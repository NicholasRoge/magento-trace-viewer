import React from 'react'

function getVisibleDuration(node, timeX, timeDX) {
    if (node.startTimeIndex < timeX) {
        return Math.min(node.duration - (timeX - node.startTimeIndex), timeDX)
    } else {
        return Math.min(node.duration, (timeX + timeDX) - node.startTimeIndex)
    }
}

function NodeList({nodes, timeX, timeDX}) {
    let cumulativePercent = 0
    
    return (
        <div style={NodeList.styles.container}>
            {nodes.map((node, index) => {
                const visibleDuration = getVisibleDuration(node, timeX, timeDX)
                if (visibleDuration <= 0) {
                    return null
                }

                
                let marginLeftPercent
                if (node.startTimeIndex < timeX) {
                    marginLeftPercent = 0
                } else {
                    const prevNode = nodes[index - 1]
                    if (prevNode && prevNode.endTimeIndex > timeX) {
                        marginLeftPercent = ((node.startTimeIndex - prevNode.endTimeIndex) / timeDX) * 100
                    } else {
                        marginLeftPercent = ((node.startTimeIndex - timeX) / timeDX) * 100
                    }
                }
                cumulativePercent += marginLeftPercent

                let widthPercent = (visibleDuration / timeDX) * 100
                cumulativePercent += widthPercent
                if (cumulativePercent > 100) {
                    widthPercent -= cumulativePercent - 100
                }

                const computedChildContainerStyle = {
                    ...NodeList.styles.childContainer,
                    marginLeft: marginLeftPercent + '%',
                    width: widthPercent + '%'
                }

                return (
                    <div style={computedChildContainerStyle} key={node.index}>
                        <Node node={node} timeX={timeX} timeDX={timeDX} />
                    </div>
                )
            })}
        </div>
    )
}
NodeList.styles = {
    container: {
        alignItems: 'flex-end',
        display: 'flex',
        width: '100%',
        overflow: 'hidden'
    },
    childContainer: {

    },
}

export default function Node({node, timeX, timeDX}) {
    let visibleDuration 
    if (node.startTimeIndex < timeX) {
        visibleDuration = Math.min(node.duration - (timeX - node.startTimeIndex), timeDX)
    } else {
        visibleDuration = Math.min(node.duration, (timeX + timeDX) - node.startTimeIndex)
    }

    const computedNodeStyle = {
        ...Node.styles.node,
    }
    if (node.startTimeIndex < timeX) {
        computedNodeStyle.borderLeftWidth = 0
    }
    if (node.endTimeIndex === null || node.endTimeIndex > timeX + timeDX) {
        if (node.endTimeIndex) {
            debugger
        }
        computedNodeStyle.borderRightWidth = 0
    }


    return (
        <div style={Node.styles.container}>
            {node.children.length > 0 && <NodeList nodes={node.children} timeX={Math.max(timeX, node.startTimeIndex)} timeDX={visibleDuration} />}
            <div className="node" style={computedNodeStyle}>
                {node.functionName}
            </div>
        </div>
    )
}
Node.List = NodeList
Node.styles = {
    container: {
        width: '100%'
    },
    node: {
        padding: 2,
        width: '100%',

        background: 'hsl(0, 0%, 80%)',

        borderColor: 'hsl(0, 0%, 60%)',
        borderStyle: 'solid',
        borderBottomWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: 1,

        overflow: 'hidden',
        textOverflow: 'ellipses',
        whiteSpace: 'nowrap'
    }
}