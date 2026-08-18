-- HOMOLOGAÇÃO SEM LOGIN. Estas políticas são deliberadamente abertas.
alter table public.vehicles enable row level security;alter table public.reservations enable row level security;alter table public.loan_records enable row level security;
revoke all on public.vehicles,public.reservations,public.loan_records from anon,authenticated;
grant select on public.vehicles to anon,authenticated;
grant insert,select,update on public.reservations to anon,authenticated;
grant select,update,insert on public.loan_records to anon,authenticated;
grant select on public.reservations_public,public.reservations_admin,public.loan_records_view to anon,authenticated;
grant execute on function public.set_reservation_status(uuid,text) to anon,authenticated;
grant execute on function public.complete_reservation(uuid) to anon,authenticated;
create policy vehicles_read_all on public.vehicles for select to anon,authenticated using(true);
create policy reservations_read_all on public.reservations for select to anon,authenticated using(true);
create policy reservations_insert_all on public.reservations for insert to anon,authenticated with check(status='pending');
create policy reservations_update_all on public.reservations for update to anon,authenticated using(true) with check(true);
create policy loan_records_read_all on public.loan_records for select to anon,authenticated using(true);
create policy loan_records_insert_all on public.loan_records for insert to anon,authenticated with check(true);
create policy loan_records_update_all on public.loan_records for update to anon,authenticated using(true) with check(true);
