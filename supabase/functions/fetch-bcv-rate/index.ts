import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getAdminClient } from '../_shared/supabase.ts'
import { handleOptions, jsonHeaders } from '../_shared/cors.ts'

const BCV_API = 'https://ve.dolarapi.com/v1/dolares/oficial'

interface DolarApiResponse {
  fuente: string
  nombre: string
  compra: number
  venta: number
  promedio: number
  fechaActualizacion: string
}

serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const supabase = getAdminClient()

    const res = await fetch(BCV_API, {
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) {
      throw new Error(`BCV API returned ${res.status}`)
    }

    const data: DolarApiResponse = await res.json()

    if (!data.promedio || data.promedio <= 0) {
      throw new Error('Invalid rate received from BCV API')
    }

    const rate = data.promedio

    if (rate < 10 || rate > 100000) {
      throw new Error(`Rate ${rate} failed sanity check, refusing to apply`)
    }

    const { data: lastSourceSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'usd_rate_source')
      .single()

    const { data: rateUpdatedAtSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'usd_rate_updated_at')
      .single()

    const lastSource = lastSourceSetting?.value ?? 'auto'
    const lastUpdate = rateUpdatedAtSetting?.value ? new Date(rateUpdatedAtSetting.value) : null
    const minutesSinceUpdate = lastUpdate
      ? (Date.now() - lastUpdate.getTime()) / 60000
      : Infinity

    if (lastSource === 'manual' && minutesSinceUpdate < 30) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'recent manual override' }),
        { headers: jsonHeaders }
      )
    }

    const now = new Date().toISOString()

    await supabase.from('settings').upsert([
      { key: 'usd_rate',             value: String(rate), updated_at: now },
      { key: 'usd_rate_updated_at',  value: now,          updated_at: now },
      { key: 'usd_rate_source',      value: 'auto',       updated_at: now },
      { key: 'usd_rate_fetched_from', value: data.fuente ?? 'dolarapi.com', updated_at: now },
    ], { onConflict: 'key' })

    await supabase.from('audit_log').insert({
      action: 'settings.usd_rate_auto_updated',
      entity_type: 'settings',
      entity_id: '00000000-0000-0000-0000-000000000000',
      meta: { rate, source: data.fuente, fetched_at: now },
    })

    return new Response(
      JSON.stringify({ ok: true, rate, fechaActualizacion: data.fechaActualizacion }),
      { headers: jsonHeaders }
    )

  } catch (err) {
    console.error('fetch-bcv-rate failed:', err)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: jsonHeaders }
    )
  }
})
