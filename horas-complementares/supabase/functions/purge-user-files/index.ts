// Apaga do Storage todos os arquivos de um usuario que ja foi excluido.
// Chamada pelo gatilho on_auth_user_deleted (ver ../../purge-user-files.sql).
//
// Seguranca: a funcao e publica (sem JWT), entao nao confia em quem chama.
// So apaga se o servidor de Auth confirmar que o usuario NAO existe mais.
// Chamada com id de usuario ativo, ou qualquer erro na conferencia, nao apaga nada.
import { createClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'certificates'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const body = await req.json().catch(() => null)
  const userId = body?.user_id
  if (typeof userId !== 'string' || !UUID.test(userId)) return json(400, { error: 'invalid_user_id' })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (data?.user) return json(409, { error: 'user_still_exists' })
  // Falha fechada: so segue quando o Auth responde explicitamente "nao encontrado"
  if (!error || error.status !== 404) return json(502, { error: 'could_not_verify_user' })

  let removed = 0
  for (;;) {
    const { data: files, error: listError } = await admin.storage.from(BUCKET).list(userId, { limit: 100 })
    if (listError) return json(500, { error: 'list_failed', removed })
    if (!files || files.length === 0) break

    const paths = files.map(f => `${userId}/${f.name}`)
    const { error: removeError } = await admin.storage.from(BUCKET).remove(paths)
    if (removeError) return json(500, { error: 'remove_failed', removed })
    removed += paths.length
  }

  return json(200, { removed })
})
