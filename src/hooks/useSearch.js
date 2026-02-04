import { useState, useMemo, useCallback } from 'react'
import { useDebounce } from './useDebounce'

/**
 * Hook for search functionality with debouncing
 * @param {Array} items - Items to search through
 * @param {Object} options - Search options
 * @param {Array<string>} options.searchFields - Fields to search in
 * @param {number} options.debounceMs - Debounce delay (default: 300ms)
 * @returns {Object} - { searchTerm, setSearchTerm, filteredItems, isSearching }
 */
export function useSearch(items, options = {}) {
  const { 
    searchFields = ['name', 'title'], 
    debounceMs = 300 
  } = options

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, debounceMs)

  const isSearching = searchTerm !== debouncedSearchTerm

  const filteredItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return []
    if (!debouncedSearchTerm.trim()) return items

    const term = debouncedSearchTerm.toLowerCase().trim()
    
    return items.filter(item => {
      return searchFields.some(field => {
        const value = getNestedValue(item, field)
        return value && String(value).toLowerCase().includes(term)
      })
    })
  }, [items, debouncedSearchTerm, searchFields])

  return {
    searchTerm,
    setSearchTerm,
    filteredItems,
    isSearching,
    hasResults: filteredItems.length > 0,
    resultCount: filteredItems.length
  }
}

/**
 * Hook for filtering items by multiple criteria
 * @param {Array} items - Items to filter
 * @param {Object} initialFilters - Initial filter values
 * @returns {Object} - { filters, setFilter, resetFilters, filteredItems }
 */
export function useFilter(items, initialFilters = {}) {
  const [filters, setFilters] = useState(initialFilters)

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(initialFilters)
  }, [initialFilters])

  const filteredItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return []

    return items.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        // Skip empty/null filter values
        if (value === '' || value === null || value === undefined) {
          return true
        }

        const itemValue = getNestedValue(item, key)
        
        // Handle array values (e.g., filter by multiple types)
        if (Array.isArray(value)) {
          return value.length === 0 || value.includes(itemValue)
        }

        // Handle date range
        if (typeof value === 'object' && (value.from || value.to)) {
          const itemDate = new Date(itemValue)
          if (value.from && itemDate < new Date(value.from)) return false
          if (value.to && itemDate > new Date(value.to)) return false
          return true
        }

        // Simple equality check
        return itemValue === value
      })
    })
  }, [items, filters])

  return {
    filters,
    setFilter,
    resetFilters,
    filteredItems,
    hasActiveFilters: Object.values(filters).some(v => 
      v !== '' && v !== null && v !== undefined && 
      (!Array.isArray(v) || v.length > 0)
    )
  }
}

/**
 * Combined search and filter hook
 */
export function useSearchAndFilter(items, options = {}) {
  const {
    searchFields = ['name', 'title'],
    initialFilters = {},
    debounceMs = 300
  } = options

  const { 
    searchTerm, 
    setSearchTerm, 
    filteredItems: searchResults,
    isSearching 
  } = useSearch(items, { searchFields, debounceMs })

  const {
    filters,
    setFilter,
    resetFilters,
    filteredItems,
    hasActiveFilters
  } = useFilter(searchResults, initialFilters)

  const resetAll = useCallback(() => {
    setSearchTerm('')
    resetFilters()
  }, [setSearchTerm, resetFilters])

  return {
    searchTerm,
    setSearchTerm,
    filters,
    setFilter,
    resetFilters,
    resetAll,
    filteredItems,
    isSearching,
    hasActiveFilters,
    resultCount: filteredItems.length
  }
}

// Helper function to get nested object values (e.g., "course.name")
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => 
    current && current[key] !== undefined ? current[key] : null, 
    obj
  )
}

export default useSearch
