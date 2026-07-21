begin;

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  tipo text not null default 'coletor',
  ativo boolean not null default true,
  criado_em timestamptz not null default timezone('utc', now()),
  atualizado_em timestamptz not null default timezone('utc', now())
);

alter table public.usuarios add column if not exists nome text;
alter table public.usuarios add column if not exists email text;
alter table public.usuarios add column if not exists tipo text;
alter table public.usuarios add column if not exists ativo boolean;
alter table public.usuarios add column if not exists criado_em timestamptz;
alter table public.usuarios add column if not exists atualizado_em timestamptz;

update public.usuarios
set
  nome = coalesce(nullif(btrim(nome), ''), 'Usuário'),
  email = lower(btrim(email)),
  tipo = coalesce(nullif(btrim(tipo), ''), 'coletor'),
  ativo = coalesce(ativo, true),
  criado_em = coalesce(criado_em, timezone('utc', now())),
  atualizado_em = coalesce(atualizado_em, timezone('utc', now()));

do $$
begin
  if exists (
    select 1
    from public.usuarios
    where email is null
       or email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'Existem e-mails inválidos em public.usuarios. Corrija-os antes de aplicar a migration.';
  end if;

  if exists (
    select lower(email)
    from public.usuarios
    group by lower(email)
    having count(*) > 1
  ) then
    raise exception 'Existem e-mails duplicados em public.usuarios. Corrija-os antes de aplicar a migration.';
  end if;

  if exists (
    select 1
    from public.usuarios
    where tipo not in ('admin', 'coletor')
  ) then
    raise exception 'Existem tipos inválidos em public.usuarios. Use apenas admin ou coletor.';
  end if;

  if exists (
    select 1
    from public.usuarios usuario
    left join auth.users auth_user on auth_user.id = usuario.id
    where auth_user.id is null
  ) then
    raise exception 'Existem perfis sem usuário correspondente no Supabase Auth.';
  end if;
end;
$$;

alter table public.usuarios alter column nome set not null;
alter table public.usuarios alter column email set not null;
alter table public.usuarios alter column tipo set not null;
alter table public.usuarios alter column tipo set default 'coletor';
alter table public.usuarios alter column ativo set not null;
alter table public.usuarios alter column ativo set default true;
alter table public.usuarios alter column criado_em set not null;
alter table public.usuarios alter column criado_em set default timezone('utc', now());
alter table public.usuarios alter column atualizado_em set not null;
alter table public.usuarios alter column atualizado_em set default timezone('utc', now());

do $$
declare
  foreign_key_record record;
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.usuarios'::regclass
      and contype = 'p'
  ) then
    alter table public.usuarios
      add constraint usuarios_pkey primary key (id);
  end if;

  for foreign_key_record in
    select constraint_info.conname
    from pg_constraint constraint_info
    join pg_attribute column_info
      on column_info.attrelid = constraint_info.conrelid
     and column_info.attnum = any(constraint_info.conkey)
    where constraint_info.conrelid = 'public.usuarios'::regclass
      and constraint_info.contype = 'f'
      and constraint_info.confrelid = 'auth.users'::regclass
      and column_info.attname = 'id'
  loop
    execute format(
      'alter table public.usuarios drop constraint %I',
      foreign_key_record.conname
    );
  end loop;

  alter table public.usuarios
    add constraint usuarios_id_auth_fkey
    foreign key (id) references auth.users(id) on delete cascade;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.usuarios'::regclass
      and conname = 'usuarios_tipo_check'
  ) then
    alter table public.usuarios
      add constraint usuarios_tipo_check
      check (tipo in ('admin', 'coletor'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.usuarios'::regclass
      and conname = 'usuarios_email_check'
  ) then
    alter table public.usuarios
      add constraint usuarios_email_check
      check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
  end if;
end;
$$;

create unique index if not exists usuarios_id_uidx
  on public.usuarios (id);

create unique index if not exists usuarios_email_lower_uidx
  on public.usuarios (lower(email));

create index if not exists usuarios_tipo_ativo_idx
  on public.usuarios (tipo, ativo);

create index if not exists usuarios_nome_lower_idx
  on public.usuarios (lower(nome));

create or replace function public.normalizar_usuario()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
  new.email := lower(btrim(new.email));
  new.atualizado_em := timezone('utc', now());

  if tg_op = 'INSERT' then
    new.criado_em := coalesce(new.criado_em, timezone('utc', now()));
  end if;

  return new;
end;
$$;

create or replace function public.proteger_administradores_ativos()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  outros_admins_ativos integer;
begin
  if tg_op = 'DELETE' then
    if auth.uid() = old.id then
      raise exception using
        errcode = 'P0001',
        message = 'O administrador não pode excluir a própria conta.';
    end if;

    if old.tipo = 'admin' and old.ativo then
      perform pg_advisory_xact_lock(hashtext('hydrotrack_active_admin_guard'));

      select count(*)
      into outros_admins_ativos
      from public.usuarios
      where tipo = 'admin'
        and ativo = true
        and id <> old.id;

      if outros_admins_ativos < 1 then
        raise exception using
          errcode = 'P0001',
          message = 'O último administrador ativo não pode ser excluído.';
      end if;
    end if;

    return old;
  end if;

  if auth.uid() = old.id and old.ativo and not new.ativo then
    raise exception using
      errcode = 'P0001',
      message = 'O administrador não pode inativar a própria conta.';
  end if;

  if old.tipo = 'admin'
     and old.ativo
     and (new.tipo <> 'admin' or not new.ativo) then
    perform pg_advisory_xact_lock(hashtext('hydrotrack_active_admin_guard'));

    select count(*)
    into outros_admins_ativos
    from public.usuarios
    where tipo = 'admin'
      and ativo = true
      and id <> old.id;

    if outros_admins_ativos < 1 then
      raise exception using
        errcode = 'P0001',
        message = 'O último administrador ativo não pode ser inativado ou rebaixado.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists usuarios_normalizar_trigger on public.usuarios;
create trigger usuarios_normalizar_trigger
before insert or update on public.usuarios
for each row execute function public.normalizar_usuario();

drop trigger if exists usuarios_proteger_admin_trigger on public.usuarios;
create trigger usuarios_proteger_admin_trigger
before update or delete on public.usuarios
for each row execute function public.proteger_administradores_ativos();

create or replace function public.is_active_user(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.usuarios
    where id = user_id
      and ativo = true
  );
$$;

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.usuarios
    where id = user_id
      and tipo = 'admin'
      and ativo = true
  );
$$;

revoke all on function public.is_active_user(uuid) from public;
revoke all on function public.is_admin(uuid) from public;
revoke all on function public.proteger_administradores_ativos() from public;
revoke all on function public.normalizar_usuario() from public;

grant execute on function public.is_active_user(uuid) to authenticated, service_role;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

alter table public.usuarios enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'usuarios'
  loop
    execute format('drop policy if exists %I on public.usuarios', policy_record.policyname);
  end loop;
end;
$$;

revoke all on table public.usuarios from anon;
revoke all on table public.usuarios from authenticated;
grant select on table public.usuarios to authenticated;

create policy usuarios_select_self_or_admin
on public.usuarios
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin(auth.uid())
);

comment on function public.is_admin(uuid) is
  'Verifica administrador ativo sem recursão de RLS. SECURITY DEFINER com search_path fixo.';

comment on function public.is_active_user(uuid) is
  'Verifica se o perfil está ativo sem recursão de RLS. SECURITY DEFINER com search_path fixo.';

comment on table public.usuarios is
  'Leitura protegida por RLS. Mutações administrativas são permitidas somente pela Edge Function admin-users.';

commit;
