import { supabase } from './supabase'

// ============================================
// QUIZ CONFIGURATION HELPERS
// ============================================

/**
 * Question types supported by the quiz system
 */
export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  SHORT_ANSWER: 'short_answer',
  ESSAY: 'essay'
}

/**
 * Ontario curriculum categories
 */
export const CATEGORIES = {
  KU: 'ku',
  THINKING: 'thinking',
  APPLICATION: 'application',
  COMMUNICATION: 'communication'
}

export const CATEGORY_LABELS = {
  ku: 'Knowledge & Understanding',
  thinking: 'Thinking',
  application: 'Application',
  communication: 'Communication'
}

/**
 * Generate a unique question ID
 */
export function generateQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new question object with defaults
 */
export function createQuestion(type = QUESTION_TYPES.MULTIPLE_CHOICE) {
  const baseQuestion = {
    id: generateQuestionId(),
    type,
    text: '',
    category: CATEGORIES.KU,
    points: 1
  }

  switch (type) {
    case QUESTION_TYPES.MULTIPLE_CHOICE:
      return {
        ...baseQuestion,
        options: ['', '', '', ''],
        correct_answer: ''
      }
    case QUESTION_TYPES.TRUE_FALSE:
      return {
        ...baseQuestion,
        options: ['True', 'False'],
        correct_answer: 'True'
      }
    case QUESTION_TYPES.SHORT_ANSWER:
      return {
        ...baseQuestion,
        correct_answer: '' // For reference, not auto-graded
      }
    case QUESTION_TYPES.ESSAY:
      return {
        ...baseQuestion,
        correct_answer: '' // Rubric or sample answer for reference
      }
    default:
      return baseQuestion
  }
}

/**
 * Calculate category distribution from questions
 */
export function calculateCategoryDistribution(questions) {
  const distribution = {
    ku: 0,
    thinking: 0,
    application: 0,
    communication: 0
  }

  questions.forEach(q => {
    const category = q.category || 'ku'
    distribution[category] += q.points || 1
  })

  return distribution
}

/**
 * Calculate total points from questions
 */
export function calculateTotalPoints(questions) {
  return questions.reduce((sum, q) => sum + (q.points || 1), 0)
}

// ============================================
// QUIZ CRUD OPERATIONS
// ============================================

/**
 * Get quiz configuration for a content item
 */
export async function getQuizConfig(contentId) {
  const { data, error } = await supabase
    .from('content')
    .select('id, name, description, quiz_config, evaluation_type, category_weights, total_points')
    .eq('id', contentId)
    .eq('type', 'quiz')
    .single()

  return { data, error }
}

/**
 * Save quiz configuration
 */
export async function saveQuizConfig(contentId, quizConfig) {
  const totalPoints = calculateTotalPoints(quizConfig.questions || [])
  const categoryWeights = calculateCategoryDistribution(quizConfig.questions || [])

  const { data, error } = await supabase
    .from('content')
    .update({
      quiz_config: quizConfig,
      total_points: totalPoints,
      category_weights: categoryWeights
    })
    .eq('id', contentId)
    .select()
    .single()

  return { data, error }
}

/**
 * Create a new quiz content item
 */
export async function createQuiz(moduleId, quizData) {
  const totalPoints = calculateTotalPoints(quizData.questions || [])
  const categoryWeights = calculateCategoryDistribution(quizData.questions || [])

  const { data, error } = await supabase
    .from('content')
    .insert({
      module_id: moduleId,
      type: 'quiz',
      name: quizData.name,
      description: quizData.description || null,
      order_index: quizData.orderIndex || 0,
      quiz_config: {
        time_limit: quizData.timeLimit || null,
        questions: quizData.questions || []
      },
      evaluation_type: quizData.evaluationType || 'of',
      total_points: totalPoints,
      category_weights: categoryWeights
    })
    .select()
    .single()

  return { data, error }
}

// ============================================
// QUIZ ATTEMPT OPERATIONS
// ============================================

/**
 * Submit a quiz attempt for grading (calls server-side function)
 */
export async function submitQuizAttempt(quizId, studentId, answers) {
  const { data, error } = await supabase
    .rpc('grade_quiz_attempt', {
      p_quiz_id: quizId,
      p_student_id: studentId,
      p_answers: answers
    })

  return { data, error }
}

