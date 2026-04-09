interface AlertBannerProps {
  message: string
  type?: 'info' | 'warning'
}

export default function AlertBanner({ message, type = 'info' }: AlertBannerProps) {
  const styles = type === 'warning'
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-brand-bg border-brand-border text-brand'

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${styles}`}>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}
