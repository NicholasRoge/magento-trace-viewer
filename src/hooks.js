import React from 'react'

export function useDelayedState(initialValue) {
    const [state, setState] = React.useState(initialValue)

    let nextValue
    let ticking = false
    function setStateDelayed(value) {
        nextValue = value
        if (ticking) {
            return
        }


        requestAnimationFrame(function () {
            setState(nextValue)

            ticking = false
        })
    }

    return [state, setStateDelayed]
}