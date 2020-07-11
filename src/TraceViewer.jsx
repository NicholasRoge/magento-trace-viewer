import React from 'react'

import {fetchBasicTraceInfo, RecordReader} from './utils'
import Graph from './Graph'
import StackInfo from './Stack/Info'


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
    parent: null,
    index: -1
  }
}

function enterChild(node, stackRoot, stackPath) {
  const updatedStackRoot = {...stackRoot}
  
  let enteredNode = updatedStackRoot
  enteredNode.duration = node.startTimeIndex - enteredNode.startTimeIndex
  enteredNode.children = [...enteredNode.children]
  for (const index of stackPath) {
    const nextEnteredNode = {
      ...enteredNode.children[index]
    }
    nextEnteredNode.parent = enteredNode
    nextEnteredNode.duration = node.startTimeIndex - nextEnteredNode.startTimeIndex
    nextEnteredNode.children = [...nextEnteredNode.children]

    enteredNode.children[index] = nextEnteredNode
    enteredNode = nextEnteredNode
  }

  node.index = enteredNode.children.length
  stackPath.push(node.index)

  enteredNode.children.push(node)

  return updatedStackRoot
}

function exitChild(exitRecord, stackRoot, stackPath) {
  const updatedStackRoot = {...stackRoot};

  let exitedNode = updatedStackRoot
  exitedNode.duration = exitRecord.timeIndex - exitedNode.startTimeIndex
  exitedNode.children = [...exitedNode.children]
  for (const index of stackPath) {
    const nextExitedNode = {
      ...exitedNode.children[index]
    }
    nextExitedNode.parent = exitedNode
    nextExitedNode.duration = exitRecord.timeIndex - nextExitedNode.startTimeIndex
    nextExitedNode.children = [...nextExitedNode.children]

    exitedNode.children[index] = nextExitedNode
    exitedNode = nextExitedNode
  }

  stackPath.pop()
  exitedNode.endTimeIndex = exitRecord.timeIndex
  exitedNode.duration = exitRecord.timeIndex - exitedNode.startTimeIndex
  exitedNode.deltaMemoryUsage = exitRecord.memoryUsage - exitedNode.startMemoryUsage

  return updatedStackRoot
}

export default function TraceViewer({ traceFile })
{
  const [basicInfo, setBasicInfo] = React.useState(null)
  React.useEffect(function () {
    fetchBasicTraceInfo(traceFile).then(setBasicInfo)
  }, [traceFile])

  const [stackRoot, setStackRoot] = React.useState()
  React.useEffect(function () {
    let interrupted = false;

    let renders = 0
    let renderStartTime = (new Date()).getTime();

    (async function () {
      const recordReader = new RecordReader(traceFile);

      let record = await recordReader.next()
      if (record.type !== 'entry') {
        throw new Error('Unexpected first record type.')
      }
      let stackRoot = createNode(record)
      stackRoot.path = 'root'
      setStackRoot(stackRoot)

      let nextNotifyTime = 0.000001
      const stackPath = []
      while (record = await recordReader.next()) {
        switch (record.type) {
          case 'entry':
            stackRoot = enterChild(createNode(record), stackRoot, stackPath)
            break

          case 'exit':
            stackRoot = exitChild(record, stackRoot, stackPath)
            break
        }

        const currentTime = (new Date()).getTime()
        if ((currentTime - renderStartTime) / 1000 > renders) {
          console.log("Rendering", renders, currentTime - renderStartTime)
          setStackRoot(stackRoot)
          ++renders
        }
      }

      setStackRoot(stackRoot)
    })()

    return function () {
      interrupted = true
    }
  }, [traceFile])

  return (
    <div className="trace-viewer">
        <div className="basic-info">
            {!basicInfo ? 'loading basic info' : (
                <dl>
                    <dt>Version</dt>
                    <dd>{basicInfo.version}</dd>

                    <dt>File Format</dt>
                    <dd>{basicInfo.fileFormat}</dd>

                    <dt>Trace Start Time</dt>
                    <dd>{new Date(basicInfo.traceStartTime).toUTCString()}</dd>

                    <dt>Trace End Time</dt>
                    <dd>{basicInfo.traceEndTime ? new Date(basicInfo.traceEndTime).toUTCString() : '<ongoing>'}</dd>

                    <dt>Trace Duration</dt>
                    <dd>{basicInfo.traceDuration ? basicInfo.traceDuration : '<ongoing>'}s</dd>
                </dl>
            )}
        </div>

        <StackInfo stackRoot={stackRoot} />
    </div>
  )
}