import { useEffect, useRef, useCallback, useState } from 'react'

/**
 * Custom hook for polling with random jitter and tab visibility handling.
 * 
 * Features:
 * - Random jitter between min and max intervals (default 25-35 seconds)
 * - Pauses polling when browser tab is inactive
 * - Resumes polling immediately when tab becomes active
 * - Provides manual refresh capability
 * - Tracks loading and error states
 * 
 * @param {Function} fetchFn - Async function to call on each poll
 * @param {Object} options - Configuration options
 * @param {number} options.minInterval - Minimum polling interval in ms (default 25000)
 * @param {number} options.maxInterval - Maximum polling interval in ms (default 35000)
 * @param {boolean} options.enabled - Whether polling is enabled (default true)
 * @param {boolean} options.fetchOnMount - Whether to fetch immediately on mount (default true)
 * @param {Array} options.deps - Dependencies to trigger refetch (optional)
 * 
 * @returns {Object} { data, loading, error, refresh, lastUpdated }
 */
export function usePolling(fetchFn, options = {}) {
  const {
    minInterval = 25000, // 25 seconds
    maxInterval = 35000, // 35 seconds
    enabled = true,
    fetchOnMount = true,
    deps = []
  } = options

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  
  const timeoutRef = useRef(null)
  const isMountedRef = useRef(true)
  const isVisibleRef = useRef(true)
  const fetchFnRef = useRef(fetchFn)

  // Keep fetchFn ref updated
  useEffect(() => {
    fetchFnRef.current = fetchFn
  }, [fetchFn])

  /**
   * Generate random interval with jitter
   */
  const getRandomInterval = useCallback(() => {
    return Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval
  }, [minInterval, maxInterval])

  /**
   * Perform the fetch operation
   */
  const doFetch = useCallback(async () => {
    if (!isMountedRef.current) return

    setLoading(true)
    setError(null)

    try {
      const result = await fetchFnRef.current()
      if (isMountedRef.current) {
        setData(result)
        setLastUpdated(new Date())
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || 'An error occurred')
        console.error('Polling fetch error:', err)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  /**
   * Schedule the next poll
   */
  const scheduleNextPoll = useCallback(() => {
    if (!enabled || !isVisibleRef.current || !isMountedRef.current) return

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    const interval = getRandomInterval()
    timeoutRef.current = setTimeout(async () => {
      await doFetch()
      scheduleNextPoll()
    }, interval)
  }, [enabled, getRandomInterval, doFetch])

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    // Clear scheduled poll
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    await doFetch()

    // Reschedule if enabled and visible
    if (enabled && isVisibleRef.current) {
      scheduleNextPoll()
    }
  }, [doFetch, enabled, scheduleNextPoll])

  /**
   * Handle visibility change
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'
      isVisibleRef.current = isVisible

      if (isVisible && enabled) {
        // Tab became visible - fetch immediately and restart polling
        doFetch().then(() => {
          scheduleNextPoll()
        })
      } else {
        // Tab became hidden - pause polling
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, doFetch, scheduleNextPoll])

  /**
   * Initial mount and cleanup
   */
  useEffect(() => {
    isMountedRef.current = true
    isVisibleRef.current = document.visibilityState === 'visible'

    if (enabled && fetchOnMount) {
      doFetch().then(() => {
        if (isVisibleRef.current) {
          scheduleNextPoll()
        }
      })
    } else if (enabled && isVisibleRef.current) {
      scheduleNextPoll()
    }

    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [enabled, fetchOnMount, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Handle enabled state changes
   */
  useEffect(() => {
    if (!enabled && timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [enabled])

  return {
    data,
    loading,
    error,
    refresh,
    lastUpdated
  }
}

/**
 * Simplified polling hook for grade updates
 * Uses 25-35 second intervals with ±5 second jitter as specified
 */
export function useGradePolling(fetchFn, options = {}) {
  return usePolling(fetchFn, {
    minInterval: 25000, // 25 seconds (30 - 5 jitter)
    maxInterval: 35000, // 35 seconds (30 + 5 jitter)
    ...options
  })
}

export default usePolling
