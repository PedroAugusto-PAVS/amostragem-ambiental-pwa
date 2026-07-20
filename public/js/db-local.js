const DB_NAME = "amostragem_offline";
const DB_VERSION = 6;

let db;

function abrirBancoLocal() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject("Erro ao abrir IndexedDB");

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;

      if (!db.objectStoreNames.contains("projetos")) {
        db.createObjectStore("projetos", {
          keyPath: "local_id",
        });
      }

      if (!db.objectStoreNames.contains("campanhas")) {
        db.createObjectStore("campanhas", {
          keyPath: "local_id",
        });
      }

      if (!db.objectStoreNames.contains("pocos")) {
        db.createObjectStore("pocos", {
          keyPath: "local_id",
        });
      }

      if (!db.objectStoreNames.contains("medicoes")) {
        db.createObjectStore("medicoes", {
          keyPath: "local_id",
        });
      }
    };
  });
}

/* PROJETOS */

async function salvarProjetoLocal(projeto) {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["projetos"], "readwrite");
    const store = tx.objectStore("projetos");

    store.put(projeto);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Erro ao salvar projeto");
  });
}

async function listarProjetosLocais() {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["projetos"], "readonly");
    const store = tx.objectStore("projetos");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result.filter((p) => !p.excluido));
    };

    request.onerror = () => reject("Erro ao listar projetos");
  });
}

async function listarProjetosParaSync() {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["projetos"], "readonly");
    const store = tx.objectStore("projetos");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);

    request.onerror = () => reject("Erro ao listar projetos");
  });
}

async function atualizarProjetoLocal(projeto) {
  return salvarProjetoLocal(projeto);
}

/* CAMPANHAS */

async function salvarCampanhaLocal(campanha) {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["campanhas"], "readwrite");
    const store = tx.objectStore("campanhas");

    store.put(campanha);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Erro ao salvar campanha");
  });
}

async function listarCampanhasLocais() {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["campanhas"], "readonly");
    const store = tx.objectStore("campanhas");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result.filter((c) => !c.excluido));
    };

    request.onerror = () => reject("Erro ao listar campanhas");
  });
}

async function listarCampanhasParaSync() {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["campanhas"], "readonly");
    const store = tx.objectStore("campanhas");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);

    request.onerror = () => reject("Erro ao listar campanhas");
  });
}

async function atualizarCampanhaLocal(campanha) {
  return salvarCampanhaLocal(campanha);
}

async function excluirCampanhaLocal(localId) {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["campanhas"], "readwrite");
    const store = tx.objectStore("campanhas");

    const req = store.get(localId);

    req.onsuccess = () => {
      const campanha = req.result;

      if (!campanha) {
        resolve(false);
        return;
      }

      campanha.excluido = true;
      campanha.sincronizado = false;
      campanha.excluido_em = new Date().toISOString();

      store.put(campanha);
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Erro ao excluir campanha");
  });
}

/* POÇOS / PMs */

async function salvarPocoLocal(poco) {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["pocos"], "readwrite");
    const store = tx.objectStore("pocos");

    store.put(poco);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Erro ao salvar PM");
  });
}

async function listarPocosLocais() {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["pocos"], "readonly");
    const store = tx.objectStore("pocos");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result.filter((p) => !p.excluido));
    };

    request.onerror = () => reject("Erro ao listar PMs");
  });
}

async function listarPocosParaSync() {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["pocos"], "readonly");
    const store = tx.objectStore("pocos");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);

    request.onerror = () => reject("Erro ao listar PMs");
  });
}

async function atualizarPocoLocal(poco) {
  return salvarPocoLocal(poco);
}

async function excluirPocoLocal(localId) {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["pocos"], "readwrite");
    const store = tx.objectStore("pocos");

    const req = store.get(localId);

    req.onsuccess = () => {
      const poco = req.result;

      if (!poco) {
        resolve(false);
        return;
      }

      poco.excluido = true;
      poco.sincronizado = false;
      poco.excluido_em = new Date().toISOString();

      store.put(poco);
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Erro ao excluir PM");
  });
}
/* MEDIÇÕES */

async function salvarMedicaoLocal(medicao) {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["medicoes"], "readwrite");
    const store = tx.objectStore("medicoes");

    store.put(medicao);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Erro ao salvar medição");
  });
}

async function listarMedicoesLocais() {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["medicoes"], "readonly");
    const store = tx.objectStore("medicoes");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result.filter((m) => !m.excluido));
    };

    request.onerror = () => reject("Erro ao listar medições");
  });
}

function criarDataLocal(valor) {
  if (!valor) return null;

  const texto = String(valor).trim().slice(0, 10);
  const [ano, mes, dia] = texto.split("-").map(Number);

  if (!ano || !mes || !dia) {
    return null;
  }

  return new Date(ano, mes - 1, dia);
}

function normalizarMesReferencia(valor) {
  if (!valor) return "";

  const texto = String(valor).trim();

  if (/^\d{4}-\d{2}/.test(texto)) {
    return texto.slice(0, 7);
  }

  return texto;
}

function dataEstaDentroDoPeriodo(dataMedicao, dataInicio, dataFim) {
  const data = criarDataLocal(dataMedicao);

  if (!data) {
    return false;
  }

  const inicio = criarDataLocal(dataInicio);
  const fim = criarDataLocal(dataFim);

  if (inicio && data < inicio) {
    return false;
  }

  if (fim && data > fim) {
    return false;
  }

  return !!(inicio || fim);
}

