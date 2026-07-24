const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const fonteDbLocal = fs.readFileSync("public/js/db-local.js", "utf8");
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function carregarApi(contextoExtra = {}) {
  const contexto = {
    console,
    ...contextoExtra,
  };

  vm.createContext(contexto);
  vm.runInContext(
    `${fonteDbLocal}
globalThis.codigosTestApi = {
  normalizarCodigoAmostra,
  normalizarTipoCodigoAmostra,
  formatarTipoCodigoAmostra,
  gerarLocalIdCodigoAmostra,
  medicaoMarcadaManualmente,
  obterCodigosDaMedicao,
  validarCodigosAmostras,
  prepararCodigosAmostras,
  obterCodigoPrincipal,
  formatarCodigosDaMedicao,
  escaparHtml
};`,
    contexto,
  );

  return contexto.codigosTestApi;
}

function testarValidacoes(api) {
  const um = api.validarCodigosAmostras([
    { codigo: "  AM-001  ", tipo: "normal" },
  ]);
  assert.equal(um.valido, true);
  assert.equal(um.codigos[0].codigo, "AM-001");
  assert.equal(um.codigos[0].ordem, 0);

  const dois = api.validarCodigosAmostras([
    { codigo: "AM-001", tipo: "normal" },
    { codigo: "AM-001-D", tipo: "duplicata" },
  ]);
  assert.equal(dois.valido, true);
  assert.equal(dois.codigos.length, 2);

  const quatro = api.validarCodigosAmostras([
    { codigo: "AM-001", tipo: "normal" },
    { codigo: "AM-001-D", tipo: "duplicata" },
    { codigo: "BC-001", tipo: "branco_campo" },
    { codigo: "CTRL-001", tipo: "controle" },
  ]);
  assert.equal(quatro.valido, true);
  assert.equal(
    quatro.codigos.map((item) => item.ordem).join(","),
    "0,1,2,3",
  );

  const semLinhas = api.validarCodigosAmostras([]);
  assert.equal(semLinhas.valido, false);
  assert.match(semLinhas.mensagem, /pelo menos um/i);

  const vazio = api.validarCodigosAmostras([
    { codigo: "AM-001", tipo: "normal" },
    { codigo: "  ", tipo: "duplicata" },
  ]);
  assert.equal(vazio.valido, false);
  assert.match(vazio.mensagem, /linha 2/i);

  const repetido = api.validarCodigosAmostras([
    { codigo: "Amostra-Ç", tipo: "normal" },
    { codigo: "  amostra-ç  ", tipo: "duplicata" },
  ]);
  assert.equal(repetido.valido, false);
  assert.match(repetido.mensagem, /repetido/i);

  const tipoInvalido = api.validarCodigosAmostras([
    { codigo: "AM-001", tipo: "inexistente" },
  ]);
  assert.equal(tipoInvalido.valido, false);
  assert.match(tipoInvalido.mensagem, /tipo válido/i);

  const longo = api.validarCodigosAmostras([
    { codigo: "X".repeat(201), tipo: "normal" },
  ]);
  assert.equal(longo.valido, false);
  assert.match(longo.mensagem, /200 caracteres/i);
}

