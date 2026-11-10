-- Trava total_required: aluno nao define nem altera a propria carga exigida.
-- Aplicado como migration "lock_total_required_for_students".
--
-- Insert pela API: o valor enviado e ignorado e vale o padrao da coluna (180).
-- Update pela API: o valor antigo e mantido, sem erro, para o upsert do app continuar funcionando.
-- Service role / SQL Editor (auth.uid() nulo) continuam podendo alterar.

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

drop trigger if exists student_profiles_lock_total_required on public.student_profiles;
create trigger student_profiles_lock_total_required
  before insert or update on public.student_profiles
  for each row
  execute function public.lock_total_required();
