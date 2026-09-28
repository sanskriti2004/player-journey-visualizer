export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const DAY_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const TIME_FMT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

export function formatDay(iso: string): string {
  return DAY_FMT.format(new Date(`${iso}T00:00:00Z`))
}

export function formatStartTime(unixSeconds: number): string {
  return `${TIME_FMT.format(new Date(unixSeconds * 1000))} UTC`
}

export function shortId(id: string): string {
  return id.slice(0, 8)
}
