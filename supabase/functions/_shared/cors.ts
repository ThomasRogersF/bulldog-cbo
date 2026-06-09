// Shared CORS headers + preflight helper.
//
// The Bulldog CBO app is SPA-only, so every supabase.functions.invoke() runs in
// the browser against a different origin (the Supabase functions domain). The
// JSON content-type + auth headers make these non-simple requests, so the browser
// sends a CORS preflight OPTIONS first. Each function must answer OPTIONS and echo
// these headers on every real response, or the call is blocked before it runs.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// JSON response headers with CORS merged in — use for every function reply.
export const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

// Returns a preflight response for OPTIONS requests, or null to continue.
export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}
