# HydroTrack

Aplicativo profissional para gerenciamento de projetos, campanhas, poços de monitoramento e medições ambientais, com funcionamento offline e sincronização com o Supabase.

O HydroTrack foi desenvolvido para facilitar atividades de campo, permitindo registrar informações mesmo sem conexão com a internet e sincronizá-las posteriormente com o banco de dados em nuvem.

Versão atual: **1.2.0**.

---

## Visão geral

O HydroTrack permite organizar e acompanhar:

- Projetos ambientais;
- Campanhas de amostragem;
- Poços de monitoramento e poços de produção;
- Medições mensais;
- Dados hidráulicos;
- Coordenadas GPS e UTM;
- Leituras de parâmetros de campo;
- Fotos dos poços e das medições;
- Códigos de amostras, incluindo duplicatas;
- Histórico por poço;
- Exportação de fichas em PDF;
- Backup e restauração do banco local;
- Sincronização entre IndexedDB e Supabase.

---

## Principais funcionalidades

### Projetos

- Cadastro de projetos;
- Cliente, local e descrição;
- Associação de campanhas e poços;
- Edição e exclusão lógica;
- Funcionamento offline.

### Campanhas

- Cadastro de campanhas por projeto;
- Período de execução;
- Mês de referência;
- Observações;
- Associação com medições.

### Poços

- Cadastro de PMs, PJs e poços de produção;
- Nome, tipo e localização;
- Coordenadas geográficas;
- Coordenadas UTM;
- Precisão e altitude do GPS;
- Profundidade total;
- Diâmetro;
- Perfil construtivo;
- Registro de fotos;
- Histórico de medições.

### Medições

- Data e mês de referência;
- Responsável e coletor;
- Profundidade total medida;
- Nível da água;
- Profundidade da bomba;
- Cálculo da coluna d’água;
- Volume estagnado;
- Volume de purga;
- Volume total esgotado;
- Leituras multiparâmetros;
- Condições ambientais;
- Alertas;
- Fotografias;
- Observações;
- Duplicação de medições.

### Códigos de amostras

Uma medição pode possuir múltiplos códigos, incluindo:

- Amostra normal;
- Duplicata;
- Branco;
- Branco de campo;
- Branco de viagem;
- Controle;
- Outros tipos.

Os códigos são armazenados localmente com a medição e sincronizados com a tabela `medicao_codigos` no Supabase.

### Funcionamento offline

O HydroTrack utiliza IndexedDB para armazenar os dados no aparelho.

Isso permite:

- Cadastrar dados sem internet;
- Consultar registros salvos localmente;
- Continuar o trabalho em campo;
- Sincronizar os registros quando a conexão for restabelecida.

### Sincronização

A sincronização envia e recebe dados entre o IndexedDB e o Supabase.

Tabelas principais:

- `projetos`;
- `campanhas`;
- `pocos`;
- `medicoes`;
- `medicao_codigos`.

A sincronização possui tratamento para:

- Registros pendentes;
- Exclusões;
- Conflitos de atualização;
- Códigos múltiplos;
- Campos numéricos vazios;
- Reconciliação entre dados locais e remotos.

### Backup local

O aplicativo permite exportar o banco local em JSON.

O backup inclui todas as stores existentes no IndexedDB e pode ser usado para recuperação dos registros em caso de falha, troca de aparelho ou atualização do aplicativo.

Recomendações:

- Criar backups regularmente;
- Guardar os arquivos em mais de um local;
- Salvar uma cópia no computador ou Google Drive;
- Nunca limpar os dados do aplicativo sem confirmar que os registros foram sincronizados ou exportados.

### Exportações

O HydroTrack gera fichas de campo em PDF com informações como:

- Projeto;
- Campanha;
- Identificação do poço;
- Localização;
- Dados hidráulicos;
- Leituras de campo;
- Estabilização;
- Alertas;
- Condições ambientais;
- Observações.

---

## Tecnologias utilizadas

### Front-end

- HTML5;
- CSS3;
- JavaScript;
- PWA;
- Service Worker.

### Banco local

- IndexedDB.

### Backend e banco em nuvem

- Supabase;
- PostgreSQL;
- Supabase Auth;
- Row Level Security — RLS.

### Android

- Capacitor;
- Android Studio;
- Gradle.

### Bibliotecas

- Supabase JavaScript Client;
- jsPDF.

---

## Estrutura atual do projeto

```text
HydroTrack/
├── .github/workflows/       # validação e build Android na CI
├── android/                 # projeto nativo gerado pelo Capacitor
├── public/                  # aplicação web e PWA
│   ├── css/
│   ├── icons/
│   ├── js/
│   ├── libs/
│   ├── index.html
│   ├── manifest.json
│   └── service-worker.js
├── supabase/
│   ├── functions/           # Edge Functions administrativas
│   └── migrations/          # schema e políticas RLS versionadas
├── tests/
├── capacitor.config.json
├── package.json
└── README.md
```

