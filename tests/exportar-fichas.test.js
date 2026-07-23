const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const dbLocalSource = fs.readFileSync("public/js/db-local.js", "utf8");

function carregarExportador(caminho, inicializador) {
  const source = fs.readFileSync(caminho, "utf8");
  const chamadaInicial = new RegExp(`\\s*${inicializador}\\(\\);\\s*$`);

  assert.match(source, chamadaInicial, `${caminho} deve inicializar a tela.`);

  const sourceParaTeste = `${dbLocalSource}
${source.replace(chamadaInicial, "")}
globalThis.exportTestApi = {
  configurarDados(dados) {
    projetosExportacao = dados.projetos;
    campanhasExportacao = dados.campanhas;
    pocosExportacao = dados.pocos;
    medicoesExportacao = dados.medicoes;
  },
  atualizarFiltroProjeto,
  atualizarFiltroCampanha,
  obterMedicoesFiltradas
};`;

  const elementos = {
    filtroProjeto: { value: "", innerHTML: "" },
    filtroCampanha: { value: "", innerHTML: "" },
    listaPocosFiltro: { innerHTML: "" },
    listaMedicoesExportacao: { innerHTML: "" },
    tipoExportacaoTexto: { innerText: "" },
  };
  let pocosSelecionados = [];

  const context = {
    console,
    localStorage: {
      getItem(chave) {
        return chave === "usuario" ? '{"id":"usuario-teste"}' : null;
      },
    },
    window: { location: { href: "" } },
    document: {
      getElementById(id) {
        return elementos[id];
      },
      querySelectorAll(seletor) {
        if (seletor === ".checkPocoFiltro:checked") {
          return pocosSelecionados.map((value) => ({ value }));
        }

        return [];
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(sourceParaTeste, context);

  return {
    api: context.exportTestApi,
    elementos,
    selecionarPocos(ids) {
      pocosSelecionados = ids;
    },
  };
}

const dados = {
  projetos: [
    { local_id: "projeto-1", nome: "Projeto 1" },
    { local_id: "projeto-2", nome: "Projeto 2" },
  ],
  campanhas: [
    {
      local_id: "campanha-1",
      projeto_local_id: "projeto-1",
      nome: "Campanha 1",
      mes_referencia: "2026-07",
    },
    {
      local_id: "campanha-2",
      projeto_local_id: "projeto-1",
      nome: "Campanha 2",
      mes_referencia: "2026-08",
    },
    {
      local_id: "campanha-3",
      projeto_local_id: "projeto-2",
      nome: "Campanha 3",
      mes_referencia: "2026-07",
    },
  ],
  pocos: [
    { local_id: "pm-1", projeto_local_id: "projeto-1", nome: "PM-1" },
    { local_id: "pm-2", projeto_local_id: "projeto-1", nome: "PM-2" },
    { local_id: "pm-3", projeto_local_id: "projeto-2", nome: "PM-3" },
  ],
  medicoes: [
    {
      local_id: "medicao-1",
      poco_local_id: "pm-1",
      campanha_local_id: "campanha-1",
      mes_referencia: "2026-07",
    },
    {
      local_id: "medicao-2",
      poco_local_id: "pm-2",
      campanha_local_id: "campanha-2",
      mes_referencia: "2026-08",
    },
    {
      local_id: "medicao-legada",
      poco_local_id: "pm-2",
      campanha_local_id: null,
      mes_referencia: "2026-07",
    },
    {
      local_id: "medicao-3",
      poco_local_id: "pm-3",
      campanha_local_id: "campanha-3",
      mes_referencia: "2026-07",
    },
  ],
};

function testarExportador(caminho, inicializador) {
  const tela = carregarExportador(caminho, inicializador);
  tela.api.configurarDados(dados);

  tela.elementos.filtroProjeto.value = "projeto-1";
  tela.elementos.filtroCampanha.value = "campanha-1";
  tela.elementos.listaPocosFiltro.innerHTML = "lista-preservada";

  tela.api.atualizarFiltroCampanha();

  assert.equal(
    tela.elementos.filtroCampanha.value,
    "campanha-1",
    `${caminho} não pode apagar a campanha selecionada.`
  );
  assert.equal(
    tela.elementos.listaPocosFiltro.innerHTML,
    "lista-preservada",
    `${caminho} não pode apagar a seleção de PMs ao trocar a campanha.`
  );
  assert.equal(
    tela.api
      .obterMedicoesFiltradas()
      .map((medicao) => medicao.local_id)
      .sort()
      .join(","),
    "medicao-1,medicao-legada",
    `${caminho} deve filtrar a campanha e aceitar a medição legada compatível.`
  );

  tela.selecionarPocos(["pm-1"]);
  assert.equal(
    tela.api
      .obterMedicoesFiltradas()
      .map((medicao) => medicao.local_id)
      .join(","),
    "medicao-1",
    `${caminho} deve combinar os filtros de campanha e PM.`
  );

  tela.selecionarPocos([]);
  tela.elementos.filtroProjeto.value = "";
  tela.elementos.filtroCampanha.value = "campanha-3";
  tela.api.atualizarFiltroCampanha();

  assert.match(
    tela.elementos.listaPocosFiltro.innerHTML,
    /value="pm-3"/,
    `${caminho} deve mostrar os PMs do projeto da campanha.`
  );
  assert.doesNotMatch(
    tela.elementos.listaPocosFiltro.innerHTML,
    /value="pm-[12]"/,
    `${caminho} não deve misturar PMs de outros projetos.`
  );
}

testarExportador("public/js/exportar-fichas.js", "carregarExportacao");
testarExportador(
  "public/js/exportar-fichas-fiscal.js",
  "carregarExportacaoFiscal"
);

for (const caminho of [
  "public/exportar-fichas.html",
  "public/exportar-fichas-fiscal.html",
]) {
  const html = fs.readFileSync(caminho, "utf8");

  assert.match(html, /filtroProjeto" onchange="atualizarFiltroProjeto\(\)"/);
  assert.match(html, /filtroCampanha" onchange="atualizarFiltroCampanha\(\)"/);
  assert.doesNotMatch(html, /onchange="atualizarFiltros\(\)"/);
}

console.log("exportar-fichas.test.js: ok");
