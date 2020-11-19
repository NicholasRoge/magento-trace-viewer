#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { pipeline, Transform, Writable } = require('stream')
const jsonWrite = require("json-write")

function parseRecordLine(line) {
  const fields = line.split("\t")
  if (fields.length === 1) {
    if (line.slice(0, 'Version:'.length) === 'Version:') {
        return {
            type: 'meta',
            name: 'version',
            value: line.slice('Version: '.length)
        }

    } else if (line.slice(0, 'File format:'.length) === 'File format:') {
        return {
            type: 'meta',
            name: 'fileFormat',
            value: line.slice('File format: '.length)
        }
    } else if (line.slice(0, 'TRACE START '.length) === 'TRACE START ') {
        return {
            type: 'meta',
            name: 'traceStart',
            value: line.slice('TRACE START ['.length, -']'.length)
        }
    } else if (line.slice(0, 'TRACE END '.length) === 'TRACE END ') {
        return {
            type: 'meta',
            name: 'traceEnd',
            value: line.slice('TRACE END   ['.length, -']'.length)
        }
    } else if (line.trim().length === 0) {
        return {
            type: 'meta',
            name: 'emptyLine',
            value: null
        }
    } else {
        throw new Error(`Unrecognized record type.  Record:  "${line}"`)
    }
  }

  
  const record = {
    level: parseInt(fields[0]),
    functionNumber: parseInt(fields[1])
  }
  switch (fields[2]) {
    case '0': 
      record.type = 'entry'; 
      record.timeIndex = parseFloat(fields[3])
      record.memoryUsage = parseInt(fields[4])
      record.functionName = fields[5]
      record.userDefined = fields[6] === '1'
      record.includeFile = fields[7]
      record.file = fields[8]
      record.line = fields[9]
      record.arguments = fields.slice(10)
      break;
    
      case '1': 
      record.type = 'exit'; 
      record.timeIndex = parseFloat(fields[3])
      record.memoryUsage = parseInt(fields[4])
      break;

    case 'R': 
      record.type = 'return'; 
      record.returnValue = fields[5]
      break;

    case '':
      record.type = 'end'
      record.timeIndex = parseFloat(fields[3])
      record.memoryUsage = parseInt(fields[4])
      break;

    default: 
      throw new Error(`Unrecognized record type.  Record:  "${line}"`)
  }

  return record
}

class TraceRecordTransform extends Transform {
    constructor(options = {}) {
        super({
            ...options,
            decodeStrings: false,
            readableObjectMode: true
        })

        this.linePartial = ''
    }

    _transform(chunk, encoding, callback) {
        const lines = (this.linePartial + chunk).split("\n")
        this.linePartial = lines.pop()

        callback(null, lines.map(parseRecordLine))
    }
}


function createNode(record) {
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
    index: -1,
    level: record.level
  }
}

const CHUNK_MAX_SIZE = 1024 * 1024 * 10; // 10mB
const CHUNK_MAX_CHILDREN = 10000;
class TraceTreeWriter extends Writable {
    constructor(outputPathPrefix, options = {}) {
        super({
            ...options,
            objectMode: true
        });

        this._outputPathPrefix = outputPathPrefix;
        
        this._rootNode = null;
        this._latestNodePath = [];     
        this._nextChunkId = 1;

        this._nodeSizeCache = new WeakMap()
    }

    async _write(chunk, encoding, callback) {
        const foo = 'bar';
        for (const record of chunk) {
            if (record.type === 'meta') {
                continue;
            }

            if (!this._rootNode) {
                if (record.type !== 'entry') {
                    throw new Error('Unexpected first record type.');
                }

                
                this._rootNode = createNode(record);
            } else {
                switch (record.type) {
                    case 'entry':
                        await this._enterNode(record);
                        break;

                    case 'exit':
                        await this._exitNode(record);
                        break;
                }
            }
        }

        callback();
    }

    _final(callback) {
        if (!this._rootNode) {
            callback();

            return;
        }


        fs.writeFileSync(
            this._outputPathPrefix + '.json',
            JSON.stringify(this._rootNode)
        );

        callback();
    }

    async _enterNode(record) {
        let node = this._rootNode
        node.duration = record.timeIndex - node.startTimeIndex
        for (const index of this._latestNodePath) {
            node = node.children[index]
            node.duration = record.timeIndex - node.startTimeIndex
        }

        const enteredNode = createNode(record)
        enteredNode.index = node.children.length
        
        this._latestNodePath.push(enteredNode.index)
        node.children.push(enteredNode)
    }

