const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const fonteDbLocal = fs.readFileSync("public/js/db-local.js", "utf8");
const fonteSync = fs.readFileSync("public/js/sync.js", "utf8");
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function copiar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function carregarApi() {
  let contadorUuid = 0;
  const alertas = [];
  const navigator = { onLine: true };
  const contexto = {
    console,
    navigator,
    document: { getElementById() { return null; } },
    alert(mensagem) { alertas.push(mensagem); },
    window: {
      addEventListener() {},
    },
    crypto: {
      randomUUID() {
        contadorUuid += 1;
        return `00000000-0000-4000-8000-${String(contadorUuid).padStart(12, "0")}`;
      },
    },
  };

  vm.createContext(contexto);
  vm.runInContext(
    `${fonteDbLocal}
${fonteSync}
globalThis.syncCodigosTestApi = {
  anexarCodigosRemotosAsMedicoes,
  buscarCodigosRemotosDaMedicao,
  sincronizarCodigosDaMedicao,
  sincronizarMedicoes,
  sincronizarDados,
  configurarDependencias(deps) {
    supabaseClient = deps.supabaseClient;
    if (deps.listarMedicoesParaSync) {
      listarMedicoesParaSync = deps.listarMedicoesParaSync;
    }
    if (deps.atualizarMedicaoLocal) {
      atualizarMedicaoLocal = deps.atualizarMedicaoLocal;
    }
  }
};`,
    contexto,
  );

  return {
    api: contexto.syncCodigosTestApi,
    alertas,
    navigator,
  };
}

function criarMockCodigos(remotosIniciais = [], opcoes = {}) {
  const estado = {
    linhas: copiar(remotosIniciais),
    consultas: [],
    upserts: [],
    exclusoes: [],
    falhasUpsertRestantes: opcoes.falhasUpsert || 0,
    erroUpsert: opcoes.erroUpsert || {
      message: "falha temporária no filho",
      code: "500",
    },
    confirmarExclusaoParcial: opcoes.confirmarExclusaoParcial === true,
  };

  class ConsultaCodigos {
    constructor() {
      this.operacao = null;
      this.filtros = {};
      this.ids = [];
    }

    select() {
      if (this.operacao === "delete") {
        const candidatos = estado.linhas.filter(
          (item) =>
            (!this.filtros.medicao_local_id ||
              item.medicao_local_id === this.filtros.medicao_local_id) &&
            this.ids.includes(item.local_id),
        );
        const confirmados = estado.confirmarExclusaoParcial
          ? candidatos.slice(0, Math.max(0, candidatos.length - 1))
          : candidatos;
        const idsConfirmados = new Set(
          confirmados.map((item) => item.local_id),
        );
        estado.linhas = estado.linhas.filter(
          (item) => !idsConfirmados.has(item.local_id),
        );
        estado.exclusoes.push({
          medicao_local_id: this.filtros.medicao_local_id,
          ids: [...this.ids],
          confirmados: [...idsConfirmados],
        });
        return Promise.resolve({
          data: confirmados.map((item) => ({ local_id: item.local_id })),
          error: null,
        });
      }

      this.operacao = "select";
      return this;
    }

    eq(coluna, valor) {
      this.filtros[coluna] = valor;
      return this;
    }

    in(coluna, valores) {
      assert.equal(coluna, "local_id");
      this.ids = [...valores];
      return this;
    }

    order() {
      const linhas = estado.linhas
        .filter(
          (item) =>
            !this.filtros.medicao_local_id ||
            item.medicao_local_id === this.filtros.medicao_local_id,
        )
        .sort((a, b) => a.ordem - b.ordem);
      estado.consultas.push(copiar(this.filtros));
      return Promise.resolve({ data: copiar(linhas), error: null });
    }

    delete() {
      this.operacao = "delete";
      return this;
    }

    upsert(payload, opcoesUpsert) {
      estado.upserts.push({
        payload: copiar(payload),
        opcoes: copiar(opcoesUpsert),
      });

      if (estado.falhasUpsertRestantes > 0) {
        estado.falhasUpsertRestantes -= 1;
        return Promise.resolve({ data: null, error: estado.erroUpsert });
      }

      const proximasLinhas = copiar(estado.linhas);

      for (const linha of payload) {
        const indice = proximasLinhas.findIndex(
          (item) => item.local_id === linha.local_id,
        );
        if (indice >= 0) {
          proximasLinhas[indice] = copiar(linha);
        } else {
          proximasLinhas.push(copiar(linha));
        }
      }

      const chaves = new Set();

      for (const linha of proximasLinhas) {
        const chave =
          `${linha.medicao_local_id}|${linha.codigo.trim().toUpperCase()}`;
        if (chaves.has(chave)) {
          return Promise.resolve({
            data: null,
            error: {
              code: "23505",
              message: "duplicate key value violates unique constraint",
            },
          });
        }
        chaves.add(chave);
      }

      estado.linhas = proximasLinhas;
      return Promise.resolve({ data: copiar(payload), error: null });
    }
  }

  return {
    estado,
    client: {
      from(tabela) {
        assert.equal(tabela, "medicao_codigos");
        return new ConsultaCodigos();
      },
    },
  };
}

