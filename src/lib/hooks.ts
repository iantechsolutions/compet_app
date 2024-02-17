/* eslint-disable */

import { useEffect, useLayoutEffect, useRef, useState } from "react"

export function useOnScroll(element: HTMLElement | undefined | null, onScrollChanged: (scrollX: number, scrollY: number) => void, all: boolean = false) {
    useLayoutEffect(() => {
        if (!element) return

        function scrollListener() {
            onScrollChanged(element!.scrollLeft, element!.scrollTop)
        }

        element.addEventListener('scroll', scrollListener, all)
        window.addEventListener('resize', scrollListener)

        return () => {
            element.removeEventListener('scroll', scrollListener)
            window.removeEventListener('resize', scrollListener)
        }
    }, [element])
}

export function useOnMounted(callback: () => (() => void) | void) {
    const isMountedRef = useRef(false)

    useEffect(() => {
        if (!isMountedRef.current) {
            isMountedRef.current = true
            return callback()
        }
    }, [])
}

const globalState = new Map<string, any>()

export function useGlobalState<T>(key: string, defaultValue: T) {
    const [value, setValue] = useState<T>(() => {
        if (globalState.has(key)) {
            return globalState.get(key)
        }

        return defaultValue
    })

    useEffect(() => {
        globalState.set(key, value)
    }, [value])

    return [value, setValue] as const
}

export function useShortcut(key: string, callback: () => void) {
    useEffect(() => {
        function listener(event: KeyboardEvent) {
            if (event.key === key && event.ctrlKey) {
                event.preventDefault()
                callback()
            }
        }

        window.addEventListener('keydown', listener)

        return () => {
            window.removeEventListener('keydown', listener)
        }
    }, [])
}