const PURCHASED_KEY = 'jj-has-purchased'

// Set once on a real order success (never for the dev-only demo checkout
// fallback) -- used to give purchasers an explicit nudge toward the hidden
// mini-game instead of the vague hint everyone else gets.
export function markPurchased() {
  try {
    localStorage.setItem(PURCHASED_KEY, '1')
  } catch {
    // Private browsing / storage blocked -- the site still works, the
    // hint just won't remember across reloads for this visitor.
  }
}

export function hasPurchasedLocally(): boolean {
  try {
    return localStorage.getItem(PURCHASED_KEY) === '1'
  } catch {
    return false
  }
}
