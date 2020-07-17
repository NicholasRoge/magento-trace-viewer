import './TraceViewer.scss'

import React from 'react'

import {useDelayedState} from './hooks'
import StackTreeBuilder from './StackTreeBuilder'
import TraceRecordReader from './TraceRecordReader'
import ControlledFlameChart from './ControlledFlameChart'


export default function TraceViewer({ traceFile })
{
  const [error, setError] = React.useState(null)
  const [traceVersion, setTraceVersion] = React.useState(null)
  const [traceFileFormat, setTraceFileFormat] = React.useState(null)
  const [traceStartDate, setTraceStartDate] = React.useState(null)
  const [traceEndDate, setTraceEndDate] = React.useState(null)
  const [traceRecordsProcessedCount, setTraceRecordsProcessedCount] = useDelayedState(0)
  const [stackTreeRootNode, setStackTreeRootNode] = useDelayedState(null)

  const [processingStartTime] = useDelayedState((new Date()).getTime())
  const [lastSecondRecordsProcessedCount, setLastSecondRecordsProcessedCount] = useDelayedState(0)

  React.useEffect(function () {
    let traceRecordsProcessedCount = 0
    let recordProcessedTimestampQueue = []

    const traceRecordReader = new TraceRecordReader(traceFile)
    traceRecordReader.addRecordProcessor(function () {
      ++traceRecordsProcessedCount
      setTraceRecordsProcessedCount(traceRecordsProcessedCount)
  
      const currentTime = (new Date()).getTime()
      recordProcessedTimestampQueue.push(currentTime)
      while (currentTime - recordProcessedTimestampQueue[0] > 1000) {
        recordProcessedTimestampQueue.shift()
      }
      setLastSecondRecordsProcessedCount(recordProcessedTimestampQueue.length)
    })

    const stackTreeBuilder = new StackTreeBuilder(traceRecordReader)
    stackTreeBuilder.build()
      .then(setStackTreeRootNode)
      .catch(function (err) {
        if (err instanceof StackTreeBuilder.InterruptedError) {
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
  }, [traceFile, setTraceVersion, setTraceFileFormat, setTraceStartDate, setTraceEndDate, setStackTreeRootNode, setTraceRecordsProcessedCount, setLastSecondRecordsProcessedCount])

  

  const currentTime = (new Date()).getTime()
  const processingDuration = currentTime - processingStartTime

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

          <dt>Processing Duration (s)</dt>
          <dd>{processingDuration / 1000}</dd>

          <dt>Records Processed per Second</dt>
          <dd>{lastSecondRecordsProcessedCount}</dd>

          <dt>Records Processed per Second (Average)</dt>
          <dd>{processingDuration > 0 && ((traceRecordsProcessedCount / processingDuration) * 1000)}</dd>

          <dt>Root Start Time Index</dt>
          <dd>{stackTreeRootNode && stackTreeRootNode.startTimeIndex}</dd>

          <dt>Root Duration</dt>
          <dd>{stackTreeRootNode && stackTreeRootNode.duration}</dd>
        </dl>
      </div>

      <div className="flamechart-container">
        <h1>Flame Chart</h1>

        <ControlledFlameChart rootNode={stackTreeRootNode} />
      </div>
    </div>
  )
}