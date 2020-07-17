import React from 'react'

let delayedStateUpdaterCalled = false
const pendingStateUpdates = new Map()

export function useDelayedState(initialValue) {
    const [state, setState] = React.useState({
        value: initialValue,
        setStateDelayed: (function () {
            function setStateDelayed(value) {
                pendingStateUpdates.set(setState, {
                    value,
                    setStateDelayed
                })
                if (delayedStateUpdaterCalled) {
                    return
                }


                requestAnimationFrame(function () {
                    for (const [setState, nextValue] of pendingStateUpdates.entries()) {
                        setState(nextValue)
                    }
                    pendingStateUpdates.clear()

                    delayedStateUpdaterCalled = false
                })
            }
            return setStateDelayed
        })()
    })


    return [state.value, state.setStateDelayed]
}