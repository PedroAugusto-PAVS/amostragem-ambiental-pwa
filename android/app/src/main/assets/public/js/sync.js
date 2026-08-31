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
    const totais = await reconciliarDadosSupabase({
      permitirMigracaoCodigosPendente: true,
    });

    if (statusSync) {
      statusSync.innerText = totais.migracaoCodigosPendente
        ? "Dados antigos restaurados; migração de códigos pendente"
        : "Dados restaurados com sucesso";
    }

    alert(
      "Dados restaurados com sucesso!\n\n" +
        `Projetos: ${totais.projetos}\n` +
        `PMs/Poços: ${totais.pocos}\n` +
        `Campanhas: ${totais.campanhas}\n` +
        `Medições: ${totais.medicoes}` +
        (totais.migracaoCodigosPendente
          ? "\n\nAtenção: a tabela medicao_codigos ainda não está disponível no Supabase. " +
            "Os dados antigos e o código principal foram restaurados, mas os códigos múltiplos " +
            "só poderão ser recuperados e sincronizados quando a tabela estiver disponível."
          : "")
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

function erroIndicaMigracaoCodigosPendente(error) {
  const codigo = String(error?.code || "");
  const mensagem = String(error?.message || "").toLowerCase();
  const mencionaTabelaCodigos = mensagem.includes("medicao_codigos");

  return (
    codigo === "PGRST205" ||
    (codigo === "42P01" && mencionaTabelaCodigos) ||
    (mencionaTabelaCodigos &&
      (mensagem.includes("does not exist") ||
        mensagem.includes("schema cache") ||
        mensagem.includes("não existe")))
  );
}

function erroSincronizacaoCodigos(prefixo, error) {
  if (erroIndicaMigracaoCodigosPendente(error)) {
    return new Error(
      "A tabela medicao_codigos não está disponível no Supabase. " +
        "Confirme se a migração foi aplicada e se o cache do esquema está atualizado " +
        "antes de sincronizar os códigos."
    );
  }

  return new Error(`${prefixo}: ${error?.message || "erro desconhecido"}`);
}

async function baixarCodigosMedicoesSupabase(
  { permitirMigracaoPendente = false } = {}
) {
  const { data, error } = await supabaseClient
    .from("medicao_codigos")
    .select("local_id, medicao_local_id, codigo, tipo, ordem, criado_em")
    .order("ordem", { ascending: true });

  if (error) {
    if (
      permitirMigracaoPendente &&
      erroIndicaMigracaoCodigosPendente(error)
    ) {
      console.warn(
        "Tabela medicao_codigos indisponível. Restaurando dados legados sem códigos múltiplos."
      );
      return {
        codigos: [],
        migracaoPendente: true,
      };
    }

    throw erroSincronizacaoCodigos(
      "Erro ao baixar códigos das amostras",
      error
    );
  }

  return {
    codigos: data || [],
    migracaoPendente: false,
  };
}

function anexarCodigosRemotosAsMedicoes(medicoes, codigosRemotos) {
  const codigosPorMedicao = new Map();

  for (const item of codigosRemotos || []) {
    if (!item?.medicao_local_id) continue;

    if (!codigosPorMedicao.has(item.medicao_local_id)) {
      codigosPorMedicao.set(item.medicao_local_id, []);
    }

    codigosPorMedicao.get(item.medicao_local_id).push({
      local_id: item.local_id,
      codigo: item.codigo,
      tipo: item.tipo,
      ordem: Number.isInteger(item.ordem) ? item.ordem : 0,
      criado_em: item.criado_em || null,
    });
  }

  return (medicoes || []).map((medicao) => {
    const codigos = codigosPorMedicao.get(medicao.local_id) || [];

    if (codigos.length === 0) {
      return medicao;
    }

    return {
      ...medicao,
      codigos_amostras: codigos.sort((a, b) => a.ordem - b.ordem),
      codigo_frascaria: obterCodigoPrincipal(codigos),
    };
  });
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

function preservarCodigosLocaisNasMedicoes(remotas, locais) {
  const locaisPorId = new Map(
    (locais || []).map((medicao) => [medicao.local_id, medicao])
  );

  return (remotas || []).map((remota) => {
    const local = locaisPorId.get(remota.local_id);
    const codigosLocais = Array.isArray(local?.codigos_amostras)
      ? local.codigos_amostras
      : [];

    if (codigosLocais.length === 0) {
      return remota;
    }

    return {
      ...remota,
      codigos_amostras: codigosLocais,
      codigo_frascaria:
        obterCodigoPrincipal(codigosLocais) ||
        local.codigo_frascaria ||
        remota.codigo_frascaria,
      sincronizado: false,
    };
  });
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

async function substituirStoresComMerge(
  dadosRemotos,
  { preservarCodigosLocais = false } = {}
) {
  await abrirBancoLocal();

  const stores = ["projetos", "pocos", "campanhas", "medicoes"];
  const dadosLocais = {};

  for (const nomeStore of stores) {
    dadosLocais[nomeStore] = await lerTodosRegistrosDaStore(nomeStore);
  }

  const sincronizadoEm = new Date().toISOString();
  const dadosFinais = {};

  for (const nomeStore of stores) {
    const dadosMesclados = mesclarDadosRemotosComPendencias(
      dadosRemotos[nomeStore],
      dadosLocais[nomeStore],
      sincronizadoEm
    );

    dadosFinais[nomeStore] =
      nomeStore === "medicoes" && preservarCodigosLocais
        ? preservarCodigosLocaisNasMedicoes(
            dadosMesclados,
            dadosLocais[nomeStore]
          )
        : dadosMesclados;
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

async function reconciliarDadosSupabase(
  { permitirMigracaoCodigosPendente = false } = {}
) {
  const [
    projetos,
    pocos,
    campanhas,
    medicoesSemCodigos,
    resultadoCodigosMedicoes,
  ] = await Promise.all([
    baixarProjetosSupabase(),
    baixarPocosSupabase(),
    baixarCampanhasSupabase(),
    baixarMedicoesSupabase(),
    baixarCodigosMedicoesSupabase({
      permitirMigracaoPendente: permitirMigracaoCodigosPendente,
    }),
  ]);
  const codigosMedicoes = resultadoCodigosMedicoes.codigos;
  const medicoes = anexarCodigosRemotosAsMedicoes(
    medicoesSemCodigos,
    codigosMedicoes
  );

  const dadosRemotos = { projetos, pocos, campanhas, medicoes };

  for (const [nomeStore, registros] of Object.entries(dadosRemotos)) {
    validarDadosBaixados(nomeStore, registros);
  }

  await substituirStoresComMerge(dadosRemotos, {
    preservarCodigosLocais: resultadoCodigosMedicoes.migracaoPendente,
  });

  return {
    projetos: projetos.length,
    pocos: pocos.length,
    campanhas: campanhas.length,
    medicoes: medicoes.length,
    codigos_amostras: codigosMedicoes.length,
    migracaoCodigosPendente: resultadoCodigosMedicoes.migracaoPendente,
  };
}

/* PROJETOS */

function exclusaoRemotaConfirmada(registros, localId) {
  return Array.isArray(registros) && registros.some(
    (registro) => registro.local_id === localId
  );
}

function exclusaoRemotaNecessaria(registro) {
  if (typeof registro?.exclusao_remota_necessaria === "boolean") {
    return registro.exclusao_remota_necessaria;
  }

  return Boolean(registro?.sincronizado_em);
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
      if (exclusaoRemotaNecessaria(projeto)) {
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
          console.info("Projeto já não existia no Supabase; concluindo exclusão local.", projeto.local_id);
        }
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

/**
 * Converte valores destinados a colunas numeric do Supabase.
 *
 * Regras:
 * - null, undefined, "" e espaços viram null;
 * - números com vírgula decimal são convertidos para ponto;
 * - valores numéricos válidos são enviados como Number;
 * - valores não vazios e inválidos interrompem a sincronização com uma
 *   mensagem que identifica o PM e o campo problemático.
 */
function normalizarNumeroPocoParaSupabase(valor, nomeCampo, localIdPoco) {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (typeof valor === "string") {
    const valorLimpo = valor.trim();

    if (valorLimpo === "") {
      return null;
    }

    let valorNormalizado = valorLimpo.replace(/\s/g, "");

    // Aceita tanto o formato 10.5 quanto 10,5. Também trata valores
    // formatados como 1.234,56 ou 1,234.56.
    if (valorNormalizado.includes(",") && valorNormalizado.includes(".")) {
      if (
        valorNormalizado.lastIndexOf(",") >
        valorNormalizado.lastIndexOf(".")
      ) {
        valorNormalizado = valorNormalizado
          .replace(/\./g, "")
          .replace(",", ".");
      } else {
        valorNormalizado = valorNormalizado.replace(/,/g, "");
      }
    } else {
      valorNormalizado = valorNormalizado.replace(",", ".");
    }

    const numero = Number(valorNormalizado);

    if (Number.isFinite(numero)) {
      return numero;
    }

    throw new Error(
      `Valor numérico inválido no campo ${nomeCampo} do PM ` +
        `${localIdPoco || "sem local_id"}: "${valor}".`
    );
  }

  const numero = Number(valor);

  if (Number.isFinite(numero)) {
    return numero;
  }

  throw new Error(
    `Valor numérico inválido no campo ${nomeCampo} do PM ` +
      `${localIdPoco || "sem local_id"}: ${String(valor)}.`
  );
}

async function sincronizarPocos(somenteExclusoes = false) {
  const pocos = await listarPocosParaSync();

  for (const poco of pocos) {
    /* ==========================
       EXCLUSÃO
    =========================== */

    if (poco.excluido === true) {
      if (exclusaoRemotaNecessaria(poco)) {
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
          console.info("PM já não existia no Supabase; concluindo exclusão local.", poco.local_id);
        }
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

      const pocoParaSupabase = {
        local_id: poco.local_id,
        usuario_id: poco.usuario_id,

        projeto_local_id: poco.projeto_local_id ?? null,
        projeto_local_ids: obterProjetosLocaisDoPoco(poco),

        nome: poco.nome,
        tipo: poco.tipo,
        local_propriedade: poco.local_propriedade,

        utm_e: poco.utm_e,
        utm_n: poco.utm_n,
        zona_utm: poco.zona_utm ?? null,
        hemisferio_utm: poco.hemisferio_utm ?? null,

        latitude: normalizarNumeroPocoParaSupabase(
          poco.latitude,
          "latitude",
          poco.local_id
        ),
        longitude: normalizarNumeroPocoParaSupabase(
          poco.longitude,
          "longitude",
          poco.local_id
        ),
        precisao_gps: normalizarNumeroPocoParaSupabase(
          poco.precisao_gps,
          "precisao_gps",
          poco.local_id
        ),
        altitude_gps: normalizarNumeroPocoParaSupabase(
          poco.altitude_gps,
          "altitude_gps",
          poco.local_id
        ),
        gps_capturado_em: poco.gps_capturado_em ?? null,
        gps: poco.gps ?? null,

        profundidade_total: normalizarNumeroPocoParaSupabase(
          poco.profundidade_total,
          "profundidade_total",
          poco.local_id
        ),
        diametro: poco.diametro,
        poco_com_cap: poco.poco_com_cap ?? null,
        perfil_construtivo: poco.perfil_construtivo ?? null,

        fotos: poco.fotos || [],

        ativo: poco.ativo !== false,

        criado_em: poco.criado_em,
        atualizado_em: new Date().toISOString(),

        excluido: false,
      };

      const { error } = await supabaseClient
        .from("pocos")
        .upsert(pocoParaSupabase, {
          onConflict: "local_id",
        });

      if (error) {
        console.error("Erro retornado pelo Supabase ao sincronizar PM:", {
          error,
          local_id: poco.local_id || "sem local_id",
          payload: pocoParaSupabase,
        });
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

  for (const campanha of campanhas) {
    /* ==========================
       EXCLUSÃO
    =========================== */

    if (campanha.excluido === true) {
      if (exclusaoRemotaNecessaria(campanha)) {
        const { data, error } = await supabaseClient
          .from("campanhas")
          .delete()
          .eq("local_id", campanha.local_id)
          .select("local_id");

        if (error) {
          console.error(error);
          throw new Error("Erro ao excluir campanha: " + error.message);
        }

        if (!exclusaoRemotaConfirmada(data, campanha.local_id)) {
          console.info("Campanha já não existia no Supabase; concluindo exclusão local.", campanha.local_id);
        }
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

async function buscarCodigosRemotosDaMedicao(medicaoLocalId) {
  const { data, error } = await supabaseClient
    .from("medicao_codigos")
    .select("local_id, medicao_local_id, codigo, tipo, ordem, criado_em")
    .eq("medicao_local_id", medicaoLocalId)
    .order("ordem", { ascending: true });

  if (error) {
    throw erroSincronizacaoCodigos(
      "Erro ao consultar códigos da medição",
      error
    );
  }

  return data || [];
}

async function executarUpsertCodigos(payload, remotos) {
  if (payload.length === 0) {
    return;
  }

  const remotosPorId = new Map(
    remotos.map((item) => [item.local_id, item])
  );
  const ocupanteAtualPorCodigo = new Map(
    remotos.map((item) => [
      normalizarCodigoAmostra(item.codigo).toLocaleUpperCase("pt-BR"),
      item.local_id,
    ])
  );
  const existeColisaoDeRenomeacao = payload.some((item) => {
    const ocupante = ocupanteAtualPorCodigo.get(
      item.codigo.toLocaleUpperCase("pt-BR")
    );
    return ocupante && ocupante !== item.local_id;
  });

  // Uma cadeia como A→B e B→C viola temporariamente o índice único se for
  // executada diretamente. Libera primeiro os códigos antigos com marcadores
  // técnicos; se a segunda etapa falhar, o snapshot local continua íntegro e
  // a próxima tentativa restaura os valores finais pelos mesmos UUIDs.
  if (existeColisaoDeRenomeacao) {
    const payloadPorId = new Map(
      payload.map((item) => [item.local_id, item])
    );
    const idsParaTemporizar = new Set();

    for (const item of payload) {
      const remoto = remotosPorId.get(item.local_id);

      if (
        remoto &&
        normalizarCodigoAmostra(remoto.codigo).toLocaleUpperCase("pt-BR") !==
          item.codigo.toLocaleUpperCase("pt-BR")
      ) {
        idsParaTemporizar.add(item.local_id);
      }

      const ocupante = ocupanteAtualPorCodigo.get(
        item.codigo.toLocaleUpperCase("pt-BR")
      );

      if (ocupante && ocupante !== item.local_id) {
        idsParaTemporizar.add(ocupante);
      }
    }

    const codigosReservados = new Set([
      ...remotos.map((item) =>
        normalizarCodigoAmostra(item.codigo).toLocaleUpperCase("pt-BR")
      ),
      ...payload.map((item) => item.codigo.toLocaleUpperCase("pt-BR")),
    ]);
    const temporarios = remotos
      .filter((remoto) => idsParaTemporizar.has(remoto.local_id))
      .map((remoto) => {
        const itemFinal = payloadPorId.get(remoto.local_id);
        let codigoTemporario = `HT-SYNC-${remoto.local_id}`;
        let sufixo = 1;

        while (
          codigosReservados.has(
            codigoTemporario.toLocaleUpperCase("pt-BR")
          )
        ) {
          sufixo += 1;
          codigoTemporario = `HT-SYNC-${sufixo}-${remoto.local_id}`;
        }

        codigosReservados.add(
          codigoTemporario.toLocaleUpperCase("pt-BR")
        );
        return {
          local_id: remoto.local_id,
          medicao_local_id: remoto.medicao_local_id,
          codigo: codigoTemporario,
          tipo: itemFinal?.tipo || remoto.tipo || "outro",
          ordem: Number.isInteger(itemFinal?.ordem)
            ? itemFinal.ordem
            : remoto.ordem || 0,
          criado_em:
            itemFinal?.criado_em ||
            remoto.criado_em ||
            new Date().toISOString(),
          atualizado_em:
            itemFinal?.atualizado_em || new Date().toISOString(),
        };
      });

    if (temporarios.length > 0) {
      const { error } = await supabaseClient
        .from("medicao_codigos")
        .upsert(temporarios, { onConflict: "local_id" });

      if (error) {
        throw erroSincronizacaoCodigos(
          "Erro ao preparar a atualização dos códigos da medição",
          error
        );
      }
    }
  }

  const { error } = await supabaseClient
    .from("medicao_codigos")
    .upsert(payload, { onConflict: "local_id" });

  if (error) {
    throw erroSincronizacaoCodigos(
      "Erro ao salvar códigos da medição",
      error
    );
  }
}

async function sincronizarCodigosDaMedicao(
  medicao,
  codigosRemotosConhecidos = null
) {
  const codigosLidos = obterCodigosDaMedicao(medicao);

  if (codigosLidos.length === 0 && !medicaoMarcadaManualmente(medicao)) {
    throw new Error(
      `A medição ${medicao.local_id} não possui código de amostra válido.`
    );
  }

  let codigos = codigosLidos.length
    ? prepararCodigosAmostras(codigosLidos)
    : [];
  const remotos =
    codigosRemotosConhecidos ||
    (await buscarCodigosRemotosDaMedicao(medicao.local_id));
  const remotosPorCodigo = new Map(
    remotos.map((item) => [
      normalizarCodigoAmostra(item.codigo).toLocaleUpperCase("pt-BR"),
      item,
    ])
  );
  const remotosPorId = new Map(
    remotos.map((item) => [item.local_id, item])
  );
  const idsRemotosReservados = new Set(
    codigos
      .map((item) => item.local_id)
      .filter((localId) => remotosPorId.has(localId))
  );

  codigos = codigos.map((item, index) => {
    const remotoComMesmoId = remotosPorId.get(item.local_id);
    const remotoComMesmoCodigo = remotosPorCodigo.get(
      item.codigo.toLocaleUpperCase("pt-BR")
    );
    const podeAdotarIdPorCodigo =
      !remotoComMesmoId &&
      remotoComMesmoCodigo &&
      !idsRemotosReservados.has(remotoComMesmoCodigo.local_id);
    const remotoReconciliado =
      remotoComMesmoId ||
      (podeAdotarIdPorCodigo ? remotoComMesmoCodigo : null);

    if (remotoReconciliado) {
      idsRemotosReservados.add(remotoReconciliado.local_id);
    }

    return {
      ...item,
      local_id: remotoReconciliado?.local_id || item.local_id,
      ordem: index,
      criado_em:
        remotoReconciliado?.criado_em ||
        item.criado_em ||
        new Date().toISOString(),
    };
  });

  medicao.codigos_amostras = codigos;
  medicao.codigo_frascaria = obterCodigoPrincipal(codigos) || null;

  // Persiste IDs reconciliados antes das chamadas remotas. Em caso de falha,
  // a próxima tentativa reutiliza os mesmos IDs e permanece idempotente.
  await atualizarMedicaoLocal(medicao);

  if (codigos.length > 0) {
    const atualizadoEm = new Date().toISOString();
    const payload = codigos.map((item) => ({
      local_id: item.local_id,
      medicao_local_id: medicao.local_id,
      codigo: item.codigo,
      tipo: item.tipo,
      ordem: item.ordem,
      criado_em: item.criado_em,
      atualizado_em: atualizadoEm,
    }));
    await executarUpsertCodigos(payload, remotos);
  }

  const idsAtuais = new Set(codigos.map((item) => item.local_id));
  const idsRemovidos = remotos
    .map((item) => item.local_id)
    .filter((localId) => !idsAtuais.has(localId));

  if (idsRemovidos.length > 0) {
    const { data, error } = await supabaseClient
      .from("medicao_codigos")
      .delete()
      .eq("medicao_local_id", medicao.local_id)
      .in("local_id", idsRemovidos)
      .select("local_id");

    if (error) {
      throw erroSincronizacaoCodigos(
        "Erro ao remover códigos antigos da medição",
        error
      );
    }

    const idsExcluidos = new Set((data || []).map((item) => item.local_id));
    const exclusaoIncompleta = idsRemovidos.some(
      (localId) => !idsExcluidos.has(localId)
    );

    if (exclusaoIncompleta) {
      throw new Error(
        "O Supabase não confirmou a remoção de todos os códigos antigos. " +
          "A medição local foi preservada como pendente."
      );
    }
  }

  return codigos;
}

async function sincronizarMedicoes(somenteExclusoes = false) {
  const medicoes = await listarMedicoesParaSync();

  for (const medicao of medicoes) {
    /* ==========================
       EXCLUSÃO
    =========================== */

    if (medicao.excluido === true) {
      if (exclusaoRemotaNecessaria(medicao)) {
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
          console.info("Medição já não existia no Supabase; concluindo exclusão local.", medicao.local_id);
        }
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

      const codigos = obterCodigosDaMedicao(medicao);

      if (codigos.length > 0) {
        medicao.codigos_amostras = prepararCodigosAmostras(codigos);
        medicao.codigo_frascaria =
          obterCodigoPrincipal(medicao.codigos_amostras) || null;
        await atualizarMedicaoLocal(medicao);
      } else if (medicaoMarcadaManualmente(medicao)) {
        medicao.codigos_amostras = [];
      } else {
        throw new Error(
          `A medição ${medicao.local_id} não possui código de amostra válido.`
        );
      }

      // Consulta a tabela filha antes de alterar o pai. Se a migração ainda não
      // foi aplicada ou a RLS estiver incorreta, a tentativa para aqui sem
      // avançar o timestamp remoto da medição.
      const codigosRemotos = await buscarCodigosRemotosDaMedicao(
        medicao.local_id
      );
      const atualizadoEmRemoto = new Date().toISOString();

      const { data: medicaoRemota, error } = await supabaseClient
        .from("medicoes")
        .upsert(
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
          atualizado_em: atualizadoEmRemoto,

          duplicada_de: medicao.duplicada_de ?? null,

          excluido: false,
        },
        {
          onConflict: "local_id",
        }
        )
        .select("atualizado_em")
        .maybeSingle();

      if (error) {
        console.error(error);
        throw new Error("Erro ao sincronizar medição: " + error.message);
      }

      // O pai já foi gravado. Persistir esse timestamp como novo baseline evita
      // que uma falha posterior nos filhos pareça um conflito criado por outro
      // dispositivo na próxima tentativa.
      medicao.sincronizado = false;
      medicao.sincronizado_em =
        medicaoRemota?.atualizado_em || atualizadoEmRemoto;
      medicao.atualizado_em = atualizadoEmRemoto;
      await atualizarMedicaoLocal(medicao);

      await sincronizarCodigosDaMedicao(medicao, codigosRemotos);

      medicao.sincronizado = true;
      medicao.sincronizado_em =
        medicaoRemota?.atualizado_em || atualizadoEmRemoto;
      medicao.atualizado_em =
        medicaoRemota?.atualizado_em || atualizadoEmRemoto;

      await atualizarMedicaoLocal(medicao);
    }
  }
}

window.addEventListener("online", () => {
  sincronizarDados();
});

window.sincronizarDados = sincronizarDados;
window.baixarDadosSupabase = baixarDadosSupabase;
