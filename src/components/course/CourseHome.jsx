import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStudentCourseProgress, getNextIncompleteContent } from '../../services/progress'
import { QuillRenderer } from '../common/QuillEditor'

/**
 * Course Home view for students
 * Shows progress summary, "Next Up" section, and syllabus
 * Per wireframe in Core Flows spec - S3: Course Access & Navigation
 */
export default function CourseHome({ course, userId, onNavigateToModules }) {
  const navigate = useNavigate()
  const [progressData, setProgressData] = useState(null)
  const [nextUp, setNextUp] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProgressData()
  }, [userId, course.id])

  const fetchProgressData = async () => {
    if (!userId) return

    setLoading(true)
    
    // Fetch progress and next incomplete content in parallel
    const [progressResult, nextUpResult] = await Promise.all([
      getStudentCourseProgress(userId, course.id),
      getNextIncompleteContent(userId, course.id)
    ])

    if (progressResult.data) {
      setProgressData(progressResult.data)
    }

    if (nextUpResult.data) {
      setNextUp(nextUpResult.data)
    }

    setLoading(false)
  }

  const handleContinueLearning = () => {
    if (nextUp?.content?.id) {
      navigate(`/content/${nextUp.content.id}`)
    } else {
      // If all complete, navigate to modules tab
      onNavigateToModules?.()
    }
  }

  const getContentIcon = (type) => {
    switch (type) {
      case 'reading':
        return '📄'
      case 'video':
        return '🎥'
      case 'text':
        return '📝'
      case 'assignment':
        return '✏️'
      case 'quiz':
        return '❓'
      default:
        return '📎'
    }
  }

  const hasSyllabus = course.syllabus && (
    (typeof course.syllabus === 'object' && course.syllabus.ops && course.syllabus.ops.length > 0 && 
      !(course.syllabus.ops.length === 1 && course.syllabus.ops[0].insert === '\n')) ||
    (typeof course.syllabus === 'string' && course.syllabus.trim())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Summary Card */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h2>
        
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Overall Course Progress</span>
            <span className="font-semibold text-gray-900">
              {progressData?.completedContent || 0} of {progressData?.totalContent || 0} items ({progressData?.percentComplete || 0}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-primary-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressData?.percentComplete || 0}%` }}
            ></div>
          </div>
        </div>

        {/* Module Progress Indicators */}
        {progressData?.modules && progressData.modules.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Module Progress</p>
            <div className="flex flex-wrap gap-2">
              {progressData.modules.map((module, idx) => {
                const isComplete = module.totalCount > 0 && module.completedCount === module.totalCount
                const inProgress = module.completedCount > 0 && module.completedCount < module.totalCount
                
                return (
                  <span
                    key={module.id}
                    className={`text-xs px-3 py-1 rounded-full ${
                      isComplete
                        ? 'bg-success-100 text-success-700'
                        : inProgress
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    title={`${module.name}: ${module.completedCount}/${module.totalCount}`}
                  >
                    {isComplete ? '✓' : `${module.completedCount}/${module.totalCount}`} {module.name}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Next Up Section */}
      {nextUp && !nextUp.allComplete && (
        <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
                  Next Up
                </span>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {nextUp.content?.name}
              </h3>
              
              <p className="text-sm text-gray-600 mb-4">
                <span className="text-xl mr-1">{getContentIcon(nextUp.content?.type)}</span>
                <span className="capitalize">{nextUp.content?.type}</span>
                <span className="mx-2">•</span>
                <span>{nextUp.module?.name}</span>
                <span className="mx-2">•</span>
                <span>{nextUp.module?.completedCount}/{nextUp.module?.totalCount} in this module</span>
              </p>

              <button
                onClick={handleContinueLearning}
                className="btn btn-primary"
              >
                Continue Learning
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Complete State */}
      {nextUp?.allComplete && (
        <div className="bg-gradient-to-r from-success-50 to-success-100 border border-success-200 rounded-xl p-6 text-center">
          <div className="w-16 h-16 bg-success-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-success-700 mb-2">Course Complete!</h3>
          <p className="text-success-600">
            Congratulations! You've completed all {nextUp.totalContent} content items in this course.
          </p>
          <button
            onClick={() => onNavigateToModules?.()}
            className="btn btn-secondary mt-4"
          >
            Review Course Materials
          </button>
        </div>
      )}

      {/* Syllabus Section */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Syllabus</h2>
        
        {hasSyllabus ? (
          <div className="prose max-w-none">
            <QuillRenderer content={course.syllabus} />
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No syllabus has been added yet.</p>
          </div>
        )}

        {/* Course Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Course Information</h3>
          
          {course.description && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">Description</p>
              <p className="text-gray-900">{course.description}</p>
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm text-gray-600">Instructor</p>
            <p className="text-gray-900">{course.teacher?.full_name}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Grading Categories</p>
            <div className="grid grid-cols-2 gap-2">
              {course.category_weights && Object.entries(course.category_weights).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-700 capitalize">
                    {key === 'ku' ? 'Knowledge & Understanding' : key}:
                  </span>
                  <span className="font-medium text-gray-900">{value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