function testarCompatibilidade(api) {
  const legado = api.obterCodigosDaMedicao({
    codigo_frascaria: "  LEGADO-001 ",
    criado_em: "2026-07-01T00:00:00.000Z",
  });
  assert.equal(legado.length, 1);
  assert.equal(legado[0].codigo, "LEGADO-001");
  assert.equal(legado[0].tipo, "normal");
  assert.equal(legado[0].criado_em, "2026-07-01T00:00:00.000Z");

  const legadoComArrayVazio = api.obterCodigosDaMedicao({
    codigos_amostras: [],
    codigo_frascaria: "LEGADO-002",
  });
  assert.equal(legadoComArrayVazio[0].codigo, "LEGADO-002");

  assert.equal(
    api.obterCodigosDaMedicao({
      marcado_manual: true,
      codigo_frascaria: "NÃO-DEVE-APARECER",
    }).length,
    0,
  );
  assert.equal(
    api.obterCodigosDaMedicao({
      codigo_frascaria: "Marcado manualmente",
    }).length,
    0,
  );
  assert.equal(
    api.medicaoMarcadaManualmente({
      codigo_frascaria: "Marcado manualmente",
    }),
    true,
  );
  assert.equal(
    api.medicaoMarcadaManualmente({
      codigo_frascaria: "Marcado manualmente",
      codigos_amostras: [{ codigo: "REAL-001", tipo: "normal" }],
    }),
    false,
    "Códigos filhos reais devem prevalecer sobre um marcador legado obsoleto.",
  );

  const multiplos = api.obterCodigosDaMedicao({
    codigo_frascaria: "LEGADO-IGNORADO",
    codigos_amostras: [
      { codigo: "DUP-1", tipo: "duplicata", ordem: 2 },
      { codigo: "NORMAL-1", tipo: "normal", ordem: 0 },
      { codigo: "BC-1", tipo: "branco_campo", ordem: 1 },
    ],
  });
  assert.equal(
    multiplos.map((item) => item.codigo).join(","),
    "NORMAL-1,BC-1,DUP-1",
  );
  assert.equal(api.obterCodigoPrincipal(multiplos), "NORMAL-1");
  assert.equal(
    api.obterCodigoPrincipal([
      { codigo: "DUP-SEM-NORMAL", tipo: "duplicata" },
      { codigo: "BC", tipo: "branco_campo" },
    ]),
    "DUP-SEM-NORMAL",
  );
  assert.equal(
    api.formatarCodigosDaMedicao({ codigos_amostras: multiplos }),
    "NORMAL-1 — Normal; BC-1 — Branco de campo; DUP-1 — Duplicata",
  );
  assert.equal(
    api.escaparHtml(`<script a="1">'&</script>`),
    "&lt;script a=&quot;1&quot;&gt;&#039;&amp;&lt;/script&gt;",
  );
}

function testarIds(api) {
  const idExistente = "01234567-89ab-4cde-8fab-0123456789ab";
  const preparados = api.prepararCodigosAmostras([
    {
      local_id: idExistente,
      codigo: "AM-001",
      tipo: "normal",
      criado_em: "2026-07-01T00:00:00.000Z",
    },
    {
      local_id: idExistente,
      codigo: "AM-002",
      tipo: "duplicata",
    },
    { codigo: "AM-003", tipo: "branco" },
  ]);

  assert.equal(preparados.length, 3);
  assert.equal(preparados[0].local_id, idExistente);
  assert.equal(preparados[0].criado_em, "2026-07-01T00:00:00.000Z");
  assert.match(preparados[1].local_id, UUID_V4);
  assert.match(preparados[2].local_id, UUID_V4);
  assert.equal(new Set(preparados.map((item) => item.local_id)).size, 3);
}

const api = carregarApi({
  crypto: {
    contador: 0,
    getRandomValues(bytes) {
      this.contador += 1;
      for (let indice = 0; indice < bytes.length; indice += 1) {
        bytes[indice] = indice + this.contador;
      }
      return bytes;
    },
  },
});

testarValidacoes(api);
testarCompatibilidade(api);
testarIds(api);
assert.match(api.gerarLocalIdCodigoAmostra(), UUID_V4);

const idNativo = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const apiComRandomUuid = carregarApi({
  crypto: {
    randomUUID() {
      return idNativo;
    },
  },
});
assert.equal(apiComRandomUuid.gerarLocalIdCodigoAmostra(), idNativo);

const apiSemCrypto = carregarApi();
assert.match(
  apiSemCrypto.gerarLocalIdCodigoAmostra(),
  UUID_V4,
  "O fallback sem crypto também precisa produzir UUID aceito pelo Supabase.",
);

console.log("codigos-amostras.test.js: ok");
