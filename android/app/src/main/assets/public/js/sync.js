let sincronizacaoEmAndamento = false;

async function sincronizarDados() {
  if (!navigator.onLine) {
    alert("Você está offline. Os dados continuarão salvos no aparelho.");
    return;
  }

  if (sincronizacaoEmAndamento) {
    return;
  }

  sincronizacaoEmAndamento = true;

  const statusSync = document.getElementById("statusSync");

  if (statusSync) {
    statusSync.innerText = "Sincronizando...";
  }

  try {
    await sincronizarMedicoes(true);
    await sincronizarCampanhas(true);
    await sincronizarPocos(true);
    await sincronizarProjetos(true);

    await sincronizarProjetos();
    await sincronizarPocos();
    await sincronizarCampanhas();
    await sincronizarMedicoes();
    await reconciliarDadosSupabase();

    if (statusSync) {
      statusSync.innerText = "Sincronização finalizada";
    }

    alert("Dados sincronizados com o Supabase.");

    atualizarTelasAposSync();
  } catch (error) {
    console.error(error);

    if (statusSync) {
      statusSync.innerText = "Erro na sincronização";
    }

    alert("Erro ao sincronizar: " + error.message);
  } finally {
    sincronizacaoEmAndamento = false;
  }
}

function atualizarTelasAposSync() {
  if (typeof carregarMedicoes === "function") carregarMedicoes();
  if (typeof carregarDashboard === "function") carregarDashboard();
  if (typeof carregarMapa === "function") carregarMapa();
  if (typeof carregarCampanhas === "function") carregarCampanhas();
  if (typeof carregarCampanha === "function") carregarCampanha();
  if (typeof carregarProjeto === "function") carregarProjeto();
}

function estaExcluido(item) {
  return item.excluido === true;
}

/* BAIXAR DADOS DA NUVEM */

async function baixarDadosSupabase() {
  if (!navigator.onLine) {
    alert("Você está offline. Conecte-se à internet para restaurar os dados.");
    return;
  }

  if (sincronizacaoEmAndamento) {
    alert("Já existe uma sincronização em andamento.");
    return;
  }

  sincronizacaoEmAndamento = true;

  const statusSync = document.getElementById("statusSync");

  if (statusSync) {
    statusSync.innerText = "Baixando dados da nuvem...";
  }

  try {
    const totais = await reconciliarDadosSupabase();

    if (statusSync) {
      statusSync.innerText = "Dados restaurados com sucesso";
    }

    alert(
      "Dados restaurados com sucesso!\n\n" +
        `Projetos: ${totais.projetos}\n` +
        `PMs/Poços: ${totais.pocos}\n` +
        `Campanhas: ${totais.campanhas}\n` +
        `Medições: ${totais.medicoes}`
    );

    atualizarTelasAposSync();
  } catch (error) {
    console.error(error);

    if (statusSync) {
      statusSync.innerText = "Erro ao restaurar dados";
    }

    alert("Erro ao restaurar dados da nuvem: " + error.message);
  } finally {
    sincronizacaoEmAndamento = false;
  }
}

async function baixarProjetosSupabase() {
  const { data, error } = await supabaseClient
    .from("projetos")
    .select("*")
    .eq("excluido", false);

  if (error) {
    throw new Error("Erro ao baixar projetos: " + error.message);
  }

  return data || [];
}

async function baixarPocosSupabase() {
  const { data, error } = await supabaseClient
    .from("pocos")
    .select("*")
    .eq("excluido", false);

  if (error) {
    throw new Error("Erro ao baixar PMs: " + error.message);
  }

  return data || [];
}

async function baixarCampanhasSupabase() {
  const { data, error } = await supabaseClient
    .from("campanhas")
    .select("*")
    .eq("excluido", false);

  if (error) {
    throw new Error("Erro ao baixar campanhas: " + error.message);
  }

  return data || [];
}

async function baixarMedicoesSupabase() {
  const { data, error } = await supabaseClient
    .from("medicoes")
    .select("*")
    .eq("excluido", false);

  if (error) {
    throw new Error("Erro ao baixar medições: " + error.message);
  }

  return data || [];
}

function validarDadosBaixados(nomeStore, registros) {
  if (!Array.isArray(registros)) {
    throw new Error(`Resposta inválida ao baixar ${nomeStore}.`);
  }

  const ids = new Set();

  for (const registro of registros) {
    if (!registro || !registro.local_id) {
      throw new Error(`Registro de ${nomeStore} sem local_id.`);
    }

    if (ids.has(registro.local_id)) {
      throw new Error(
        `Resposta de ${nomeStore} contém local_id duplicado: ${registro.local_id}.`
      );
    }

    ids.add(registro.local_id);
  }
}

