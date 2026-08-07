const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const fonteSync = fs.readFileSync("public/js/sync.js", "utf8");

function carregarApi() {
  const removidos = [];
  let chamadasRemotas = 0;
  const contexto = {
    console,
    navigator: { onLine: true },
    document: { getElementById() { return null; } },
    window: { addEventListener() {} },
    alert() {},
    setTimeout,
    clearTimeout,
    respostaDeleteTeste: { data: [], error: null },
  };

  vm.createContext(contexto);
  vm.runInContext(
    `${fonteSync}
globalThis.syncExclusoesTestApi = {
  sincronizarProjetos,
  sincronizarCampanhas,
  sincronizarPocos,
  configurar({ registro, resposta }) {
    respostaDeleteTeste = resposta || { data: [], error: null };
    listarProjetosParaSync = async () => registro.tabela === "projetos" ? [registro] : [];
    listarCampanhasParaSync = async () => registro.tabela === "campanhas" ? [registro] : [];
    listarPocosParaSync = async () => registro.tabela === "pocos" ? [registro] : [];
  }
};`,
    contexto,
  );

  contexto.abrirBancoLocal = async () => {};
  contexto.db = {
    transaction([tabela]) {
      const tx = {
        objectStore() {
          return {
            delete(localId) {
              removidos.push({ tabela, localId });
              setTimeout(() => tx.oncomplete?.(), 0);
            },
          };
        },
      };
      return tx;
    },
  };
  contexto.supabaseClient = {
    from() {
      chamadasRemotas += 1;
      return {
        delete() { return this; },
        eq() { return this; },
        select() { return Promise.resolve(contexto.respostaDeleteTeste); },
      };
    },
  };

  return {
    api: contexto.syncExclusoesTestApi,
    removidos,
    chamadasRemotas: () => chamadasRemotas,
  };
}

async function executarExclusao(api, tabela) {
  const nomes = {
    projetos: "sincronizarProjetos",
    campanhas: "sincronizarCampanhas",
    pocos: "sincronizarPocos",
  };
  await api[nomes[tabela]](true);
}

async function testarExclusaoSomenteLocal(tabela) {
  const teste = carregarApi();
  teste.api.configurar({
    registro: {
      tabela,
      local_id: `${tabela}-local`,
      excluido: true,
      sincronizado: false,
      exclusao_remota_necessaria: false,
    },
  });

  await executarExclusao(teste.api, tabela);
  assert.equal(teste.chamadasRemotas(), 0, `${tabela}: tentou excluir na nuvem.`);
  assert.deepEqual(teste.removidos, [
    { tabela, localId: `${tabela}-local` },
  ]);
}

async function testarExclusaoRemotaConfirmada(tabela) {
  const teste = carregarApi();
  const localId = `${tabela}-remoto`;
  teste.api.configurar({
    registro: {
      tabela,
      local_id: localId,
      excluido: true,
      sincronizado_em: "2026-08-07T00:00:00.000Z",
    },
    resposta: { data: [{ local_id: localId }], error: null },
  });

  await executarExclusao(teste.api, tabela);
  assert.equal(teste.chamadasRemotas(), 1, `${tabela}: não excluiu na nuvem.`);
  assert.equal(teste.removidos.length, 1, `${tabela}: não removeu localmente.`);
}

async function testarExclusaoRemotaNaoConfirmada(tabela) {
  const teste = carregarApi();
  teste.api.configurar({
    registro: {
      tabela,
      local_id: `${tabela}-protegido`,
      excluido: true,
      sincronizado_em: "2026-08-07T00:00:00.000Z",
    },
    resposta: { data: [], error: null },
  });

  await assert.rejects(() => executarExclusao(teste.api, tabela));
  assert.equal(teste.removidos.length, 0, `${tabela}: perdeu o tombstone local.`);
}

async function main() {
  for (const tabela of ["projetos", "campanhas", "pocos"]) {
    await testarExclusaoSomenteLocal(tabela);
    await testarExclusaoRemotaConfirmada(tabela);
    await testarExclusaoRemotaNaoConfirmada(tabela);
  }
  console.log("sync-exclusoes.test.js: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
