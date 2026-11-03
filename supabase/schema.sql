-- BUKU PENGHUBUNG SD NO. 3 LUKLUK
-- Jalankan sekali di Supabase SQL Editor, setelah membuat project baru.
-- Setelah guru/admin mendaftar, naikkan role mereka memakai perintah di README.
-- Jangan jalankan dengan schema yang sudah berisi tabel bernama sama tanpa pemeriksaan.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null unique,
 full_name text not null default '',
 role text not null default 'parent' check (role in ('parent','teacher','admin')),
 created_at timestamptz not null default now()
);

create table if not exists public.students (
 id uuid primary key default gen_random_uuid(),
 full_name text not null check (length(trim(full_name)) between 2 and 150),
 class_name text not null default 'VI',
 nis text not null default '',
 nisn text not null default '',
 school_year text not null default '2026/2027',
 teacher_id uuid not null references public.profiles(id),
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists public.guardian_links (
 student_id uuid not null references public.students(id) on delete cascade,
 guardian_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(student_id,guardian_id)
);

create table if not exists public.entries (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.students(id) on delete cascade,
 occurred_on date not null default current_date,
 category text not null default 'Informasi' check(category in ('Informasi','Perkembangan Belajar','Kedisiplinan','Kehadiran','Apresiasi','Lainnya')),
 message text not null check(length(trim(message)) between 5 and 800),
 teacher_id uuid not null references public.profiles(id),
 author_name text not null,
 teacher_signature text not null check(teacher_signature like 'data:image/png;base64,%' and length(teacher_signature) <= 200000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.acknowledgments (
 entry_id uuid primary key references public.entries(id) on delete cascade,
 guardian_id uuid not null references public.profiles(id),
 signature_data text not null check(signature_data like 'data:image/png;base64,%' and length(signature_data) <= 200000),
 signed_at timestamptz not null default now()
);

create index if not exists students_teacher_idx on public.students(teacher_id);
create index if not exists guardian_links_guardian_idx on public.guardian_links(guardian_id);
create index if not exists entries_student_date_idx on public.entries(student_id,occurred_on desc);
create index if not exists entries_teacher_idx on public.entries(teacher_id);
create index if not exists ack_guardian_idx on public.acknowledgments(guardian_id);

-- Automatically create unprivileged parent account on every Supabase signup.
create or replace function private.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,email,full_name,role)
 values(new.id, lower(coalesce(new.email,'')), left(trim(coalesce(new.raw_user_meta_data->>'full_name','')),150), 'parent')
 on conflict (id) do nothing;
 return new;
end;
$$;

drop trigger if exists on_auth_user_created_buku on auth.users;
create trigger on_auth_user_created_buku after insert on auth.users
for each row execute procedure private.create_profile_for_new_user();

-- Restore existing auth users if they signed up before SQL setup.
insert into public.profiles(id,email,full_name,role)
select id, lower(email),left(trim(coalesce(raw_user_meta_data->>'full_name','')),150),'parent'
from auth.users where email is not null
on conflict (id) do nothing;

create or replace function private.my_role()
returns text language sql stable security definer set search_path = '' as $$
 select coalesce((select role from public.profiles where id = auth.uid()),'anonymous');
$$;

create or replace function private.can_teach(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select (private.my_role() = 'admin') or exists (
  select 1 from public.students s where s.id=p_student and s.teacher_id=auth.uid() and private.my_role() = 'teacher'
 );
$$;

create or replace function private.is_guardian(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.guardian_links gl where gl.student_id=p_student and gl.guardian_id=auth.uid());
$$;

create or replace function private.can_read_student(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select private.can_teach(p_student) or private.is_guardian(p_student);
$$;

create or replace function private.teacher_has_guardian(p_guardian uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select (private.my_role() in ('teacher','admin')) and exists(
 select 1 from public.guardian_links gl
 join public.students s on s.id=gl.student_id
 where gl.guardian_id=p_guardian and (s.teacher_id=auth.uid() or private.my_role()='admin')
 );
$$;

-- Database-enforced immutable signatures: only teacher messages can be edited before acknowledgment.
create or replace function private.protect_entry_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
 if exists(select 1 from public.acknowledgments a where a.entry_id=old.id) then
  raise exception 'Berita sudah ditandatangani orang tua dan tidak dapat diubah atau dihapus';
 end if;
 if tg_op = 'UPDATE' then
  if new.student_id is distinct from old.student_id
    or new.teacher_id is distinct from old.teacher_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Identitas berita tidak boleh diubah';
  end if;
  new.updated_at = now();
 end if;
 if tg_op = 'DELETE' then
  return old;
 end if;
 return new;
end;
$$;

drop trigger if exists entries_protect_changes on public.entries;
create trigger entries_protect_changes before update or delete on public.entries
for each row execute function private.protect_entry_changes();

create or replace function private.stamp_acknowledgment()
returns trigger language plpgsql set search_path = '' as $$
begin
 new.guardian_id = auth.uid();
 new.signed_at = now();
 return new;
end;
$$;

drop trigger if exists ack_stamp on public.acknowledgments;
create trigger ack_stamp before insert on public.acknowledgments
for each row execute function private.stamp_acknowledgment();

-- Parent email lookup is exact-match and can only link to a pupil that the caller teaches.
create or replace function public.link_guardian_by_email(p_student uuid, p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_guardian uuid;
begin
 if auth.uid() is null or not private.can_teach(p_student) then
  raise exception 'Akses ditolak';
 end if;
 if length(trim(coalesce(p_email,''))) > 254 then return false; end if;
 select id into v_guardian from public.profiles
 where email = lower(trim(p_email)) and role='parent' limit 1;
 if v_guardian is null then return false; end if;
 insert into public.guardian_links(student_id,guardian_id) values(p_student,v_guardian)
 on conflict do nothing;
 return true;
end;
$$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.guardian_links enable row level security;
alter table public.entries enable row level security;
alter table public.acknowledgments enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using(id=(select auth.uid()) or (select private.my_role())='admin' or (select private.teacher_has_guardian(id)));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
using((select private.my_role())='admin') with check((select private.my_role())='admin');

drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated
using((select private.can_read_student(id)));
drop policy if exists students_insert on public.students;
create policy students_insert on public.students for insert to authenticated
with check( (select private.my_role())='admin' or ((select private.my_role())='teacher' and teacher_id=(select auth.uid())) );
drop policy if exists students_update on public.students;
create policy students_update on public.students for update to authenticated
using((select private.can_teach(id))) with check((select private.can_teach(id)) and ((select private.my_role())='admin' or teacher_id=(select auth.uid())));

drop policy if exists guardians_read on public.guardian_links;
create policy guardians_read on public.guardian_links for select to authenticated
using(guardian_id=(select auth.uid()) or (select private.can_teach(student_id)));
drop policy if exists guardians_delete on public.guardian_links;
create policy guardians_delete on public.guardian_links for delete to authenticated
using((select private.can_teach(student_id)));

drop policy if exists entries_read on public.entries;
create policy entries_read on public.entries for select to authenticated
using((select private.can_read_student(student_id)));
drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries for insert to authenticated
with check((select private.can_teach(student_id)) and teacher_id=(select auth.uid()));
drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries for update to authenticated
using((select private.can_teach(student_id))) with check((select private.can_teach(student_id)));
drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries for delete to authenticated
using((select private.can_teach(student_id)));

drop policy if exists ack_read on public.acknowledgments;
create policy ack_read on public.acknowledgments for select to authenticated
using(exists(select 1 from public.entries e where e.id=entry_id and (select private.can_read_student(e.student_id))));
drop policy if exists ack_insert on public.acknowledgments;
create policy ack_insert on public.acknowledgments for insert to authenticated
with check(guardian_id=(select auth.uid()) and exists(select 1 from public.entries e where e.id=entry_id and (select private.is_guardian(e.student_id))));
-- No UPDATE and DELETE policies on acknowledgments: signed acknowledgment is permanent.

-- Revoke API access by anonymous visitors. RLS protects authenticated rows.
revoke all on public.profiles,public.students,public.guardian_links,public.entries,public.acknowledgments from anon;
grant select,update on public.profiles to authenticated;
grant select,insert,update on public.students to authenticated;
grant select,delete on public.guardian_links to authenticated;
grant select,insert,update,delete on public.entries to authenticated;
grant select,insert on public.acknowledgments to authenticated;
revoke all on function public.link_guardian_by_email(uuid,text) from public,anon;
grant execute on function public.link_guardian_by_email(uuid,text) to authenticated;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.my_role(),private.can_teach(uuid),private.is_guardian(uuid),private.can_read_student(uuid),private.teacher_has_guardian(uuid) from public;
grant execute on function private.my_role(),private.can_teach(uuid),private.is_guardian(uuid),private.can_read_student(uuid),private.teacher_has_guardian(uuid) to authenticated;

-- IMPORTANT: DO NOT put service_role key in browser. Only URL + publishable/anon key.
