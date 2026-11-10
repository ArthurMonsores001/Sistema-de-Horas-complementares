-- Regras de status do certificado para o aluno.
-- Aplicado como migration "lock_approved_certificates_and_default_180".
--
-- 1. Insert: aluno so cria certificado como draft ou pending, sem comentario de avaliador.
-- 2. Update: aluno nao altera certificado aprovado nem em avaliacao (pending).
--    So pode mudar o status para pending (envio ou reenvio apos reprovacao).
--    Nunca altera supervisor_comment.
-- 3. Delete: aluno nao exclui certificado aprovado.
-- Supervisor e service role (auth.uid() nulo) nao passam por estas travas.

drop policy if exists "cert_insert" on public.certificates;
create policy "cert_insert"
on public.certificates for insert
to authenticated
with check (
  exists (
    select 1 from public.student_profiles p
    where p.id = certificates.profile_id and p.user_id = auth.uid()
  )
  and status in ('draft', 'pending')
  and supervisor_comment is null
);

-- A transicao de status passa a ser validada pelo trigger abaixo.
-- O with check antigo impedia o aluno de corrigir um certificado reprovado.
drop policy if exists "cert_update" on public.certificates;
create policy "cert_update"
on public.certificates for update
to authenticated
using (
  exists (
    select 1 from public.student_profiles p
    where p.id = certificates.profile_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.student_profiles p
    where p.id = certificates.profile_id and p.user_id = auth.uid()
  )
);

create or replace function public.guard_certificate_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_supervisor() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'approved' then
      raise exception 'Certificado aprovado não pode ser excluído.' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.status = 'approved' then
    raise exception 'Certificado aprovado não pode ser alterado nem reenviado.' using errcode = '42501';
  end if;
  if old.status = 'pending' then
    raise exception 'Certificado em avaliação não pode ser alterado.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and new.status <> 'pending' then
    raise exception 'Apenas supervisores podem aprovar ou reprovar certificados.' using errcode = '42501';
  end if;
  if new.supervisor_comment is distinct from old.supervisor_comment then
    raise exception 'Apenas supervisores podem alterar o comentário de avaliação.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists certificates_guard_changes on public.certificates;
create trigger certificates_guard_changes
  before update or delete on public.certificates
  for each row
  execute function public.guard_certificate_changes();

-- is_supervisor() nao precisa ser chamavel sem login.
revoke execute on function public.is_supervisor() from public, anon;
grant execute on function public.is_supervisor() to authenticated;

-- Carga padrao: 180 h (provisorio, ate resposta da coordenacao).
alter table public.student_profiles alter column total_required set default 180;
update public.student_profiles set total_required = 180 where total_required <> 180;

create or replace function public.lock_total_required()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.total_required := 180; -- mesmo valor do default da coluna
  else
    new.total_required := old.total_required;
  end if;

  return new;
end;
$$;
