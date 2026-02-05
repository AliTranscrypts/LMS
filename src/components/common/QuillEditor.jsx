import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

/**
 * QuillEditor - Rich text editor component using Quill
 * Supports tables, images, videos, code blocks
 */
const QuillEditor = forwardRef(function QuillEditor({ 
  value, 
  onChange, 
  placeholder = 'Write something...',
  readOnly = false,
  className = ''
}, ref) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const quillRef = useRef(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getEditor: () => quillRef.current,
    getContents: () => quillRef.current?.getContents(),
    setContents: (delta) => quillRef.current?.setContents(delta),
    getText: () => quillRef.current?.getText(),
  }))

  useEffect(() => {
    if (!editorRef.current) return
    
    // Prevent double initialization (React StrictMode)
    if (quillRef.current) return

    // Clean up any existing toolbar from a previous mount
    const existingToolbar = containerRef.current?.querySelector('.ql-toolbar')
    if (existingToolbar) {
      existingToolbar.remove()
    }

    // Quill toolbar options with advanced formatting
    const toolbarOptions = [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['link', 'image', 'video', 'code-block'],
      ['blockquote'],
      ['clean']
    ]

    // Initialize Quill
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      placeholder: placeholder,
      readOnly: readOnly,
      modules: {
        toolbar: readOnly ? false : toolbarOptions,
      }
    })

    quillRef.current = quill

    // Set initial content if provided
    if (value) {
      if (typeof value === 'object' && value.ops) {
        quill.setContents(value)
      } else if (typeof value === 'string') {
        quill.setText(value)
      }
    }

    // Listen for changes
    quill.on('text-change', () => {
      if (onChange) {
        const contents = quill.getContents()
        onChange(contents)
      }
    })

    setIsInitialized(true)

    return () => {
      // Proper cleanup - remove toolbar and reset
      if (containerRef.current) {
        const toolbar = containerRef.current.querySelector('.ql-toolbar')
        if (toolbar) {
          toolbar.remove()
        }
      }
      if (quillRef.current) {
        quillRef.current.off('text-change')
        quillRef.current = null
      }
      setIsInitialized(false)
    }
  }, [])

  // Update content when value changes externally
  useEffect(() => {
    if (!quillRef.current || !isInitialized) return

    const currentContents = quillRef.current.getContents()
    
    // Only update if content is different
    if (value && JSON.stringify(currentContents) !== JSON.stringify(value)) {
      const selection = quillRef.current.getSelection()
      
      if (typeof value === 'object' && value.ops) {
        quillRef.current.setContents(value, 'silent')
      } else if (typeof value === 'string' && quillRef.current.getText().trim() !== value.trim()) {
        quillRef.current.setText(value, 'silent')
      }
      
      // Restore cursor position
      if (selection) {
        quillRef.current.setSelection(selection, 'silent')
      }
    }
  }, [value, isInitialized])

  // Update readOnly state
  useEffect(() => {
    if (quillRef.current) {
      quillRef.current.enable(!readOnly)
    }
  }, [readOnly])

  return (
    <div className={`quill-editor-container ${className}`} ref={containerRef}>
      <div ref={editorRef} className="min-h-[200px]" />
      <style>{`
        .quill-editor-container .ql-container {
          font-family: inherit;
          font-size: 14px;
          min-height: 200px;
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
        }
        .quill-editor-container .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background-color: #f9fafb;
        }
        .quill-editor-container .ql-editor {
          min-height: 200px;
        }
        .quill-editor-container .ql-editor.ql-blank::before {
          font-style: normal;
          color: #9ca3af;
        }
        .quill-editor-container .ql-snow .ql-picker.ql-header .ql-picker-label::before,
        .quill-editor-container .ql-snow .ql-picker.ql-header .ql-picker-item::before {
          content: 'Normal';
        }
        .quill-editor-container .ql-snow .ql-picker.ql-header .ql-picker-label[data-value="1"]::before,
        .quill-editor-container .ql-snow .ql-picker.ql-header .ql-picker-item[data-value="1"]::before {
          content: 'Heading 1';
        }
        .quill-editor-container .ql-snow .ql-picker.ql-header .ql-picker-label[data-value="2"]::before,
        .quill-editor-container .ql-snow .ql-picker.ql-header .ql-picker-item[data-value="2"]::before {
          content: 'Heading 2';
        }
        .quill-editor-container .ql-snow .ql-picker.ql-header .ql-picker-label[data-value="3"]::before,
        .quill-editor-container .ql-snow .ql-picker.ql-header .ql-picker-item[data-value="3"]::before {
          content: 'Heading 3';
        }
        /* Read-only styles */
        .quill-editor-container .ql-container.ql-disabled {
          border: none;
          background: transparent;
        }
        .quill-editor-container .ql-container.ql-disabled .ql-editor {
          padding: 0;
        }
      `}</style>
    </div>
  )
})

export default QuillEditor

/**
 * QuillRenderer - Renders Quill delta content as read-only HTML
 */
export function QuillRenderer({ content, className = '' }) {
  const containerRef = useRef(null)
  const quillRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    
    // Prevent double initialization (React StrictMode)
    if (quillRef.current) return

    // Clean up any existing toolbar from a previous mount
    const existingToolbar = wrapperRef.current?.querySelector('.ql-toolbar')
    if (existingToolbar) {
      existingToolbar.remove()
    }

    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      readOnly: true,
      modules: {
        toolbar: false
      }
    })

    quillRef.current = quill

    if (content) {
      if (typeof content === 'object' && content.ops) {
        quill.setContents(content)
      } else if (typeof content === 'string') {
        quill.setText(content)
      }
    }

    return () => {
      // Proper cleanup
      if (wrapperRef.current) {
        const toolbar = wrapperRef.current.querySelector('.ql-toolbar')
        if (toolbar) {
          toolbar.remove()
        }
      }
      quillRef.current = null
    }
  }, [])

  // Update content when it changes
  useEffect(() => {
    if (!quillRef.current) return

    if (content) {
      if (typeof content === 'object' && content.ops) {
        quillRef.current.setContents(content)
      } else if (typeof content === 'string') {
        quillRef.current.setText(content)
      }
    }
  }, [content])

  return (
    <div className={`quill-renderer ${className}`} ref={wrapperRef}>
      <div ref={containerRef} />
      <style>{`
        .quill-renderer .ql-container {
          font-family: inherit;
          font-size: inherit;
          border: none !important;
        }
        .quill-renderer .ql-editor {
          padding: 0;
          line-height: 1.75;
        }
        .quill-renderer .ql-editor h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
        }
        .quill-renderer .ql-editor h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .quill-renderer .ql-editor h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .quill-renderer .ql-editor p {
          margin-bottom: 0.75rem;
        }
        .quill-renderer .ql-editor ul,
        .quill-renderer .ql-editor ol {
          margin-bottom: 0.75rem;
          padding-left: 1.5rem;
        }
        .quill-renderer .ql-editor blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #6b7280;
        }
        .quill-renderer .ql-editor pre {
          background-color: #1f2937;
          color: #f3f4f6;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .quill-renderer .ql-editor img {
          max-width: 100%;
          border-radius: 0.5rem;
        }
        .quill-renderer .ql-editor .ql-video {
          width: 100%;
          aspect-ratio: 16/9;
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  )
}
