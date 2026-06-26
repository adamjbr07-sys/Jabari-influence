import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-side Supabase client (T1). Single-user tool, so all access is server-side
// with the service-role key — no RLS dance needed.
//
// NOTE on env naming: the host shell exports a bare `SUPABASE_URL` pointing at a
// DIFFERENT project (known footgun). We deliberately read NEXT_PUBLIC_SUPABASE_URL
// so this app never picks up that stray value. For local dev also start the dev
// server with `env -u SUPABASE_URL` (see CLAUDE.md / DESIGN/CONTRACT notes).

let _client: SupabaseClient | null = null

/**
 * Returns the Supabase client, or throws a clear error if not configured.
 * Route handlers should catch this and surface "Couldn't reach the database"
 * (D2 graceful-degradation) rather than crashing.
 */
export function db(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY in .env.local (local values come from ' +
        '`supabase start`). Start dev with `env -u SUPABASE_URL npm run dev`.',
    )
  }

  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}
