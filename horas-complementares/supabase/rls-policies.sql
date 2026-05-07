-- Supabase RLS policies for Horas Complementares
-- Run this file in Supabase Dashboard > SQL Editor.

-- Profiles: each authenticated user can only access their own profiles.
alter table public.student_profiles enable row level security;

drop policy if exists "student_profiles_select_own" on public.student_profiles;
drop policy if exists "student_profiles_insert_own" on public.student_profiles;
drop policy if exists "student_profiles_update_own" on public.student_profiles;
drop policy if exists "student_profiles_delete_own" on public.student_profiles;

create policy "student_profiles_select_own"
on public.student_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "student_profiles_insert_own"
on public.student_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "student_profiles_update_own"
on public.student_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "student_profiles_delete_own"
on public.student_profiles
for delete
to authenticated
using (auth.uid() = user_id);

-- Certificates: access is allowed only through a profile owned by the user.
alter table public.certificates enable row level security;

drop policy if exists "certificates_select_own" on public.certificates;
drop policy if exists "certificates_insert_own" on public.certificates;
drop policy if exists "certificates_update_own" on public.certificates;
drop policy if exists "certificates_delete_own" on public.certificates;

create policy "certificates_select_own"
on public.certificates
for select
to authenticated
using (
  exists (
    select 1
    from public.student_profiles profile
    where profile.id = certificates.profile_id
      and profile.user_id = auth.uid()
  )
);

create policy "certificates_insert_own"
on public.certificates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.student_profiles profile
    where profile.id = certificates.profile_id
      and profile.user_id = auth.uid()
  )
);

create policy "certificates_update_own"
on public.certificates
for update
to authenticated
using (
  exists (
    select 1
    from public.student_profiles profile
    where profile.id = certificates.profile_id
      and profile.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.student_profiles profile
    where profile.id = certificates.profile_id
      and profile.user_id = auth.uid()
  )
);

create policy "certificates_delete_own"
on public.certificates
for delete
to authenticated
using (
  exists (
    select 1
    from public.student_profiles profile
    where profile.id = certificates.profile_id
      and profile.user_id = auth.uid()
  )
);

-- Storage: files are stored in certificates/{auth.uid()}/...
update storage.buckets
set public = false
where id = 'certificates';

drop policy if exists "certificate_files_select_own" on storage.objects;
drop policy if exists "certificate_files_insert_own" on storage.objects;
drop policy if exists "certificate_files_update_own" on storage.objects;
drop policy if exists "certificate_files_delete_own" on storage.objects;

create policy "certificate_files_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'certificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "certificate_files_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'certificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "certificate_files_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'certificates'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'certificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "certificate_files_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'certificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);
