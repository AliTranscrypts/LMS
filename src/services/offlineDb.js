import { openDB } from 'idb'

const DB_NAME = 'lms-offline-db'
const DB_VERSION = 1

// Store names
const STORES = {
  COURSES: 'courses',
  MODULES: 'modules',
  CONTENT: 'content',
  ENROLLMENTS: 'enrollments',
  PENDING_SUBMISSIONS: 'pending-submissions',
  USER_PROFILE: 'user-profile'
}

/**
 * Initialize the IndexedDB database
 */
async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Courses store
      if (!db.objectStoreNames.contains(STORES.COURSES)) {
        const courseStore = db.createObjectStore(STORES.COURSES, { keyPath: 'id' })
        courseStore.createIndex('teacherId', 'teacher_id')
      }

      // Modules store
      if (!db.objectStoreNames.contains(STORES.MODULES)) {
        const moduleStore = db.createObjectStore(STORES.MODULES, { keyPath: 'id' })
        moduleStore.createIndex('courseId', 'course_id')
      }

      // Content store (syllabus, readings, videos, assignments)
      if (!db.objectStoreNames.contains(STORES.CONTENT)) {
        const contentStore = db.createObjectStore(STORES.CONTENT, { keyPath: 'id' })
        contentStore.createIndex('moduleId', 'module_id')
        contentStore.createIndex('type', 'type')
      }

      // Enrollments store
      if (!db.objectStoreNames.contains(STORES.ENROLLMENTS)) {
        const enrollmentStore = db.createObjectStore(STORES.ENROLLMENTS, { keyPath: ['course_id', 'student_id'] })
        enrollmentStore.createIndex('studentId', 'student_id')
        enrollmentStore.createIndex('courseId', 'course_id')
      }

      // Pending submissions store (for background sync)
      if (!db.objectStoreNames.contains(STORES.PENDING_SUBMISSIONS)) {
        const submissionStore = db.createObjectStore(STORES.PENDING_SUBMISSIONS, { 
          keyPath: 'id', 
          autoIncrement: true 
        })
        submissionStore.createIndex('assignmentId', 'assignment_id')
        submissionStore.createIndex('studentId', 'student_id')
        submissionStore.createIndex('timestamp', 'timestamp')
      }

      // User profile store
      if (!db.objectStoreNames.contains(STORES.USER_PROFILE)) {
        db.createObjectStore(STORES.USER_PROFILE, { keyPath: 'id' })
      }
    }
  })
}

// Singleton DB instance
let dbPromise = null
function getDB() {
  if (!dbPromise) {
    dbPromise = initDB()
  }
  return dbPromise
}

// ============================================
// COURSES
// ============================================

export async function cacheCourse(course) {
  const db = await getDB()
  await db.put(STORES.COURSES, {
    ...course,
    cachedAt: Date.now()
  })
}

export async function cacheCourses(courses) {
  const db = await getDB()
  const tx = db.transaction(STORES.COURSES, 'readwrite')
  await Promise.all([
    ...courses.map(course => tx.store.put({ ...course, cachedAt: Date.now() })),
    tx.done
  ])
}

export async function getCachedCourse(courseId) {
  const db = await getDB()
  return db.get(STORES.COURSES, courseId)
}

export async function getCachedCoursesByTeacher(teacherId) {
  const db = await getDB()
  return db.getAllFromIndex(STORES.COURSES, 'teacherId', teacherId)
}

export async function getAllCachedCourses() {
  const db = await getDB()
  return db.getAll(STORES.COURSES)
}

// ============================================
// MODULES
// ============================================

export async function cacheModule(module) {
  const db = await getDB()
  await db.put(STORES.MODULES, {
    ...module,
    cachedAt: Date.now()
  })
}

export async function cacheModules(modules) {
  const db = await getDB()
  const tx = db.transaction(STORES.MODULES, 'readwrite')
  await Promise.all([
    ...modules.map(module => tx.store.put({ ...module, cachedAt: Date.now() })),
    tx.done
  ])
}

export async function getCachedModule(moduleId) {
  const db = await getDB()
  return db.get(STORES.MODULES, moduleId)
}

export async function getCachedModulesByCourse(courseId) {
  const db = await getDB()
  return db.getAllFromIndex(STORES.MODULES, 'courseId', courseId)
}

// ============================================
// CONTENT
// ============================================

export async function cacheContent(content) {
  const db = await getDB()
  await db.put(STORES.CONTENT, {
    ...content,
    cachedAt: Date.now()
  })
}

