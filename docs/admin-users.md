# Módulo seguro de usuários

O frontend usa somente a chave pública e o JWT da sessão. A função `admin-users` valida o JWT, busca o perfil pelo UUID autenticado e exige `tipo = 'administrador'` e `ativo = true`. A Service Role existe apenas no ambiente da Edge Function.

## Contrato

`POST /functions/v1/admin-users`, com `Authorization: Bearer <JWT>`:

```json
{ "action": "create", "data": { "nome": "Ana", "email": "ana@example.com", "senha": "segredo", "tipo": "coletor" } }
```

Ações: `create`, `update`, `activate`, `deactivate` e `delete`. Respostas usam `success`, `message`, `data` e, em erros, `code`. A edição rejeita senha. Os tipos válidos são `administrador` e `coletor`.

O Auth não possui busca administrativa direta por e-mail na versão usada. A função pagina `listUsers` em blocos de 200, até 500 páginas (100 mil usuários); isso tem custo linear e deve ser substituído por uma API oficial mais eficiente se ela surgir.

Inativação usa `updateUserById(..., { ban_duration })`, suportado pela versão fixada do SDK, e o guard do frontend também consulta `usuarios.ativo` após login, restauração, refresh do token e retorno da rede. Dados offline não são apagados.

## Banco e diagnóstico

Antes de `db push`, execute no SQL Editor:

```sql
select lower(btrim(email)) as email_normalizado,
       count(*) as quantidade,
       array_agg(id order by id) as usuarios
from public.usuarios
group by lower(btrim(email))
having count(*) > 1;
```

Corrija duplicidades manualmente também no Auth. A migration não exclui nem mescla registros. Ela converte o valor legado `admin` para `administrador`, reforça constraints, RLS, índices e cria `logs_usuarios`. `is_admin()` usa `SECURITY DEFINER`, proprietário `postgres`, `search_path` fixo e `row_security=off`: isso evita recursão da policy; `EXECUTE` fica restrito a `authenticated` e `service_role`.

## CORS e secrets

Nas Edge Functions hospedadas, `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são secrets reservados fornecidos pelo Supabase. Confirme sem imprimir valores:

```powershell
supabase secrets list
```

Configure somente as origens web adicionais, separadas por vírgula:

```powershell
supabase secrets set ALLOWED_ORIGINS=https://app.exemplo.com,https://admin.exemplo.com
```

Por padrão são aceitos o domínio do projeto Supabase, `capacitor://localhost` e `http://localhost`. A Service Role nunca deve ser copiada para `.env` público, `public/` ou APK.

## Deploy

```powershell
git add .
git commit -m "backup antes do modulo seguro de usuarios"
git tag pre-admin-users
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
supabase functions deploy admin-users
```

Não use `--no-verify-jwt`. Após testes:

```powershell
git add .
git commit -m "implementa gerenciamento seguro de usuarios"
```

## Teste local

```powershell
supabase start
supabase db reset
supabase functions serve admin-users --env-file supabase/.env.local
npm run dev
node tests/admin-users.test.js
```

Use secrets locais emitidos por `supabase status`; não versione `supabase/.env.local`. Teste no navegador, PWA e APK real. Para APK, a cópia de `public/` deve ser feita posteriormente pelo fluxo normal do Capacitor; este módulo não executa sincronização Android.

## Checklist

- Criar coletor/admin; normalizar e-mail; rejeitar duplicado no perfil ou Auth, senha curta, nome vazio e tipo inválido.
- Rejeitar coletor, perfil ausente/inativo, JWT ausente/expirado e localStorage adulterado.
- Editar nome/tipo/e-mail; rejeitar duplicidade e senha; compensar Auth se o perfil falhar.
- Ativar; inativar coletor; rejeitar autoinativação e último admin; sessão inativa encerra ao ser revalidada.
- Excluir coletor/admin com outro admin; rejeitar autoexclusão/último admin; testar perfil sem Auth, Auth sem perfil, falha e retry.
- Confirmar lista/contadores/filtros sem reload, loading, clique duplo, recuperação dos botões e mensagens sem detalhes internos.
- Simular internet instável e ausência de rede nos três ambientes.

Falhas de compensação devem ser conferidas nos logs da função e em `logs_usuarios`; nunca são enviados stack, SQL ou secrets ao cliente.

## Rollback sem perda de usuários

Frontend: reverta somente `public/admin.html`, `public/js/admin.js`, `public/js/auth.js` e `public/js/supabase.js` para `pre-admin-users`. Não sincronize Android automaticamente.

Edge Function: redeploy da versão marcada ou remova a função:

```powershell
git show pre-admin-users:supabase/functions/admin-users/index.ts > supabase/functions/admin-users/index.ts
supabase functions deploy admin-users
# ou, para desativá-la:
supabase functions delete admin-users --project-ref SEU_PROJECT_REF
```

Banco: não apague `usuarios` nem reverta a conversão de tipos enquanto o frontend novo estiver ativo. Em manutenção, remova apenas policies/funções/índices criados por `202607210002`, restaure as policies capturadas no backup e mantenha `logs_usuarios` para preservar auditoria. A tabela de logs pode permanecer sem impacto. Rollback de schema deve ser uma migration nova, revisada, nunca `db reset` em produção.

## Limitações

- Não há transação distribuída entre Auth e `public`; a função usa compensação explícita.
- Auditoria é best-effort para não transformar indisponibilidade do log em inconsistência de usuário.
- Uma sessão já offline pode operar conforme o comportamento offline existente até voltar a ter rede, exceto quando o cache local já registra `ativo=false`.
