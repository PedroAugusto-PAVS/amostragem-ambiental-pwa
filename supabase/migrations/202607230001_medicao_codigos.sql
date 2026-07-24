begin;

-- O HydroTrack cria medicoes offline e usa medicoes.local_id como identificador
-- estavel entre IndexedDB e Supabase. A relacao abaixo usa essa chave para que
-- uma tentativa repetida de sincronizacao nao crie outra medicao.
do $$
begin
  if to_regclass('public.medicoes') is null then
    raise exception 'A tabela public.medicoes nao existe.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medicoes'
      and column_name = 'local_id'
      and data_type = 'text'
  ) then
    raise exception 'public.medicoes.local_id precisa existir e ser text.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medicoes'
      and column_name = 'usuario_id'
  ) then
    raise exception 'public.medicoes.usuario_id precisa existir para as politicas RLS.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medicoes'
      and column_name = 'codigo_frascaria'
  ) then
    raise exception 'public.medicoes.codigo_frascaria precisa existir para o backfill seguro.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medicoes'
      and column_name = 'criado_em'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medicoes'
      and column_name = 'atualizado_em'
  ) then
    raise exception 'public.medicoes precisa conter criado_em e atualizado_em para o backfill.';
  end if;

  if to_regclass('public.usuarios') is null then
    raise exception 'A tabela public.usuarios nao existe para validar usuarios ativos e administradores.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'ativo'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'tipo'
  ) then
    raise exception 'public.usuarios precisa conter as colunas ativo e tipo para as politicas RLS.';
  end if;

  if exists (
    select 1
    from public.medicoes
    where local_id is not null
    group by local_id
    having count(*) > 1
  ) then
    raise exception
      'public.medicoes.local_id contém valores repetidos. Corrija-os antes de aplicar esta migração.';
  end if;

end;
$$;

-- O upsert atual de medicoes ja depende da unicidade de local_id. O indice
-- tambem permite que a tabela filha use essa chave como foreign key.
create unique index if not exists medicoes_local_id_uidx
  on public.medicoes (local_id);

create table if not exists public.medicao_codigos (
  local_id uuid primary key default gen_random_uuid(),
  medicao_local_id text not null,
  codigo text not null,
  tipo text not null default 'normal',
  ordem integer not null default 0,
  criado_em timestamptz not null default timezone('utc', now()),
  atualizado_em timestamptz not null default timezone('utc', now()),

  constraint medicao_codigos_medicao_fkey
    foreign key (medicao_local_id)
    references public.medicoes(local_id)
    on update cascade
    on delete cascade,

  constraint medicao_codigos_tipo_check check (
    tipo in (
      'normal',
      'duplicata',
      'branco',
      'branco_campo',
      'branco_viagem',
      'controle',
      'outro'
    )
  ),

  constraint medicao_codigos_codigo_check check (
    codigo = btrim(codigo)
    and char_length(codigo) between 1 and 200
  ),

  constraint medicao_codigos_ordem_check check (ordem >= 0),

  constraint medicao_codigos_medicao_codigo_unique
    unique (medicao_local_id, codigo)
);

create index if not exists medicao_codigos_medicao_ordem_idx
  on public.medicao_codigos (medicao_local_id, ordem, criado_em);

create unique index if not exists medicao_codigos_codigo_normalizado_uidx
  on public.medicao_codigos (medicao_local_id, lower(btrim(codigo)));

create or replace function public.normalizar_medicao_codigo()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.codigo := btrim(new.codigo);
  new.tipo := lower(btrim(new.tipo));
  new.atualizado_em := timezone('utc', now());

  if tg_op = 'INSERT' then
    new.criado_em := coalesce(new.criado_em, timezone('utc', now()));
  end if;

  return new;
end;
$$;

-- Auxiliares SECURITY DEFINER isolam as consultas de autorizacao e desativam
-- RLS apenas dentro das funcoes. Nenhuma policy de usuarios consulta a tabela
-- medicao_codigos, evitando recursao.
create or replace function public.medicao_codigos_usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists (
    select 1
    from public.usuarios
    where id = auth.uid()
      and ativo = true
  );
$$;

