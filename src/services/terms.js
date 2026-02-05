import { supabase } from './supabase'

/**
 * Get all terms ordered by creation date (newest first)
 */
export async function getTerms() {
  const { data, error } = await supabase
    .from('terms')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * Create a new term
 * @param {string} name - The term name (e.g., "Fall 2025")
 */
export async function createTerm(name) {
  const { data, error } = await supabase
    .from('terms')
    .insert({ name: name.trim() })
    .select()
    .single()

  return { data, error }
}

/**
 * Update a term's name
 * @param {string} termId - The term ID
 * @param {string} name - The new term name
 */
export async function updateTerm(termId, name) {
  const { data, error } = await supabase
    .from('terms')
    .update({ name: name.trim() })
    .eq('id', termId)
    .select()
    .single()

  return { data, error }
}

/**
 * Delete a term
 * Note: Enrollments with this term_id will have their term_id set to NULL
 * @param {string} termId - The term ID to delete
 */
export async function deleteTerm(termId) {
  const { error } = await supabase
    .from('terms')
    .delete()
    .eq('id', termId)

  return { error }
}

/**
 * Get a single term by ID
 * @param {string} termId - The term ID
 */
export async function getTerm(termId) {
  const { data, error } = await supabase
    .from('terms')
    .select('id, name, created_at')
    .eq('id', termId)
    .single()

  return { data, error }
}
