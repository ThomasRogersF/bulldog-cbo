// Builds the end-of-shift daily closing report (HTML) sent when a shift closes.

import { escapeHtml } from './telegram.ts'

export async function buildShiftReport(
  supabase: any,
  shiftId: string
): Promise<string> {
  // Fetch shift details
  const { data: shift } = await supabase
    .from('shifts')
    .select(`
      *,
      opened_profile:profiles!shifts_opened_by_fkey(full_name),
      closed_profile:profiles!shifts_closed_by_fkey(full_name)
    `)
    .eq('id', shiftId)
    .single()

  if (!shift) return '❌ No se encontró el turno.'

  // Fetch all confirmed orders for this shift
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        qty,
        unit_price_usd,
        line_total_usd,
        menu_item_snapshot
      )
    `)
    .eq('shift_id', shiftId)
    .eq('status', 'confirmed')

  const orderList = orders ?? []

  // Calculate totals. The Bs total comes from the orders themselves —
  // each order stores its own total_bs / usd_rate_used (the rate lives on
  // orders, NOT on shifts). Fall back to total_usd * rate when total_bs is null.
  const totalUsd = orderList.reduce(
    (s: number, o: any) => s + Number(o.total_usd),
    0
  )
  const totalBs = orderList.reduce((s: number, o: any) => {
    const bs =
      o.total_bs != null
        ? Number(o.total_bs)
        : Number(o.total_usd) * Number(o.usd_rate_used ?? 0)
    return s + bs
  }, 0)
  const orderCount = orderList.length
  const avgTicket = orderCount > 0 ? totalUsd / orderCount : 0

  // Payment method breakdown
  const byMethod: Record<string, number> = {}
  for (const o of orderList) {
    const m = o.payment_method ?? 'otro'
    byMethod[m] = (byMethod[m] ?? 0) + Number(o.total_usd)
  }

  // Top 5 items
  const itemTotals: Record<string, { name: string; qty: number }> = {}
  for (const o of orderList) {
    for (const item of o.order_items ?? []) {
      const snapshot = item.menu_item_snapshot as any
      const name = snapshot?.name ?? 'Desconocido'
      if (!itemTotals[name]) itemTotals[name] = { name, qty: 0 }
      itemTotals[name].qty += item.qty
    }
  }
  const topItems = Object.values(itemTotals)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  // Shift duration
  const openedAt = new Date(shift.opened_at)
  const closedAt = new Date(shift.closed_at)
  const durationMs = closedAt.getTime() - openedAt.getTime()
  const durationH = Math.floor(durationMs / 3600000)
  const durationM = Math.floor((durationMs % 3600000) / 60000)
  const durationStr =
    durationH > 0 ? `${durationH}h ${durationM}m` : `${durationM}m`

  // Cash variance
  const variance =
    shift.variance_usd != null ? Number(shift.variance_usd) : null
  const varianceStr =
    variance === null
      ? 'No registrado'
      : variance === 0
        ? '✅ Sin diferencia'
        : variance > 0
          ? `⬆️ Sobrante: +$${variance.toFixed(2)}`
          : `⬇️ Faltante: -$${Math.abs(variance).toFixed(2)}`

  // Format payment methods
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

  const methodLines = Object.entries(byMethod)
    .sort(([, a], [, b]) => b - a)
    .map(([method, amount]) => {
      const label = paymentLabels[method] ?? method
      return `  • ${escapeHtml(label)}: <b>$${amount.toFixed(2)}</b>`
    })
    .join('\n')

  const topLines = topItems
    .map(
      (item, i) =>
        `  ${i + 1}. ${escapeHtml(item.name)} — <b>${item.qty} uds</b>`
    )
    .join('\n')

  const dateStr = closedAt.toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const timeStr = closedAt.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `📊 <b>REPORTE DE CIERRE — Bulldog CBO</b>
📅 ${escapeHtml(dateStr)} | ${timeStr}
👤 Turno #${shift.shift_number} · ${escapeHtml(shift.opened_profile?.full_name ?? '')}
⏱ Duración: ${durationStr}

💰 <b>VENTAS</b>
  Total: <b>$${totalUsd.toFixed(2)}</b> / ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
  Órdenes: <b>${orderCount}</b>
  Ticket promedio: <b>$${avgTicket.toFixed(2)}</b>

💳 <b>MÉTODOS DE PAGO</b>
${methodLines || '  Sin ventas'}

🏆 <b>TOP PRODUCTOS</b>
${topLines || '  Sin ventas'}

💵 <b>CAJA</b>
  Esperado: $${Number(shift.expected_cash_usd ?? 0).toFixed(2)}
  Contado: $${Number(shift.closing_cash_usd ?? 0).toFixed(2)}
  ${varianceStr}

—
<i>Bulldog CBO · Sistema POS</i>`
}