function criarMockSincronizacaoCompleta() {
  const estado = {
    eventos: [],
    remotoPaiAtualizadoEm: "2026-07-20T12:00:00.000Z",
    payloadsPai: [],
    linhasFilhas: [],
    falhasFilhoRestantes: 1,
  };

  class ConsultaPai {
    constructor() {
      this.operacao = "select";
      this.payload = null;
    }

    select() {
      return this;
    }

    eq() {
      return this;
    }

    upsert(payload) {
      this.operacao = "upsert";
      this.payload = copiar(payload);
      estado.payloadsPai.push(this.payload);
      estado.eventos.push("pai:upsert");
      return this;
    }

    maybeSingle() {
      if (this.operacao === "upsert") {
        estado.remotoPaiAtualizadoEm = this.payload.atualizado_em;
        return Promise.resolve({
          data: { atualizado_em: estado.remotoPaiAtualizadoEm },
          error: null,
        });
      }

      estado.eventos.push("pai:verificar-conflito");
      return Promise.resolve({
        data: {
          local_id: "medicao-retry",
          atualizado_em: estado.remotoPaiAtualizadoEm,
        },
        error: null,
      });
    }
  }

  class ConsultaFilhos {
    constructor() {
      this.operacao = "select";
    }

    select() {
      return this;
    }

    eq() {
      return this;
    }

    order() {
      estado.eventos.push("filhos:preflight");
      return Promise.resolve({
        data: copiar(estado.linhasFilhas),
        error: null,
      });
    }

    upsert(payload) {
      estado.eventos.push("filhos:upsert");
      if (estado.falhasFilhoRestantes > 0) {
        estado.falhasFilhoRestantes -= 1;
        return Promise.resolve({
          data: null,
          error: { message: "rede interrompida", code: "503" },
        });
      }
      estado.linhasFilhas = copiar(payload);
      return Promise.resolve({ data: copiar(payload), error: null });
    }
  }

  return {
    estado,
    client: {
      from(tabela) {
        if (tabela === "medicoes") return new ConsultaPai();
        if (tabela === "medicao_codigos") return new ConsultaFilhos();
        throw new Error(`Tabela inesperada no mock: ${tabela}`);
      },
    },
  };
}

async function testarAnexacaoRemota(api) {
  const resultado = api.anexarCodigosRemotosAsMedicoes(
    [
      {
        local_id: "m-1",
        codigo_frascaria: "LEGADO",
      },
      {
        local_id: "m-sem-filhos",
        codigo_frascaria: "MANTIDO",
      },
    ],
    [
      {
        local_id: "c-2",
        medicao_local_id: "m-1",
        codigo: "DUP",
        tipo: "duplicata",
        ordem: 2,
      },
      {
        local_id: "c-1",
        medicao_local_id: "m-1",
        codigo: "NORMAL",
        tipo: "normal",
        ordem: 0,
      },
    ],
  );

  assert.equal(
    resultado[0].codigos_amostras.map((item) => item.codigo).join(","),
    "NORMAL,DUP",
  );
  assert.equal(resultado[0].codigo_frascaria, "NORMAL");
  assert.equal(resultado[1].codigo_frascaria, "MANTIDO");
  assert.equal(resultado[1].codigos_amostras, undefined);
}

