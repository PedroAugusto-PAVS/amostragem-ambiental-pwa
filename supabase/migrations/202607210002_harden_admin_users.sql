begin;

-- Diagnóstico não destrutivo. Execute isoladamente antes do db push:
-- select lower(btrim(email)) as email_normalizado, count(*) as quantidade,
--        array_agg(id order by id) as usuarios
-- from public.usuarios
-- group by lower(btrim(email))
-- having count(*) > 1;
-- Corrija cada grupo manualmente no Auth e no perfil; esta migration não mescla nem exclui usuários.

do $$
begin
  if exists (
    select 1 from public.usuarios
    group by lower(btrim(email)) having count(*) > 1
  ) then
    raise exception 'Existem e-mails duplicados por lower(trim(email)); corrija-os manualmente antes da migration.';
  end if;
end;
$$;

drop trigger if exists usuarios_proteger_admin_trigger on public.usuarios;
alter table public.usuarios drop constraint if exists usuarios_tipo_check;
alter table public.usuarios drop constraint if exists usuarios_email_check;
alter table public.usuarios drop constraint if exists usuarios_nome_check;

update public.usuarios set tipo = 'administrador' where tipo = 'admin';
update public.usuarios set email = lower(btrim(email)), nome = btrim(nome);

alter table public.usuarios
  add constraint usuarios_tipo_check check (tipo in ('administrador', 'coletor')),
  add constraint usuarios_nome_check check (char_length(btrim(nome)) between 2 and 120),
  add constraint usuarios_email_check check (
    email = lower(btrim(email))
    and char_length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

drop index if exists public.usuarios_email_lower_uidx;
create unique index usuarios_email_normalizado_uidx on public.usuarios (lower(btrim(email)));
drop index if exists public.usuarios_tipo_ativo_idx;
create index usuarios_tipo_ativo_idx on public.usuarios (tipo, ativo);

create or replace function public.normalizar_usuario()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
  new.email := lower(btrim(new.email));
  new.atualizado_em := timezone('utc', now());
  if tg_op = 'INSERT' then new.criado_em := coalesce(new.criado_em, timezone('utc', now())); end if;
  return new;
end;
$$;

create or replace function public.is_active_user(user_id uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists(select 1 from public.usuarios where id = user_id and ativo = true);
$$;

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists(
    select 1 from public.usuarios
    where id = user_id and tipo = 'administrador' and ativo = true
  );
$$;

create or replace function public.proteger_administradores_ativos()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare outros integer;
begin
  if tg_op = 'DELETE' then
    if auth.uid() = old.id then raise exception 'Você não pode excluir sua própria conta.'; end if;
    if old.tipo = 'administrador' and old.ativo then
      perform pg_advisory_xact_lock(hashtext('hydrotrack_active_admin_guard'));
      select count(*) into outros from public.usuarios
      where tipo = 'administrador' and ativo and id <> old.id;
      if outros < 1 then raise exception 'Não é possível excluir o último administrador ativo.'; end if;
    end if;
    return old;
  end if;
  if auth.uid() = old.id and old.ativo and not new.ativo then
    raise exception 'Você não pode inativar sua própria conta.';
  end if;
  if old.tipo = 'administrador' and old.ativo
     and (new.tipo <> 'administrador' or not new.ativo) then
    perform pg_advisory_xact_lock(hashtext('hydrotrack_active_admin_guard'));
    select count(*) into outros from public.usuarios
    where tipo = 'administrador' and ativo and id <> old.id;
    if outros < 1 then raise exception 'Não é possível remover ou inativar o último administrador ativo.'; end if;
  end if;
  return new;
end;
$$;

create trigger usuarios_proteger_admin_trigger
before update or delete on public.usuarios
for each row execute function public.proteger_administradores_ativos();

alter function public.is_active_user(uuid) owner to postgres;
alter function public.is_admin(uuid) owner to postgres;
alter function public.proteger_administradores_ativos() owner to postgres;
alter function public.normalizar_usuario() owner to postgres;
revoke all on function public.is_active_user(uuid) from public;
revoke all on function public.is_admin(uuid) from public;
revoke all on function public.proteger_administradores_ativos() from public;
revoke all on function public.normalizar_usuario() from public;
grant execute on function public.is_active_user(uuid) to authenticated, service_role;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

alter table public.usuarios enable row level security;
drop policy if exists usuarios_select_self_or_admin on public.usuarios;
create policy usuarios_select_self_or_admin on public.usuarios
for select to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()));

revoke all on table public.usuarios from anon, authenticated;
grant select on table public.usuarios to authenticated;

create table if not exists public.logs_usuarios (
  id uuid primary key default gen_random_uuid(),
  ator_id uuid references auth.users(id) on delete set null,
  alvo_id uuid,
  acao text not null check (acao in ('criacao','edicao','ativacao','inativacao','exclusao','falha_criacao','falha_edicao','falha_exclusao')),
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default timezone('utc', now())
);
create index if not exists logs_usuarios_ator_criado_idx on public.logs_usuarios (ator_id, criado_em desc);
create index if not exists logs_usuarios_alvo_criado_idx on public.logs_usuarios (alvo_id, criado_em desc);
alter table public.logs_usuarios enable row level security;
revoke all on table public.logs_usuarios from anon, authenticated;
-- Sem policies: somente a Service Role da Edge Function acessa a auditoria.

comment on function public.is_admin(uuid) is
  'SECURITY DEFINER com proprietário postgres, search_path fixo e row_security off para evitar recursão de RLS; execução restrita.';
comment on table public.logs_usuarios is
  'Auditoria administrativa sem senhas, JWTs ou secrets; acesso exclusivo via Service Role.';

commit;
