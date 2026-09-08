-- One staff record may serve as a class Coach, PT Trainer, or both.
create table if not exists trainer_roles (
  trainer_id uuid not null references trainers(id) on delete cascade,
  role text not null check (role in ('COACH', 'TRAINER')),
  primary key (trainer_id, role)
);
alter table trainer_roles enable row level security;
drop policy if exists "trainer_roles_select" on trainer_roles;
create policy "trainer_roles_select" on trainer_roles for select using (exists (select 1 from trainers t where t.id = trainer_id and is_org_member(t.organization_id)));
drop policy if exists "trainer_roles_insert" on trainer_roles;
create policy "trainer_roles_insert" on trainer_roles for insert with check (exists (select 1 from trainers t where t.id = trainer_id and is_org_wide(t.organization_id)));
drop policy if exists "trainer_roles_delete" on trainer_roles;
create policy "trainer_roles_delete" on trainer_roles for delete using (exists (select 1 from trainers t where t.id = trainer_id and is_org_wide(t.organization_id)));
grant select, insert, delete on trainer_roles to authenticated;

-- Existing instructors previously called Trainer are kept available for classes.
insert into trainer_roles (trainer_id, role)
select id, 'COACH' from trainers
on conflict do nothing;
insert into trainer_roles (trainer_id, role)
select id, 'TRAINER' from trainers
on conflict do nothing;
