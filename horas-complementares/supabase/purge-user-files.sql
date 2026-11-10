-- Ao excluir um usuario em auth.users, apaga tambem os arquivos dele no Storage.
-- As tabelas (student_profiles, certificates, user_roles) ja caem por ON DELETE CASCADE.
-- Os arquivos nao: o Supabase bloqueia DELETE em storage.objects e o arquivo fisico
-- so sai pela API de Storage. Por isso o gatilho chama a Edge Function purge-user-files.
--
-- pg_net envia a requisicao depois do COMMIT, entao a funcao ja encontra o usuario excluido.

create extension if not exists pg_net with schema extensions;

create or replace function public.purge_user_files_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://fsutnueghixkfdixfszy.supabase.co/functions/v1/purge-user-files',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('user_id', old.id)
  );
  return old;
exception when others then
  -- Falha ao agendar a limpeza nunca pode impedir a exclusao da conta
  raise warning 'purge_user_files_on_delete: %', sqlerrm;
  return old;
end;
$$;

revoke all on function public.purge_user_files_on_delete() from public, anon, authenticated;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.purge_user_files_on_delete();
