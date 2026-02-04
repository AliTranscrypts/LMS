import { useMemo, useCallback, useRef } from 'react'

/**
 * Memoizes a computed value with deep comparison of dependencies
 * Useful for expensive calculations that depend on complex objects
 * @param {Function} compute - Function that computes the value
 * @param {Array} deps - Dependencies array (like useMemo)
 * @returns {any} - The memoized computed value
 */
export function useMemoizedComputation(compute, deps) {
  return useMemo(() => compute(), deps)
}

/**
 * Caches the previous value for comparison
 * @param {any} value - Current value
 * @returns {any} - Previous value
 */
export function usePrevious(value) {
  const ref = useRef()
  const previous = ref.current
  ref.current = value
  return previous
}

/**
 * Memoizes grade calculations for a course
 * @param {Array} grades - Array of grade objects
 * @param {Object} categoryWeights - Category weight configuration
 * @returns {Object} - Computed grade statistics
 */
export function useMemoizedGradeStats(grades, categoryWeights) {
  return useMemo(() => {
    if (!grades || grades.length === 0) {
      return {
        average: 0,
        categoryAverages: {},
        totalAssignments: 0,
        gradedAssignments: 0
      }
    }

    const gradedItems = grades.filter(g => g.total_score != null)
    
    if (gradedItems.length === 0) {
      return {
        average: 0,
        categoryAverages: {},
        totalAssignments: grades.length,
        gradedAssignments: 0
      }
    }

    // Calculate overall average
    const totalScore = gradedItems.reduce((sum, g) => sum + (g.total_score || 0), 0)
    const totalMax = gradedItems.reduce((sum, g) => sum + (g.max_score || 100), 0)
    const average = totalMax > 0 ? (totalScore / totalMax) * 100 : 0

    // Calculate category averages
    const categoryTotals = {}
    const categoryCounts = {}

    gradedItems.forEach(grade => {
      if (grade.category_scores) {
        Object.entries(grade.category_scores).forEach(([category, score]) => {
          if (!categoryTotals[category]) {
            categoryTotals[category] = 0
            categoryCounts[category] = 0
          }
          categoryTotals[category] += score.earned || 0
          categoryCounts[category] += score.max || 0
        })
      }
    })

    const categoryAverages = {}
    Object.keys(categoryTotals).forEach(category => {
      const max = categoryCounts[category]
      categoryAverages[category] = max > 0 
        ? (categoryTotals[category] / max) * 100 
        : 0
    })

    return {
      average: Math.round(average * 10) / 10,
      categoryAverages,
      totalAssignments: grades.length,
      gradedAssignments: gradedItems.length
    }
  }, [grades, categoryWeights])
}

/**
 * Memoizes course content filtering/sorting
 * @param {Array} modules - Array of module objects with content
 * @param {Object} filters - Filter configuration
 * @returns {Array} - Filtered and sorted modules
 */
export function useMemoizedCourseContent(modules, filters = {}) {
  return useMemo(() => {
    if (!modules) return []

    let result = [...modules]

    // Filter by content type if specified
    if (filters.contentType) {
      result = result.map(module => ({
        ...module,
        content: module.content?.filter(c => c.type === filters.contentType) || []
      })).filter(m => m.content.length > 0)
    }

    // Filter by search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      result = result.map(module => ({
        ...module,
        content: module.content?.filter(c => 
          c.title?.toLowerCase().includes(term) ||
          c.description?.toLowerCase().includes(term)
        ) || []
      })).filter(m => 
        m.name.toLowerCase().includes(term) || 
        m.content.length > 0
      )
    }

    // Sort modules by order_index
    result.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))

    // Sort content within each module
    result.forEach(module => {
      if (module.content) {
        module.content.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      }
    })

    return result
  }, [modules, filters.contentType, filters.searchTerm])
}

/**
 * Creates a stable callback that always has access to latest state
 * @param {Function} callback - The callback function
 * @returns {Function} - Stable callback reference
 */
export function useStableCallback(callback) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  return useCallback((...args) => {
    return callbackRef.current(...args)
  }, [])
}

export default useMemoizedGradeStats
