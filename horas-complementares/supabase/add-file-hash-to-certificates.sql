alter table public.certificates
add column if not exists file_hash text;

create index if not exists certificates_profile_id_file_hash_idx
on public.certificates (profile_id, file_hash)
where file_hash is not null;
