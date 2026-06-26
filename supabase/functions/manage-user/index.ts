import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getAdminClient } from '../_shared/supabase.ts'
import { handleOptions, jsonHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const supabase = getAdminClient()

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Forbidden — owners only' }), {
        status: 403,
        headers: jsonHeaders,
      })
    }

    const body = await req.json()
    const { action } = body

    // ── CREATE ───────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { full_name, username, password, role = 'worker' } = body

      if (!full_name || !username || !password) {
        return new Response(
          JSON.stringify({ error: 'full_name, username y password son requeridos' }),
          { status: 400, headers: jsonHeaders }
        )
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
          { status: 400, headers: jsonHeaders }
        )
      }

      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .is('deleted_at', null)
        .single()

      if (existing) {
        return new Response(
          JSON.stringify({ error: `El usuario "${username}" ya existe` }),
          { status: 409, headers: jsonHeaders }
        )
      }

      const internalEmail = `${username.toLowerCase().trim()}@bulldogcbo.internal`

      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: internalEmail,
          password,
          email_confirm: true,
        })

      if (createError) {
        if (createError.message.includes('already registered')) {
          return new Response(
            JSON.stringify({ error: `El usuario "${username}" ya existe` }),
            { status: 409, headers: jsonHeaders }
          )
        }
        throw createError
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUser.user.id,
          full_name: full_name.trim(),
          username: username.toLowerCase().trim(),
          role,
          is_active: true,
        })

      if (profileError) {
        await supabase.auth.admin.deleteUser(newUser.user.id)
        throw profileError
      }

      await supabase.from('audit_log').insert({
        actor_id: user.id,
        action: 'user.created',
        entity_type: 'profile',
        entity_id: newUser.user.id,
        after: { full_name, username, role },
      })

      return new Response(
        JSON.stringify({ ok: true, userId: newUser.user.id }),
        { headers: jsonHeaders }
      )
    }

    // ── DEACTIVATE ───────────────────────────────────────────────────────────
    if (action === 'deactivate') {
      const { userId } = body

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId requerido' }),
          { status: 400, headers: jsonHeaders }
        )
      }

      if (userId === user.id) {
        return new Response(
          JSON.stringify({ error: 'No puedes desactivar tu propia cuenta' }),
          { status: 400, headers: jsonHeaders }
        )
      }

      const now = new Date().toISOString()
      await supabase
        .from('profiles')
        .update({ is_active: false, deleted_at: now })
        .eq('id', userId)

      await supabase.auth.admin.updateUserById(userId, { ban_duration: '876600h' })

      await supabase.from('audit_log').insert({
        actor_id: user.id,
        action: 'user.deactivated',
        entity_type: 'profile',
        entity_id: userId,
      })

      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders })
    }

    // ── REACTIVATE ───────────────────────────────────────────────────────────
    if (action === 'reactivate') {
      const { userId } = body

      if (userId === user.id) {
        return new Response(
          JSON.stringify({ error: 'Operación no permitida' }),
          { status: 400, headers: jsonHeaders }
        )
      }

      await supabase
        .from('profiles')
        .update({ is_active: true, deleted_at: null })
        .eq('id', userId)

      await supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' })

      await supabase.from('audit_log').insert({
        actor_id: user.id,
        action: 'user.reactivated',
        entity_type: 'profile',
        entity_id: userId,
      })

      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders })
    }

    // ── RESET PASSWORD ────────────────────────────────────────────────────────
    if (action === 'reset_password') {
      const { userId, newPassword } = body

      if (!userId || !newPassword) {
        return new Response(
          JSON.stringify({ error: 'userId y newPassword requeridos' }),
          { status: 400, headers: jsonHeaders }
        )
      }

      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
          { status: 400, headers: jsonHeaders }
        )
      }

      await supabase.auth.admin.updateUserById(userId, { password: newPassword })

      await supabase.from('audit_log').insert({
        actor_id: user.id,
        action: 'user.password_reset',
        entity_type: 'profile',
        entity_id: userId,
      })

      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders })
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: jsonHeaders }
    )
  } catch (err) {
    console.error('manage-user error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: jsonHeaders }
    )
  }
})
