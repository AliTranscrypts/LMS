export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="text-center py-12 px-4">
      {icon && (
        <div className="flex justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 max-w-sm mx-auto mb-6">{description}</p>
      )}
      {action && (
        <div>{action}</div>
      )}
    </div>
  )
}
