import './TraceViewer.scss'

import React from 'react'

import {useDelayedState} from './hooks'
import StackTreeBuilder from './StackTreeBuilder'
import TraceRecordReader from './TraceRecordReader'
import ControlledFlameChart from './ControlledFlameChart'
import FlameChart from './FlameChart'


export default function TraceViewer({ traceFile, awaitBuildDoneBeforeRender = true })
{
  const [error, setError] = React.useState(null)
  const [traceVersion, setTraceVersion] = React.useState(null)
  const [traceFileFormat, setTraceFileFormat] = React.useState(null)
  const [traceStartDate, setTraceStartDate] = React.useState(null)
  const [traceEndDate, setTraceEndDate] = React.useState(null)
  const [traceRecordsProcessedCount, setTraceRecordsProcessedCount] = useDelayedState(0)
  const [stackTreeRootNode, setStackTreeRootNode] = useDelayedState(null)
  const [selectedNode, setSelectedNode] = React.useState(null)

  const [processingStartTime, setProcessingStartTime] = React.useState(performance.now())
  const [processingEndTime, setProcessingEndTime] = React.useState(null)
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
    stackTreeBuilder.subscribe(rootNode => setStackTreeRootNode(rootNode))
    
    setProcessingStartTime(performance.now())
    stackTreeBuilder.build()
      .then(rootNode => setStackTreeRootNode(rootNode, null, true))
      .catch(function (err) {
        if (err instanceof StackTreeBuilder.InterruptedError) {
          return
        }


        const errorMessage = 'Caught error while building stack tree:  ' + err.message
        setError(errorMessage)

        console.error(errorMessage)
        console.error(err)
      }) 
      .then(() => setProcessingEndTime(performance.now()))

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
      setProcessingStartTime(null)
      setProcessingEndTime(null)
    }
  }, [traceFile, setTraceVersion, setTraceFileFormat, setTraceStartDate, setTraceEndDate, setStackTreeRootNode, setTraceRecordsProcessedCount, setLastSecondRecordsProcessedCount])

  React.useEffect(function () {
        // I currently have no way to dynamically modify child nodes after
        // they're created, so if the root node changes, the selected child node
        // must be unselected so that it may be reselected to show updated
        // information
        if (!selectedNode) {
          return
        }

        setSelectedNode(null)
    }, [stackTreeRootNode, setSelectedNode])
  

  let processingDuration = 0
  if (processingStartTime) {
    processingDuration = (processingEndTime || performance.now()) - processingStartTime
  }

  let activeNode = null
  if (!awaitBuildDoneBeforeRender || (stackTreeRootNode && stackTreeRootNode.endTimeIndex)) {
    activeNode = selectedNode || stackTreeRootNode
  }

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

          {stackTreeRootNode && !stackTreeRootNode.endTimeIndex && (
            <React.Fragment>
              <dt>Records Processed per Second</dt>
              <dd>{lastSecondRecordsProcessedCount}</dd>

              <dt>Records Processed per Second (Average)</dt>
              <dd>{processingDuration > 0 && ((traceRecordsProcessedCount / processingDuration) * 1000)}</dd>
            </React.Fragment>
          )}
        </dl>
      </div>

      <div className="flamechart-container">
        <h1>Flame Chart</h1>

        <ControlledFlameChart 
          rootNode={activeNode} 
          onNodeClick={(e, node) => setSelectedNode(node)} />
      </div>
    </div>
  )
}