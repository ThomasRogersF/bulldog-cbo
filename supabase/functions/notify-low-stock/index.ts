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
    const { orderId } = await req.json()

    const supabase = getAdminClient()
    const cfg = await getTelegramConfig(supabase)

    if (cfg.low_stock_alerts !== 'true') {
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

    // Query the ingredient_stock VIEW for low/out items
    const { data: lowItems } = await supabase
      .from('ingredient_stock')
      .select('*')
      .eq('is_low_stock', true)
      .is('deleted_at', null)
      .order('current_stock', { ascending: true })

    if (!lowItems || lowItems.length === 0) {
      return new Response(JSON.stringify({ ok: true, no_alerts: true }), {
        headers: jsonHeaders,
      })
    }

    const lines = lowItems
      .map((item: any) => {
        const stock = Number(item.current_stock)
        const min = Number(item.min_stock)
        const icon = stock <= 0 ? '🔴' : stock <= min * 0.5 ? '🟠' : '🟡'
        const stockStr =
          stock <= 0
            ? '<b>AGOTADO</b>'
            : `${stock} ${item.unit} (mín: ${min})`
        return `${icon} ${escapeHtml(item.name)}: ${stockStr}`
      })
      .join('\n')

    const outCount = lowItems.filter(
      (i: any) => Number(i.current_stock) <= 0
    ).length
    const lowCount = lowItems.length - outCount

    let header = '⚠️ <b>ALERTA DE STOCK — Bulldog CBO</b>\n'
    if (outCount > 0)
      header += `🔴 ${outCount} ingrediente${outCount > 1 ? 's' : ''} agotado${outCount > 1 ? 's' : ''}\n`
    if (lowCount > 0)
      header += `🟡 ${lowCount} ingrediente${lowCount > 1 ? 's' : ''} bajo mínimo\n`

    const message = `${header}
${lines}

<i>Reponer antes del próximo turno</i>`

    const result = await sendTelegram(
      { botToken: cfg.telegram_bot_token, chatId: cfg.telegram_chat_id },
      message
    )

    await supabase.from('audit_log').insert({
      action: 'telegram.low_stock',
      entity_type: 'order',
      entity_id: orderId,
      meta: {
        telegram_ok: result.ok,
        low_items: lowItems.map((i: any) => i.name),
        error: result.error ?? null,
      },
    })

    return new Response(
      JSON.stringify({ ...result, alertCount: lowItems.length }),
      { headers: jsonHeaders }
    )
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})