function campanhaCombinaComMedicao(campanha, medicao, poco) {
  if (!campanha || !medicao || !poco) {
    return false;
  }

  if (campanha.excluido) {
    return false;
  }

  if (!poco.projeto_local_id || campanha.projeto_local_id !== poco.projeto_local_id) {
    return false;
  }

  const mesCampanha = normalizarMesReferencia(campanha.mes_referencia);
  const mesMedicao = normalizarMesReferencia(
    medicao.mes_referencia || medicao.data_medicao
  );

  if (mesCampanha && mesMedicao && mesCampanha === mesMedicao) {
    return true;
  }

  return dataEstaDentroDoPeriodo(
    medicao.data_medicao,
    campanha.data_inicio,
    campanha.data_fim
  );
}

function calcularPontuacaoCompatibilidadeCampanha(campanha, medicao) {
  const mesMedicao = normalizarMesReferencia(
    medicao.mes_referencia || medicao.data_medicao
  );

  return (
    (campanha.ativo === false ? 0 : 100) +
    (normalizarMesReferencia(campanha.mes_referencia) === mesMedicao ? 10 : 0) +
    (dataEstaDentroDoPeriodo(
      medicao.data_medicao,
      campanha.data_inicio,
      campanha.data_fim
    )
      ? 5
      : 0)
  );
}

function obterCampanhasCompativeisParaMedicao(medicao, poco, campanhas = []) {
  if (!medicao || !poco?.projeto_local_id) {
    return [];
  }

  return campanhas
    .filter((campanha) => campanhaCombinaComMedicao(campanha, medicao, poco))
    .sort((a, b) => {
      const pontuacaoA = calcularPontuacaoCompatibilidadeCampanha(a, medicao);
      const pontuacaoB = calcularPontuacaoCompatibilidadeCampanha(b, medicao);

      if (pontuacaoA !== pontuacaoB) {
        return pontuacaoB - pontuacaoA;
      }

      return new Date(b.criado_em || 0) - new Date(a.criado_em || 0);
    });
}

function medicaoEhCompativelComCampanha(
  campanha,
  medicao,
  poco,
  campanhas = []
) {
  if (!campanha || !medicao || !poco) {
    return false;
  }

  if (medicao.campanha_local_id === campanha.local_id) {
    return true;
  }

  if (medicao.campanha_local_id) {
    const campanhaVinculada = campanhas.find(
      (item) => item.local_id === medicao.campanha_local_id
    );

    if (
      campanhaVinculada &&
      campanhaCombinaComMedicao(campanhaVinculada, medicao, poco)
    ) {
      return false;
    }
  }

  return obterCampanhasCompativeisParaMedicao(
    medicao,
    poco,
    campanhas
  ).some((campanhaCompativel) => campanhaCompativel.local_id === campanha.local_id);
}

function obterCampanhaCompativelParaMedicao(medicao, poco, campanhas = []) {
  if (!medicao || !poco?.projeto_local_id) {
    return null;
  }

  return obterCampanhasCompativeisParaMedicao(medicao, poco, campanhas)[0] || null;
}

async function sincronizarVinculoCampanhaMedicao(
  medicao,
  poco = null,
  campanhas = null
) {
  if (!medicao?.poco_local_id) {
    return medicao;
  }

  const pocoAtual =
    poco ||
    (await listarPocosLocais()).find(
      (item) => item.local_id === medicao.poco_local_id
    );

  if (!pocoAtual) {
    return medicao;
  }

  const campanhasDisponiveis = campanhas || (await listarCampanhasLocais());
  const campanhaLocalIdAtual = medicao.campanha_local_id || null;

  if (campanhaLocalIdAtual) {
    const campanhaAtual = campanhasDisponiveis.find(
      (campanha) => campanha.local_id === campanhaLocalIdAtual
    );

    if (
      campanhaAtual &&
      campanhaCombinaComMedicao(campanhaAtual, medicao, pocoAtual)
    ) {
      return medicao;
    }
  }

  const campanhaCompativel = obterCampanhaCompativelParaMedicao(
    medicao,
    pocoAtual,
    campanhasDisponiveis
  );

  const novoCampanhaLocalId = campanhaCompativel?.local_id || null;

  if (campanhaLocalIdAtual !== novoCampanhaLocalId) {
    medicao.campanha_local_id = novoCampanhaLocalId;
    medicao.sincronizado = false;
    medicao.atualizado_em = new Date().toISOString();
  }

  return medicao;
}

async function listarMedicoesParaSync() {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["medicoes"], "readonly");
    const store = tx.objectStore("medicoes");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);

    request.onerror = () => reject("Erro ao listar medições");
  });
}

async function atualizarMedicaoLocal(medicao) {
  return salvarMedicaoLocal(medicao);
}

async function excluirMedicaoLocal(localId) {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["medicoes"], "readwrite");
    const store = tx.objectStore("medicoes");

    const req = store.get(localId);

    req.onsuccess = () => {
      const medicao = req.result;

      if (!medicao) {
        resolve(false);
        return;
      }

      medicao.excluido = true;
      medicao.sincronizado = false;
      medicao.excluido_em = new Date().toISOString();

      store.put(medicao);
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Erro ao excluir medição");
  });
}
