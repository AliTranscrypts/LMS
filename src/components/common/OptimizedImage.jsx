import { useState, useCallback, memo } from 'react'

/**
 * Optimized image component with lazy loading and error handling
 */
function OptimizedImage({
  src,
  alt,
  className = '',
  placeholderClassName = '',
  errorFallback = null,
  onLoad,
  onError,
  loading = 'lazy',
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  const handleLoad = useCallback((e) => {
    setIsLoaded(true)
    onLoad?.(e)
  }, [onLoad])

  const handleError = useCallback((e) => {
    setHasError(true)
    onError?.(e)
  }, [onError])

  if (hasError) {
    if (errorFallback) {
      return errorFallback
    }
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
        {...props}
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Placeholder while loading */}
      {!isLoaded && (
        <div 
          className={`absolute inset-0 animate-pulse bg-gray-200 ${placeholderClassName}`}
        />
      )}
      <img
        src={src}
        alt={alt}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  )
}

// Memoize to prevent unnecessary re-renders
export default memo(OptimizedImage)

/**
 * Avatar image with fallback initials
 */
export function Avatar({ 
  src, 
  name = '', 
  size = 'md', 
  className = '' 
}) {
  const [hasError, setHasError] = useState(false)
  
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl'
  }

  // Generate initials from name
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (!src || hasError) {
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-medium ${sizeClasses[size]} ${className}`}
      >
        {initials || '?'}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name}
      className={`rounded-full object-cover ${sizeClasses[size]} ${className}`}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  )
}
