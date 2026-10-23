import * as Sentry from '@sentry/nextjs'

// No-ops safely if NEXT_PUBLIC_SENTRY_DSN isn't set -- fine for local dev,
// just means errors aren't reported until a real DSN is configured.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Checkout/pre-order/donation pages embed Stripe's PaymentElement, which
  // renders in a cross-origin iframe Session Replay can't see into anyway --
  // keeping replay off entirely so there's no ambiguity about what's captured
  // on pages real customers enter payment info on.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
