const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const arquivo = path.join(__dirname, "..", "public", "js", "db-local.js");
const codigo = fs.readFileSync(arquivo, "utf8") + `
this.api = {
  obterProjetosLocaisDoPoco,
  pocoPertenceAoProjeto,
  formatarDataBrasileira,
  campanhaCombinaComMedicao,
  sincronizarVinculoCampanhaMedicao
};`;

const contexto = { console };
vm.createContext(contexto);
vm.runInContext(codigo, contexto);

const poco = {
  projeto_local_id: "projeto-principal",
  projeto_local_ids: ["projeto-principal", "projeto-secundario"],
};

assert.deepStrictEqual(
  Array.from(contexto.api.obterProjetosLocaisDoPoco(poco)),
  ["projeto-principal", "projeto-secundario"]
);
assert.strictEqual(contexto.api.pocoPertenceAoProjeto(poco, "projeto-secundario"), true);
assert.strictEqual(contexto.api.formatarDataBrasileira("2026-08-15"), "15/08/2026");

const campanha = {
  local_id: "campanha-2",
  projeto_local_id: "projeto-secundario",
  mes_referencia: "2026-08",
};
assert.strictEqual(
  contexto.api.campanhaCombinaComMedicao(
    campanha,
    { mes_referencia: "2026-08", data_medicao: "2026-08-15" },
    poco
  ),
  true
);

contexto.api
  .sincronizarVinculoCampanhaMedicao(
    { poco_local_id: "poco-1", campanha_local_id: "campanha-2" },
    poco,
    [campanha]
  )
  .then((medicao) => {
    assert.strictEqual(medicao.campanha_local_id, "campanha-2");
    console.log("✓ PM pode pertencer a mais de um projeto");
    console.log("✓ campanha selecionada em projeto vinculado é preservada");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
