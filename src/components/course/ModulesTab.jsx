import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { getCourseModules } from '../../services/courses'
import { createModule, updateModule, deleteModule, reorderModules, addContent, deleteContent, reorderContent } from '../../services/modules'
import { getStudentCourseProgress } from '../../services/progress'
import { useAuth } from '../../contexts/AuthContext'
import EmptyState from '../common/EmptyState'
import Modal from '../common/Modal'
import ContentTypeSelector, { ContentForm } from './ContentTypeSelector'

export default function ModulesTab({ course, isTeacher, onUpdate }) {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isStudent = profile?.role === 'student'
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedModules, setExpandedModules] = useState({})
  const [progressData, setProgressData] = useState(null)
  
  // Module actions state
  const [isAddingModule, setIsAddingModule] = useState(false)
  const [newModuleName, setNewModuleName] = useState('')
  const [editingModuleId, setEditingModuleId] = useState(null)
  const [editingModuleName, setEditingModuleName] = useState('')
  const [deletingModule, setDeletingModule] = useState(null)
  
  // Content actions state
  const [showContentTypeSelector, setShowContentTypeSelector] = useState(false)
  const [selectedModuleForContent, setSelectedModuleForContent] = useState(null)
  const [selectedContentType, setSelectedContentType] = useState(null)
  const [showContentForm, setShowContentForm] = useState(false)

  useEffect(() => {
    fetchModules()
  }, [course.id, user?.id])

  const fetchModules = async () => {
    setLoading(true)
    const { data, error } = await getCourseModules(course.id)
    
    if (error) {
      setError('Failed to load modules')
      console.error(error)
    } else {
      setModules(data || [])
      // Expand first module by default
      if (data?.length > 0) {
        setExpandedModules({ [data[0].id]: true })
      }
    }

    // Fetch progress for students
    if (isStudent && user?.id) {
      const { data: progress } = await getStudentCourseProgress(user.id, course.id)
      setProgressData(progress)
    }

    setLoading(false)
  }

  // Get completion status for a content item
  const getContentProgress = (contentId) => {
    if (!progressData?.modules) return null
    for (const module of progressData.modules) {
      const content = module.content?.find(c => c.id === contentId)
      if (content) return content.completed
    }
    return false
  }

  // Get completion count for a module
  const getModuleProgress = (moduleId) => {
    if (!progressData?.modules) return { completed: 0, total: 0 }
    const module = progressData.modules.find(m => m.id === moduleId)
    if (!module) return { completed: 0, total: 0 }
    return { completed: module.completedCount, total: module.totalCount }
  }

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }))
  }

  // Handle adding a new module
  const handleAddModule = async () => {
    if (!newModuleName.trim()) return

    const orderIndex = modules.length
    const { data, error } = await createModule(course.id, newModuleName.trim(), orderIndex)
    
    if (error) {
      console.error('Failed to create module:', error)
    } else {
      setModules(prev => [...prev, { ...data, content: [] }])
      setExpandedModules(prev => ({ ...prev, [data.id]: true }))
    }
    
    setIsAddingModule(false)
    setNewModuleName('')
  }

  // Handle editing a module name
  const handleEditModule = async (moduleId) => {
    if (!editingModuleName.trim()) {
      setEditingModuleId(null)
      return
    }

    const { data, error } = await updateModule(moduleId, { name: editingModuleName.trim() })
    
    if (error) {
      console.error('Failed to update module:', error)
    } else {
      setModules(prev => prev.map(m => 
        m.id === moduleId ? { ...m, name: data.name } : m
      ))
    }
    
    setEditingModuleId(null)
    setEditingModuleName('')
  }

  // Handle deleting a module
  const handleDeleteModule = async (moduleId) => {
    const { error } = await deleteModule(moduleId)
    
    if (error) {
      console.error('Failed to delete module:', error)
    } else {
      setModules(prev => prev.filter(m => m.id !== moduleId))
    }
    
    setDeletingModule(null)
  }

  // Handle drag and drop for modules
  const handleDragEnd = async (result) => {
    const { destination, source, type } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    if (type === 'MODULE') {
      const reorderedModules = Array.from(modules)
      const [removed] = reorderedModules.splice(source.index, 1)
      reorderedModules.splice(destination.index, 0, removed)

      // Optimistic update
      setModules(reorderedModules)

      // Persist to database
      const { error } = await reorderModules(reorderedModules)
      if (error) {
        // Rollback on error
        setModules(modules)
        console.error('Failed to reorder modules:', error)
      }
    } else if (type === 'CONTENT') {
      const sourceModuleId = source.droppableId
      const destModuleId = destination.droppableId

      const sourceModule = modules.find(m => m.id === sourceModuleId)
      const destModule = modules.find(m => m.id === destModuleId)

      if (!sourceModule || !destModule) return

      const sourceContent = Array.from(sourceModule.content || [])
      const [movedContent] = sourceContent.splice(source.index, 1)

      if (sourceModuleId === destModuleId) {
        // Reorder within the same module
        sourceContent.splice(destination.index, 0, movedContent)
        
        setModules(prev => prev.map(m => 
          m.id === sourceModuleId ? { ...m, content: sourceContent } : m
        ))

        // Persist to database
        await reorderContent(sourceContent)
      } else {
        // Move to different module
        const destContent = Array.from(destModule.content || [])
        destContent.splice(destination.index, 0, movedContent)

        setModules(prev => prev.map(m => {
          if (m.id === sourceModuleId) return { ...m, content: sourceContent }
          if (m.id === destModuleId) return { ...m, content: destContent }
          return m
        }))

        // Persist to database - would need moveContent API
      }
    }
  }

  // Handle adding content
  const handleOpenContentSelector = (moduleId) => {
    setSelectedModuleForContent(moduleId)
    setShowContentTypeSelector(true)
  }

  const handleSelectContentType = (type) => {
    setSelectedContentType(type)
    setShowContentTypeSelector(false)
    setShowContentForm(true)
  }

  const handleCreateContent = async (contentData) => {
    const module = modules.find(m => m.id === selectedModuleForContent)
    const orderIndex = module?.content?.length || 0

    const { data, error } = await addContent(selectedModuleForContent, {
      ...contentData,
      orderIndex
    })

    if (error) {
      return { error: error.message || 'Failed to create content' }
    }

    // Update local state
    setModules(prev => prev.map(m => 
      m.id === selectedModuleForContent 
        ? { ...m, content: [...(m.content || []), data] }
        : m
    ))

    setShowContentForm(false)
    setSelectedModuleForContent(null)
    setSelectedContentType(null)

    return { error: null }
  }

  // Handle deleting content
  const handleDeleteContent = async (moduleId, contentId) => {
    const { error } = await deleteContent(contentId)
    
    if (error) {
      console.error('Failed to delete content:', error)
    } else {
      setModules(prev => prev.map(m => 
        m.id === moduleId 
          ? { ...m, content: (m.content || []).filter(c => c.id !== contentId) }
          : m
      ))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-12 text-error-600">{error}</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Course Modules</h2>
        {isTeacher && (
          <button 
            onClick={() => setIsAddingModule(true)}
            className="btn btn-success"
          >
            + Add Module
          </button>
        )}
      </div>

      {/* Inline Add Module */}
      {isAddingModule && (
        <div className="card p-4 mb-4 border-2 border-primary-200 bg-primary-50">
          <div className="flex gap-3">
            <input
              type="text"
              value={newModuleName}
              onChange={(e) => setNewModuleName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddModule()
                if (e.key === 'Escape') {
                  setIsAddingModule(false)
                  setNewModuleName('')
                }
              }}
              className="input flex-1"
              placeholder="Enter module name (e.g., Unit 1: Introduction)"
              autoFocus
            />
            <button onClick={handleAddModule} className="btn btn-primary">
              Add
            </button>
            <button 
              onClick={() => {
                setIsAddingModule(false)
                setNewModuleName('')
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {modules.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          title="No modules yet"
          description={isTeacher ? "Add your first module to start building your course." : "Your instructor hasn't added any modules yet."}
          action={isTeacher && (
            <button 
              onClick={() => setIsAddingModule(true)}
              className="btn btn-success"
            >
              + Add Module
            </button>
          )}
        />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="modules" type="MODULE">
            {(provided) => (
              <div 
                ref={provided.innerRef} 
                {...provided.droppableProps}
                className="space-y-4"
              >
                {modules.map((module, index) => (
                  <Draggable 
                    key={module.id} 
                    draggableId={module.id} 
                    index={index}
                    isDragDisabled={!isTeacher}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={snapshot.isDragging ? 'opacity-75' : ''}
                      >
                        <ModuleCard
                          module={module}
                          index={index}
                          isExpanded={expandedModules[module.id]}
                          onToggle={() => toggleModule(module.id)}
                          isTeacher={isTeacher}
                          isStudent={isStudent}
                          isEditing={editingModuleId === module.id}
                          editingName={editingModuleName}
                          onStartEdit={() => {
                            setEditingModuleId(module.id)
                            setEditingModuleName(module.name)
                          }}
                          onEditChange={setEditingModuleName}
                          onEditSubmit={() => handleEditModule(module.id)}
                          onEditCancel={() => {
                            setEditingModuleId(null)
                            setEditingModuleName('')
                          }}
                          onDelete={() => setDeletingModule(module)}
                          onAddContent={() => handleOpenContentSelector(module.id)}
                          onDeleteContent={(contentId) => handleDeleteContent(module.id, contentId)}
                          onContentClick={(contentId) => navigate(`/content/${contentId}`)}
                          dragHandleProps={provided.dragHandleProps}
                          getContentProgress={getContentProgress}
                          moduleProgress={getModuleProgress(module.id)}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Delete Module Confirmation Modal */}
      <Modal 
        isOpen={!!deletingModule} 
        onClose={() => setDeletingModule(null)}
        title="Delete Module"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete "<strong>{deletingModule?.name}</strong>"? 
          This will also delete all content within this module. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button 
            onClick={() => handleDeleteModule(deletingModule?.id)}
            className="btn bg-error-600 text-white hover:bg-error-700 flex-1"
          >
            Delete Module
          </button>
          <button 
            onClick={() => setDeletingModule(null)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Content Type Selector Modal */}
      <ContentTypeSelector
        isOpen={showContentTypeSelector}
        onClose={() => {
          setShowContentTypeSelector(false)
          setSelectedModuleForContent(null)
        }}
        onSelect={handleSelectContentType}
      />

      {/* Content Form Modal */}
      <Modal
        isOpen={showContentForm}
        onClose={() => {
          setShowContentForm(false)
          setSelectedContentType(null)
          setSelectedModuleForContent(null)
        }}
        title={`Add ${selectedContentType ? selectedContentType.charAt(0).toUpperCase() + selectedContentType.slice(1) : 'Content'}`}
      >
        {selectedContentType && (
          <ContentForm
            type={selectedContentType}
            courseId={course.id}
            onSubmit={handleCreateContent}
            onCancel={() => {
              setShowContentForm(false)
              setSelectedContentType(null)
              setSelectedModuleForContent(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function ModuleCard({ 
  module, 
  index, 
  isExpanded, 
  onToggle, 
  isTeacher,
  isStudent,
  isEditing,
  editingName,
  onStartEdit,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  onDelete,
  onAddContent,
  onDeleteContent,
  onContentClick,
  dragHandleProps,
  getContentProgress,
  moduleProgress
}) {
  const contentItems = module.content || []
  const completedCount = moduleProgress?.completed || 0
  const totalCount = moduleProgress?.total || contentItems.length
  const isModuleComplete = totalCount > 0 && completedCount === totalCount

  const getContentIcon = (type) => {
    switch (type) {
      case 'reading':
        return '📄'
      case 'video':
        return '🎥'
      case 'assignment':
        return '📝'
      case 'quiz':
        return '❓'
      default:
        return '📎'
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
        {/* Drag Handle */}
        {isTeacher && (
          <div {...dragHandleProps} className="cursor-grab text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
          </div>
        )}

        {/* Module Number */}
        <span className="text-2xl font-bold text-gray-300 w-8">
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Module Name (editable) */}
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSubmit()
                if (e.key === 'Escape') onEditCancel()
              }}
              className="input py-1"
              autoFocus
            />
          ) : (
            <button onClick={onToggle} className="text-left w-full">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{module.name}</h3>
                {isStudent && totalCount > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isModuleComplete 
                      ? 'bg-success-100 text-success-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {isModuleComplete ? '✓ Complete' : `${completedCount}/${totalCount}`}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {totalCount === 0 ? 'No content' : isStudent ? `${completedCount} of ${totalCount} completed` : `${totalCount} items`}
              </p>
            </button>
          )}
        </div>

        {/* Actions */}
        {isTeacher && !isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={onStartEdit}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="Edit module"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-error-600 hover:bg-error-50 rounded"
              title="Delete module"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}

        {isEditing && (
          <div className="flex items-center gap-2">
            <button onClick={onEditSubmit} className="btn btn-primary btn-sm">Save</button>
            <button onClick={onEditCancel} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        )}

        {/* Expand/Collapse */}
        <button onClick={onToggle} className="p-2 text-gray-400 hover:text-gray-600">
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Content List */}
      {isExpanded && (
        <Droppable droppableId={module.id} type="CONTENT">
          {(provided) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="border-t border-gray-200 p-4"
            >
              {contentItems.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <p>No content in this module yet.</p>
                  {isTeacher && (
                    <button 
                      onClick={onAddContent}
                      className="btn btn-secondary mt-3 text-sm"
                    >
                      + Add Content
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {contentItems.map((item, contentIndex) => {
                    const isContentComplete = getContentProgress ? getContentProgress(item.id) : false
                    return (
                      <Draggable 
                        key={item.id} 
                        draggableId={item.id} 
                        index={contentIndex}
                        isDragDisabled={!isTeacher}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            onClick={() => onContentClick && onContentClick(item.id)}
                            className={`flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors ${
                              snapshot.isDragging ? 'shadow-lg' : ''
                            } ${isContentComplete ? 'bg-success-50 hover:bg-success-100' : ''}`}
                          >
                            {isTeacher && (
                              <div {...provided.dragHandleProps} className="cursor-grab text-gray-400" onClick={(e) => e.stopPropagation()}>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                                </svg>
                              </div>
                            )}
                            {/* Completion indicator for students */}
                            {isStudent && (
                              <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isContentComplete 
                                  ? 'bg-success-500 border-success-500 text-white' 
                                  : 'border-gray-300'
                              }`}>
                                {isContentComplete && (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <span className="text-xl">{getContentIcon(item.type)}</span>
                            <div className="flex-1">
                              <p className={`font-medium ${isContentComplete ? 'text-success-700' : 'text-gray-900'}`}>
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="capitalize">{item.type}</span>
                                {item.due_date && (
                                  <>
                                    <span>•</span>
                                    <span className={new Date() > new Date(item.due_date) ? 'text-error-600' : ''}>
                                      Due {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  </>
                                )}
                                {item.total_points && (
                                  <>
                                    <span>•</span>
                                    <span>{item.total_points} pts</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {isTeacher && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeleteContent(item.id)
                                }}
                                className="p-1 text-gray-400 hover:text-error-600"
                                title="Delete content"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                            <div className="text-gray-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    )
                  })}
                  {provided.placeholder}
                  {isTeacher && (
                    <button 
                      onClick={onAddContent}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
                    >
                      + Add Content
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </Droppable>
      )}
    </div>
  )
}
