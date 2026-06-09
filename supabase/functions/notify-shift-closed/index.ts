import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getAdminClient, getTelegramConfig } from '../_shared/supabase.ts'
import { sendTelegram } from '../_shared/telegram.ts'
import { buildShiftReport } from '../_shared/report.ts'
import { corsHeaders, jsonHeaders, handleOptions } from '../_shared/cors.ts'

serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    })
  }

  try {
    const { shiftId } = await req.json()

    const supabase = getAdminClient()
    const cfg = await getTelegramConfig(supabase)

    if (cfg.shift_alerts !== 'true') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: jsonHeaders,
      })
    }

    if (!cfg.telegram_bot_token || !cfg.telegram_chat_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Telegram not configured' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    // Mark report as sent first to prevent duplicates
    await supabase
      .from('shifts')
      .update({ telegram_report_sent: true })
      .eq('id', shiftId)

    const message = await buildShiftReport(supabase, shiftId)

    const result = await sendTelegram(
      { botToken: cfg.telegram_bot_token, chatId: cfg.telegram_chat_id },
      message
    )

    await supabase.from('audit_log').insert({
      action: 'telegram.shift_closed',
      entity_type: 'shift',
      entity_id: shiftId,
      meta: { telegram_ok: result.ok, error: result.error ?? null },
    })

    return new Response(JSON.stringify(result), { headers: jsonHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})
