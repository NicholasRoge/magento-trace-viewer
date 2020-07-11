import React from 'react'

import Node from './Node'

export const styles = {
    info: {
        alignItems: 'flex-end',        
        display: 'flex',
        height: '100%',
        width: '100%',

        overflowX: 'hidden',
        overflowY: 'auto'
    }
}

export default function Info({stackRoot}) {
    let [timeX, setTimeX] = React.useState(0)
    let [timeDX, setTimeDX] = React.useState(0)
    let [following, setFollowing] = React.useState(true)

    if (!stackRoot) {
        return null
    }


    if (following) {
        timeDX = (stackRoot.startTimeIndex + stackRoot.duration) - timeX
    }    

    return (
        <div style={styles.info}>
            <Node.List nodes={[stackRoot]} timeX={timeX} timeDX={timeDX} />
        </div>
    )
}