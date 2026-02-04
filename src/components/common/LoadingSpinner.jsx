/**
 * Loading spinner component with various sizes
 */
export default function LoadingSpinner({ 
  size = 'md', 
  className = '',
  fullScreen = false,
  message = '' 
}) {
  const sizeClasses = {
    xs: 'h-4 w-4 border-2',
    sm: 'h-6 w-6 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
    xl: 'h-16 w-16 border-4'
  }

  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div 
        className={`animate-spin rounded-full border-primary-600 border-t-transparent ${sizeClasses[size]}`}
      />
      {message && (
        <p className="text-sm text-gray-600">{message}</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {spinner}
      </div>
    )
  }

  return spinner
}

/**
 * Full page loading state
 */
export function PageLoader({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

/**
 * Skeleton loader for content
 */
export function Skeleton({ className = '', variant = 'rect' }) {
  const baseClasses = 'animate-pulse bg-gray-200'
  
  const variantClasses = {
    rect: 'rounded',
    circle: 'rounded-full',
    text: 'rounded h-4'
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  )
}

/**
 * Card skeleton for loading states
 */
export function CardSkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <Skeleton className="h-6 w-3/4" variant="text" />
      <Skeleton className="h-4 w-full" variant="text" />
      <Skeleton className="h-4 w-2/3" variant="text" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded" />
        <Skeleton className="h-8 w-20 rounded" />
      </div>
    </div>
  )
}

/**
 * List skeleton for loading states
 */
export function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200">
          <Skeleton className="h-10 w-10" variant="circle" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" variant="text" />
            <Skeleton className="h-3 w-1/2" variant="text" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Table skeleton for loading states
 */
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" variant="text" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-4 py-3 flex gap-4">
            {Array.from({ length: cols }).map((_, colIdx) => (
              <Skeleton key={colIdx} className="h-4 flex-1" variant="text" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
