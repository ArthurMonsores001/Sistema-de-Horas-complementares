-- Identificacao de certificado duplicado: barreira no banco (KAN-11).
-- Rodar no Supabase Dashboard > SQL Editor. Idempotente.
--
-- ORDEM DE PUBLICACAO (importa):
--   1. publicar a Edge Function hash-attachment
--   2. publicar o frontend que chama a funcao depois do upload
--   3. rodar este arquivo
-- Rodar este arquivo antes dos passos 1 e 2 bloqueia o envio de certificado com anexo.

-- ── 1. Indice unico: mesmo arquivo nao entra duas vezes no mesmo perfil ──────
-- Conferir antes se ha duplicata antiga (o create falha se houver):
--   select profile_id, file_hash, count(*) from public.certificates
--   where file_hash is not null group by 1, 2 having count(*) > 1;
create unique index if not exists certificates_profile_file_hash_unique
on public.certificates (profile_id, file_hash)
where file_hash is not null;

-- O indice nao unico antigo cobre as mesmas colunas e ficou redundante.
drop index if exists public.certificates_profile_id_file_hash_idx;

-- ── 2. Hash calculado pelo servidor ───────────────────────────────────────────
-- Preenchida so pela Edge Function hash-attachment (service role).
-- RLS ligado e nenhuma policy: aluno e supervisor nao leem nem escrevem.
create table if not exists public.attachment_hashes (
  storage_path text primary key,
  file_hash    text not null,
  created_at   timestamptz not null default now()
);

alter table public.attachment_hashes enable row level security;
revoke all on public.attachment_hashes from anon, authenticated;

-- O file_hash enviado pelo cliente e ignorado sempre que existe arquivo no Storage.
create or replace function public.set_certificate_file_hash()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  server_hash text;
begin
  -- Sem arquivo no Storage nao ha o que conferir.
  if new.storage_path is null then
    return new;
  end if;

  -- Mesmo arquivo de antes: o hash nao muda, venha o que vier do cliente.
  if tg_op = 'UPDATE' and new.storage_path is not distinct from old.storage_path then
    new.file_hash := old.file_hash;
    return new;
  end if;

  -- O arquivo tem que estar na pasta do dono do perfil ({user_id}/...).
  if split_part(new.storage_path, '/', 1) is distinct from (
    select p.user_id::text from public.student_profiles p where p.id = new.profile_id
  ) then
    raise exception 'O arquivo anexado não pertence a este aluno.' using errcode = '42501';
  end if;

  select h.file_hash into server_hash
  from public.attachment_hashes h
  where h.storage_path = new.storage_path;

  if server_hash is null then
    raise exception 'O arquivo anexado ainda não foi verificado. Tente enviar novamente.' using errcode = '42501';
  end if;

  new.file_hash := server_hash;
  return new;
end;
$$;

revoke execute on function public.set_certificate_file_hash() from public, anon, authenticated;

drop trigger if exists certificates_set_file_hash on public.certificates;
create trigger certificates_set_file_hash
  before insert or update on public.certificates
  for each row
  execute function public.set_certificate_file_hash();
