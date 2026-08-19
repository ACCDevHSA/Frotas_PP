-- Execute uma vez no SQL Editor
alter table public.vehicles add column if not exists last_driver text;

-- Sempre que o usuário atual for trocado manualmente, preserva o anterior.
create or replace function public.keep_previous_driver() returns trigger language plpgsql as $$
begin
  if old.current_driver is distinct from new.current_driver
     and nullif(btrim(coalesce(old.current_driver,'')),'') is not null then
    new.last_driver := old.current_driver;
  end if;
  new.updated_at := now();
  return new;
end;$$;
drop trigger if exists trg_keep_previous_driver on public.vehicles;
create trigger trg_keep_previous_driver before update of current_driver on public.vehicles for each row execute function public.keep_previous_driver();

-- Recria a view utilizada no site. Reservas aprovadas aparecem imediatamente.
create or replace view public.reservations_public as
select r.id,r.vehicle_id,r.requester_name,r.project,r.start_date,r.end_date,r.status,r.created_at,v.model,v.plate
from public.reservations r join public.vehicles v on v.id=r.vehicle_id;
grant select on public.reservations_public to anon,authenticated;

-- Mantém permissões de edição desta versão sem login.
grant select,insert,update on public.vehicles to anon,authenticated;
