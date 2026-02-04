import { useState } from 'react'

/**
 * PdfViewer - Displays PDF files using iframe/embed with fallback
 * 
 * @param {Object} props
 * @param {string} props.url - URL of the PDF file
 * @param {string} props.title - Title for accessibility
 * @param {boolean} props.allowDownload - Whether to show download button
 * @param {function} props.onLoad - Callback when PDF loads
 */
export default function PdfViewer({ 
  url, 
  title = 'PDF Document', 
  allowDownload = true,
  onLoad 
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const handleLoad = () => {
    setLoading(false)
    if (onLoad) {
      onLoad()
    }
  }

  const handleError = () => {
    setLoading(false)
    setError(true)
  }

  const handleDownload = () => {
    window.open(url, '_blank')
  }

  if (error) {
    return (
      <div className="bg-gray-100 rounded-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-600 mb-4">Unable to display PDF in browser.</p>
        {allowDownload && (
          <button
            onClick={handleDownload}
            className="btn btn-primary"
          >
            Download PDF
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative bg-gray-100 rounded-lg overflow-hidden">
      {/* Header with title and download button */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14,2 14,8 20,8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 12v5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 14.5l2-2.5 2 2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className="font-medium truncate">{title}</span>
        </div>
        {allowDownload && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            title="Download PDF"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 top-12 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-3 text-gray-600">Loading document...</p>
          </div>
        </div>
      )}

      {/* PDF iframe */}
      <iframe
        src={`${url}#toolbar=0&navpanes=0`}
        title={title}
        className="w-full h-[calc(100vh-200px)] min-h-[500px]"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}
