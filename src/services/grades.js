import { supabase } from './supabase'

// ============================================
// STUDENT GRADE QUERIES
// ============================================

/**
 * Get a student's enrollment with calculated grade for a specific course
 * Used for polling grade updates
 */
export async function getStudentEnrollmentGrade(courseId, studentId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('calculated_grade, last_calculated_at')
    .eq('course_id', courseId)
    .eq('student_id', studentId)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Get all grades for a student in a specific course
 * Includes assignment details for display
 */
export async function getStudentCourseGrades(courseId, studentId) {
  const { data, error } = await supabase
    .from('grades')
    .select(`
      id,
      total_score,
      max_score,
      category_scores,
      feedback,
      graded_at,
      assignment:content!grades_assignment_id_fkey(
        id,
        name,
        type,
        category_weights,
        total_points,
        evaluation_type,
        module:modules(course_id)
      )
    `)
    .eq('student_id', studentId)

  if (error) {
    return { data: null, error }
  }

  // Filter to only grades for this course
  const courseGrades = data?.filter(g => 
    g.assignment?.module?.course_id === courseId
  ) || []

  return { data: courseGrades, error: null }
}

/**
 * Combined function to get all student grade data for a course
 * Used by the polling hook
 */
export async function fetchStudentGradeData(courseId, studentId) {
  // Fetch enrollment grade and individual grades in parallel
  const [enrollmentResult, gradesResult] = await Promise.all([
    getStudentEnrollmentGrade(courseId, studentId),
    getStudentCourseGrades(courseId, studentId)
  ])

  if (enrollmentResult.error) {
    throw new Error(enrollmentResult.error.message)
  }

  if (gradesResult.error) {
    throw new Error(gradesResult.error.message)
  }

  return {
    enrollmentGrade: enrollmentResult.data?.calculated_grade || null,
    lastCalculatedAt: enrollmentResult.data?.last_calculated_at || null,
    grades: gradesResult.data || []
  }
}

// ============================================
// TEACHER GRADEBOOK QUERIES
// ============================================

/**
 * Get all enrolled students with their calculated grades for a course
 * Used for the teacher gradebook view
 */
export async function getCourseGradebook(courseId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      enrolled_at,
      calculated_grade,
      last_calculated_at,
      student:profiles!enrollments_student_id_fkey(
        id,
        full_name,
        student_id
      )
    `)
    .eq('course_id', courseId)
    .order('enrolled_at', { ascending: true })

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Get detailed grade breakdown for all students in a course
 * Includes individual assignment grades
 */
export async function getCourseDetailedGrades(courseId) {
  // First get all enrollments
  const { data: enrollments, error: enrollmentError } = await getCourseGradebook(courseId)
  
  if (enrollmentError) {
    return { data: null, error: enrollmentError }
  }

  // Get all assignments for this course
  const { data: assignments, error: assignmentError } = await supabase
    .from('content')
    .select(`
      id,
      name,
      type,
      total_points,
      evaluation_type,
      category_weights,
      module:modules!inner(course_id)
    `)
    .eq('module.course_id', courseId)
    .in('type', ['assignment', 'quiz'])
    .order('created_at', { ascending: true })

  if (assignmentError) {
    return { data: null, error: assignmentError }
  }

  // Get all grades for all students in this course
  const studentIds = enrollments?.map(e => e.student?.id).filter(Boolean) || []
  const assignmentIds = assignments?.map(a => a.id) || []

  let grades = []
  if (studentIds.length > 0 && assignmentIds.length > 0) {
    const { data: gradesData, error: gradesError } = await supabase
      .from('grades')
      .select(`
        id,
        assignment_id,
        student_id,
        total_score,
        max_score,
        category_scores,
        graded_at
      `)
      .in('student_id', studentIds)
      .in('assignment_id', assignmentIds)

    if (gradesError) {
      return { data: null, error: gradesError }
    }

    grades = gradesData || []
  }

  // Create a grade lookup map: student_id -> assignment_id -> grade
  const gradeLookup = new Map()
  grades.forEach(g => {
    if (!gradeLookup.has(g.student_id)) {
      gradeLookup.set(g.student_id, new Map())
    }
    gradeLookup.get(g.student_id).set(g.assignment_id, g)
  })

  // Build the complete gradebook data
  const gradebook = enrollments?.map(enrollment => ({
    student: enrollment.student,
    enrolledAt: enrollment.enrolled_at,
    calculatedGrade: enrollment.calculated_grade,
    lastCalculatedAt: enrollment.last_calculated_at,
    assignmentGrades: assignments?.map(assignment => ({
      assignment,
      grade: gradeLookup.get(enrollment.student?.id)?.get(assignment.id) || null
    })) || []
  })) || []

  return { 
    data: {
      students: gradebook,
      assignments: assignments || []
    }, 
    error: null 
  }
}

/**
 * Manually trigger grade recalculation for a student
 * Calls the PostgreSQL function directly
 */
export async function recalculateStudentGrade(studentId, courseId) {
  const { data, error } = await supabase
    .rpc('calculate_student_grade', {
      p_student_id: studentId,
      p_course_id: courseId
    })

  if (error) {
    return { data: null, error }
  }

  // Update the enrollment with the new calculated grade
  const { error: updateError } = await supabase
    .from('enrollments')
    .update({
      calculated_grade: data,
      last_calculated_at: new Date().toISOString()
    })
    .eq('student_id', studentId)
    .eq('course_id', courseId)

  if (updateError) {
    return { data: null, error: updateError }
  }

  return { data, error: null }
}

// ============================================
// GRADE STATISTICS
// ============================================

/**
 * Get grade statistics for a course
 */
export async function getCourseGradeStats(courseId) {
  const { data: gradebook, error } = await getCourseGradebook(courseId)

  if (error) {
    return { data: null, error }
  }

  const gradesWithFinal = gradebook?.filter(e => 
    e.calculated_grade?.final_grade !== null && 
    e.calculated_grade?.final_grade !== undefined
  ) || []

  if (gradesWithFinal.length === 0) {
    return {
      data: {
        average: null,
        highest: null,
        lowest: null,
        count: 0,
        totalStudents: gradebook?.length || 0
      },
      error: null
    }
  }

  const finalGrades = gradesWithFinal.map(e => e.calculated_grade.final_grade)
  const average = finalGrades.reduce((a, b) => a + b, 0) / finalGrades.length
  const highest = Math.max(...finalGrades)
  const lowest = Math.min(...finalGrades)

  return {
    data: {
      average: Math.round(average * 100) / 100,
      highest,
      lowest,
      count: gradesWithFinal.length,
      totalStudents: gradebook?.length || 0
    },
    error: null
  }
}
