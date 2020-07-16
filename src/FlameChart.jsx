import './FlameChart.scss'

import React from 'react'

import Node from './Stack/Node'

export default function FlameChart({rootNode, timeX = 0, timeDX = null, width = 1000}) {
    if (!rootNode) {
        return null
    }


    return (
        <div className="flamechart">
            <Node.List nodes={[rootNode]} timeX={timeX} timeDX={timeDX} width={width} />
        </div>
    )
}