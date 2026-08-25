begin;

alter table public.pocos
  add column if not exists projeto_local_ids jsonb not null default '[]'::jsonb;

update public.pocos
set projeto_local_ids = case
  when projeto_local_id is null then '[]'::jsonb
  else jsonb_build_array(projeto_local_id)
end
where projeto_local_ids = '[]'::jsonb;

create index if not exists pocos_projeto_local_ids_idx
  on public.pocos using gin (projeto_local_ids);

comment on column public.pocos.projeto_local_ids is
  'IDs de todos os projetos que utilizam o poço. projeto_local_id permanece como vínculo legado/principal.';

commit;