create or replace function public.pode_editar_medicao_codigo(
  medicao_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select
    public.medicao_codigos_usuario_ativo()
    and (
      exists (
        select 1
        from public.medicoes
        where local_id = medicao_id
          and usuario_id = auth.uid()
      )
      or exists (
        select 1
        from public.usuarios
        where id = auth.uid()
          and ativo = true
          and tipo in ('admin', 'administrador')
      )
    );
$$;

drop trigger if exists medicao_codigos_normalizar_trigger
  on public.medicao_codigos;
create trigger medicao_codigos_normalizar_trigger
before insert or update on public.medicao_codigos
for each row execute function public.normalizar_medicao_codigo();

-- Backfill seguro do campo legado. O marcador interno "Marcado manualmente"
-- representa apenas progresso de campanha e nao e um codigo de amostra.
insert into public.medicao_codigos (
  local_id,
  medicao_local_id,
  codigo,
  tipo,
  ordem,
  criado_em,
  atualizado_em
)
select
  gen_random_uuid(),
  medicao.local_id,
  btrim(medicao.codigo_frascaria),
  'normal',
  0,
  coalesce(medicao.criado_em, timezone('utc', now())),
  coalesce(medicao.atualizado_em, timezone('utc', now()))
from public.medicoes medicao
where nullif(btrim(medicao.codigo_frascaria), '') is not null
  and medicao.local_id is not null
  and lower(btrim(medicao.codigo_frascaria)) <> 'marcado manualmente'
  and not exists (
    select 1
    from public.medicao_codigos codigo_existente
    where codigo_existente.medicao_local_id = medicao.local_id
      and lower(btrim(codigo_existente.codigo)) =
          lower(btrim(medicao.codigo_frascaria))
  )
on conflict (medicao_local_id, codigo) do nothing;

alter table public.medicao_codigos enable row level security;

drop policy if exists medicao_codigos_select on public.medicao_codigos;
drop policy if exists medicao_codigos_insert on public.medicao_codigos;
drop policy if exists medicao_codigos_update on public.medicao_codigos;
drop policy if exists medicao_codigos_delete on public.medicao_codigos;

-- A subconsulta respeita as politicas existentes de medicoes. Assim, o usuario
-- somente enxerga codigos de uma medicao que ele ja pode enxergar.
create policy medicao_codigos_select
on public.medicao_codigos
for select
to authenticated
using (
  public.medicao_codigos_usuario_ativo()
  and exists (
    select 1
    from public.medicoes medicao
    where medicao.local_id = medicao_codigos.medicao_local_id
  )
);

create policy medicao_codigos_insert
on public.medicao_codigos
for insert
to authenticated
with check (
  public.pode_editar_medicao_codigo(medicao_codigos.medicao_local_id)
);

create policy medicao_codigos_update
on public.medicao_codigos
for update
to authenticated
using (
  public.pode_editar_medicao_codigo(medicao_codigos.medicao_local_id)
)
with check (
  public.pode_editar_medicao_codigo(medicao_codigos.medicao_local_id)
);

create policy medicao_codigos_delete
on public.medicao_codigos
for delete
to authenticated
using (
  public.pode_editar_medicao_codigo(medicao_codigos.medicao_local_id)
);

revoke all on table public.medicao_codigos from anon;
revoke all on table public.medicao_codigos from authenticated;
grant select, insert, update, delete
  on table public.medicao_codigos to authenticated;
grant all on table public.medicao_codigos to service_role;

alter function public.medicao_codigos_usuario_ativo() owner to postgres;
alter function public.pode_editar_medicao_codigo(text) owner to postgres;

revoke all on function public.normalizar_medicao_codigo() from public;
revoke all on function public.medicao_codigos_usuario_ativo() from public;
revoke all on function public.pode_editar_medicao_codigo(text) from public;
grant execute on function public.medicao_codigos_usuario_ativo()
  to authenticated, service_role;
grant execute on function public.pode_editar_medicao_codigo(text)
  to authenticated, service_role;

comment on table public.medicao_codigos is
  'Codigos de amostra, duplicatas, brancos e controles vinculados a uma unica medicao HydroTrack.';
comment on column public.medicao_codigos.local_id is
  'UUID gerado offline e reutilizado em upserts idempotentes.';
comment on column public.medicao_codigos.medicao_local_id is
  'Referencia a chave offline estavel public.medicoes.local_id.';
comment on column public.medicao_codigos.ordem is
  'Ordem de exibicao dos codigos dentro da medicao.';
comment on function public.normalizar_medicao_codigo() is
  'Normaliza codigo, tipo e timestamp sem consultar usuarios e sem recursao de RLS.';
comment on function public.medicao_codigos_usuario_ativo() is
  'Confirma que o usuario autenticado esta ativo sem recursao de RLS.';
comment on function public.pode_editar_medicao_codigo(text) is
  'Autoriza o proprietario da medicao ou um administrador ativo a editar seus codigos.';

commit;
