const chunkSize = 1024

export function parseRecord(line)
{
  const fields = line.split("\t")
  
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
      record.type = '?unknown?'
      record.timeIndex = parseFloat(fields[3])
      record.memoryUsage = parseInt(fields[4])
      break;

    default: 
      throw new Error('Unrecognized record type')
  }

  return record
}

export async function fetchHead(url)
{
  return fetch(url, {
    method: 'HEAD'
  })
}

export async function fetchRange(url, ...ranges)
{
  return fetch(url, {
    method: 'GET',
    headers: new Headers({
      'Range': 'bytes=' + ranges
        .map(range => range[0] + '-' + range[1])
        .join(', ')
    })
  })
}

export async function fetchLines(url, count = 1, fromEnd = false, contentLength = -1) {
  if (fromEnd && contentLength === -1) {
    const headResponse = await fetchHead(url)
    contentLength = headResponse.headers.get('Content-Length')
  }

  let nextRangeOffset
  if (fromEnd) {
    nextRangeOffset = contentLength - chunkSize
  } else {
    nextRangeOffset = 0
  }

  const lines = ['']
  do {
    const response = await fetchRange(url, [nextRangeOffset, nextRangeOffset + chunkSize])
    const responseText = await response.text()

    if (fromEnd) {
      nextRangeOffset -= chunkSize + 1

      const partialLine = responseText + lines.shift()
      lines.unshift(...partialLine.split("\n"))
    } else {
      nextRangeOffset += chunkSize + 1

      const partialLine = lines.pop() + responseText
      lines.push(...partialLine.split("\n"))
    }
  } while (lines.length <= count)

  if (fromEnd) {
    return lines.slice(-count)
  } else {
    return lines.slice(0, count)
  }
}

export async function fetchBasicTraceInfo(traceFile)
{
  const info = {
      file: traceFile
  }

  const headResponse = await fetchHead(traceFile)
  info.size = parseInt(headResponse.headers.get('Content-Length'))

  const headerInfoLines = await fetchLines(traceFile, 3)
  let [, version] = headerInfoLines[0].split(': ')
  let [, fileFormat] = headerInfoLines[1].split(': ')
  let traceStartTime = headerInfoLines[2].slice('TRACE START ['.length, -']'.length)
  info.version = version
  info.fileFormat = parseInt(fileFormat)
  info.traceStartTime = (new Date(traceStartTime)).getTime()
  info.recordStartOffset = headerInfoLines.join("\n").length + 1

  const endLines = await fetchLines(traceFile, 4, true, info.size)
  if (!/^TRACE END /.test(endLines[1])) {
    info.traceDuration = null
    info.traceEndTime = null
  } else {
    let traceDuration = parseRecord(endLines[0]).timeIndex
    let traceEndTime = endLines[1].slice('TRACE END   ['.length, -']'.length)
    info.traceDuration = traceDuration
    info.traceEndTime = (new Date(traceEndTime)).getTime()
  }

  return info
}

export class RecordReader {
  static chunkSize = 1024 * 1024

  static headerLineCount = 3

  constructor(traceFile, recordStartOffset)
  {
    this.traceFile = traceFile
    this.currentOffset = 0

    this.recordBuffer = []
    this.linePartial = ''
  }

  async next() {
    if (this.recordBuffer.length !== 0) {
      return this.recordBuffer.shift()
    }


    while (this.recordBuffer.length < 10000) {
      const response = await fetchRange(this.traceFile, [this.currentOffset, this.currentOffset + (RecordReader.chunkSize - 1)])
      this.linePartial += await response.text()

      const lines = this.linePartial.split("\n")
      if (this.currentOffset === 0) {
        lines.splice(0, RecordReader.headerLineCount)
      }
      this.linePartial = lines.pop()

      for (const line of lines) {
        const record = parseRecord(line)
        this.recordBuffer.push(record)
      }

      this.currentOffset += RecordReader.chunkSize
    }

    return this.recordBuffer.shift()
  }
}