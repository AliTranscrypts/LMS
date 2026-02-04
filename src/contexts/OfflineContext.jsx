import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as offlineDb from '../services/offlineDb'

const OfflineContext = createContext(null)

export function useOffline() {
  const context = useContext(OfflineContext)
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider')
  }
  return context
}

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingSubmissions, setPendingSubmissions] = useState([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState(null)

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Trigger sync when coming back online
      syncPendingSubmissions()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load pending submissions on mount
  useEffect(() => {
    loadPendingSubmissions()
  }, [])

  const loadPendingSubmissions = async () => {
    try {
      const pending = await offlineDb.getPendingSubmissions()
      setPendingSubmissions(pending.filter(s => s.status === 'pending'))
    } catch (error) {
      console.error('Failed to load pending submissions:', error)
    }
  }

  // Queue a submission for later sync
  const queueSubmission = useCallback(async (submissionData) => {
    try {
      const id = await offlineDb.addPendingSubmission(submissionData)
      await loadPendingSubmissions()
      return { id, queued: true }
    } catch (error) {
      console.error('Failed to queue submission:', error)
      throw error
    }
  }, [])

  // Sync pending submissions when online
  const syncPendingSubmissions = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return

    setIsSyncing(true)
    try {
      const pending = await offlineDb.getPendingSubmissions()
      const toSync = pending.filter(s => s.status === 'pending')

      for (const submission of toSync) {
        try {
          // Import dynamically to avoid circular dependency
          const { createSubmission } = await import('../services/assignments')
          
          await createSubmission(
            submission.assignment_id,
            submission.student_id,
            submission.submission_data,
            submission.due_date
          )

          // Mark as synced
          await offlineDb.updatePendingSubmission(submission.id, { status: 'synced' })
        } catch (error) {
          console.error('Failed to sync submission:', submission.id, error)
          await offlineDb.updatePendingSubmission(submission.id, { 
            status: 'failed',
            error: error.message 
          })
        }
      }

      // Clean up synced submissions
      await offlineDb.clearSyncedSubmissions()
      await loadPendingSubmissions()
      setLastSyncTime(Date.now())
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing])

  // Get cache statistics
  const getCacheStats = useCallback(async () => {
    return offlineDb.getCacheStats()
  }, [])

  // Clear all cached data
  const clearCache = useCallback(async () => {
    await offlineDb.clearAllCache()
  }, [])

  const value = {
    isOnline,
    pendingSubmissions,
    pendingCount: pendingSubmissions.length,
    isSyncing,
    lastSyncTime,
    queueSubmission,
    syncPendingSubmissions,
    getCacheStats,
    clearCache
  }

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  )
}

export default OfflineContext
