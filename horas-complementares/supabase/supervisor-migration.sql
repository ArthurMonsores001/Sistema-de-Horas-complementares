-- Migration: Supervisor feature
-- Run this in Supabase Dashboard > SQL Editor

-- ── 1. Tabela de roles ────────────────────────────────────────────
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('student', 'supervisor')),
  created_at timestamptz default now(),
  unique(user_id)
);

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own"
on public.user_roles for select
to authenticated
using (auth.uid() = user_id);

-- ── 2. Função auxiliar de RLS ─────────────────────────────────────
create or replace function public.is_supervisor()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'supervisor'
  )
$$;

-- ── 3. Novos campos em student_profiles ───────────────────────────
alter table public.student_profiles
  add column if not exists turma  text not null default '',
  add column if not exists periodo text not null default '';

-- ── 4. Novos campos em certificates ──────────────────────────────
alter table public.certificates
  add column if not exists status             text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected')),
  add column if not exists supervisor_comment text,
  add column if not exists submitted_at       timestamptz;

-- ── 5. RLS: supervisor pode ler todos os perfis ───────────────────
drop policy if exists "student_profiles_select_own" on public.student_profiles;
create policy "student_profiles_select_own"
on public.student_profiles for select
to authenticated
using (auth.uid() = user_id or public.is_supervisor());

-- ── 6. RLS: supervisor pode ler todos os certificados ─────────────
drop policy if exists "certificates_select_own" on public.certificates;
create policy "certificates_select_own"
on public.certificates for select
to authenticated
using (
  exists (
    select 1 from public.student_profiles p
    where p.id = certificates.profile_id
      and p.user_id = auth.uid()
  )
  or public.is_supervisor()
);

-- ── 7. RLS: supervisor pode atualizar status e comentário ─────────
drop policy if exists "certificates_update_supervisor" on public.certificates;
create policy "certificates_update_supervisor"
on public.certificates for update
to authenticated
using (public.is_supervisor())
with check (public.is_supervisor());

-- ── 8. RLS: supervisor pode visualizar arquivos de qualquer aluno ─
drop policy if exists "certificate_files_select_own" on storage.objects;
create policy "certificate_files_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'certificates'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_supervisor()
  )
);
