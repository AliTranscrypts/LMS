import { useState, useEffect } from 'react'
import { getCourseModules } from '../../services/courses'
import EmptyState from '../common/EmptyState'

export default function ModulesTab({ course, isTeacher, onUpdate }) {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedModules, setExpandedModules] = useState({})

  useEffect(() => {
    fetchModules()
  }, [course.id])

  const fetchModules = async () => {
    setLoading(true)
    const { data, error } = await getCourseModules(course.id)
    
    if (error) {
      setError('Failed to load modules')
      console.error(error)
    } else {
      setModules(data || [])
      // Expand first module by default
      if (data?.length > 0) {
        setExpandedModules({ [data[0].id]: true })
      }
    }
    setLoading(false)
  }

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-12 text-error-600">{error}</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Course Modules</h2>
        {isTeacher && (
          <button className="btn btn-success">
            + Add Module
          </button>
        )}
      </div>

      {modules.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          title="No modules yet"
          description={isTeacher ? "Add your first module to start building your course." : "Your instructor hasn't added any modules yet."}
          action={isTeacher && (
            <button className="btn btn-success">
              + Add Module
            </button>
          )}
        />
      ) : (
        <div className="space-y-4">
          {modules.map((module, index) => (
            <ModuleCard
              key={module.id}
              module={module}
              index={index}
              isExpanded={expandedModules[module.id]}
              onToggle={() => toggleModule(module.id)}
              isTeacher={isTeacher}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ModuleCard({ module, index, isExpanded, onToggle, isTeacher }) {
  const contentItems = module.content || []
  const completedCount = 0 // TODO: Get from progress service
  const totalCount = contentItems.length

  const getContentIcon = (type) => {
    switch (type) {
      case 'reading':
        return '📄'
      case 'video':
        return '🎥'
      case 'assignment':
        return '📝'
      case 'quiz':
        return '❓'
      default:
        return '📎'
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-gray-300">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{module.name}</h3>
            <p className="text-sm text-gray-500">
              {totalCount === 0 ? 'No content' : `${completedCount}/${totalCount} completed`}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          {contentItems.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>No content in this module yet.</p>
              {isTeacher && (
                <button className="btn btn-secondary mt-3 text-sm">
                  + Add Content
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {contentItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <span className="text-xl">{getContentIcon(item.type)}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500 capitalize">{item.type}</p>
                  </div>
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
              {isTeacher && (
                <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
                  + Add Content
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
