-- Execute uma única vez no SQL Editor do Supabase
alter table public.vehicles add column if not exists manual_status text not null default 'auto' check (manual_status in ('auto','available','unavailable'));
alter table public.vehicles add column if not exists current_user text;
alter table public.vehicles add column if not exists manual_start_date date;
alter table public.vehicles add column if not exists manual_end_date date;
-- A política abaixo é necessária apenas nesta versão sem login.
drop policy if exists vehicles_insert_all on public.vehicles;
drop policy if exists vehicles_update_all on public.vehicles;
drop policy if exists vehicles_delete_all on public.vehicles;
revoke all on public.vehicles from anon,authenticated;
grant select,insert,update,delete on public.vehicles to anon,authenticated;
create policy vehicles_insert_all on public.vehicles for insert to anon,authenticated with check(true);
create policy vehicles_update_all on public.vehicles for update to anon,authenticated using(true) with check(true);
create policy vehicles_delete_all on public.vehicles for delete to anon,authenticated using(true);
-- Garante que as views existentes reflitam as novas colunas automaticamente.
create or replace view public.reservations_public as select r.id,r.vehicle_id,r.requester_name,r.project,r.start_date,r.end_date,r.status,v.model,v.plate from public.reservations r join public.vehicles v on v.id=r.vehicle_id;
create or replace view public.reservations_admin as select r.*,v.model,v.version,v.color,v.plate from public.reservations r join public.vehicles v on v.id=r.vehicle_id;
