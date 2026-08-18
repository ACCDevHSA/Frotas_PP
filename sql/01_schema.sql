create extension if not exists pgcrypto;
create table if not exists public.vehicles (
 id uuid primary key default gen_random_uuid(), project text, model text not null, version text, color text,
 year_model text, plate text not null unique, renavam text, chassis text, rotation_day text,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.reservations (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id) on delete restrict,
 requester_name text not null, requester_email text not null, employee_number text not null, department text not null,
 job_title text, project text not null, start_date date not null, end_date date not null, purpose text not null, notes text,
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled','completed')),
 admin_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint valid_period check(end_date>=start_date)
);
create table if not exists public.loan_records (
 id uuid primary key default gen_random_uuid(), reservation_id uuid not null unique references public.reservations(id),
 vehicle_id uuid not null references public.vehicles(id), withdrawal_date date not null, expected_return_date date not null,
 actual_return_date date, status text not null default 'open' check(status in ('open','completed')),
 contract_url text, checklist_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists reservations_vehicle_dates on public.reservations(vehicle_id,start_date,end_date,status);
create or replace view public.reservations_public as select r.id,r.vehicle_id,r.requester_name,r.project,r.start_date,r.end_date,r.status,v.model,v.plate from public.reservations r join public.vehicles v on v.id=r.vehicle_id;
create or replace view public.reservations_admin as select r.*,v.model,v.version,v.color,v.plate from public.reservations r join public.vehicles v on v.id=r.vehicle_id;
create or replace view public.loan_records_view as select l.*,r.requester_name,r.requester_email,r.employee_number,r.department,r.project,v.model,v.version,v.color,v.plate from public.loan_records l join public.reservations r on r.id=l.reservation_id join public.vehicles v on v.id=l.vehicle_id;
create or replace function public.set_reservation_status(p_reservation_id uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$
declare x public.reservations;
begin
 if p_status not in ('approved','rejected') then raise exception 'Status inválido'; end if;
 select * into x from public.reservations where id=p_reservation_id for update;
 if not found then raise exception 'Solicitação não encontrada'; end if;
 if p_status='approved' and exists(select 1 from public.reservations where vehicle_id=x.vehicle_id and status='approved' and id<>x.id and start_date<=x.end_date and end_date>=x.start_date) then raise exception 'Conflito com outra reserva aprovada'; end if;
 update public.reservations set status=p_status,updated_at=now() where id=x.id;
 if p_status='approved' then insert into public.loan_records(reservation_id,vehicle_id,withdrawal_date,expected_return_date) values(x.id,x.vehicle_id,x.start_date,x.end_date) on conflict(reservation_id) do nothing; end if;
end$$;
create or replace function public.complete_reservation(p_reservation_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin update public.reservations set status='completed',updated_at=now() where id=p_reservation_id;update public.loan_records set status='completed',actual_return_date=current_date,updated_at=now() where reservation_id=p_reservation_id;end$$;