A estrutura poderá ser reorganizada futuramente para separar melhor módulos, serviços, páginas, componentes, banco local, sincronização e exportações.

---

## Pré-requisitos

Para executar o projeto, instale:

- Node.js;
- npm;
- Git;
- Android Studio;
- Java JDK compatível com o projeto;
- Conta e projeto no Supabase.

---

## Instalação

Clone o repositório:

```bash
git clone https://github.com/PedroAugusto-PAVS/amostragem-ambiental-pwa.git
```

Entre na pasta:

```bash
cd amostragem-ambiental-pwa
```

Instale as dependências:

```bash
npm install
```

---

## Configuração do Supabase

Configure a URL e a chave pública do projeto no arquivo responsável pela conexão, normalmente:

```text
public/js/supabase.js
```

Exemplo:

```javascript
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA-CHAVE-PUBLICA";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
```

Nunca publique no GitHub:

- Senhas;
- Chaves privadas;
- Service Role Key;
- Arquivos `.env`;
- Arquivos de assinatura Android;
- Senhas da chave `.jks`.

A chave `service_role` nunca deve ser usada no front-end.

---

## Executar no navegador

O projeto possui um servidor HTTP local para desenvolvimento.

Exemplo:

```bash
npm run dev
```

Acesse `http://localhost:3000`.

Algumas APIs, como geolocalização e Service Worker, exigem:

- `localhost`; ou
- conexão HTTPS.

---

## Atualizar o Android

Depois de alterar os arquivos web:

```bash
npx cap sync android
```

Para abrir no Android Studio:

```bash
npx cap open android
```

---

## Gerar APK de teste

No Android Studio:

```text
Build
→ Build Bundle(s) / APK(s)
→ Build APK(s)
```

O arquivo normalmente será criado em:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Gerar versão assinada

No Android Studio:

```text
Build
→ Generate Signed Bundle / APK
→ APK ou Android App Bundle
```

Para permitir atualizações por cima de uma versão já instalada, mantenha:

- O mesmo `applicationId`;
- A mesma chave `.jks`;
- O mesmo alias;
- Um `versionCode` maior;
- A instalação por cima do aplicativo existente.

App ID oficial:

```text
br.com.pavs.hydrotrack
```

---

## Cuidados ao atualizar

Antes de instalar uma nova versão:

1. Sincronize os dados;
2. Exporte um backup local;
3. Confirme que os registros estão no Supabase;
4. Gere o novo APK;
5. Instale por cima do aplicativo atual.

Não faça:

- Desinstalação antes da atualização;
- Limpeza dos dados do aplicativo;
- Restauração da nuvem sem verificar os dados locais;
- Troca da chave de assinatura;
- Alteração do App ID.

---

## Segurança

O HydroTrack utiliza:

- Autenticação pelo Supabase;
- Políticas RLS;
- Separação por usuário;
- Banco local offline;
- Sincronização controlada;
- Backup manual do IndexedDB.

Recomendações adicionais:

- Revisar regularmente as políticas RLS;
- Manter as dependências atualizadas;
- Não expor chaves privadas;
- Utilizar HTTPS;
- Criar backups do Supabase;
- Proteger o repositório e a chave Android;
- Usar autenticação de dois fatores nas contas do projeto.

---

## Git

Verificar alterações:

```bash
git status
```

Adicionar arquivos:

```bash
git add .
```

Criar commit:

```bash
git commit -m "feat: descreve a alteração realizada"
```

Enviar para o GitHub:

```bash
git push origin main
```

Exemplo de commit para o backup local:

```bash
git commit -m "feat: adiciona backup e restauração do banco local"
```

---

## Roadmap

Melhorias previstas:

- Reorganização completa da estrutura do projeto;
- Refatoração dos módulos;
- Melhoria da arquitetura;
- Backup automático;
- Assinatura digital;
- Fotos no PDF;
- PDF completo da campanha;
- Mapa com marcadores;
- Rotas de coleta;
- Controle de equipamentos;
- Controle de calibração;
- Cadeia de custódia;
- QR Code;
- Sincronização mais inteligente;
- Exportações mais completas;
- Melhorias de UX e UI;
- Painel administrativo mais completo.

---

## Licença

Este projeto é distribuído sob a licença MIT. Consulte o arquivo
[`LICENSE`](LICENSE) para conhecer os termos de uso, cópia, modificação e
distribuição.

---

## Autor

Desenvolvido por **Pedro Augusto**.

Projeto:

```text
HydroTrack
```

Aplicativo para gerenciamento de poços, campanhas e medições ambientais.

---

## Status

Projeto em desenvolvimento ativo.

As funcionalidades devem ser testadas antes do uso em produção, especialmente:

- Sincronização;
- Backup e restauração;
- Geolocalização;
- Geração de PDF;
- Instalação e atualização do APK;
- Políticas de segurança do Supabase.
