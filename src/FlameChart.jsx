import './FlameChart.scss'

import React from 'react'

import {useDelayedState} from './hooks'
import Node from './Stack/Node'

function getPixelValue(str) {
    return parseInt(str.slice(0, -'px'.length))
}

function computeInnerWidth(el) {
    const computedStyle = window.getComputedStyle(el)
    
    const paddingLeft = getPixelValue(computedStyle.paddingLeft)
    const paddingRight = getPixelValue(computedStyle.paddingRight)

    return el.clientWidth - (paddingLeft + paddingRight)
}

export default function FlameChart({rootNode, timeX = 0, timeDX = 1, eventHandlers = {}, onWheelActive, onNodeClick}) {
    const rootEl = React.useRef()

    const [ownInnerWidth, setOwnInnerWidth] = useDelayedState(null)

    React.useEffect(function () {
        let rootElCurrent = rootEl.current
        if (!rootElCurrent || !onWheelActive) {
            return
        }


        rootEl.current.addEventListener('wheel', onWheelActive)
        return function () {
            rootElCurrent.removeEventListener('wheel', onWheelActive)
        }
    }, [rootEl, onWheelActive])

    React.useEffect(function () {
        if (!rootEl.current) {
            return;
        }


        setOwnInnerWidth(computeInnerWidth(rootEl.current))
        const resizeObserver = new ResizeObserver(function () {
            setOwnInnerWidth(computeInnerWidth(rootEl.current))
        })
        resizeObserver.observe(rootEl.current)

        return function () {
            resizeObserver.disconnect()
        }
    }, [rootEl, setOwnInnerWidth])


    if (!rootNode) {
        return null
    }

    return (
        <div 
            className="flamechart" 
            {...eventHandlers}
            ref={rootEl}>
            {ownInnerWidth && (
                <Node.List nodes={[rootNode]} timeX={timeX} timeDX={timeDX} width={ownInnerWidth} onNodeClick={onNodeClick} />
            )}
        </div>
    )
}