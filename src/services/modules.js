import { supabase } from './supabase'

/**
 * Get all modules for a course with their content
 */
export async function getCourseModules(courseId) {
  const { data, error } = await supabase
    .from('modules')
    .select(`
      *,
      content:content(*)
    `)
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  // Sort content by order_index within each module
  if (data) {
    data.forEach(module => {
      if (module.content) {
        module.content.sort((a, b) => a.order_index - b.order_index)
      }
    })
  }

  return { data, error }
}

/**
 * Create a new module
 */
export async function createModule(courseId, name, orderIndex) {
  const { data, error } = await supabase
    .from('modules')
    .insert({
      course_id: courseId,
      name,
      order_index: orderIndex
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Update a module
 */
export async function updateModule(moduleId, updates) {
  const { data, error } = await supabase
    .from('modules')
    .update(updates)
    .eq('id', moduleId)
    .select()
    .single()

  return { data, error }
}

/**
 * Delete a module
 */
export async function deleteModule(moduleId) {
  const { data, error } = await supabase
    .from('modules')
    .delete()
    .eq('id', moduleId)

  return { data, error }
}

/**
 * Reorder modules - updates order_index for multiple modules
 */
export async function reorderModules(modules) {
  // Use a transaction-like approach by updating each module
  const updates = modules.map((module, index) => 
    supabase
      .from('modules')
      .update({ order_index: index })
      .eq('id', module.id)
  )

  const results = await Promise.all(updates)
  const errors = results.filter(r => r.error)
  
  if (errors.length > 0) {
    return { error: errors[0].error }
  }

  return { data: modules }
}

/**
 * Add content to a module
 */
export async function addContent(moduleId, contentData) {
  const { data, error } = await supabase
    .from('content')
    .insert({
      module_id: moduleId,
      type: contentData.type,
      name: contentData.name,
      description: contentData.description || null,
      order_index: contentData.orderIndex,
      file_url: contentData.fileUrl || null,
      file_size: contentData.fileSize || null,
      file_type: contentData.fileType || null,
      submission_type: contentData.submissionType || null,
      category_weights: contentData.categoryWeights || null,
      evaluation_type: contentData.evaluationType || null,
      due_date: contentData.dueDate || null,
      total_points: contentData.totalPoints || null,
      quiz_config: contentData.quizConfig || null,
      // Assignment attachment fields (optional document/video for students)
      attachment_type: contentData.attachmentType || null,
      attachment_url: contentData.attachmentUrl || null,
      attachment_file_name: contentData.attachmentFileName || null,
      attachment_file_size: contentData.attachmentFileSize || null,
      attachment_file_type: contentData.attachmentFileType || null
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Update content item
 */
export async function updateContent(contentId, updates) {
  const { data, error } = await supabase
    .from('content')
    .update(updates)
    .eq('id', contentId)
    .select()
    .single()

  return { data, error }
}

/**
 * Delete content item
 */
export async function deleteContent(contentId) {
  const { data, error } = await supabase
    .from('content')
    .delete()
    .eq('id', contentId)

  return { data, error }
}

/**
 * Reorder content within a module
 */
export async function reorderContent(contentItems) {
  const updates = contentItems.map((item, index) => 
    supabase
      .from('content')
      .update({ order_index: index })
      .eq('id', item.id)
  )

  const results = await Promise.all(updates)
  const errors = results.filter(r => r.error)
  
  if (errors.length > 0) {
    return { error: errors[0].error }
  }

  return { data: contentItems }
}

/**
 * Move content to a different module
 */
export async function moveContent(contentId, newModuleId, newOrderIndex) {
  const { data, error } = await supabase
    .from('content')
    .update({ 
      module_id: newModuleId,
      order_index: newOrderIndex 
    })
    .eq('id', contentId)
    .select()
    .single()

  return { data, error }
}