function mesclarDadosRemotosComPendencias(remotos, locais, sincronizadoEm) {
  const registrosPorId = new Map();

  for (const remoto of remotos) {
    registrosPorId.set(remoto.local_id, {
      ...remoto,
      sincronizado: true,
      sincronizado_em: sincronizadoEm,
    });
  }

  for (const local of locais) {
    if (local.sincronizado !== true || local.excluido === true) {
      registrosPorId.set(local.local_id, local);
    }
  }

  return Array.from(registrosPorId.values());
}

async function lerTodosRegistrosDaStore(nomeStore) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([nomeStore], "readonly");
    const request = tx.objectStore(nomeStore).getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(
      request.error || new Error(`Erro ao ler dados locais de ${nomeStore}.`)
    );
  });
}

async function substituirStoresComMerge(dadosRemotos) {
  await abrirBancoLocal();

  const stores = ["projetos", "pocos", "campanhas", "medicoes"];
  const dadosLocais = {};

  for (const nomeStore of stores) {
    dadosLocais[nomeStore] = await lerTodosRegistrosDaStore(nomeStore);
  }

  const sincronizadoEm = new Date().toISOString();
  const dadosFinais = {};

  for (const nomeStore of stores) {
    dadosFinais[nomeStore] = mesclarDadosRemotosComPendencias(
      dadosRemotos[nomeStore],
      dadosLocais[nomeStore],
      sincronizadoEm
    );
  }

  await new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");

    for (const nomeStore of stores) {
      const store = tx.objectStore(nomeStore);
      store.clear();

      for (const registro of dadosFinais[nomeStore]) {
        store.put(registro);
      }
    }

    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(
      tx.error || new Error("A substituição segura dos dados locais foi cancelada.")
    );
    tx.onerror = () => {
      // O evento abort rejeitará a Promise com o erro da transação.
    };
  });
}

async function reconciliarDadosSupabase() {
  const [projetos, pocos, campanhas, medicoes] = await Promise.all([
    baixarProjetosSupabase(),
    baixarPocosSupabase(),
    baixarCampanhasSupabase(),
    baixarMedicoesSupabase(),
  ]);

  const dadosRemotos = { projetos, pocos, campanhas, medicoes };

  for (const [nomeStore, registros] of Object.entries(dadosRemotos)) {
    validarDadosBaixados(nomeStore, registros);
  }

  await substituirStoresComMerge(dadosRemotos);

  return {
    projetos: projetos.length,
    pocos: pocos.length,
    campanhas: campanhas.length,
    medicoes: medicoes.length,
  };
}

/* PROJETOS */

function exclusaoRemotaConfirmada(registros, localId) {
  return Array.isArray(registros) && registros.some(
    (registro) => registro.local_id === localId
  );
}