async function testarInclusaoIdempotente(api) {
  const idRemoto = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const mock = criarMockCodigos([
    {
      local_id: idRemoto,
      medicao_local_id: "m-1",
      codigo: "EXISTENTE",
      tipo: "normal",
      ordem: 0,
      criado_em: "2026-07-01T00:00:00.000Z",
    },
  ]);
  const persistencias = [];
  api.configurarDependencias({
    supabaseClient: mock.client,
    atualizarMedicaoLocal: async (medicao) => {
      persistencias.push(copiar(medicao));
    },
  });
  const medicao = {
    local_id: "m-1",
    codigo_frascaria: "valor antigo",
    codigos_amostras: [
      { codigo: " existente ", tipo: "normal" },
      { codigo: "NOVA-DUP", tipo: "duplicata" },
    ],
  };

  const primeira = await api.sincronizarCodigosDaMedicao(
    medicao,
    copiar(mock.estado.linhas),
  );
  assert.equal(primeira[0].local_id, idRemoto);
  assert.equal(primeira[0].criado_em, "2026-07-01T00:00:00.000Z");
  assert.match(primeira[1].local_id, UUID_V4);
  assert.equal(medicao.codigo_frascaria, "existente");
  assert.equal(mock.estado.linhas.length, 2);
  assert.equal(mock.estado.upserts[0].opcoes.onConflict, "local_id");
  const idsPrimeira = primeira.map((item) => item.local_id).join(",");

  const segunda = await api.sincronizarCodigosDaMedicao(medicao);
  assert.equal(
    segunda.map((item) => item.local_id).join(","),
    idsPrimeira,
    "Uma segunda sincronização deve reutilizar os IDs.",
  );
  assert.equal(
    mock.estado.linhas.length,
    2,
    "Uma segunda sincronização não pode criar linhas duplicadas.",
  );
  assert.ok(persistencias.length >= 2);
}

async function testarRemocao(api) {
  const remotos = [
    {
      local_id: "11111111-1111-4111-8111-111111111111",
      medicao_local_id: "m-remover",
      codigo: "MANTER",
      tipo: "normal",
      ordem: 0,
    },
    {
      local_id: "22222222-2222-4222-8222-222222222222",
      medicao_local_id: "m-remover",
      codigo: "REMOVER",
      tipo: "duplicata",
      ordem: 1,
    },
  ];
  const mock = criarMockCodigos(remotos);
  api.configurarDependencias({
    supabaseClient: mock.client,
    atualizarMedicaoLocal: async () => {},
  });

  await api.sincronizarCodigosDaMedicao(
    {
      local_id: "m-remover",
      codigos_amostras: [
        {
          local_id: remotos[0].local_id,
          codigo: "MANTER",
          tipo: "normal",
        },
      ],
    },
    copiar(remotos),
  );

  assert.equal(mock.estado.exclusoes.length, 1);
  assert.equal(
    mock.estado.exclusoes[0].medicao_local_id,
    "m-remover",
    "O delete deve estar limitado à medição corrente.",
  );
  assert.deepEqual(mock.estado.exclusoes[0].ids, [remotos[1].local_id]);
  assert.equal(mock.estado.linhas.length, 1);

  const mockIncompleto = criarMockCodigos(remotos, {
    confirmarExclusaoParcial: true,
  });
  api.configurarDependencias({
    supabaseClient: mockIncompleto.client,
    atualizarMedicaoLocal: async () => {},
  });
  await assert.rejects(
    api.sincronizarCodigosDaMedicao(
      {
        local_id: "m-remover",
        codigos_amostras: [
          {
            local_id: remotos[0].local_id,
            codigo: "MANTER",
            tipo: "normal",
          },
        ],
      },
      copiar(remotos),
    ),
    /não confirmou a remoção/i,
  );
}

