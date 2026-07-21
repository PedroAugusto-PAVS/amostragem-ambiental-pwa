# Gerenciamento seguro de usuários

## Arquivos do módulo

- `supabase/functions/admin-users/index.ts`: Edge Function administrativa.
- `supabase/migrations/202607210001_admin_users_security.sql`: estrutura, índices, triggers e RLS.
- `supabase/config.toml`: mantém a validação JWT obrigatória para `admin-users`.
- `public/admin.html`: painel administrativo existente.
- `public/js/admin.js`: listagem, filtros e operações via Edge Function.
- `public/js/auth.js`: login com encerramento de sessão para perfil ausente ou inativo.
- `public/css/style.css`: estilos exclusivos dos controles administrativos.
- `server.js`: servidor estático, sem Service Role e sem rotas administrativas.

## Segurança e consistência

O navegador usa apenas a chave pública do projeto e o JWT da sessão. A Service Role fica somente no ambiente da Edge Function.

Usuários autenticados recebem somente `SELECT` em `public.usuarios`: cada usuário lê o próprio perfil e administradores ativos podem listar todos. `INSERT`, `UPDATE` e `DELETE` diretos são revogados; toda mutação passa pela Edge Function, evitando divergência entre Auth e perfil.

Todas as ações validam novamente o JWT, consultam `public.usuarios` e exigem administrador ativo. A criação usa `auth.admin.createUser` com `email_confirm: true`. Se a inserção do perfil falhar, a função remove imediatamente o usuário recém-criado no Auth.

Na edição, o Auth é atualizado primeiro e o perfil depois. Se o perfil falhar, os campos do Auth são restaurados. Ativação e inativação usam o mesmo mecanismo de compensação e também banem ou liberam o login no Auth.

A exclusão começa no Auth. A foreign key `usuarios.id -> auth.users.id on delete cascade` remove o perfil na mesma operação do banco. A função verifica e remove qualquer perfil remanescente, cobrindo instalações antigas. Se o Auth falhar, o perfil não é removido.

O trigger `proteger_administradores_ativos` usa advisory lock transacional. Assim, mesmo duas requisições concorrentes não conseguem remover, rebaixar ou inativar todos os administradores ativos.

## Pré-requisitos

- Docker Desktop para executar a pilha Supabase local.
- Supabase CLI via `npx supabase` ou instalação global.
- Acesso ao projeto Supabase `ecmctjixtznsixajfclt` para aplicar migration e deploy.
- Backup das tabelas `public.usuarios` e `auth.users` antes da migration.

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já são fornecidas automaticamente às Edge Functions hospedadas. A Service Role não deve ser adicionada a `public/`, ao APK ou ao repositório.

## Deploy

Execute na raiz do projeto:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref ecmctjixtznsixajfclt
npx.cmd supabase db push
npx.cmd supabase functions deploy admin-users
npx.cmd cap sync android
```

Não use `--no-verify-jwt`. O arquivo `supabase/config.toml` mantém `verify_jwt = true`.

## Teste local

```powershell
npx.cmd supabase start
npx.cmd supabase db reset
npx.cmd supabase functions serve admin-users
npm.cmd run dev
```

Abra `http://localhost:3000`, entre com um administrador da pilha local e use o painel. Para testar o frontend contra a pilha local, altere temporariamente `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `public/js/supabase.js` somente no ambiente local; não versionar chaves locais ou secretas.

## Checklist

- Admin ativo consegue listar usuários.
- Coletor não consegue listar todos os usuários nem invocar a função.
- Token ausente ou expirado retorna mensagem de permissão.
- Cadastro normal cria Auth confirmado e perfil ativo com o mesmo UUID.
- E-mail duplicado no Auth ou em `public.usuarios` é recusado.
- Senha menor que seis caracteres e e-mail inválido são recusados.
- Falha ao inserir perfil remove o Auth recém-criado.
- Edição altera nome, e-mail, tipo e status nos dois locais.
- Falha no perfil durante edição restaura o Auth.
- Usuário inativo não consegue entrar e sua sessão é encerrada no login.
- Admin não consegue inativar ou excluir a própria conta.
- Último admin ativo não pode ser inativado, rebaixado ou excluído.
- Ativar libera novamente o login.
- Excluir remove Auth e perfil.
- Pesquisa por nome/e-mail e filtros de tipo/status funcionam juntos.
- Cliques repetidos durante uma operação não criam requisições duplicadas.
- Mensagens do Supabase não aparecem diretamente na interface.
- Fluxos funcionam no navegador e no APK após o deploy da Edge Function.

## Rollback

Antes do deploy, exporte o schema e os dados de `public.usuarios`. Para voltar o frontend, reverta apenas os arquivos listados em "Arquivos do módulo" e execute `npx.cmd cap sync android`.

Para retirar a Edge Function remota:

```powershell
npx.cmd supabase functions delete admin-users --project-ref ecmctjixtznsixajfclt
```

Não remova a foreign key em cascata nem desabilite RLS sem restaurar previamente policies equivalentes. Se for indispensável reverter a migration, restaure o backup do schema/policies em uma janela de manutenção; migrations de segurança não devem ser desfeitas por um `down` genérico que possa reabrir acesso.

## Dependências da estrutura real

A migration interrompe sem alterar nada se encontrar e-mail inválido ou duplicado, tipo diferente de `admin`/`coletor`, ou perfil órfão sem linha correspondente em `auth.users`. Esses registros devem ser revisados manualmente antes do `db push`. Policies antigas da tabela `usuarios` são substituídas pelas policies versionadas deste módulo.
