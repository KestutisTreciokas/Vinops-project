export default function Badge({
  children, tone='neutral', className=''
}: { children: React.ReactNode; tone?: 'neutral'|'success'|'warning'|'error'|'brand'; className?: string }) {
  const map: Record<string,string> = {
    neutral: 'bg-bg-muted text-fg-muted',
    success: 'bg-success text-success',
    warning: 'bg-warning text-warning',
    error:   'bg-error text-error',
    brand:   'bg-brand-10 text-brand',
  }
  return <span className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-medium ${map[tone]} ${className}`}>{children}</span>
}