async function testarRenomeacaoSemColisaoDeIds(api) {
  const remotos = [
    {
      local_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      medicao_local_id: "m-renomear",
      codigo: "A",
      tipo: "normal",
      ordem: 0,
    },
    {
      local_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      medicao_local_id: "m-renomear",
      codigo: "B",
      tipo: "duplicata",
      ordem: 1,
    },
  ];
  const mock = criarMockCodigos(remotos);
  api.configurarDependencias({
    supabaseClient: mock.client,
    atualizarMedicaoLocal: async () => {},
  });

  const resultado = await api.sincronizarCodigosDaMedicao(
    {
      local_id: "m-renomear",
      codigos_amostras: [
        {
          local_id: remotos[0].local_id,
          codigo: "B",
          tipo: "normal",
        },
        {
          local_id: remotos[1].local_id,
          codigo: "C",
          tipo: "duplicata",
        },
      ],
    },
    copiar(remotos),
  );

  assert.equal(
    resultado.map((item) => item.local_id).join(","),
    remotos.map((item) => item.local_id).join(","),
    "Renomear códigos não pode fazer duas linhas adotarem o mesmo UUID remoto.",
  );
  assert.equal(new Set(resultado.map((item) => item.local_id)).size, 2);
  assert.equal(
    mock.estado.upserts.length,
    2,
    "Uma cadeia de renomeação deve liberar códigos antigos antes do upsert final.",
  );
  assert.ok(
    mock.estado.upserts[0].payload.every((item) =>
      item.codigo.startsWith("HT-SYNC-")
    ),
  );
  assert.deepEqual(
    mock.estado.linhas.map((item) => item.codigo),
    ["B", "C"],
  );
}

async function testarRemocaoComReusoDoCodigo(api) {
  const removido = {
    local_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    medicao_local_id: "m-reusar",
    codigo: "A",
    tipo: "normal",
    ordem: 0,
  };
  const renomeado = {
    local_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    medicao_local_id: "m-reusar",
    codigo: "B",
    tipo: "duplicata",
    ordem: 1,
  };
  const mock = criarMockCodigos([removido, renomeado]);
  api.configurarDependencias({
    supabaseClient: mock.client,
    atualizarMedicaoLocal: async () => {},
  });

  await api.sincronizarCodigosDaMedicao(
    {
      local_id: "m-reusar",
      codigos_amostras: [
        {
          local_id: renomeado.local_id,
          codigo: "A",
          tipo: "normal",
        },
      ],
    },
    [copiar(removido), copiar(renomeado)],
  );

  assert.equal(mock.estado.upserts.length, 2);
  assert.equal(mock.estado.upserts[0].payload.length, 2);
  assert.deepEqual(mock.estado.exclusoes[0].ids, [removido.local_id]);
  assert.equal(mock.estado.linhas.length, 1);
  assert.equal(mock.estado.linhas[0].local_id, renomeado.local_id);
  assert.equal(mock.estado.linhas[0].codigo, "A");
}

async function testarFalhaERetry(api) {
  const mock = criarMockCodigos([], { falhasUpsert: 1 });
  const persistencias = [];
  api.configurarDependencias({
    supabaseClient: mock.client,
    atualizarMedicaoLocal: async (medicao) => {
      persistencias.push(copiar(medicao));
    },
  });
  const medicao = {
    local_id: "m-retry-filho",
    codigos_amostras: [{ codigo: "RETRY", tipo: "normal" }],
  };

  await assert.rejects(
    api.sincronizarCodigosDaMedicao(medicao, []),
    /falha temporária/i,
  );
  const idPersistido = medicao.codigos_amostras[0].local_id;
  assert.match(idPersistido, UUID_V4);
  assert.equal(persistencias.at(-1).codigos_amostras[0].local_id, idPersistido);

  await api.sincronizarCodigosDaMedicao(medicao, []);
  assert.equal(medicao.codigos_amostras[0].local_id, idPersistido);
  assert.equal(mock.estado.linhas.length, 1);
  assert.equal(mock.estado.linhas[0].local_id, idPersistido);

  const mockSemMigracao = criarMockCodigos([], {
    falhasUpsert: 1,
    erroUpsert: {
      code: "42P01",
      message: 'relation "medicao_codigos" does not exist',
    },
  });
  api.configurarDependencias({
    supabaseClient: mockSemMigracao.client,
    atualizarMedicaoLocal: async () => {},
  });
  await assert.rejects(
    api.sincronizarCodigosDaMedicao(
      {
        local_id: "m-sem-migracao",
        codigos_amostras: [
          {
            local_id: "33333333-3333-4333-8333-333333333333",
            codigo: "AM",
            tipo: "normal",
          },
        ],
      },
      [],
    ),
    /migração da tabela medicao_codigos ainda não foi aplicada/i,
  );
}

