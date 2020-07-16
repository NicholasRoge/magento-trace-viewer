import './TraceViewer.scss'

import React from 'react'

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

  const [flamechartTimeX, setFlamechartTimeX] = React.useState(0)
  const [flamechartTimeDX, setFlamechartTimeDX] = React.useState(1)
  const [flamechartFollow, setFlamechartFollow] = React.useState(false)

  const [processingStartTime] = React.useState((new Date()).getTime())
  const [lastSecondRecordsProcessedCount, setLastSecondRecordsProcessedCount] = React.useState(0)

  React.useEffect(function () {
    let traceRecordsProcessedCount = 0
    let recordProcessedTimestampQueue = []

    let interrupted = false
    const latestUpdates = {
      traceRecordsProcessedCount,
      stackTreeRootNode,
      lastSecondRecordsProcessedCount
    }
    function applyLatestUpdates() {
      setTraceRecordsProcessedCount(latestUpdates.traceRecordsProcessedCount)
      setStackTreeRootNode(latestUpdates.stackTreeRootNode)
      setLastSecondRecordsProcessedCount(latestUpdates.lastSecondRecordsProcessedCount)

      if (!interrupted) {
        requestAnimationFrame(applyLatestUpdates)
      }
    }
    requestAnimationFrame(applyLatestUpdates)

    const traceRecordReader = new TraceRecordReader(traceFile)
    traceRecordReader.addRecordProcessor(function () {
      ++traceRecordsProcessedCount
  
      const currentTime = (new Date()).getTime()
      recordProcessedTimestampQueue.push(currentTime)
      while (currentTime - recordProcessedTimestampQueue[0] > 1000) {
        recordProcessedTimestampQueue.shift()
      }
      latestUpdates.lastSecondRecordsProcessedCount = recordProcessedTimestampQueue.length

      latestUpdates.traceRecordsProcessedCount = traceRecordsProcessedCount
    })

    const stackTreeBuilder = new StackTreeBuilder(traceRecordReader)
    stackTreeBuilder.subscribe(rootNode => latestUpdates.stackTreeRootNode = rootNode)
    stackTreeBuilder.build()
      .then(rootNode => latestUpdates.stackTreeRootNode = rootNode)
      .catch(function (err) {
        if (err instanceof StackTreeBuilder.InterruptedError) {
          return
        }


        const errorMessage = 'Caught error while building stack tree:  ' + err.message
        setError(errorMessage)

        console.error(errorMessage)
        console.error(err)
      }) 
      .then(() => interrupted = true)

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

  
  let flamechartFollowTimeDX = 0
  if (flamechartFollow && stackTreeRootNode) {
    flamechartFollowTimeDX = (stackTreeRootNode.startTimeIndex + stackTreeRootNode.duration) - flamechartTimeX 
  }

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
        </dl>
      </div>

      <div className="flamechart-container">
        <h1>Flame Chart</h1>

        <div className="controls">
          <div className="control">
            <label htmlFor="flamechart-control-timex">Time X</label>
            <input 
              id="flamechart-control-timex"
              type="number" 
              step="0.1"
              value={flamechartTimeX} 
              onChange={e => setFlamechartTimeX(Math.max(0, e.target.value))} />
          </div>

          {!flamechartFollow && (
            <div className="control">
              <label htmlFor="flamechart-control-timedx">Time ΔX</label>
              <input 
                id="flamechart-control-timedx"
                type="number" 
                step="0.1"
                value={flamechartTimeDX} 
                onChange={e => setFlamechartTimeDX(Math.max(flamechartTimeX, e.target.value))} />
            </div>
          )}

          <div className="control">
            <label htmlFor="flamechart-control-follow">Follow</label>
            <input 
              id="flamechart-control-follow"
              type="checkbox" 
              value={flamechartFollow} 
              onChange={e => setFlamechartFollow(e.target.checked)} />
          </div>
        </div>

        <FlameChart 
          rootNode={stackTreeRootNode} 
          timeX={flamechartTimeX}
          timeDX={flamechartFollow ? flamechartFollowTimeDX : flamechartTimeDX} />
      </div>
    </div>
  )
}