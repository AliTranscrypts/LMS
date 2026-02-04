import { supabase } from './supabase'

/**
 * Get progress for a student in a course
 */
export async function getStudentCourseProgress(studentId, courseId) {
  // Get all content items in the course
  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select(`
      id,
      name,
      content:content(id, name, type)
    `)
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  if (modulesError) return { data: null, error: modulesError }

  // Get completed content items for the student
  const { data: progress, error: progressError } = await supabase
    .from('content_progress')
    .select('content_id, completed')
    .eq('student_id', studentId)
    .eq('completed', true)

  if (progressError) return { data: null, error: progressError }

  // Calculate progress
  const completedIds = new Set(progress?.map(p => p.content_id) || [])
  
  let totalContent = 0
  let completedContent = 0

  const modulesWithProgress = modules?.map(module => {
    const contentWithProgress = module.content?.map(item => {
      totalContent++
      const isComplete = completedIds.has(item.id)
      if (isComplete) completedContent++
      return { ...item, completed: isComplete }
    }) || []

    const moduleCompleted = contentWithProgress.filter(c => c.completed).length
    const moduleTotal = contentWithProgress.length

    return {
      ...module,
      content: contentWithProgress,
      completedCount: moduleCompleted,
      totalCount: moduleTotal,
      percentComplete: moduleTotal > 0 ? Math.round((moduleCompleted / moduleTotal) * 100) : 0
    }
  }) || []

  return {
    data: {
      modules: modulesWithProgress,
      totalContent,
      completedContent,
      percentComplete: totalContent > 0 ? Math.round((completedContent / totalContent) * 100) : 0
    },
    error: null
  }
}

/**
 * Mark content as complete
 */
export async function markContentComplete(contentId, studentId) {
  const { data, error } = await supabase
    .from('content_progress')
    .upsert({
      content_id: contentId,
      student_id: studentId,
      completed: true,
      completed_at: new Date().toISOString()
    }, {
      onConflict: 'content_id,student_id'
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Mark content as incomplete
 */
export async function markContentIncomplete(contentId, studentId) {
  const { data, error } = await supabase
    .from('content_progress')
    .upsert({
      content_id: contentId,
      student_id: studentId,
      completed: false,
      completed_at: null
    }, {
      onConflict: 'content_id,student_id'
    })
    .select()
    .single()

  return { data, error }
}
