const VISITOR_ID_KEY = 'jj-visitor-id'

// Anonymous per-browser id for the catch-and-collect easter egg -- no
// accounts, just a random id stuck in localStorage. Lost on cleared site
// data or a different device, by design (see CaughtCreature schema note).
export function getVisitorId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_ID_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}
