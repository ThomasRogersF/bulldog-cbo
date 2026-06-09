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

    if (cfg.large_sale_alerts !== 'true') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: jsonHeaders,
      })
    }

    // Use || (not ??) so a blank setting also falls back to 20.
    const threshold = parseFloat(cfg.large_sale_threshold || '20')

    if (!cfg.telegram_bot_token || !cfg.telegram_chat_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Telegram not configured' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    // Fetch order details
    const { data: order } = await supabase
      .from('orders')
      .select(`
        *,
        worker:profiles!orders_worker_id_fkey(full_name),
        order_items(qty, menu_item_snapshot, line_total_usd)
      `)
      .eq('id', orderId)
      .single()

    if (!order || Number(order.total_usd) < threshold) {
      return new Response(
        JSON.stringify({ ok: true, below_threshold: true }),
        { headers: jsonHeaders }
      )
    }

    const timeStr = new Date(
      order.paid_at ?? order.created_at
    ).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })

    const itemLines = (order.order_items ?? [])
      .map((item: any) => {
        const snapshot = item.menu_item_snapshot as any
        return `  • ${escapeHtml(snapshot?.name ?? 'Item')} ×${item.qty} — $${Number(item.line_total_usd).toFixed(2)}`
      })
      .join('\n')

    const paymentLabels: Record<string, string> = {
      cash_usd: 'Efectivo USD',
      cash_bs: 'Efectivo Bs',
      card: 'Tarjeta',
      pagomovil: 'Pago móvil',
      transfer: 'Transferencia',
      zinli: 'Zinli',
      binance: 'Binance',
      paypal: 'PayPal',
      credit: 'Crédito',
    }

    const message = `💰 <b>VENTA GRANDE — Bulldog CBO</b>

🧾 Orden #${order.order_number} · ${timeStr}
👤 ${escapeHtml(order.worker?.full_name ?? 'Trabajador')}
💵 Total: <b>$${Number(order.total_usd).toFixed(2)}</b>
💳 ${paymentLabels[order.payment_method] ?? order.payment_method}

📋 Items:
${itemLines}`

    const result = await sendTelegram(
      { botToken: cfg.telegram_bot_token, chatId: cfg.telegram_chat_id },
      message
    )

    await supabase.from('audit_log').insert({
      action: 'telegram.large_sale',
      entity_type: 'order',
      entity_id: orderId,
      meta: {
        telegram_ok: result.ok,
        total_usd: order.total_usd,
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
