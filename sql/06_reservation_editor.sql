-- Execute uma vez no SQL Editor do Supabase.
-- Mantém a validação de conflito e sincroniza loan_records ao editar reserva aprovada.
create or replace function public.admin_update_reservation(
  p_reservation_id uuid,
  p_requester_name text,
  p_requester_email text,
  p_employee_number text,
  p_department text,
  p_job_title text,
  p_project text,
  p_start_date date,
  p_end_date date,
  p_purpose text,
  p_notes text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare x public.reservations;
begin
  if p_end_date < p_start_date then raise exception 'A data final deve ser posterior ou igual à inicial'; end if;
  select * into x from public.reservations where id=p_reservation_id for update;
  if not found then raise exception 'Reserva não encontrada'; end if;

  if x.status='approved' and exists(
    select 1 from public.reservations r
    where r.vehicle_id=x.vehicle_id and r.status='approved' and r.id<>x.id
      and r.start_date<=p_end_date and r.end_date>=p_start_date
  ) then raise exception 'O novo período conflita com outra reserva aprovada'; end if;

  update public.reservations set
    requester_name=p_requester_name, requester_email=p_requester_email,
    employee_number=p_employee_number, department=p_department,
    job_title=p_job_title, project=p_project, start_date=p_start_date,
    end_date=p_end_date, purpose=p_purpose, notes=p_notes, updated_at=now()
  where id=p_reservation_id;

  if x.status='approved' then
    update public.loan_records set withdrawal_date=p_start_date,
      expected_return_date=p_end_date, updated_at=now()
    where reservation_id=p_reservation_id;
  end if;
end;$$;

create or replace function public.admin_delete_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  delete from public.loan_records where reservation_id=p_reservation_id;
  delete from public.reservations where id=p_reservation_id;
  if not found then raise exception 'Reserva não encontrada'; end if;
end;$$;

grant execute on function public.admin_update_reservation(uuid,text,text,text,text,text,text,date,date,text,text) to anon,authenticated;
grant execute on function public.admin_delete_reservation(uuid) to anon,authenticated;
