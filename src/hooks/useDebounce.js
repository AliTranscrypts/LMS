import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Debounces a value - returns the debounced value that updates after delay
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {any} - The debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Returns a debounced version of a callback function
 * @param {Function} callback - The function to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {Function} - The debounced function
 */
export function useDebouncedCallback(callback, delay = 300) {
  const timeoutRef = useRef(null)
  const callbackRef = useRef(callback)

  // Update callback ref on each render
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args)
    }, delay)
  }, [delay])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

/**
 * Throttles a callback function - ensures it's called at most once per interval
 * @param {Function} callback - The function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds (default: 300ms)
 * @returns {Function} - The throttled function
 */
export function useThrottledCallback(callback, limit = 300) {
  const lastRanRef = useRef(0)
  const callbackRef = useRef(callback)

  // Update callback ref on each render
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const throttledCallback = useCallback((...args) => {
    const now = Date.now()
    
    if (now - lastRanRef.current >= limit) {
      lastRanRef.current = now
      callbackRef.current(...args)
    }
  }, [limit])

  return throttledCallback
}

export default useDebounce
