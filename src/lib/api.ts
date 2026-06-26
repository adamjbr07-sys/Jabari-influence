import { NextResponse } from 'next/server'

// All v2 routes run on Node (Supabase service client + Claude subprocess).
export const runtime = 'nodejs'

export function ok(data: unknown) {
  return NextResponse.json(data)
}

/** Map any thrown error to a JSON 500. D2: Supabase/Claude failures degrade
 *  gracefully — the client shows "couldn't reach the database", not a crash. */
export function fail(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : 'Unknown error'
  return NextResponse.json({ error: message }, { status })
}
