import {fetchRange, sleep} from './utils'


export function parseRecordLine(line) {
  const fields = line.split("\t")
  if (fields.length === 1) {
    if (line.slice(0, 'TRACE START '.length) === 'TRACE START ') {
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

export default class TraceRecordReader {
  constructor (traceFile, chunkSize = 1024 * 1024 * 50) {
    this._traceFile = traceFile
    this._chunkSize = chunkSize

    this.reset()
  }

  reset() {
    if (this._metaTraceStartPromiseReject) {
        this._metaTraceStartPromiseReject()
    }
    if (this._metaTraceEndPromiseReject) {
        this._metaTraceEndPromiseReject()
    }

    this._currentOffset = 0
    this._linePartial = ''
    this._unprocessedLines = []
    this._metaData = null
    this._lastProcessorYieldTime = performance.now()

    this._readNextLinesPromise = null
    this._readMetaDataPromise = null
    this._metaTraceStartPromise = null
    this._metaTraceStartPromiseResolve = null
    this._metaTraceStartPromiseReject = null
    this._metaTraceEndPromise = null
    this._metaTraceEndPromiseResolve = null
    this._metaTraceEndPromiseReject = null

    this._recordProcessors = []
  }

  addRecordProcessor(callback) {
      this._recordProcessors.push(callback)
  }

  getReadStarted() {
      return this._currentOffset !== 0
  }

  async getFileSize() {
    if (!this._traceFileSize) {
      await this._readNextLines()
    }

    return this._traceFileSize
  }

  async getVersion() {
    await this._readMetaData()

    return this._metaData.version
  }

  async getFileFormat() {
    await this._readMetaData()
    
    return this._metaData.fileFormat
  }

  async getTraceStart() {
    if (this._metaData && this._metaData.traceStart) {
        return this._metaData.traceStart
    } else if (this._metaTraceStartPromise) {
        return this._metaTraceStartPromise
    }


    this._metaTraceStartPromise = new Promise((resolve, reject) => {
        this._metaTraceStartPromiseReject = reject
        this._metaTraceStartPromiseResolve = value => {
            this._metaData.traceStart = value

            this._metaTraceStartPromise = null
            this._metaTraceStartPromiseResolve = null
            this._metaTraceStartPromiseReject = null

            resolve(value)
        }
    })
    return this._metaTraceStartPromise
  }

  async getTraceEnd() {
    if (this._metaData && this._metaData.traceEnd) {
        return this._metaData.traceEnd
    } else if (this._metaTraceEndPromise) {
        return this._metaTraceEndPromise
    }


    this._metaTraceEndPromise = new Promise((resolve, reject) => {
        this._metaTraceEndPromiseReject = reject
        this._metaTraceEndPromiseResolve = value => {
            this._metaData.traceEnd = value

            this._metaTraceEndPromise = null
            this._metaTraceEndPromiseResolve = null
            this._metaTraceEndPromiseReject = null

            resolve(value)
        }
    })
    return this._metaTraceEndPromise
  }

  async next() {
    await this._readMetaData()
    while (this._unprocessedLines.length === 0) {
      if (this._isEndOfFileReached()) {
        return null;
      }


      await this._readNextLines()
    }

    let record
    do {
        const recordLine = this._unprocessedLines.shift()
        record = parseRecordLine(recordLine)
        
        record = this._processRecord(record)
    } while (record.type === 'meta' && this._unprocessedLines.length > 0)

    const currentTime = performance.now()
    if (currentTime - this._lastProcessorYieldTime >= 10) {
      this._lastProcessorYieldTime = currentTime

      await sleep()
    }

    return record
  }

  [Symbol.asyncIterator]() {
    return {
      next: async () => {
        let record = await this.next()
        if (record === null) {
          return {
            done: true
          }
        }


        return {
          value: record,
          done: false
        }
      }
    }
  }

  _isEndOfFileReached() {
    return this._traceFileSize && this._currentOffset >= this._traceFileSize
  }

  async _readNextLines() {
    if (this._readNextLinesPromise) {
      return this._readNextLinesPromise
    }


    if (this._isEndOfFileReached()) {
      return
    }


    this._readNextLinesPromise = new Promise(async resolve => {
      let chunkEndOffset = (this._currentOffset + this._chunkSize) - 1
      if (this._traceFileSize) {
        chunkEndOffset = Math.min(this._traceFileSize - 1, chunkEndOffset)
      }
      const response = await fetchRange(this._traceFile, [
        this._currentOffset, 
        chunkEndOffset
      ])

      const contentRangeHeader = response.headers.get('Content-Range')
      const [, traceFileSize] = contentRangeHeader.split('/')
      this._traceFileSize = traceFileSize

      this._linePartial += await response.text()
      this._currentOffset = chunkEndOffset + 1

      this._unprocessedLines = this._unprocessedLines.concat(this._linePartial.split("\n"))
      this._linePartial = this._unprocessedLines.pop()

      this._readNextLinesPromise = null
      resolve()
    })
    return this._readNextLinesPromise
  }

  async _readMetaData() {
    if (this._metaData) {
      return this._metaData
    } else if (this._readMetaDataPromise) {
      return this._readMetaDataPromise
    }


    this._readMetaDataPromise = new Promise(async resolve => {
      while (this._unprocessedLines.length < 2) {
        await this._readNextLines()
      }

      const versionLine = this._unprocessedLines.shift()
      const [versionHeaderName, version] = versionLine.split(': ')
      if (versionHeaderName !== 'Version') {
        throw new Error('Invalid file format')
      }

      const fileFormatLine = this._unprocessedLines.shift()
      const [fileFormatHeaderName, fileFormat] = fileFormatLine.split(': ')
      if (fileFormatHeaderName !== 'File format') {
        throw new Error('Invalid file format')
      } else if (fileFormat !== '4') {
        throw new Error('Unexpected file format')
      }

      this._metaData = {
        version,
        fileFormat,
        traceStart: null,
        traceEnd: null
      }

      resolve()
    })
    return this._readMetaDataPromise
  }

  _processRecord(record) {
    if (record.type === 'meta') {
      // eslint-disable-next-line
      switch (record.name) {
        case 'traceStart':
          if (this._metaTraceStartPromiseResolve) {
            this._metaTraceStartPromiseResolve(record.value)
          } else {
            this._metaData.traceStart = record.value
          }
          break;

        case 'traceEnd':
          if (this._metaTraceEndPromiseResolve) {
            this._metaTraceEndPromiseResolve(record.value)
          } else {
            this._metaData.traceEnd = record.value
          }
          break;
      }
    }

    for (const recordProcessor of this._recordProcessors) {
        const result = recordProcessor(record)
        if (result) {
            record = result
        }
    }

    return record
  }
}