import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // This creates a Supabase client specific to the browser (client-side)
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}