import React from 'react'

import {useDelayedState} from './hooks'
import FlameChart from './FlameChart'


function keepValueBetween(value, from, to) {
    return Math.max(from, Math.min(value, to))
}

export default function ControlledFlameChart({rootNode, onNodeClick})
{
    const [timeX, setTimeX] = useDelayedState(0)
    const [timeDX, setTimeDX] = useDelayedState(1)
    const [follow, setFollow] = useDelayedState(true)

    if (!rootNode) {
        return null
    }


    let computedTimeX = follow ? rootNode.startTimeIndex : timeX
    let computedTimeDX = follow ? rootNode.duration: timeDX

    function handleWheel(e) {
        if (e.deltaY === 0) {
            return;
        }

        
        if (e.altKey) {
            handleWheelZoom(e)
        } else if (e.shiftKey) {
            handleWheelPanHorizontal(e)
        }
    }

    function handleWheelZoom(e) {
        e.preventDefault()

        const magnitude = Math.abs(e.deltaMode === 0 ? e.deltaY / 100 : e.deltaY)
        if (e.deltaY > 0) {
            zoomOut(e.currentTarget, e.clientX, magnitude)
        } else {
            zoomIn(e.currentTarget, e.clientX, magnitude)
        }
    }

    function handleWheelPanHorizontal(e) {
        e.preventDefault()
        
        if (follow) {
            return
        }


        let scrollTime = (e.deltaY / e.currentTarget.clientWidth) * computedTimeDX
        if (e.deltaMode === 1) {
            scrollTime *= 50
        } else if (e.deltaMode === 2) {
            scrollTime = e.deltaY * computedTimeDX
        }

        const newTimeX = keepValueBetween(
            computedTimeX + scrollTime, 
            rootNode.startTimeIndex,
            rootNode.startTimeIndex + (rootNode.duration - computedTimeDX)
        )
        setTimeX(newTimeX)
    }


    function zoomOut(el, clientX, magnitude = 1) {
        const newTimeDX = computedTimeDX * (1 + (0.1 * magnitude))
        if (newTimeDX >= rootNode.duration) {
            setFollow(true)
        } else {
            const newTimeX = keepValueBetween(
                computedTimeX - (clientX / el.clientWidth) * (newTimeDX - computedTimeDX),
                rootNode.startTimeIndex,
                rootNode.startTimeIndex + (rootNode.duration - newTimeDX)
            )

            setFollow(false)
            setTimeDX(newTimeDX)
            setTimeX(newTimeX)
        }
    }

    function zoomIn(el, clientX, magnitude = 1) {
        const newTimeDX = computedTimeDX * (1 - (0.1 * magnitude))
        const newTimeX = keepValueBetween(
            computedTimeX + (clientX / el.clientWidth) * (computedTimeDX - newTimeDX),
            rootNode.startTimeIndex,
            rootNode.startTimeIndex + (rootNode.duration - newTimeDX)
        )

        setFollow(false)
        setTimeX(newTimeX)
        setTimeDX(newTimeDX)
    }

    return (
        <React.Fragment>
            <div className="controls">
                <div className="control">
                    <label htmlFor="flamechart-control-timex">Time X</label>
                    <input 
                        id="flamechart-control-timex"
                        type="number" 
                        step={computedTimeDX / 10}
                        value={computedTimeX} 
                        onChange={e => {
                            setFollow(false)
                            setTimeX(Math.max(0, e.target.value))
                        }} />
                </div>

                <div className="control">
                    <label htmlFor="flamechart-control-timedx">Time ΔX</label>
                    <input 
                        id="flamechart-control-timedx"
                        type="number" 
                        step="0.1"
                        min={computedTimeX}
                        value={computedTimeDX} 
                        onChange={e => {
                            if (follow) {
                                return
                            }


                            setFollow(false)
                            setTimeDX(Math.max(computedTimeX, e.target.value))
                        }} />
                </div>

                <div className="control">
                    <label htmlFor="flamechart-control-follow">Follow</label>
                    <input 
                        id="flamechart-control-follow"
                        type="checkbox" 
                        value={follow ? '1' : '0'}
                        checked={follow} 
                        onChange={e => {
                            setFollow(e.target.checked)
                            if (!e.target.checked) {
                                setTimeX(computedTimeX)
                                setTimeDX(computedTimeDX)
                            }
                        }} />
                </div>
            </div>

            <FlameChart 
                rootNode={rootNode} 
                timeX={computedTimeX} 
                timeDX={computedTimeDX}
                onWheelActive={handleWheel} 
                onNodeClick={onNodeClick} />
        </React.Fragment>
    )
}

ControlledFlameChart.FollowModel = {
    Continuous: 0,
    Fixed: 1
}