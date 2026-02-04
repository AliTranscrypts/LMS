import { createContext, useContext, useState, useCallback } from 'react'
import { getCourse, updateCourse as updateCourseApi } from '../services/courses'
import { getCourseModules, createModule, updateModule, deleteModule, reorderModules as reorderModulesApi } from '../services/modules'
import { getClassRoster } from '../services/enrollments'

const CourseContext = createContext(null)

export function CourseProvider({ children, courseId }) {
  const [course, setCourse] = useState(null)
  const [modules, setModules] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * Fetch course data
   */
  const fetchCourse = useCallback(async () => {
    if (!courseId) return

    setLoading(true)
    setError(null)

    const { data, error } = await getCourse(courseId)
    
    if (error) {
      setError('Failed to load course')
      console.error(error)
    } else {
      setCourse(data)
    }
    
    setLoading(false)
    return { data, error }
  }, [courseId])

  /**
   * Fetch modules for the course
   */
  const fetchModules = useCallback(async () => {
    if (!courseId) return

    const { data, error } = await getCourseModules(courseId)
    
    if (error) {
      console.error('Failed to load modules:', error)
    } else {
      setModules(data || [])
    }
    
    return { data, error }
  }, [courseId])

  /**
   * Fetch enrollments/roster
   */
  const fetchEnrollments = useCallback(async () => {
    if (!courseId) return

    const { data, error } = await getClassRoster(courseId)
    
    if (error) {
      console.error('Failed to load enrollments:', error)
    } else {
      setEnrollments(data || [])
    }
    
    return { data, error }
  }, [courseId])

  /**
   * Update course details
   */
  const updateCourse = useCallback(async (updates) => {
    const { data, error } = await updateCourseApi(courseId, updates)
    
    if (!error && data) {
      setCourse(prev => ({ ...prev, ...data }))
    }
    
    return { data, error }
  }, [courseId])

  /**
   * Add a new module
   */
  const addModule = useCallback(async (name) => {
    const orderIndex = modules.length
    const { data, error } = await createModule(courseId, name, orderIndex)
    
    if (!error && data) {
      setModules(prev => [...prev, { ...data, content: [] }])
    }
    
    return { data, error }
  }, [courseId, modules.length])

  /**
   * Update a module
   */
  const editModule = useCallback(async (moduleId, updates) => {
    const { data, error } = await updateModule(moduleId, updates)
    
    if (!error && data) {
      setModules(prev => prev.map(m => 
        m.id === moduleId ? { ...m, ...data } : m
      ))
    }
    
    return { data, error }
  }, [])

  /**
   * Delete a module
   */
  const removeModule = useCallback(async (moduleId) => {
    const { error } = await deleteModule(moduleId)
    
    if (!error) {
      setModules(prev => prev.filter(m => m.id !== moduleId))
    }
    
    return { error }
  }, [])

  /**
   * Reorder modules
   */
  const reorderModules = useCallback(async (reorderedModules) => {
    // Optimistic update
    const previousModules = [...modules]
    setModules(reorderedModules)

    const { error } = await reorderModulesApi(reorderedModules)
    
    if (error) {
      // Rollback on error
      setModules(previousModules)
    }
    
    return { error }
  }, [modules])

  /**
   * Refresh all course data
   */
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchCourse(),
      fetchModules(),
      fetchEnrollments()
    ])
  }, [fetchCourse, fetchModules, fetchEnrollments])

  const value = {
    // State
    course,
    modules,
    enrollments,
    loading,
    error,
    
    // Actions
    fetchCourse,
    fetchModules,
    fetchEnrollments,
    updateCourse,
    addModule,
    editModule,
    removeModule,
    reorderModules,
    refreshAll,
    
    // Direct state setters for optimistic updates
    setCourse,
    setModules,
    setEnrollments
  }

  return (
    <CourseContext.Provider value={value}>
      {children}
    </CourseContext.Provider>
  )
}

export function useCourse() {
  const context = useContext(CourseContext)
  if (!context) {
    throw new Error('useCourse must be used within a CourseProvider')
  }
  return context
}

export default CourseContext
