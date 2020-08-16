import {shuffleArray} from './utils'

export class InterruptedError extends Error {
}

const storedNamespaceIndexByName = JSON.parse(localStorage.namespaceIndexByName || '{}')
const storedNamespaceIndexNames = Object.values(storedNamespaceIndexByName)

const availableNamespaceIndices = Object.keys([...new Array(30)])
    .map(index => index * 10)
    .filter(index => storedNamespaceIndexNames.indexOf(index) === -1)
shuffleArray(availableNamespaceIndices)

const namespaceIndexByName = new Map()
Object.entries(storedNamespaceIndexByName).forEach(([namespaceName, index]) => namespaceIndexByName.set(namespaceName, index))
export function createNode(record) {
  const classes = []

  const namespaceName = record.functionName.split('\\').shift()
  if (namespaceName !== record.functionName) {
    if (namespaceName === 'Magento') {
        classes.push('-namespace-magento')
    } else {
        if (!namespaceIndexByName.has(namespaceName)) {
            if (availableNamespaceIndices.length > 0) {
                namespaceIndexByName.set(namespaceName, availableNamespaceIndices.pop())
            } else {
                namespaceIndexByName.set(namespaceName, Math.floor(Math.random() * 300))
            }
            localStorage.namespaceIndexByName = JSON.stringify(Object.fromEntries(namespaceIndexByName.entries()))
        }
        classes.push('-namespace-' + namespaceIndexByName.get(namespaceName))
    }
  }

  const className = record.functionName.split(/::|->/).shift()
  if (className !== record.functionName) {
      if (className === 'Magento\\Framework\\Interception\\PluginList\\PluginList') {
          classes.push('-plugin-list-call')
      }
  }

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
    index: -1,
    level: record.level,
    classes
  }
}

export default class StackTreeBuilder {
    static InterruptedError = InterruptedError

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
        //this._rootNode = {...this._rootNode}

        let node = this._rootNode
        node.duration = record.timeIndex - node.startTimeIndex
        for (const index of this._latestNodePath) {
            //node.children = [...node.children]
            
            node = node.children[index]
            node.duration = record.timeIndex - node.startTimeIndex
        }

        const enteredNode = createNode(record)
        enteredNode.index = node.children.length
        this._visitNode(enteredNode, 'enter')
        
        this._latestNodePath.push(enteredNode.index)
        node.children.push(enteredNode)// = [...node.children, enteredNode]
    }

    _exitNode(record) {
        //this._rootNode = {...this._rootNode}

        let node = this._rootNode
        node.duration = record.timeIndex - node.startTimeIndex
        for (const index of this._latestNodePath) {
            //node.children = [...node.children]

            node = node.children[index]
            node.duration = record.timeIndex - node.startTimeIndex
        }

        const exitedNode = node //{...node}
        exitedNode.endTimeIndex = record.timeIndex
        exitedNode.duration = exitedNode.endTimeIndex - exitedNode.startTimeIndex
        exitedNode.endMemoryUsage = record.memoryUsage
        exitedNode.deltaMemoryUsage = exitedNode.endMemoryUsage - exitedNode.startMemoryUsage
        this._visitNode(exitedNode, 'exit')

        this._latestNodePath.pop()
    }
}