async function verificarConflitoRemoto(tabela, registro) {
  if (!registro.sincronizado_em) return;

  const { data, error } = await supabaseClient
    .from(tabela)
    .select("local_id, atualizado_em")
    .eq("local_id", registro.local_id)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao verificar conflito em ${tabela}: ${error.message}`);
  }

  if (!data?.atualizado_em) return;

  const atualizadoRemoto = Date.parse(data.atualizado_em);
  const ultimaSincronizacao = Date.parse(registro.sincronizado_em);

  if (
    Number.isFinite(atualizadoRemoto) &&
    Number.isFinite(ultimaSincronizacao) &&
    atualizadoRemoto > ultimaSincronizacao
  ) {
    throw new Error(
      `Conflito detectado em ${tabela} (${registro.local_id}). ` +
      "O registro foi alterado em outro dispositivo e a versão local foi preservada como pendente."
    );
  }
}

async function sincronizarProjetos(somenteExclusoes = false) {
  const projetos = await listarProjetosParaSync();

  for (const projeto of projetos) {
    /* ==========================
       EXCLUSÃO
    ===========================*/

    if (projeto.excluido === true) {
      const { data, error } = await supabaseClient
        .from("projetos")
        .delete()
        .eq("local_id", projeto.local_id)
        .select("local_id");

      if (error) {
        console.error(error);
        throw new Error("Erro ao excluir projeto: " + error.message);
      }

      if (!exclusaoRemotaConfirmada(data, projeto.local_id)) {
        throw new Error(
          "A exclusão do projeto não foi confirmada pelo Supabase. O registro local foi preservado."
        );
      }

      await abrirBancoLocal();

      await new Promise((resolve, reject) => {
        const tx = db.transaction(["projetos"], "readwrite");
        const store = tx.objectStore("projetos");

        store.delete(projeto.local_id);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject();
      });

      continue;
    }

    if (somenteExclusoes) continue;

    /* ==========================
       UPSERT
    ===========================*/

    if (!projeto.sincronizado) {
      await verificarConflitoRemoto("projetos", projeto);

      const { error } = await supabaseClient.from("projetos").upsert(
        {
          local_id: projeto.local_id,
          usuario_id: projeto.usuario_id,

          nome: projeto.nome,
          cliente: projeto.cliente,
          processo_comercial: projeto.processo_comercial ?? null,
          local: projeto.local,
          descricao: projeto.descricao,

          ativo: projeto.ativo !== false,

          criado_em: projeto.criado_em,
          atualizado_em: new Date().toISOString(),

          excluido: false,
        },
        {
          onConflict: "local_id",
        }
      );

      if (error) {
        console.error(error);
        throw new Error("Erro ao sincronizar projeto: " + error.message);
      }

      projeto.sincronizado = true;
      projeto.sincronizado_em = new Date().toISOString();
      projeto.atualizado_em = new Date().toISOString();

      await atualizarProjetoLocal(projeto);
    }
  }
}

/* PMS / POÇOS */

async function sincronizarPocos(somenteExclusoes = false) {
  const pocos = await listarPocosParaSync();

  for (const poco of pocos) {
    /* ==========================
       EXCLUSÃO
    =========================== */

    if (poco.excluido === true) {
      const { data, error } = await supabaseClient
        .from("pocos")
        .delete()
        .eq("local_id", poco.local_id)
        .select("local_id");

      if (error) {
        console.error(error);
        throw new Error("Erro ao excluir PM: " + error.message);
      }

      if (!exclusaoRemotaConfirmada(data, poco.local_id)) {
        throw new Error(
          "A exclusão do PM não foi confirmada pelo Supabase. O registro local foi preservado."
        );
      }

      await abrirBancoLocal();

      await new Promise((resolve, reject) => {
        const tx = db.transaction(["pocos"], "readwrite");
        const store = tx.objectStore("pocos");

        store.delete(poco.local_id);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject();
      });

      continue;
    }

    if (somenteExclusoes) continue;

    /* ==========================
       UPSERT
    =========================== */

    if (!poco.sincronizado) {
      await verificarConflitoRemoto("pocos", poco);

      const { error } = await supabaseClient.from("pocos").upsert(
        {
          local_id: poco.local_id,
          usuario_id: poco.usuario_id,

          projeto_local_id: poco.projeto_local_id ?? null,

          nome: poco.nome,
          tipo: poco.tipo,
          local_propriedade: poco.local_propriedade,

          utm_e: poco.utm_e,
          utm_n: poco.utm_n,
          zona_utm: poco.zona_utm ?? null,
          hemisferio_utm: poco.hemisferio_utm ?? null,

          latitude: poco.latitude ?? null,
          longitude: poco.longitude ?? null,
          precisao_gps: poco.precisao_gps ?? null,
          altitude_gps: poco.altitude_gps ?? null,
          gps_capturado_em: poco.gps_capturado_em ?? null,
          gps: poco.gps ?? null,

          profundidade_total: poco.profundidade_total ?? null,
          diametro: poco.diametro,
          poco_com_cap: poco.poco_com_cap ?? null,
          perfil_construtivo: poco.perfil_construtivo ?? null,

          fotos: poco.fotos || [],

          ativo: poco.ativo !== false,

          criado_em: poco.criado_em,
          atualizado_em: new Date().toISOString(),

          excluido: false,
        },
        {
          onConflict: "local_id",
        }
      );

      if (error) {
        console.error(error);
        throw new Error("Erro ao sincronizar PM: " + error.message);
      }

      poco.sincronizado = true;
      poco.sincronizado_em = new Date().toISOString();
      poco.atualizado_em = new Date().toISOString();

      await atualizarPocoLocal(poco);
    }
  }
}

/* CAMPANHAS */

async function sincronizarCampanhas(somenteExclusoes = false) {
  const campanhas = await listarCampanhasParaSync();
  console.log("Campanhas para sincronizar:", campanhas);

  for (const campanha of campanhas) {
    /* ==========================
       EXCLUSÃO
    =========================== */

    console.log("Sincronizando campanha:", campanha);
    console.log("Excluído:", campanha.excluido);

    if (campanha.excluido === true) {
      console.log("EXCLUINDO DO SUPABASE:", campanha.local_id);
      const { data, error } = await supabaseClient
        .from("campanhas")
        .delete()
        .eq("local_id", campanha.local_id)
        .select();

      console.log("DELETE retornou:", data);
      console.log("DELETE erro:", error); 

      if (error) {
        console.error(error);
        throw new Error("Erro ao excluir campanha: " + error.message);
      }

      if (!exclusaoRemotaConfirmada(data, campanha.local_id)) {
        throw new Error(
          "A exclusão da campanha não foi confirmada pelo Supabase. O registro local foi preservado."
        );
      }

      await abrirBancoLocal();

      await new Promise((resolve, reject) => {
        const tx = db.transaction(["campanhas"], "readwrite");
        const store = tx.objectStore("campanhas");

        store.delete(campanha.local_id);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject();
      });

      continue;
    }

    if (somenteExclusoes) continue;

    /* ==========================
       UPSERT
    =========================== */

    if (!campanha.sincronizado) {
      await verificarConflitoRemoto("campanhas", campanha);

      const { error } = await supabaseClient.from("campanhas").upsert(
        {
          local_id: campanha.local_id,

          projeto_local_id: campanha.projeto_local_id,
          usuario_id: campanha.usuario_id,

          nome: campanha.nome,
          mes_referencia: campanha.mes_referencia,

          data_inicio: campanha.data_inicio ?? null,
          data_fim: campanha.data_fim ?? null,

          observacoes: campanha.observacoes,

          ativo: campanha.ativo !== false,

          criado_em: campanha.criado_em,
          atualizado_em: new Date().toISOString(),

          excluido: false,
        },
        {
          onConflict: "local_id",
        }
      );

      if (error) {
        console.error(error);
        throw new Error("Erro ao sincronizar campanha: " + error.message);
      }

      campanha.sincronizado = true;
      campanha.sincronizado_em = new Date().toISOString();
      campanha.atualizado_em = new Date().toISOString();

      await atualizarCampanhaLocal(campanha);
    }
  }
}

/* MEDIÇÕES */

async function sincronizarMedicoes(somenteExclusoes = false) {
  const medicoes = await listarMedicoesParaSync();

  for (const medicao of medicoes) {
    /* ==========================
       EXCLUSÃO
    =========================== */

    if (medicao.excluido === true) {
      const { data, error } = await supabaseClient
        .from("medicoes")
        .delete()
        .eq("local_id", medicao.local_id)
        .select("local_id");

      if (error) {
        console.error(error);
        throw new Error("Erro ao excluir medição: " + error.message);
      }

      if (!exclusaoRemotaConfirmada(data, medicao.local_id)) {
        throw new Error(
          "A exclusão da medição não foi confirmada pelo Supabase. O registro local foi preservado."
        );
      }

      await abrirBancoLocal();

      await new Promise((resolve, reject) => {
        const tx = db.transaction(["medicoes"], "readwrite");
        const store = tx.objectStore("medicoes");

        store.delete(medicao.local_id);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject();
      });

      continue;
    }

    if (somenteExclusoes) continue;

    /* ==========================
       UPSERT
    =========================== */

    if (!medicao.sincronizado) {
      await verificarConflitoRemoto("medicoes", medicao);

      const { error } = await supabaseClient.from("medicoes").upsert(
        {
          local_id: medicao.local_id,

          poco_local_id: medicao.poco_local_id,
          poco_nome: medicao.poco_nome,

          campanha_local_id: medicao.campanha_local_id ?? null,

          usuario_id: medicao.usuario_id,
          coletor_nome: medicao.coletor_nome,

          codigo_frascaria: medicao.codigo_frascaria ?? null,
          responsavel_als: medicao.responsavel_als ?? null,

          data_medicao: medicao.data_medicao ?? null,
          mes_referencia: medicao.mes_referencia,

          profundidade_total_mes: medicao.profundidade_total_mes ?? null,
          nivel_agua: medicao.nivel_agua ?? null,
          profundidade_bomba: medicao.profundidade_bomba ?? null,

          coluna_agua: medicao.coluna_agua ?? null,
          volume_estagnado: medicao.volume_estagnado ?? null,
          volume_purga: medicao.volume_purga ?? null,
          volume_total_esgotado: medicao.volume_total_esgotado ?? null,

          leituras: medicao.leituras || [],
          estabilizacao: medicao.estabilizacao ?? null,
          alertas: medicao.alertas || [],

          condicoes_ambientais: medicao.condicoes_ambientais || {},

          fotos: medicao.fotos || [],

          criado_em: medicao.criado_em,
          atualizado_em: new Date().toISOString(),

          duplicada_de: medicao.duplicada_de ?? null,

          excluido: false,
        },
        {
          onConflict: "local_id",
        }
      );

      if (error) {
        console.error(error);
        throw new Error("Erro ao sincronizar medição: " + error.message);
      }

      medicao.sincronizado = true;
      medicao.sincronizado_em = new Date().toISOString();
      medicao.atualizado_em = new Date().toISOString();

      await atualizarMedicaoLocal(medicao);
    }
  }
}

window.addEventListener("online", () => {
  sincronizarDados();
});

window.sincronizarDados = sincronizarDados;
window.baixarDadosSupabase = baixarDadosSupabase;
