const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const arquivo = path.join(__dirname, "..", "public", "js", "projeto-detalhe.js");
const codigo = fs
  .readFileSync(arquivo, "utf8")
  .replace(
    /carregarProjeto\(\);\s*$/,
    "this.api = { ordenarPocosPorNome, filtrarPocosProjeto };"
  );

const contexto = {
  localStorage: {
    getItem(chave) {
      if (chave === "usuario") return JSON.stringify({ id: "usuario-teste" });
      if (chave === "projeto_selecionado") return "projeto-teste";
      return null;
    },
  },
  window: { location: { href: "" }, history: { length: 1 } },
};

vm.createContext(contexto);
vm.runInContext(codigo, contexto);

const nomesOrdenados = contexto.api
  .ordenarPocosPorNome([
    { nome: "PM-33" },
    { nome: "PM-03" },
    { nome: "PM-2" },
    { nome: "PM-13" },
    { nome: "PM-1" },
  ])
  .map((poco) => poco.nome);

assert.deepStrictEqual(Array.from(nomesOrdenados), [
  "PM-1",
  "PM-2",
  "PM-03",
  "PM-13",
  "PM-33",
]);

const cards = [
  { dataset: { nomePoco: "pm-03" }, style: {} },
  { dataset: { nomePoco: "pm-13" }, style: {} },
  { dataset: { nomePoco: "pm-33" }, style: {} },
];

contexto.document = {
  getElementById() {
    return { value: "13" };
  },
  querySelectorAll() {
    return cards;
  },
};

contexto.api.filtrarPocosProjeto();

assert.deepStrictEqual(
  cards.map((card) => card.style.display),
  ["none", "", "none"]
);

console.log("✓ poços do projeto são ordenados numericamente pelo nome");
console.log("✓ pesquisa filtra os poços pelo nome");
