import React from 'react'

import InterruptedError from './InterruptedError'
import StackTreeBuilder from './StackTreeBuilder'
import TraceRecordReader from './TraceRecordReader'
import FlameChart from './FlameChart'

export default function TraceViewer({ traceFile })
{
  const [error, setError] = React.useState(null)
  const [traceVersion, setTraceVersion] = React.useState(null)
  const [traceFileFormat, setTraceFileFormat] = React.useState(null)
  const [traceStartDate, setTraceStartDate] = React.useState(null)
  const [traceEndDate, setTraceEndDate] = React.useState(null)
  const [traceRecordsProcessedCount, setTraceRecordsProcessedCount] = React.useState(0)
  const [stackTreeRootNode, setStackTreeRootNode] = React.useState(null)

  React.useEffect(function () {
    let lastUpdateTimeIndex = -Infinity
    let traceRecordsProcessedCount = 0

    const traceRecordReader = new TraceRecordReader(traceFile)
    traceRecordReader.addRecordProcessor(function () {
      ++traceRecordsProcessedCount

      setTraceRecordsProcessedCount(traceRecordsProcessedCount)
    })

    const stackTreeBuilder = new StackTreeBuilder(traceRecordReader)
    stackTreeBuilder.subscribe(function (rootNode) {
      if (rootNode.duration - lastUpdateTimeIndex < 0.1) {
        return
      }


      lastUpdateTimeIndex = rootNode.duration

      setStackTreeRootNode(rootNode)

      if (rootNode.duration > 1) {
        stackTreeBuilder.interrupt()
      }
    })
    stackTreeBuilder.build()
      .then(setStackTreeRootNode)
      .catch(function (err) {
        if (err instanceof InterruptedError) {
          return
        }


        const errorMessage = 'Caught error while building stack tree:  ' + err.message
        setError(errorMessage)

        console.error(errorMessage)
        console.error(err)
      }) 

    traceRecordReader.getVersion().then(setTraceVersion)
    traceRecordReader.getFileFormat().then(setTraceFileFormat)
    traceRecordReader.getTraceStart().then(setTraceStartDate)
    traceRecordReader.getTraceEnd().then(setTraceEndDate)

    return function () {
      stackTreeBuilder.interrupt().then(function () {
        traceRecordReader.reset()
      })

      setTraceVersion(null)
      setTraceFileFormat(null)
      setTraceStartDate(null)
      setTraceEndDate(null)
      setStackTreeRootNode(null)
    }
  }, [traceFile])

  return (
    <div className="trace-viewer">
        {error && (
          <div className="error-message">{error}</div>
        )}

      <div className="metainfo-container">
        <h1>Meta Info</h1>

        <dl>
          <dt>Version</dt>
          <dd>{traceVersion}</dd>

          <dt>File Format</dt>
          <dd>{traceFileFormat}</dd>

          <dt>Trace Start Date</dt>
          <dd>{traceStartDate && new Date(traceStartDate).toUTCString()}</dd>

          <dt>Trace End Date</dt>
          <dd>{traceEndDate && new Date(traceEndDate).toUTCString()}</dd>

          <dt>Records Processed</dt>
          <dd>{traceRecordsProcessedCount}</dd>
        </dl>
      </div>

      <div className="flamechart-container">
        <h1>Flame Chart</h1>
        <FlameChart rootNode={stackTreeRootNode} width={1000} timeDX={1} />
      </div>
    </div>
  )
}