    async _exitNode(record) {
        let node = this._rootNode
        node.duration = record.timeIndex - node.startTimeIndex
        for (const index of this._latestNodePath) {
            node = node.children[index]
            node.duration = record.timeIndex - node.startTimeIndex
        }

        const exitedNode = node 
        exitedNode.endTimeIndex = record.timeIndex
        exitedNode.duration = exitedNode.endTimeIndex - exitedNode.startTimeIndex
        exitedNode.endMemoryUsage = record.memoryUsage
        exitedNode.deltaMemoryUsage = exitedNode.endMemoryUsage - exitedNode.startMemoryUsage

        this._latestNodePath.pop()

        const nodeSize = this._computeNodeSize(exitedNode)
        if (nodeSize > CHUNK_MAX_SIZE) {
            this._writeChildChunks(exitedNode)
            this._computeNodeSize(exitedNode, false)
        }
    }

    _computeNodeSize(node, useCacheForRoot = true) {
        if (useCacheForRoot && this._nodeSizeCache.has(node)) {
            return this._nodeSizeCache.get(node)
        }

        let size = '{}'.length;
        for (const key in node) {
            if (key === 'children') {
                size += key.length + '"":'.length;
                size += '[]'.length 
                size += (node[key].length - 1)
                size += ','.length
                for (const child of node[key]) {
                    if (typeof child === 'string') {
                        size += this._getValueSize(child)
                    } else {
                        size += this._computeNodeSize(child)
                    }
                }
            } else {
                let valueSize = this._getValueSize(node[key])
                if (valueSize > 0) {
                    size += key.length + '"":'.length + valueSize;
                    size += ','.length
                }
            }
        }
        size -= ','.length

        this._nodeSizeCache.set(node, size)
        return size
    }

    _getValueSize(value) {
        if (value === null) {
            return 'null'.length
        } else if (Array.isArray(value)) {
            let size = '[]'.length
            if (value.length > 0) {
                size += value.length - 1 // Field separators (,)
            }
            for (const subValue of value) {
                size += this._getValueSize(subValue)
            }
            return size
        } else if (typeof value === 'object') {
            let needsMinusOne = false
            let size = '{}'.length
            for (const key in value) {
                let valueSize = this._getValueSize(value)
                if (valueSize > 0) {
                    size += key.length + '"":'.length + valueSize + ','.length
                    needsMinusOne = true
                }
            }
            if (needsMinusOne) {
                size -= ','.length
            }
            return size
        } else if (typeof value === 'string') {
            return JSON.stringify(value).length
        } else if (typeof value === 'number') {
            return value.toString().length
        } else if (typeof value === 'boolean') {
            if (value) {
                return 'true'.length
            } else {
                return 'false'.length
            }
        } else {
            return 0
        }
    }

    _writeChildChunks(node) {
        const childNodes = node.children
        const childChunks = []
        while (childNodes.length > 0) {
            let i = 0
            let currentSize = 0
            while (i < childNodes.length && currentSize < CHUNK_MAX_SIZE) {
                currentSize += this._computeNodeSize(childNodes[i])
                ++i
            }
            if (i !== 1 || i < childNodes.length) {
                --i
            }
            
            const chunkData = JSON.stringify(childNodes.splice(0, i))
            const chunkId = this._writeChunk(chunkData)
            childChunks.push('http://racksolutions.ifi/media/trace/get-grouped-options-combinations.2583.1/' + chunkId + '.json')
        }
        node.chunkedChildren = true
        node.children = childChunks
    }

    _writeChunk(chunkData) {
        if (!fs.existsSync(this._outputPathPrefix)) {
            fs.mkdirSync(this._outputPathPrefix);
        }

        fs.writeFileSync(path.join(this._outputPathPrefix, this._nextChunkId + ".json"), chunkData);

        ++this._nextChunkId;

        return this._nextChunkId - 1;
    }

    _updateChildAsChunk(chunkUrl) {
        let chunkedChildParentNode = this._rootNode

        const chunkedChildParentPath = [...this._latestNodePath]
        const chunkedChildIndex = chunkedChildParentPath.pop()
        for (const index of chunkedChildParentPath) {
            chunkedChildParentNode = chunkedChildParentNode.children[index]
        }
        chunkedChildParentNode[chunkedChildIndex] = chunkUrl
    }
}


const traceFilePath = process.argv[2];
const outputDir = './';

pipeline(
    fs.createReadStream(traceFilePath),
    new TraceRecordTransform(),
    new TraceTreeWriter('./get-grouped-options-combinations.2583.1'),
    function (err) {
        console.error(err);
    }
)