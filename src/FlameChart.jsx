import './FlameChart.scss'

import React from 'react'

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

export default function FlameChart({rootNode, timeX = 0, timeDX = null}) {
    const rootEl = React.useRef()

    const [ownInnerWidth, setOwnInnerWidth] = React.useState(null)

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
    }, [rootEl.current])


    if (!rootNode) {
        return null
    }


    return (
        <div className="flamechart" ref={rootEl}>
            {ownInnerWidth && (
                <Node.List nodes={[rootNode]} timeX={timeX} timeDX={timeDX} width={ownInnerWidth} />
            )}
        </div>
    )
}