async function testarMarcadorManualRestaurado(api) {
  const mock = criarMockSincronizacaoCompleta();
  const medicao = {
    local_id: "medicao-manual",
    poco_local_id: "poco-1",
    usuario_id: "usuario-1",
    codigo_frascaria: "Marcado manualmente",
    sincronizado: false,
    criado_em: "2026-07-01T00:00:00.000Z",
  };

  api.configurarDependencias({
    supabaseClient: mock.client,
    listarMedicoesParaSync: async () => [medicao],
    atualizarMedicaoLocal: async () => {},
  });

  await api.sincronizarMedicoes();
  assert.equal(medicao.sincronizado, true);
  assert.equal(medicao.codigos_amostras.length, 0);
  assert.equal(mock.estado.linhasFilhas.length, 0);
}

async function testarPaiFalhaERetry(api) {
  const mock = criarMockSincronizacaoCompleta();
  const persistencias = [];
  const medicao = {
    local_id: "medicao-retry",
    poco_local_id: "poco-1",
    usuario_id: "usuario-1",
    sincronizado: false,
    sincronizado_em: mock.estado.remotoPaiAtualizadoEm,
    codigos_amostras: [
      {
        local_id: "44444444-4444-4444-8444-444444444444",
        codigo: "NORMAL-RETRY",
        tipo: "normal",
      },
    ],
    criado_em: "2026-07-01T00:00:00.000Z",
  };

  api.configurarDependencias({
    supabaseClient: mock.client,
    listarMedicoesParaSync: async () => [medicao],
    atualizarMedicaoLocal: async (registro) => {
      persistencias.push(copiar(registro));
    },
  });

  await assert.rejects(api.sincronizarMedicoes(), /rede interrompida/i);
  assert.equal(medicao.sincronizado, false);
  assert.equal(
    medicao.sincronizado_em,
    mock.estado.remotoPaiAtualizadoEm,
    "O timestamp do pai gravado deve virar o baseline antes de sincronizar filhos.",
  );
  assert.ok(
    mock.estado.eventos.indexOf("filhos:preflight") <
      mock.estado.eventos.indexOf("pai:upsert"),
    "A tabela filha deve ser consultada antes de alterar o pai.",
  );

  await api.sincronizarMedicoes();
  assert.equal(medicao.sincronizado, true);
  assert.equal(mock.estado.linhasFilhas.length, 1);
  assert.equal(mock.estado.payloadsPai.length, 2);
  assert.equal(mock.estado.linhasFilhas[0].codigo, "NORMAL-RETRY");
  assert.ok(
    persistencias.some(
      (registro) =>
        registro.sincronizado === false &&
        registro.sincronizado_em === mock.estado.remotoPaiAtualizadoEm,
    ),
  );
}

async function testarOffline(instancia) {
  instancia.navigator.onLine = false;
  await instancia.api.sincronizarDados();
  assert.equal(instancia.alertas.length, 1);
  assert.match(instancia.alertas[0], /offline/i);
}

async function executar() {
  const instancia = carregarApi();
  await testarAnexacaoRemota(instancia.api);
  await testarInclusaoIdempotente(instancia.api);
  await testarRemocao(instancia.api);
  await testarRenomeacaoSemColisaoDeIds(instancia.api);
  await testarRemocaoComReusoDoCodigo(instancia.api);
  await testarFalhaERetry(instancia.api);
  await testarPaiFalhaERetry(instancia.api);
  await testarMarcadorManualRestaurado(instancia.api);
  await testarOffline(instancia);
  console.log("sync-codigos.test.js: ok");
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
