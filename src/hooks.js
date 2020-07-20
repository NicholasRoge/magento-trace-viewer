import React from 'react'

let delayedStateUpdaterCalled = false
const pendingStateUpdates = new Map()

export function useDelayedState(initialValue) {
    const [state, setState] = React.useState({
        value: initialValue,
        setStateDelayed: (function () {
            function setStateDelayed(value, callback = null, setImmediate = false) {
                if (setImmediate) {
                    setState({
                        value,
                        setStateDelayed
                    }, callback)
                    pendingStateUpdates.delete(setState)

                    return
                }


                pendingStateUpdates.set(setState, {
                    value,
                    callback,
                    setStateDelayed
                })
                if (delayedStateUpdaterCalled) {
                    return
                }


                requestAnimationFrame(function () {
                    for (const [setState, nextValue] of pendingStateUpdates.entries()) {
                        const callback = nextValue.callback
                        delete nextValue.callback

                        setState(nextValue, callback)
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

