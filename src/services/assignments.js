import { supabase } from './supabase'
import * as offlineDb from './offlineDb'

// ============================================
// SUBMISSIONS
// ============================================

/**
 * Get all submissions for a student for a specific assignment
 */
export async function getStudentSubmissions(assignmentId, studentId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .order('version', { ascending: false })

  return { data, error }
}

/**
 * Get the latest submission for a student
 */
export async function getLatestSubmission(assignmentId, studentId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  // PGRST116 means no rows found - not an error for us
  if (error?.code === 'PGRST116') {
    return { data: null, error: null }
  }

  return { data, error }
}

/**
 * Get all submissions for an assignment (teacher view)
 */
export async function getAssignmentSubmissions(assignmentId) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      student:profiles!submissions_student_id_fkey(id, full_name, student_id)
    `)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })

  return { data, error }
}

/**
 * Get unique students who have submitted for an assignment
 */
export async function getSubmittedStudents(assignmentId) {
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select(`
      student_id,
      student:profiles!submissions_student_id_fkey(id, full_name, student_id),
      submitted_at,
      is_late,
      version
    `)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })

  if (error) return { data: null, error }

  // Group submissions by student and get their latest version
  const studentMap = new Map()
  submissions?.forEach(sub => {
    if (!studentMap.has(sub.student_id)) {
      studentMap.set(sub.student_id, {
        student_id: sub.student_id,
        student: sub.student,
        latest_submission: sub,
        submission_count: 1
      })
    } else {
      studentMap.get(sub.student_id).submission_count++
    }
  })

  return { data: Array.from(studentMap.values()), error: null }
}

/**
 * Create a new submission (with offline queuing support)
 * If offline, the submission is queued for later sync
 */
export async function createSubmission(assignmentId, studentId, submissionData, dueDate) {
  const isOnline = navigator.onLine

  // If offline, queue the submission
  if (!isOnline) {
    try {
      const id = await offlineDb.addPendingSubmission({
        assignment_id: assignmentId,
        student_id: studentId,
        submission_data: submissionData,
        due_date: dueDate
      })
      return { 
        data: { id, queued: true }, 
        error: null,
        queued: true 
      }
    } catch (error) {
      return { data: null, error, queued: false }
    }
  }

  // Online - submit directly
  try {
    // Get current version count
    const { data: existing } = await supabase
      .from('submissions')
      .select('version')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const newVersion = (existing?.version || 0) + 1
    const now = new Date()
    const isLate = dueDate ? now > new Date(dueDate) : false

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        submission_data: submissionData,
        is_late: isLate,
        version: newVersion
      })
      .select()
      .single()

    return { data, error, queued: false }
  } catch (networkError) {
    // Network error during submission - queue it
    console.warn('Network error, queueing submission:', networkError)
    try {
      const id = await offlineDb.addPendingSubmission({
        assignment_id: assignmentId,
        student_id: studentId,
        submission_data: submissionData,
        due_date: dueDate
      })
      return { 
        data: { id, queued: true }, 
        error: null,
        queued: true 
      }
    } catch (queueError) {
      return { data: null, error: queueError, queued: false }
    }
  }
}

// ============================================
// GRADES
// ============================================

/**
 * Get grade for a student on an assignment
 */
export async function getStudentGrade(assignmentId, studentId) {
  const { data, error } = await supabase
    .from('grades')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .single()

  // PGRST116 means no rows found - not an error for us
  if (error?.code === 'PGRST116') {
    return { data: null, error: null }
  }

  return { data, error }
}

/**
 * Get all grades for an assignment (teacher view)
 */
export async function getAssignmentGrades(assignmentId) {
  const { data, error } = await supabase
    .from('grades')
    .select(`
      *,
      student:profiles!grades_student_id_fkey(id, full_name, student_id)
    `)
    .eq('assignment_id', assignmentId)

  return { data, error }
}

/**
 * Save or update a grade (upsert)
 */
export async function saveGrade(assignmentId, studentId, gradeData, gradedBy) {
  const { category_scores, total_score, max_score, feedback, submission_id } = gradeData

  const { data, error } = await supabase
    .from('grades')
    .upsert({
      assignment_id: assignmentId,
      student_id: studentId,
      category_scores,
      total_score,
      max_score,
      feedback: feedback || null,
      submission_id: submission_id || null,
      graded_by: gradedBy,
      graded_at: new Date().toISOString()
    }, {
      onConflict: 'assignment_id,student_id'
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Delete a grade
 */
export async function deleteGrade(assignmentId, studentId) {
  const { error } = await supabase
    .from('grades')
    .delete()
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)

  return { error }
}

// ============================================
// ASSIGNMENT CONTENT
// ============================================

/**
 * Get assignment details with related data
 */
export async function getAssignmentDetails(assignmentId) {
  const { data, error } = await supabase
    .from('content')
    .select(`
      *,
      module:modules(
        id,
        name,
        course_id,
        course:courses(
          id,
          name,
          teacher_id,
          category_weights
        )
      )
    `)
    .eq('id', assignmentId)
    .eq('type', 'assignment')
    .single()

  return { data, error }
}

/**
 * Get all assignments in a course
 */
export async function getCourseAssignments(courseId) {
  const { data, error } = await supabase
    .from('content')
    .select(`
      *,
      module:modules!inner(
        id,
        name,
        course_id
      )
    `)
    .eq('module.course_id', courseId)
    .eq('type', 'assignment')
    .order('created_at', { ascending: true })

  return { data, error }
}

// ============================================
// ENROLLED STUDENTS
// ============================================

/**
 * Get enrolled students for a course
 */
export async function getCourseEnrolledStudents(courseId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      student_id,
      enrolled_at,
      calculated_grade,
      student:profiles!enrollments_student_id_fkey(id, full_name, student_id)
    `)
    .eq('course_id', courseId)
    .order('enrolled_at', { ascending: true })

  return { data, error }
}

// ============================================
// FILE UPLOADS FOR SUBMISSIONS
// ============================================

/**
 * Generate storage path for submission file
 */
export function generateSubmissionPath(assignmentId, studentId, fileName) {
  const ext = fileName.split('.').pop()
  const timestamp = Date.now()
  return `submissions/${assignmentId}/${studentId}/${timestamp}.${ext}`
}

/**
 * Upload submission file
 */
export async function uploadSubmissionFile(file, assignmentId, studentId) {
  const path = generateSubmissionPath(assignmentId, studentId, file.name)

  const { data, error } = await supabase.storage
    .from('course-content')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    return { data: null, error }
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('course-content')
    .getPublicUrl(path)

  return {
    data: {
      path: data.path,
      url: urlData.publicUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    },
    error: null
  }
}

/**
 * Download submission file
 */
export async function downloadSubmissionFile(path) {
  const { data, error } = await supabase.storage
    .from('course-content')
    .download(path)

  return { data, error }
}

/**
 * Get signed URL for submission file (for downloading)
 */
export async function getSubmissionSignedUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('course-content')
    .createSignedUrl(path, expiresIn)

  return { data, error }
}
