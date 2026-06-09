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
    const { orderId, itemName, workerName, note } = await req.json()

    const supabase = getAdminClient()
    const cfg = await getTelegramConfig(supabase)

    if (cfg.override_alerts !== 'true') {
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

    const timeStr = new Date().toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const message = `⚠️ <b>VENTA SIN STOCK — Bulldog CBO</b>

🕐 ${timeStr}
👤 ${escapeHtml(workerName || 'Trabajador')}
🍽 Ítem: <b>${escapeHtml(itemName)}</b>
📝 Nota: <i>${escapeHtml(note || 'Sin nota')}</i>

<i>Se vendió este ítem sin stock registrado. Verificar inventario.</i>`

    const result = await sendTelegram(
      { botToken: cfg.telegram_bot_token, chatId: cfg.telegram_chat_id },
      message
    )

    await supabase.from('audit_log').insert({
      action: 'telegram.override',
      entity_type: 'order',
      entity_id: orderId,
      meta: {
        telegram_ok: result.ok,
        item_name: itemName,
        worker: workerName,
        error: result.error ?? null,
      },
    })

    return new Response(JSON.stringify(result), { headers: jsonHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})
