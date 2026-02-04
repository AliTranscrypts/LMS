import { useOffline } from '../../contexts/OfflineContext'

export default function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing } = useOffline()

  // Don't show anything when online and no pending items
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="flex items-center gap-2 bg-warning-600 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" 
            />
          </svg>
          <span className="text-sm font-medium">You're offline</span>
        </div>
      )}

      {/* Pending submissions indicator */}
      {pendingCount > 0 && (
        <div className={`flex items-center gap-2 ${isOnline ? 'bg-primary-600' : 'bg-gray-600'} text-white px-4 py-2 rounded-lg shadow-lg`}>
          {isSyncing ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
              <span className="text-sm font-medium">Syncing...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <span className="text-sm font-medium">
                {pendingCount} pending {pendingCount === 1 ? 'submission' : 'submissions'}
              </span>
            </>
          )}
        </div>
      )}

      {/* Back online notification */}
      {isOnline && pendingCount === 0 && isSyncing && (
        <div className="flex items-center gap-2 bg-success-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 13l4 4L19 7" 
            />
          </svg>
          <span className="text-sm font-medium">Back online - Synced!</span>
        </div>
      )}
    </div>
  )
}
