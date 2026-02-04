import { useState } from 'react'

export default function SyllabusTab({ course, isTeacher, onUpdate }) {
  // For MVP, show syllabus as read-only
  // TODO: Add Quill editor integration for teachers
  
  const syllabus = course.syllabus

  // If syllabus is a Quill delta, we'd render it here
  // For now, just display as text or show placeholder
  const hasSyllabus = syllabus && (
    (typeof syllabus === 'object' && syllabus.ops) ||
    (typeof syllabus === 'string' && syllabus.trim())
  )

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Course Syllabus</h2>
        {isTeacher && (
          <button className="btn btn-secondary text-sm">
            Edit Syllabus
          </button>
        )}
      </div>

      {hasSyllabus ? (
        <div className="prose max-w-none">
          {typeof syllabus === 'string' ? (
            <p className="text-gray-700 whitespace-pre-wrap">{syllabus}</p>
          ) : (
            // Render Quill delta content
            <div className="text-gray-700">
              {syllabus.ops?.map((op, i) => (
                <span key={i}>{op.insert}</span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No syllabus has been added yet.</p>
          {isTeacher && (
            <button className="btn btn-primary mt-4">
              Add Syllabus
            </button>
          )}
        </div>
      )}

      {/* Course Info */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Course Information</h3>
        
        {course.description && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">Description</p>
            <p className="text-gray-900">{course.description}</p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm text-gray-600">Instructor</p>
          <p className="text-gray-900">{course.teacher?.full_name}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-2">Grading Categories</p>
          <div className="grid grid-cols-2 gap-2">
            {course.category_weights && Object.entries(course.category_weights).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-gray-700 capitalize">
                  {key === 'ku' ? 'Knowledge & Understanding' : key}:
                </span>
                <span className="font-medium text-gray-900">{value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
