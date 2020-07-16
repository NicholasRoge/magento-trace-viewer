import React from 'react'

function getVisibleDuration(node, timeX, timeDX) {
    if (node.startTimeIndex < timeX) {
        return Math.min(node.duration - (timeX - node.startTimeIndex), timeDX)
    } else {
        return Math.min(node.duration, (timeX + timeDX) - node.startTimeIndex)
    }
}

function NodeList({nodes, timeX, timeDX, width = 100}) {
    let lastOutputWidth = 0

    const containerStyle = {
        alignItems: 'flex-end',
        display: 'flex',
        width: width
    }

    return (
        <ul className="stack-node-list" style={containerStyle}>
            {nodes.map(node => {
                const visibleDuration = getVisibleDuration(node, timeX, timeDX)
                if (visibleDuration <= 0) {
                    return null
                }

                
                let childLeftFractional = Math.max(0, ((node.startTimeIndex - timeX) / timeDX) * width)
                let childWidthFractional = (visibleDuration / timeDX) * width
                if (childWidthFractional < 1) {
                    return null
                }


                let childMarginLeft = Math.floor(childLeftFractional) - lastOutputWidth
                let childWidth = Math.floor(childWidthFractional)
                if (!node.endTimeIndex) {
                    childWidth = Math.ceil(childWidthFractional)
                } else {
                    childWidth = Math.floor(childWidthFractional)
                }
                lastOutputWidth += childMarginLeft + Math.floor(childWidthFractional)

                const childContainerStyle = {
                    marginLeft: childMarginLeft,
                    width: childWidth
                }

                return (
                    <li style={childContainerStyle} key={node.index}>
                        <Node node={node} timeX={timeX} timeDX={timeDX} width={childWidth} />
                    </li>
                )
            })}
        </ul>
    )
}

export default function Node({node, timeX, timeDX, width}) {
    const visibleDuration = getVisibleDuration(node, timeX, timeDX)

    const nodeClasses = ['stack-node']
    if (node.startTimeIndex < timeX) {
        nodeClasses.push('-start-obscured')
    }
    if (node.endTimeIndex === null) {
        nodeClasses.push('-ongoing')
    }
    if (node.endTimeIndex > timeX + timeDX) {
        nodeClasses.push('-end-obscured')
    }

    const nodeStyle = {
        width
    }

    const nodeLabelStyle = {
        width,
        overflow: 'hidden',
        whiteSpace: 'nowrap'
    }


    return (
        <div className={nodeClasses.join(' ')} style={nodeStyle}>
            {node.children.length > 0 && <NodeList nodes={node.children} timeX={Math.max(timeX, node.startTimeIndex)} timeDX={visibleDuration} width={width} />}

            <div className="stack-node-label" style={nodeLabelStyle}>
                {node.functionName}
            </div>
        </div>
    )
}
Node.List = NodeList