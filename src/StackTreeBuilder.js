import InterruptedError from "./InterruptedError"

export function createNode(record) {
  return {
    startTimeIndex: record.timeIndex,
    endTimeIndex: null,
    duration: 0,
    startMemoryUsage: record.memoryUsage,
    endMemoryUsage: null,
    deltaMemoryUsage: null,
    functionName: record.functionName,
    arguments: record.arguments,
    children: [],
    parent: null,
    index: -1
  }
}

export default class StackTreeBuilder {
    constructor(traceRecordReader) {
        this._traceRecordReader = traceRecordReader

        this._subscribers = new Set()
        this._nodeVisitors = new Set()

        this._rootNode = null
        this._latestNodePath = []
    }

    subscribe(callback) {
        this._subscribers.add(callback)
    }

    unsubscribe(callback) {
        this._subscribers.delete(callback)
    }

    _notifySubscribers() {
        this._subscribers.forEach(
            callback => callback(this._rootNode, this)
        )
    }

    addNodeVisitor(callback) {
        this._nodeVisitors.add(callback)
    }

    removeNodeVisitor(callback) {
        this._nodeVisitors.add(callback)
    }

    _visitNode(node, visitType) {
        this._nodeVisitors.forEach(
            callback => callback(node, visitType)
        )
    }

    async interrupt() {
        if (this._interruptPromise) {
            return this._interruptPromise
        }


        this._interrupted = true

        this._interruptPromise = new Promise(resolve => {
            this._interruptPromiseResolve = resolve
        })
        return this._interruptPromise
    }

    async build() {
        if (this._traceRecordReader.getReadStarted()) {
            this._traceRecordReader.reset()
        }

        let record = await this._traceRecordReader.next()
        if (record.type !== 'entry') {
            throw new Error('Unexpected first record type')
        }

        this._rootNode = createNode(record)
        this._visitNode(this._rootNode, 'enter')
        this._notifySubscribers()

        // eslint-disable-next-line
        while (record = await this._traceRecordReader.next()) {
            if (this._interruptPromise) {
                this._interruptPromiseResolve()

                throw new InterruptedError()
            }

            // eslint-disable-next-line
            switch (record.type) {
                case 'entry':
                    this._enterNode(record)
                    this._notifySubscribers()
                    break;

                case 'exit':
                    this._exitNode(record)
                    this._notifySubscribers()
                    break;
            }
        }

        this._notifySubscribers()

        return this._rootNode
    }

    _enterNode(record) {
        this._rootNode = {...this._rootNode}

        let node = this._rootNode
        node.duration = record.timeIndex - node.startTimeIndex
        for (const index of this._latestNodePath) {
            node.children = [...node.children]
            
            node = node.children[index]
            node.duration = record.timeIndex - node.startTimeIndex
        }

        const enteredNode = createNode(record)
        enteredNode.index = node.children.length
        this._visitNode(enteredNode, 'enter')
        
        this._latestNodePath.push(enteredNode.index)
        node.children = [...node.children, enteredNode]
    }

    _exitNode(record) {
        this._rootNode = {...this._rootNode}

        let node = this._rootNode
        node.duration = record.timeIndex - node.startTimeIndex
        for (const index of this._latestNodePath) {
            node.children = [...node.children]

            node = node.children[index]
            node.duration = record.timeIndex - node.startTimeIndex
        }

        const exitedNode = node
        exitedNode.endTimeIndex = record.timeIndex
        exitedNode.duration = exitedNode.endTimeIndex - exitedNode.startTimeIndex
        exitedNode.endMemoryUsage = record.memoryUsage
        exitedNode.deltaMemoryUsage = exitedNode.endMemoryUsage - exitedNode.startMemoryUsage
        this._visitNode(exitedNode, 'exit')

        this._latestNodePath.pop()
    }
}