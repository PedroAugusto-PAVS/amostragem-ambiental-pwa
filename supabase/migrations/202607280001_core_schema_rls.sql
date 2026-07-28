begin;

create table if not exists public.projetos (
  local_id text primary key,
  usuario_id uuid not null references auth.users(id) on delete restrict,
  nome text not null,
  cliente text,
  processo_comercial text,
  local text,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default timezone('utc', now()),
  atualizado_em timestamptz not null default timezone('utc', now()),
  excluido boolean not null default false
);

create table if not exists public.pocos (
  local_id text primary key,
  usuario_id uuid not null references auth.users(id) on delete restrict,
  projeto_local_id text references public.projetos(local_id) on delete cascade,
  nome text not null,
  tipo text,
  local_propriedade text,
  utm_e text,
  utm_n text,
  zona_utm text,
  hemisferio_utm text,
  latitude numeric,
  longitude numeric,
  precisao_gps numeric,
  altitude_gps numeric,
  gps_capturado_em timestamptz,
  gps jsonb,
  profundidade_total numeric,
  diametro text,
  poco_com_cap text,
  perfil_construtivo jsonb,
  fotos jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default timezone('utc', now()),
  atualizado_em timestamptz not null default timezone('utc', now()),
  excluido boolean not null default false
);

create table if not exists public.campanhas (
  local_id text primary key,
  usuario_id uuid not null references auth.users(id) on delete restrict,
  projeto_local_id text not null references public.projetos(local_id) on delete cascade,
  nome text not null,
  mes_referencia text,
  data_inicio date,
  data_fim date,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default timezone('utc', now()),
  atualizado_em timestamptz not null default timezone('utc', now()),
  excluido boolean not null default false
);

create table if not exists public.medicoes (
  local_id text primary key,
  usuario_id uuid not null references auth.users(id) on delete restrict,
  poco_local_id text not null references public.pocos(local_id) on delete cascade,
  poco_nome text,
  campanha_local_id text references public.campanhas(local_id) on delete set null,
  coletor_nome text,
  codigo_frascaria text,
  responsavel_als text,
  data_medicao date,
  mes_referencia text,
  profundidade_total_mes numeric,
  nivel_agua numeric,
  profundidade_bomba numeric,
  coluna_agua numeric,
  volume_estagnado numeric,
  volume_purga numeric,
  volume_total_esgotado numeric,
  leituras jsonb not null default '[]'::jsonb,
  estabilizacao jsonb,
  alertas jsonb not null default '[]'::jsonb,
  condicoes_ambientais jsonb not null default '{}'::jsonb,
  fotos jsonb not null default '[]'::jsonb,
  duplicada_de text references public.medicoes(local_id) on delete set null,
  criado_em timestamptz not null default timezone('utc', now()),
  atualizado_em timestamptz not null default timezone('utc', now()),
  excluido boolean not null default false
);

-- Compatibilidade com instalações anteriores: acrescenta somente colunas de
-- sincronização que podem não existir. Alterações de tipo permanecem explícitas
-- para evitar conversões destrutivas de dados já publicados.
alter table public.projetos add column if not exists excluido boolean not null default false;
alter table public.pocos add column if not exists excluido boolean not null default false;
alter table public.campanhas add column if not exists excluido boolean not null default false;
alter table public.medicoes add column if not exists excluido boolean not null default false;

create index if not exists projetos_usuario_idx on public.projetos(usuario_id);
create index if not exists pocos_usuario_projeto_idx on public.pocos(usuario_id, projeto_local_id);
create index if not exists campanhas_usuario_projeto_idx on public.campanhas(usuario_id, projeto_local_id);
create index if not exists medicoes_usuario_poco_idx on public.medicoes(usuario_id, poco_local_id);
create index if not exists medicoes_campanha_idx on public.medicoes(campanha_local_id);

alter table public.projetos enable row level security;
alter table public.pocos enable row level security;
alter table public.campanhas enable row level security;
alter table public.medicoes enable row level security;

revoke all on table public.projetos, public.pocos, public.campanhas, public.medicoes
from anon, authenticated;
grant select, insert, update, delete
on table public.projetos, public.pocos, public.campanhas, public.medicoes
to authenticated;

do $$
declare
  tabela text;
  politica record;
begin
  foreach tabela in array array['projetos', 'pocos', 'campanhas', 'medicoes']
  loop
    for politica in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = tabela
    loop
      execute format('drop policy if exists %I on public.%I', politica.policyname, tabela);
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated using (
        public.is_active_user(auth.uid())
        and (usuario_id = auth.uid() or public.is_admin(auth.uid()))
      )',
      tabela || '_select_owner_or_admin',
      tabela
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        public.is_active_user(auth.uid())
        and usuario_id = auth.uid()
      )',
      tabela || '_insert_owner',
      tabela
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (
        public.is_active_user(auth.uid())
        and (usuario_id = auth.uid() or public.is_admin(auth.uid()))
      ) with check (
        public.is_active_user(auth.uid())
        and (usuario_id = auth.uid() or public.is_admin(auth.uid()))
      )',
      tabela || '_update_owner_or_admin',
      tabela
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        public.is_active_user(auth.uid())
        and (usuario_id = auth.uid() or public.is_admin(auth.uid()))
      )',
      tabela || '_delete_owner_or_admin',
      tabela
    );
  end loop;
end;
$$;

comment on table public.projetos is 'Projetos do HydroTrack; acesso isolado por usuario via RLS.';
comment on table public.pocos is 'Pocos e pontos de monitoramento do HydroTrack.';
comment on table public.campanhas is 'Campanhas de amostragem do HydroTrack.';
comment on table public.medicoes is 'Medicoes ambientais e dados de campo do HydroTrack.';

commit;
