# HydroTrack

[![Versão](https://img.shields.io/badge/versão-1.2.0-0A7EA4)](./package.json)
[![Licença MIT](https://img.shields.io/badge/licença-MIT-green.svg)](./LICENSE)
[![PWA](https://img.shields.io/badge/PWA-offline--first-5A0FC8)](#arquitetura)
[![Android](https://img.shields.io/badge/Android-Capacitor-3DDC84)](./android)

Plataforma offline-first para gerenciamento de projetos ambientais, campanhas de amostragem, poços de monitoramento e medições de campo. O HydroTrack funciona como aplicação web progressiva e aplicativo Android, com persistência local em IndexedDB e sincronização com o Supabase.

> **Status:** em desenvolvimento ativo. Valide sincronização, backups, geolocalização e exportações antes do uso em produção.

## Sumário

- [Recursos](#recursos)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Como executar](#como-executar)
- [Configuração do Supabase](#configuração-do-supabase)
- [Testes e qualidade](#testes-e-qualidade)
- [Android](#android)
- [Segurança e dados](#segurança-e-dados)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Roadmap](#roadmap)
- [Licença](#licença)

## Recursos

- Gestão de projetos, clientes, campanhas e poços ambientais.
- Cadastro de PMs, PJs e poços de produção com coordenadas GPS/UTM.
- Registro de medições hidráulicas, condições ambientais e leituras multiparâmetros.
- Múltiplos códigos por medição: amostra, duplicata, brancos, controle e outros.
- Fotos, observações, alertas e histórico por poço.
- Geração de fichas de campo em PDF.
- Backup e restauração do banco local em JSON.
- Operação sem internet e sincronização posterior com a nuvem.

## Arquitetura

O HydroTrack utiliza uma estratégia **offline-first**:

1. A aplicação grava e consulta os registros localmente no IndexedDB.
2. Alterações permanecem disponíveis durante atividades de campo sem conexão.
3. Quando a rede é restabelecida, o módulo de sincronização reconcilia registros locais e remotos.
4. O Supabase fornece autenticação, PostgreSQL, políticas RLS e persistência em nuvem.

Principais entidades sincronizadas: 

- `projetos`
- `campanhas`
- `pocos`
- `medicoes`
- `medicao_codigos`

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Interface | HTML5, CSS3 e JavaScript |
| Aplicação web | PWA e Service Worker |
| Persistência local | IndexedDB |
| Backend | Supabase, PostgreSQL, Auth e RLS |
| Android | Capacitor, Android Studio e Gradle |
| Documentos | jsPDF |
| Servidor local | Node.js e Express |

## Como executar

### Pré-requisitos

- Node.js e npm
- Git
- Projeto configurado no Supabase
- Android Studio e JDK compatível, apenas para o aplicativo Android

### Instalação

```bash
git clone https://github.com/PedroAugusto-PAVS/amostragem-ambiental-pwa.git
cd amostragem-ambiental-pwa
npm install
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`. Geolocalização e Service Worker exigem `localhost` ou HTTPS.

## Configuração do Supabase

Configure a URL do projeto e a chave pública anon/publishable no módulo de conexão do front-end.

```js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA-CHAVE-PUBLICA";
```

Nunca exponha a chave `service_role`, senhas, arquivos `.env`, chaves de assinatura Android ou credenciais administrativas no front-end ou no repositório.

## Testes e qualidade

```bash
# Executa a suíte automatizada
npm test

# Valida sintaxe e executa todos os testes
npm run check
```

A suíte cobre códigos de amostras, sincronização, migrações, relatórios e exportação de fichas.

## Android

Após alterar os arquivos web:

```bash
npx cap sync android
npx cap open android
```

O identificador oficial do aplicativo é `br.com.pavs.hydrotrack`. Para permitir atualizações, preserve o mesmo applicationId, a mesma chave de assinatura e incremente o versionCode.

Antes de atualizar um dispositivo:

1. Sincronize os registros.
2. Exporte um backup local.
3. Confirme a persistência no Supabase.
4. Instale a nova versão sobre a existente.

## Segurança e dados

- Autenticação pelo Supabase Auth.
- Isolamento de dados por políticas Row Level Security.
- Persistência local para continuidade do trabalho de campo.
- Sincronização controlada e backup manual do IndexedDB.
- HTTPS recomendado em produção.

Dados locais podem ser perdidos ao limpar o armazenamento ou desinstalar o aplicativo. Mantenha backups atualizados e confirme a sincronização antes de qualquer manutenção.

## Estrutura do projeto

```text
.
├── .github/workflows/   # validação e build na CI
├── android/             # projeto nativo Capacitor
├── docs/                # documentação complementar
├── public/              # aplicação web/PWA
├── resources/           # recursos do aplicativo
├── supabase/            # migrations e Edge Functions
├── tests/               # testes automatizados
├── capacitor.config.json
├── package.json
└── server.js
```

## Roadmap

- Evolução da sincronização e resolução de conflitos.
- Backup automático e exportações mais completas.
- Mapas, rotas de coleta e QR Code.
- Controle de equipamentos, calibração e cadeia de custódia.
- Melhorias contínuas de arquitetura, UX e painel administrativo.

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](./LICENSE).

## Autor

Desenvolvido por [Pedro Augusto](https://github.com/PedroAugusto-PAVS).
