interface GeoTask {
  number: number
  text: string
}

interface GeoTaskListProps {
  tasks: GeoTask[]
}

export default function GeoTaskList({ tasks }: GeoTaskListProps) {
  return (
    <div className="bg-brand-bg border border-brand-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="w-[2.5px] h-4 bg-brand rounded-full" />
        Recommended GEO Actions
      </h3>

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500">Run a scan to generate action items.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.number}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/70"
            >
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-brand text-white text-xs font-bold">
                {task.number}
              </span>
              <p className="text-sm text-gray-700">{task.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
