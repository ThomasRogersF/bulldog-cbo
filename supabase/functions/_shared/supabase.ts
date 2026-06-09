// Shared Supabase admin client (service-role) + Telegram config loader.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the
// Supabase Edge runtime — no manual secret config needed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

export async function getTelegramConfig(
  supabase: ReturnType<typeof getAdminClient>
) {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'telegram_bot_token',
      'telegram_chat_id',
      'low_stock_alerts',
      'shift_alerts',
      'large_sale_alerts',
      'override_alerts',
      'large_sale_threshold',
    ])

  const cfg: Record<string, string> = {}
  for (const row of data ?? []) {
    cfg[row.key] = row.value ?? ''
  }
  return cfg
}
