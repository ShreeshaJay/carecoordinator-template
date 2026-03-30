export async function logClientActivity(action: string, category: string, details?: string) {
  try {
    await fetch('/api/log-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, category, details: details || '' }),
    })
  } catch {
    // Don't let logging failures affect UX
  }
}
