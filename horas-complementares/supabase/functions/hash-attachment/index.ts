// Calcula no servidor o SHA-256 de um anexo ja enviado ao Storage e grava em
// public.attachment_hashes. O trigger set_certificate_file_hash usa esse valor
// e ignora o hash enviado pelo cliente (ver ../../server-file-hash.sql).
//
// Seguranca: exige JWT valido e so aceita arquivo dentro da pasta do proprio
// usuario ({user_id}/arquivo). Nada do corpo da requisicao e confiado alem do caminho.
import { createClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'certificates'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  const user = auth?.user
  if (!user) return json(401, { error: 'unauthorized' })

  const body = await req.json().catch(() => null)
  const path = body?.storage_path
  // Formato gravado pelo upload: {user_id}/{arquivo}, sem subpastas
  const fileName = typeof path === 'string' ? path.slice(user.id.length + 1) : ''
  if (
    typeof path !== 'string' ||
    path.length > 300 ||
    !path.startsWith(`${user.id}/`) ||
    !fileName ||
    fileName.includes('/') ||
    fileName.includes('..')
  ) {
    return json(400, { error: 'invalid_storage_path' })
  }

  const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(path)
  if (downloadError || !file) return json(404, { error: 'file_not_found' })

  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const fileHash = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')

  const { error: saveError } = await admin
    .from('attachment_hashes')
    .upsert({ storage_path: path, file_hash: fileHash })
  if (saveError) return json(500, { error: 'save_failed' })

  return json(200, { file_hash: fileHash })
})
