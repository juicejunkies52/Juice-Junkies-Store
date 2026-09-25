import { config } from 'dotenv'

// .env.local first (local Postgres, PRINTFUL_API_TOKEN=demo) so it wins,
// then .env for anything not already set. Mirrors Next.js's own precedence
// and keeps tests from ever touching real Printful or a production DB.
config({ path: '.env.local' })
config({ path: '.env' })
