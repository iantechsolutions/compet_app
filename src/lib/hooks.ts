/* eslint-disable */

import { useEffect, useLayoutEffect, useRef } from "react"

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