export async function cacheContentItems(contentItems) {
  const db = await getDB()
  const tx = db.transaction(STORES.CONTENT, 'readwrite')
  await Promise.all([
    ...contentItems.map(item => tx.store.put({ ...item, cachedAt: Date.now() })),
    tx.done
  ])
}

export async function getCachedContent(contentId) {
  const db = await getDB()
  return db.get(STORES.CONTENT, contentId)
}

export async function getCachedContentByModule(moduleId) {
  const db = await getDB()
  return db.getAllFromIndex(STORES.CONTENT, 'moduleId', moduleId)
}

// ============================================
// ENROLLMENTS
// ============================================

export async function cacheEnrollment(enrollment) {
  const db = await getDB()
  await db.put(STORES.ENROLLMENTS, {
    ...enrollment,
    cachedAt: Date.now()
  })
}

export async function cacheEnrollments(enrollments) {
  const db = await getDB()
  const tx = db.transaction(STORES.ENROLLMENTS, 'readwrite')
  await Promise.all([
    ...enrollments.map(e => tx.store.put({ ...e, cachedAt: Date.now() })),
    tx.done
  ])
}

export async function getCachedEnrollmentsByStudent(studentId) {
  const db = await getDB()
  return db.getAllFromIndex(STORES.ENROLLMENTS, 'studentId', studentId)
}

export async function getCachedEnrollmentsByCourse(courseId) {
  const db = await getDB()
  return db.getAllFromIndex(STORES.ENROLLMENTS, 'courseId', courseId)
}

// ============================================
// PENDING SUBMISSIONS (Background Sync)
// ============================================

export async function addPendingSubmission(submission) {
  const db = await getDB()
  const id = await db.add(STORES.PENDING_SUBMISSIONS, {
    ...submission,
    timestamp: Date.now(),
    status: 'pending'
  })
  return id
}

export async function getPendingSubmissions() {
  const db = await getDB()
  return db.getAll(STORES.PENDING_SUBMISSIONS)
}

export async function getPendingSubmissionsByStudent(studentId) {
  const db = await getDB()
  return db.getAllFromIndex(STORES.PENDING_SUBMISSIONS, 'studentId', studentId)
}

export async function updatePendingSubmission(id, updates) {
  const db = await getDB()
  const existing = await db.get(STORES.PENDING_SUBMISSIONS, id)
  if (existing) {
    await db.put(STORES.PENDING_SUBMISSIONS, { ...existing, ...updates })
  }
}

export async function removePendingSubmission(id) {
  const db = await getDB()
  await db.delete(STORES.PENDING_SUBMISSIONS, id)
}

export async function clearSyncedSubmissions() {
  const db = await getDB()
  const all = await db.getAll(STORES.PENDING_SUBMISSIONS)
  const synced = all.filter(s => s.status === 'synced')
  const tx = db.transaction(STORES.PENDING_SUBMISSIONS, 'readwrite')
  await Promise.all([
    ...synced.map(s => tx.store.delete(s.id)),
    tx.done
  ])
}

// ============================================
// USER PROFILE
// ============================================

export async function cacheUserProfile(profile) {
  const db = await getDB()
  await db.put(STORES.USER_PROFILE, {
    ...profile,
    cachedAt: Date.now()
  })
}

export async function getCachedUserProfile(userId) {
  const db = await getDB()
  return db.get(STORES.USER_PROFILE, userId)
}

// ============================================
// CACHE MANAGEMENT
// ============================================

export async function clearAllCache() {
  const db = await getDB()
  const tx = db.transaction(
    [STORES.COURSES, STORES.MODULES, STORES.CONTENT, STORES.ENROLLMENTS, STORES.USER_PROFILE],
    'readwrite'
  )
  await Promise.all([
    tx.objectStore(STORES.COURSES).clear(),
    tx.objectStore(STORES.MODULES).clear(),
    tx.objectStore(STORES.CONTENT).clear(),
    tx.objectStore(STORES.ENROLLMENTS).clear(),
    tx.objectStore(STORES.USER_PROFILE).clear(),
    tx.done
  ])
}

export async function getCacheStats() {
  const db = await getDB()
  const [courses, modules, content, enrollments, pending] = await Promise.all([
    db.count(STORES.COURSES),
    db.count(STORES.MODULES),
    db.count(STORES.CONTENT),
    db.count(STORES.ENROLLMENTS),
    db.count(STORES.PENDING_SUBMISSIONS)
  ])
  return { courses, modules, content, enrollments, pendingSubmissions: pending }
}

export { STORES }
