import React from 'react'

import Node from './Stack/Node'

export default function FlameChart({rootNode, timeX = 0, timeDX = null, width = 1000}) {
    if (!rootNode) {
        return null
    }


    if (timeDX === null) {
        timeDX = (rootNode.startTimeIndex + rootNode.duration) - timeX
    }

    const flameChartStyle = {
        width
    }

    return (
        <div className="flamechart" style={flameChartStyle}>
            <Node.List nodes={[rootNode]} timeX={timeX} timeDX={timeDX} width={width} />
        </div>
    )
}