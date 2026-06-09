import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getAdminClient, getTelegramConfig } from '../_shared/supabase.ts'
import { sendTelegram, escapeHtml } from '../_shared/telegram.ts'
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
    const { shiftId, shiftNumber, workerName, openedAt, _test } =
      await req.json()

    const supabase = getAdminClient()
    const cfg = await getTelegramConfig(supabase)

    // The Settings "send test message" button reaches this function with
    // _test:true and must always send (bypass the shift_alerts toggle), as long
    // as the token + chat id are configured.
    if (!_test && cfg.shift_alerts !== 'true') {
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

    const timeStr = new Date(openedAt).toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const message = _test
      ? `🔔 <b>Mensaje de prueba — Bulldog CBO</b>

✅ La conexión con Telegram funciona correctamente.

<i>Recibirás aquí las notificaciones de turnos, ventas y stock.</i>`
      : `🟢 <b>Turno #${shiftNumber} abierto</b>

👤 ${escapeHtml(workerName || 'Trabajador')}
🕐 ${timeStr}

<i>Bulldog CBO está en operación.</i>`

    const result = await sendTelegram(
      { botToken: cfg.telegram_bot_token, chatId: cfg.telegram_chat_id },
      message
    )

    // Log to audit
    await supabase.from('audit_log').insert({
      action: _test ? 'telegram.test' : 'telegram.shift_opened',
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
