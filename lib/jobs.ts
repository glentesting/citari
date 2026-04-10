/**
 * Global background job manager.
 * Survives React component unmounts — runs fetch calls outside the component lifecycle.
 * Shows completion via callback (toast/notification).
 */

type JobStatus = 'running' | 'done' | 'error'
type JobListener = (job: { id: string; label: string; status: JobStatus; error?: string }) => void

const jobs = new Map<string, { label: string; status: JobStatus; error?: string }>()
const listeners = new Set<JobListener>()

function notify(id: string) {
  const job = jobs.get(id)
  if (job) listeners.forEach((fn) => fn({ id, ...job }))
}

export function onJobUpdate(fn: JobListener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function getRunningJobs() {
  return Array.from(jobs.entries())
    .filter(([, j]) => j.status === 'running')
    .map(([id, j]) => ({ id, ...j }))
}

/**
 * Run an API call in the background. Survives page navigation.
 * The fetch runs globally — not tied to any component.
 */
export function runBackgroundJob(
  id: string,
  label: string,
  url: string,
  body: Record<string, any>
) {
  // Don't start duplicate jobs
  const existing = jobs.get(id)
  if (existing && existing.status === 'running') return

  jobs.set(id, { label, status: 'running' })
  notify(id)

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      if (res.ok) {
        jobs.set(id, { label, status: 'done' })
      } else {
        const data = await res.json().catch(() => ({}))
        jobs.set(id, { label, status: 'error', error: data.error || `Failed (${res.status})` })
      }
      notify(id)
      // Clean up after 30 seconds
      setTimeout(() => { jobs.delete(id) }, 30000)
    })
    .catch((e) => {
      jobs.set(id, { label, status: 'error', error: e.message })
      notify(id)
      setTimeout(() => { jobs.delete(id) }, 30000)
    })
}
