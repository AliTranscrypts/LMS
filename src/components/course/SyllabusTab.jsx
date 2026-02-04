import { useState, useRef } from 'react'
import QuillEditor, { QuillRenderer } from '../common/QuillEditor'
import { updateCourse } from '../../services/courses'

export default function SyllabusTab({ course, isTeacher, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false)
  const [syllabus, setSyllabus] = useState(course.syllabus)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const editorRef = useRef(null)

  const hasSyllabus = syllabus && (
    (typeof syllabus === 'object' && syllabus.ops && syllabus.ops.length > 0 && 
      !(syllabus.ops.length === 1 && syllabus.ops[0].insert === '\n')) ||
    (typeof syllabus === 'string' && syllabus.trim())
  )

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const { error } = await updateCourse(course.id, { syllabus })
    
    if (error) {
      setError('Failed to save syllabus. Please try again.')
      console.error(error)
    } else {
      setIsEditing(false)
      if (onUpdate) onUpdate()
    }
    
    setSaving(false)
  }

  const handleCancel = () => {
    setSyllabus(course.syllabus)
    setIsEditing(false)
    setError(null)
  }

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Course Syllabus</h2>
        {isTeacher && !isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="btn btn-secondary text-sm"
          >
            {hasSyllabus ? 'Edit Syllabus' : 'Add Syllabus'}
          </button>
        )}
        {isTeacher && isEditing && (
          <div className="flex gap-2">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button 
              onClick={handleCancel}
              disabled={saving}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error-50 border border-error-500 text-error-600 rounded-md text-sm">
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="mb-6">
          <QuillEditor
            ref={editorRef}
            value={syllabus}
            onChange={setSyllabus}
            placeholder="Write your course syllabus here. You can include headings, lists, images, videos, and more..."
          />
          <p className="mt-2 text-sm text-gray-500">
            Tip: Use the toolbar to add headings, lists, images, videos, and code blocks.
          </p>
        </div>
      ) : hasSyllabus ? (
        <div className="prose max-w-none mb-6">
          <QuillRenderer content={syllabus} />
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 mb-6">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No syllabus has been added yet.</p>
          {isTeacher && (
            <button 
              onClick={() => setIsEditing(true)}
              className="btn btn-primary mt-4"
            >
              Add Syllabus
            </button>
          )}
        </div>
      )}

      {/* Course Info */}
      <div className="pt-6 border-t border-gray-200">
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