/**
 * Get student's quiz attempts for a specific quiz
 */
export async function getStudentQuizAttempts(quizId, studentId) {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })

  return { data, error }
}

/**
 * Get the latest quiz attempt for a student
 */
export async function getLatestQuizAttempt(quizId, studentId) {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code === 'PGRST116') {
    // No rows found - not an error
    return { data: null, error: null }
  }

  return { data, error }
}

/**
 * Get all quiz attempts for grading (teacher view)
 */
export async function getQuizAttemptsForGrading(quizId) {
  const { data, error } = await supabase
    .rpc('get_quiz_attempts_for_grading', {
      p_quiz_id: quizId
    })

  return { data, error }
}

/**
 * Get quiz attempt by ID with student info
 */
export async function getQuizAttemptById(attemptId) {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select(`
      *,
      student:profiles!quiz_attempts_student_id_fkey(
        id,
        full_name,
        student_id
      ),
      quiz:content!quiz_attempts_quiz_id_fkey(
        id,
        name,
        quiz_config,
        evaluation_type
      )
    `)
    .eq('id', attemptId)
    .single()

  return { data, error }
}

// ============================================
// MANUAL GRADING OPERATIONS
// ============================================

/**
 * Manually grade a quiz question (for short answer/essay)
 */
export async function manualGradeQuestion(attemptId, questionId, pointsEarned, graderId, feedback = null) {
  const { data, error } = await supabase
    .rpc('manual_grade_quiz_question', {
      p_attempt_id: attemptId,
      p_question_id: questionId,
      p_points_earned: pointsEarned,
      p_grader_id: graderId,
      p_feedback: feedback
    })

  return { data, error }
}

/**
 * Bulk update manual grades for an attempt
 */
export async function bulkGradeQuizAttempt(attemptId, questionGrades, graderId, overallFeedback = null) {
  // Update each question grade
  const results = []
  for (const qg of questionGrades) {
    const { data, error } = await manualGradeQuestion(
      attemptId,
      qg.questionId,
      qg.pointsEarned,
      graderId,
      qg.feedback
    )
    results.push({ questionId: qg.questionId, data, error })
  }

  // Update overall feedback if provided
  if (overallFeedback) {
    const { data: attemptData } = await getQuizAttemptById(attemptId)
    if (attemptData) {
      await supabase
        .from('grades')
        .update({ feedback: overallFeedback })
        .eq('assignment_id', attemptData.quiz_id)
        .eq('student_id', attemptData.student_id)
    }
  }

  return { results }
}

// ============================================
// QUIZ STATISTICS
// ============================================

/**
 * Get quiz statistics for a quiz (teacher view)
 */
export async function getQuizStats(quizId) {
  const { data: attempts, error } = await supabase
    .from('quiz_attempts')
    .select('total_score, max_score, is_graded')
    .eq('quiz_id', quizId)
    .eq('is_graded', true)

  if (error) {
    return { data: null, error }
  }

  if (!attempts || attempts.length === 0) {
    return {
      data: {
        totalAttempts: 0,
        gradedAttempts: 0,
        averageScore: null,
        highestScore: null,
        lowestScore: null,
        averagePercentage: null
      },
      error: null
    }
  }

  const scores = attempts.map(a => a.total_score)
  const percentages = attempts.map(a => (a.total_score / a.max_score) * 100)

  return {
    data: {
      totalAttempts: attempts.length,
      gradedAttempts: attempts.filter(a => a.is_graded).length,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      averagePercentage: Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length * 100) / 100
    },
    error: null
  }
}

/**
 * Check if a student has already attempted a quiz
 */
export async function hasStudentAttemptedQuiz(quizId, studentId) {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('id')
    .eq('quiz_id', quizId)
    .eq('student_id', studentId)
    .limit(1)

  if (error) {
    return { hasAttempted: false, error }
  }

  return { hasAttempted: data && data.length > 0, error: null }
}

/**
 * Get student's grade for a quiz
 */
export async function getStudentQuizGrade(quizId, studentId) {
  const { data, error } = await supabase
    .from('grades')
    .select('*')
    .eq('assignment_id', quizId)
    .eq('student_id', studentId)
    .single()

  if (error && error.code === 'PGRST116') {
    return { data: null, error: null }
  }

  return { data, error }
}
