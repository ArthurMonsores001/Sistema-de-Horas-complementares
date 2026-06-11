-- Fix gap #2: bloqueia aluno de auto-aprovar certificado ou alterar supervisor_comment
-- Run this in Supabase Dashboard > SQL Editor

-- Função trigger: rejeita mudança de status para approved/rejected e
-- mudança de supervisor_comment por usuários não-supervisor
create or replace function public.prevent_student_status_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if not public.is_supervisor() then
    if new.supervisor_comment is distinct from old.supervisor_comment then
      raise exception 'Apenas supervisores podem alterar o comentário de avaliação.';
    end if;
    if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
      raise exception 'Apenas supervisores podem aprovar ou reprovar certificados.';
    end if;
  end if;
  return new;
end;
$$;

-- Aplica o trigger na tabela certificates
drop trigger if exists certificates_prevent_student_status_change on public.certificates;
create trigger certificates_prevent_student_status_change
  before update on public.certificates
  for each row
  execute function public.prevent_student_status_change();
