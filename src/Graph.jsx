import React from 'react'

import {RecordReader} from './utils'


const levelMax = 112
const memoryMax = 90214680
let maxLevelAverage = 0
function getAverageLevel(samples) {
    let contributingSampleCount = 0
    let levelSum = 0
    for (const sample of samples) {
        if (typeof sample.level !== 'number') {
            continue;
        }

        levelSum += sample.level
        ++contributingSampleCount
    }
    return levelSum / contributingSampleCount
}

function getAverageMemoryUsage(samples) {
    let contributingSampleCount = 0
    let memorySum = 0
    for (const sample of samples) {
        if (typeof sample.memoryUsage !== 'number') {
            continue;
        }

        memorySum += sample.memoryUsage
        ++contributingSampleCount
    }
    return memorySum / contributingSampleCount
}

export default function Graph({
    traceFile,
    recordStartOffset,
    traceDuration,
    width = 480,
    height = 320
}) {
    const canvasRef = React.useRef()
    React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) {
            return
        }


        const context = canvasRef.current.getContext('2d')
        context.lineWidth = 1
        context.clearRect(0, 0, width, height)

        const recordReader = new RecordReader(traceFile, recordStartOffset)
        const pixelDuration = traceDuration / canvas.width

        let interrupted = false;
        (async () => {
            let samples = []
            let maxProfilerStackSize = 0
            let profilerStack = []

            let data = []
            let maxes = {
                level: 10,
                memoryUsage: 1000
            }

            function rerender()
            {
                context.clearRect(0, 0, canvas.width, canvas.height)
                for (let x = 0;x < data.length;++x) {
                    renderPoint(x)
                }
            }

            function renderPoint(x) {
                context.strokeStyle = 'hsla(0, 100%, 50%, 0.5)'
                context.beginPath()
                context.moveTo(x, canvas.height)
                context.lineTo(x, canvas.height * (1 - (data[x].level / maxes.level)))
                context.closePath()
                context.stroke()

                context.strokeStyle = 'hsla(210, 100%, 50%, 0.5)'
                context.beginPath()
                context.moveTo(x, canvas.height)
                context.lineTo(x, canvas.height * (1 - (data[x].memoryUsage / maxes.memoryUsage)))
                context.closePath()
                context.stroke()
            }

            while (!interrupted) {
                const record = await recordReader.next()
                if (record) {
                    if (record.functionName === 'Magento\\Framework\\Profiler::start') {
                        const incoming = record.arguments[0]
                        //console.log(`${[...Array(profilerStack.length + 1)].join('  ')}-> "${incoming}"`)

                        profilerStack.push(incoming)

                        maxProfilerStackSize = Math.max(maxProfilerStackSize, profilerStack.length)
                    } else if (record.functionName === 'Magento\\Framework\\Profiler::stop') {
                        var outgoing = profilerStack.pop()
                        //console.log(`${[...Array(profilerStack.length + 1)].join('  ')}<- "${outgoing}"`)
                    }

                    samples.push(record)
                    if (Math.floor(record.timeIndex / pixelDuration) < (data.length + 1)) {
                        continue;
                    }
                } else {
                    interrupted = true
                }


                const dataPoint = {
                    level: getAverageLevel(samples),
                    memoryUsage: getAverageMemoryUsage(samples)
                }
                data.push(dataPoint)

                let needsRerender = false
                for (const key in dataPoint) {
                    if (dataPoint[key] > maxes[key] * 0.9) {
                        needsRerender = true

                        const oldMax = maxes[key]
                        const newMax = dataPoint[key] * 1.5
                        maxes[key] = dataPoint[key] * 1.5
                    }
                }
                if (needsRerender) {
                    rerender()
                } else {
                    renderPoint(data.length - 1)
                }

                samples = [samples[samples.length - 1]]
            }
        })()

        return () => {
            interrupted = true
        }
    }, [width, height, traceFile, recordStartOffset, traceDuration, canvasRef])

    return (
        <canvas className="graph" ref={canvasRef} width={width} height={height} style={{width, height}} />
    )
}