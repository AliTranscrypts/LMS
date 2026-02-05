import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import { markContentComplete, markContentIncomplete } from '../services/progress'
import { getSignedUrl } from '../services/uploads'
import Layout from '../components/common/Layout'
import PdfViewer from '../components/content/PdfViewer'
import VideoPlayer from '../components/content/VideoPlayer'
import AssignmentViewer from '../components/assignment/AssignmentViewer'
import { QuizViewer, QuizBuilder } from '../components/quiz'

export default function ContentViewer() {
  const { contentId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  
  const [content, setContent] = useState(null)
  const [module, setModule] = useState(null)
  const [course, setCourse] = useState(null)
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [marking, setMarking] = useState(false)
  const [signedFileUrl, setSignedFileUrl] = useState(null)
  const [fileUrlLoading, setFileUrlLoading] = useState(false)

  // Navigation state
  const [prevContent, setPrevContent] = useState(null)
  const [nextContent, setNextContent] = useState(null)

  const isStudent = profile?.role === 'student'
  const isTeacher = profile?.role === 'teacher'
  const isCompleted = progress?.completed

  useEffect(() => {
    fetchContent()
  }, [contentId, user?.id])

  // Generate signed URL for file content (PDFs, videos)
  useEffect(() => {
    const generateSignedUrl = async () => {
      if (!content?.file_url) {
        setSignedFileUrl(null)
        return
      }

      setFileUrlLoading(true)
      try {
        let storagePath = content.file_url

        // Check if file_url is a full URL (legacy data) - extract the path
        if (content.file_url.startsWith('http')) {
          // Legacy URL format: https://xxx.supabase.co/storage/v1/object/public/course-content/path/to/file
          // Extract path after /course-content/
          const match = content.file_url.match(/\/storage\/v1\/object\/public\/course-content\/(.+)$/)
          if (match) {
            storagePath = match[1]
          } else {
            // Can't extract path, try using as-is (will likely fail for private bucket)
            console.warn('Could not extract storage path from legacy URL:', content.file_url)
            setSignedFileUrl(content.file_url)
            setFileUrlLoading(false)
            return
          }
        }

        // Generate signed URL for storage path
        const { data, error } = await getSignedUrl(storagePath, 3600) // 1 hour expiry
        if (error) {
          console.error('Error generating signed URL:', error)
          setSignedFileUrl(null)
        } else {
          setSignedFileUrl(data.signedUrl)
        }
      } catch (err) {
        console.error('Error generating signed URL:', err)
        setSignedFileUrl(null)
      } finally {
        setFileUrlLoading(false)
      }
    }

    generateSignedUrl()
  }, [content?.file_url])

  const fetchContent = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch content with module and course info
      const { data: contentData, error: contentError } = await supabase
        .from('content')
        .select(`
          *,
          module:modules(
            id,
            name,
            course_id,
            order_index,
            course:courses(
              id,
              name,
              teacher_id
            )
          )
        `)
        .eq('id', contentId)
        .single()

      if (contentError) throw contentError
      if (!contentData) throw new Error('Content not found')

      setContent(contentData)
      setModule(contentData.module)
      setCourse(contentData.module?.course)

      // Fetch progress for students
      if (isStudent) {
        const { data: progressData } = await supabase
          .from('content_progress')
          .select('*')
          .eq('content_id', contentId)
          .eq('student_id', user.id)
          .single()

        setProgress(progressData)
      }

      // Fetch adjacent content for navigation
      await fetchNavigation(contentData)

    } catch (err) {
      console.error('Error fetching content:', err)
      setError(err.message || 'Failed to load content')
    } finally {
      setLoading(false)
    }
  }

  const fetchNavigation = async (currentContent) => {
    if (!currentContent.module) return

    // Get all content in the same module
    const { data: moduleContent } = await supabase
      .from('content')
      .select('id, name, type, order_index')
      .eq('module_id', currentContent.module.id)
      .order('order_index', { ascending: true })

    if (!moduleContent) return

    const currentIndex = moduleContent.findIndex(c => c.id === currentContent.id)
    
    if (currentIndex > 0) {
      setPrevContent(moduleContent[currentIndex - 1])
    } else {
      setPrevContent(null)
    }

    if (currentIndex < moduleContent.length - 1) {
      setNextContent(moduleContent[currentIndex + 1])
    } else {
      setNextContent(null)
    }
  }

  const handleMarkComplete = async () => {
    if (!isStudent) return
    
    setMarking(true)
    const { data, error } = await markContentComplete(contentId, user.id)
    
    if (!error) {
      setProgress(data)
    }
    setMarking(false)
  }

  const handleMarkIncomplete = async () => {
    if (!isStudent) return
    
    setMarking(true)
    const { data, error } = await markContentIncomplete(contentId, user.id)
    
    if (!error) {
      setProgress(data)
    }
    setMarking(false)
  }

  const getContentIcon = (type) => {
    switch (type) {
      case 'reading': return '📄'
      case 'video': return '🎥'
      case 'assignment': return '📝'
      case 'quiz': return '❓'
      default: return '📎'
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="page-container">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">😕</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Content Not Found</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button onClick={() => navigate(-1)} className="btn btn-primary">
              Go Back
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
                Dashboard
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li>
              <Link to={`/courses/${course?.id}`} className="text-gray-500 hover:text-gray-700">
                {course?.name}
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-900 font-medium truncate max-w-[200px]">
              {content?.name}
            </li>
          </ol>
        </nav>

        {/* Content Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{getContentIcon(content?.type)}</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{content?.name}</h1>
                <p className="text-gray-500 mt-1">
                  {module?.name} • {content?.type?.charAt(0).toUpperCase() + content?.type?.slice(1)}
                </p>
              </div>
            </div>

            {/* Completion Status Badge */}
            {isStudent && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                isCompleted 
                  ? 'bg-success-100 text-success-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {isCompleted ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Completed
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400 rounded-full"></div>
                    Not completed
                  </>
                )}
              </div>
            )}
          </div>

          {content?.description && (
            <p className="mt-4 text-gray-600">{content.description}</p>
          )}
        </div>

        {/* Content Viewer */}
        <div className="mb-8">
          {content?.type === 'reading' && content?.file_url && (
            fileUrlLoading ? (
              <div className="bg-gray-100 rounded-lg p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading document...</p>
              </div>
            ) : signedFileUrl ? (
              <PdfViewer 
                url={signedFileUrl} 
                title={content.name}
                allowDownload={true}
              />
            ) : (
              <div className="bg-error-50 rounded-lg p-12 text-center">
                <div className="text-5xl mb-4">⚠️</div>
                <p className="text-error-600">Unable to load document. Please try refreshing the page.</p>
              </div>
            )
          )}

          {content?.type === 'video' && content?.file_url && (
            fileUrlLoading ? (
              <div className="bg-gray-100 rounded-lg p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading video...</p>
              </div>
            ) : signedFileUrl ? (
              <VideoPlayer
                url={signedFileUrl}
                title={content.name}
                onEnded={() => {
                  // Auto-mark complete when video ends (optional)
                }}
              />
            ) : (
              <div className="bg-error-50 rounded-lg p-12 text-center">
                <div className="text-5xl mb-4">⚠️</div>
                <p className="text-error-600">Unable to load video. Please try refreshing the page.</p>
              </div>
            )
          )}

          {!content?.file_url && (content?.type === 'reading' || content?.type === 'video') && (
            <div className="bg-gray-100 rounded-lg p-12 text-center">
              <div className="text-5xl mb-4">{getContentIcon(content?.type)}</div>
              <p className="text-gray-600">
                {isTeacher 
                  ? 'No file has been uploaded for this content yet.' 
                  : 'This content is not available yet.'}
              </p>
            </div>
          )}

          {content?.type === 'assignment' && isStudent && (
            <AssignmentViewer
              content={content}
              progress={progress}
              onProgressUpdate={(newProgress) => setProgress(newProgress)}
            />
          )}

          {content?.type === 'assignment' && isTeacher && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📝</span>
                <div>
                  <h3 className="font-semibold text-blue-900">Assignment Details</h3>
                  <p className="text-blue-700 text-sm">
                    {content.submission_type === 'file' ? 'File upload' : 
                     content.submission_type === 'text' ? 'Text entry' : 'File upload or text entry'} required
                  </p>
                </div>
              </div>
              
              {content.description && (
                <p className="text-blue-800 mb-4">{content.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {content.due_date && (
                  <div>
                    <span className="font-medium text-blue-900">Due Date:</span>
                    <span className="ml-2 text-blue-700">
                      {new Date(content.due_date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}
                {content.total_points && (
                  <div>
                    <span className="font-medium text-blue-900">Total Points:</span>
                    <span className="ml-2 text-blue-700">{content.total_points}</span>
                  </div>
                )}
                {content.evaluation_type && (
                  <div>
                    <span className="font-medium text-blue-900">Evaluation Type:</span>
                    <span className="ml-2 text-blue-700">
                      {content.evaluation_type === 'of' ? 'OF Learning (Counts toward grade)' : 
                       content.evaluation_type === 'for' ? 'FOR Learning (Diagnostic)' : 'AS Learning (Practice)'}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-blue-200">
                <p className="text-sm text-blue-600">
                  To grade submissions, go to the <strong>Grades</strong> tab in the course view.
                </p>
              </div>
            </div>
          )}

          {content?.type === 'quiz' && isStudent && (
            <QuizViewer
              content={content}
              progress={progress}
              onProgressUpdate={(newProgress) => setProgress(newProgress)}
            />
          )}

          {content?.type === 'quiz' && isTeacher && (
            <TeacherQuizView 
              content={content}
              onQuizSaved={fetchContent}
            />
          )}
        </div>

        {/* Mark Complete Button - for students viewing reading/video (not assignments - those complete via submission) */}
        {isStudent && (content?.type === 'reading' || content?.type === 'video') && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">
                  {isCompleted ? 'Great job!' : 'Finished this content?'}
                </h3>
                <p className="text-sm text-gray-500">
                  {isCompleted 
                    ? 'You have completed this content item.' 
                    : 'Mark this content as complete to track your progress.'}
                </p>
              </div>
              
              {isCompleted ? (
                <button
                  onClick={handleMarkIncomplete}
                  disabled={marking}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  {marking ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  Mark Incomplete
                </button>
              ) : (
                <button
                  onClick={handleMarkComplete}
                  disabled={marking}
                  className="btn btn-success flex items-center gap-2"
                >
                  {marking ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Mark Complete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-6">
          <div>
            {prevContent ? (
              <Link
                to={`/content/${prevContent.id}`}
                className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <div className="text-left">
                  <span className="text-xs text-gray-400 block">Previous</span>
                  <span className="font-medium">{prevContent.name}</span>
                </div>
              </Link>
            ) : (
              <div></div>
            )}
          </div>

          <Link
            to={`/courses/${course?.id}`}
            className="btn btn-secondary"
          >
            Back to Course
          </Link>

          <div>
            {nextContent ? (
              <Link
                to={`/content/${nextContent.id}`}
                className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors"
              >
                <div className="text-right">
                  <span className="text-xs text-gray-400 block">Next</span>
                  <span className="font-medium">{nextContent.name}</span>
                </div>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ) : (
              <div></div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

/**
 * TeacherQuizView - Teacher's view of a quiz with edit capabilities
 */
function TeacherQuizView({ content, onQuizSaved }) {
  const [showBuilder, setShowBuilder] = useState(false)
  const [quizConfig, setQuizConfig] = useState(content?.quiz_config)

  const hasQuestions = quizConfig?.questions?.length > 0
  const totalPoints = quizConfig?.questions?.reduce((sum, q) => sum + (q.points || 1), 0) || 0
  const questionCounts = quizConfig?.questions?.reduce((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1
    return acc
  }, {}) || {}

  if (showBuilder) {
    return (
      <QuizBuilder
        content={content}
        onSave={() => {
          setShowBuilder(false)
          onQuizSaved && onQuizSaved()
        }}
        onCancel={() => setShowBuilder(false)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Quiz Overview Card */}
      <div className="card p-6 bg-purple-50 border border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📝</span>
            <div>
              <h3 className="font-semibold text-purple-900">Quiz Details</h3>
              <p className="text-purple-700 text-sm">
                {hasQuestions 
                  ? `${quizConfig.questions.length} questions • ${totalPoints} total points`
                  : 'No questions configured yet'
                }
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowBuilder(true)}
            className="btn btn-primary"
          >
            {hasQuestions ? 'Edit Quiz' : 'Build Quiz'}
          </button>
        </div>

        {hasQuestions && (
          <>
            {/* Question Type Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {Object.entries(questionCounts).map(([type, count]) => (
                <div key={type} className="bg-white rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-purple-700">{count}</div>
                  <div className="text-xs text-purple-600">
                    {type.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>

            {/* Time Limit */}
            {quizConfig.time_limit && (
              <div className="flex items-center gap-2 text-sm text-purple-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Time limit: {quizConfig.time_limit} minutes
              </div>
            )}
          </>
        )}

        {/* Evaluation Type */}
        {content.evaluation_type && (
          <div className="mt-4 pt-4 border-t border-purple-200">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              content.evaluation_type === 'of' 
                ? 'bg-success-100 text-success-700' 
                : content.evaluation_type === 'for'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {content.evaluation_type === 'of' && '✓ Counts toward grade (OF Learning)'}
              {content.evaluation_type === 'for' && 'Practice (FOR Learning)'}
              {content.evaluation_type === 'as' && 'Self-assessment (AS Learning)'}
            </span>
          </div>
        )}
      </div>

      {/* Grading Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> To grade quiz attempts, go to the <strong>Grades</strong> tab in the course view.
          Multiple choice and true/false questions are auto-graded. Short answer and essay questions require manual grading.
        </p>
      </div>
    </div>
  )
}
