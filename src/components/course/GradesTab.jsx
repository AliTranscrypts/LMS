import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../services/supabase'

export default function GradesTab({ course, isTeacher, studentId }) {
  const [loading, setLoading] = useState(true)
  const [grades, setGrades] = useState([])
  const [enrollmentGrade, setEnrollmentGrade] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isTeacher) {
      fetchTeacherGradesOverview()
    } else {
      fetchStudentGrades()
    }
  }, [course.id, studentId, isTeacher])

  const fetchStudentGrades = async () => {
    setLoading(true)
    
    // Fetch enrollment with calculated grade
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('calculated_grade')
      .eq('course_id', course.id)
      .eq('student_id', studentId)
      .single()

    if (enrollmentError && enrollmentError.code !== 'PGRST116') {
      console.error(enrollmentError)
    } else {
      setEnrollmentGrade(enrollment?.calculated_grade)
    }

    // Fetch individual grades
    const { data: gradesData, error: gradesError } = await supabase
      .from('grades')
      .select(`
        *,
        assignment:content(id, name, type, category_weights, total_points)
      `)
      .eq('student_id', studentId)

    if (gradesError) {
      setError('Failed to load grades')
      console.error(gradesError)
    } else {
      setGrades(gradesData || [])
    }

    setLoading(false)
  }

  const fetchTeacherGradesOverview = async () => {
    setLoading(true)
    // For teachers, show assignments list with grading status
    // This is a placeholder - full implementation would show all assignments with submission counts
    
    const { data, error } = await supabase
      .from('content')
      .select(`
        id,
        name,
        type,
        total_points,
        module:modules!inner(course_id)
      `)
      .eq('module.course_id', course.id)
      .in('type', ['assignment', 'quiz'])

    if (error) {
      setError('Failed to load assignments')
      console.error(error)
    } else {
      setGrades(data || [])
    }

    setLoading(false)
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

  // Student view
  if (!isTeacher) {
    return <StudentGradesView grades={grades} enrollmentGrade={enrollmentGrade} categoryWeights={course.category_weights} />
  }

  // Teacher view
  return <TeacherGradesView assignments={grades} courseId={course.id} />
}

function StudentGradesView({ grades, enrollmentGrade, categoryWeights }) {
  const finalGrade = enrollmentGrade?.final_grade
  const categories = enrollmentGrade?.categories || {}

  return (
    <div>
      {/* Grade Summary */}
      <div className="card p-6 mb-6">
        <div className="text-center mb-6">
          <div className="text-5xl font-bold text-success-600 mb-2">
            {finalGrade !== undefined && finalGrade !== null ? `${finalGrade}%` : '--'}
          </div>
          <p className="text-gray-600">Overall Course Grade</p>
        </div>

        {/* Category Breakdown */}
        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Category Breakdown</h3>
          <div className="space-y-4">
            {Object.entries(categoryWeights || {}).map(([key, weight]) => {
              const categoryGrade = categories[key]
              const label = key === 'ku' ? 'Knowledge & Understanding' : key.charAt(0).toUpperCase() + key.slice(1)
              
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{label} ({weight}% weight)</span>
                    <span className="font-medium text-gray-900">
                      {categoryGrade !== undefined && categoryGrade !== null ? `${categoryGrade}%` : '--'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-success-500 h-2 rounded-full transition-all"
                      style={{ width: `${categoryGrade || 0}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Individual Grades */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Graded Assignments</h3>
        
        {grades.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No graded assignments yet.
          </div>
        ) : (
          <div className="space-y-4">
            {grades.map((grade) => (
              <div key={grade.id} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{grade.assignment?.name}</h4>
                    <p className="text-sm text-gray-500">
                      Graded on {new Date(grade.graded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-success-600">
                      {grade.total_score}/{grade.max_score}
                    </div>
                    <div className="text-sm text-gray-500">
                      {Math.round((grade.total_score / grade.max_score) * 100)}%
                    </div>
                  </div>
                </div>
                
                {/* Category scores */}
                {grade.category_scores && (
                  <div className="flex flex-wrap gap-3 text-sm">
                    {Object.entries(grade.category_scores).map(([key, value]) => {
                      const maxValue = grade.assignment?.category_weights?.[key]
                      const label = key === 'ku' ? 'K&U' : key.charAt(0).toUpperCase() + key.slice(1)
                      return value !== undefined && value !== null && (
                        <span key={key} className="text-gray-600">
                          {label}: {value}{maxValue ? `/${maxValue}` : ''}
                        </span>
                      )
                    })}
                  </div>
                )}

                {grade.feedback && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 italic">
                    {grade.feedback}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TeacherGradesView({ assignments, courseId }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Assignments & Quizzes</h2>
      
      {assignments.length === 0 ? (
        <div className="card p-6 text-center text-gray-500">
          No assignments or quizzes have been created yet.
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="card p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {assignment.type === 'quiz' ? '❓' : '📝'}
                  </span>
                  <div>
                    <h3 className="font-medium text-gray-900">{assignment.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{assignment.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  {assignment.total_points && (
                    <p className="text-sm text-gray-600">{assignment.total_points} points</p>
                  )}
                  <p className="text-sm text-primary-600 font-medium">View Submissions →</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
