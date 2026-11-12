-- Lista de supervisores para consulta no Dashboard (Table Editor / SQL Editor).
-- So leitura: o papel continua vindo apenas de public.user_roles.
-- Rodar no Supabase Dashboard > SQL Editor. Idempotente.
--
-- security_invoker + revoke: aluno e supervisor nao leem estes e-mails pela API.

create or replace view public.supervisores
with (security_invoker = true) as
select u.email, r.created_at as supervisor_desde, u.last_sign_in_at as ultimo_acesso
from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role = 'supervisor';

revoke all on public.supervisores from public, anon, authenticated;
