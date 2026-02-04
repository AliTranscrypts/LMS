import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function RegistrationSuccess() {
  const location = useLocation()
  const navigate = useNavigate()
  const { studentId, fullName } = location.state || {}
  const [copied, setCopied] = useState(false)

  // If no student ID, redirect to signup
  if (!studentId) {
    navigate('/signup')
    return null
  }

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(studentId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = studentId
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome, {fullName}!
        </h1>
        <p className="text-gray-600 mb-8">
          Your account has been created successfully.
        </p>

        {/* Student ID Display */}
        <div className="bg-primary-50 border-2 border-dashed border-primary-300 rounded-lg p-6 mb-6">
          <p className="text-sm text-gray-600 mb-2">Your Unique Student ID</p>
          <p className="text-3xl font-bold text-primary-600 tracking-wider mb-4">
            {studentId}
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Share this ID with your teacher for course enrollment
          </p>
          <button
            onClick={handleCopyId}
            className={`btn ${copied ? 'btn-success' : 'btn-secondary'} inline-flex items-center gap-2`}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy ID
              </>
            )}
          </button>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="btn btn-primary w-full py-3 text-base"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  )
}
