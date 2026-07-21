const fs = require("fs");
const vm = require("vm");

const source = `${fs.readFileSync("public/js/sync.js", "utf8")}
globalThis.syncTestApi = {
  validarDadosBaixados,
  mesclarDadosRemotosComPendencias,
  exclusaoRemotaConfirmada,
  verificarConflitoRemoto
};`;
const context = {
  window: { addEventListener() {} },
  console
};

vm.createContext(context);
vm.runInContext(source, context);

const {
  validarDadosBaixados,
  mesclarDadosRemotosComPendencias,
  exclusaoRemotaConfirmada,
  verificarConflitoRemoto
} = context.syncTestApi;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const merged = mesclarDadosRemotosComPendencias(
  [
    { local_id: "remoto", nome: "Nuvem" },
    { local_id: "editado", nome: "Versão remota" }
  ],
  [
    { local_id: "editado", nome: "Versão local", sincronizado: false },
    { local_id: "excluido", excluido: true, sincronizado: false },
    { local_id: "legado", nome: "Sem flag" },
    { local_id: "obsoleto", sincronizado: true }
  ],
  "2026-07-21T00:00:00.000Z"
);
const porId = new Map(merged.map((item) => [item.local_id, item]));

assert(porId.get("editado").nome === "Versão local", "Edição pendente foi sobrescrita.");
assert(porId.get("excluido").excluido === true, "Tombstone foi removido.");
assert(porId.has("legado"), "Registro legado pendente foi removido.");
assert(!porId.has("obsoleto"), "Registro sincronizado obsoleto foi mantido.");
assert(porId.get("remoto").sincronizado === true, "Registro remoto não foi confirmado.");

validarDadosBaixados("projetos", [{ local_id: "unico" }]);

let duplicadoRejeitado = false;
try {
  validarDadosBaixados("projetos", [{ local_id: "a" }, { local_id: "a" }]);
} catch (_error) {
  duplicadoRejeitado = true;
}

assert(duplicadoRejeitado, "Resposta com local_id duplicado foi aceita.");
assert(
  exclusaoRemotaConfirmada([{ local_id: "confirmado" }], "confirmado"),
  "Exclusão retornada não foi reconhecida."
);
assert(
  !exclusaoRemotaConfirmada([], "ausente"),
  "Exclusão sem linha retornada foi aceita."
);

async function testarConflitos() {
  context.supabaseClient = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: { atualizado_em: "2026-07-21T01:00:00.000Z" }, error: null };
        }
      };
    }
  };

  let conflitoDetectado = false;
  try {
    await verificarConflitoRemoto("projetos", {
      local_id: "editado",
      sincronizado_em: "2026-07-21T00:00:00.000Z"
    });
  } catch (_error) {
    conflitoDetectado = true;
  }

  assert(conflitoDetectado, "Alteração remota posterior não gerou conflito.");
  await verificarConflitoRemoto("projetos", { local_id: "novo" });
}

testarConflitos()
  .then(() => console.log("sync-merge.test.js: ok"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
