async function sincronizarDados() {
  if (!navigator.onLine) {
    alert("Você está offline. Os dados continuarão salvos no aparelho.");
    return;
  }

  const statusSync = document.getElementById("statusSync");

  if (statusSync) {
    statusSync.innerText = "Sincronizando...";
  }

  try {
    await sincronizarProjetos();
    await sincronizarPocos();
    await sincronizarCampanhas();
    await sincronizarMedicoes();

    await baixarDadosSupabase();

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

/* BAIXAR DADOS DA NUVEM */

async function baixarDadosSupabase() {
  if (!navigator.onLine) {
    alert("Você está offline. Conecte-se à internet para restaurar os dados.");
    return;
  }

  const statusSync = document.getElementById("statusSync");

  if (statusSync) {
    statusSync.innerText = "Baixando dados da nuvem...";
  }

  try {
    const totalProjetos = await baixarProjetosSupabase();
    const totalPocos = await baixarPocosSupabase();
    const totalCampanhas = await baixarCampanhasSupabase();
    const totalMedicoes = await baixarMedicoesSupabase();

    if (statusSync) {
      statusSync.innerText = "Dados restaurados com sucesso";
    }

    alert(
      "Dados restaurados com sucesso!\n\n" +
        `Projetos: ${totalProjetos}\n` +
        `PMs/Poços: ${totalPocos}\n` +
        `Campanhas: ${totalCampanhas}\n` +
        `Medições: ${totalMedicoes}`
    );

    atualizarTelasAposSync();
  } catch (error) {
    console.error(error);

    if (statusSync) {
      statusSync.innerText = "Erro ao restaurar dados";
    }

    alert("Erro ao restaurar dados da nuvem: " + error.message);
  }
}

async function baixarProjetosSupabase() {
  const { data, error } = await supabaseClient.from("projetos").select("*");

  if (error) {
    throw new Error("Erro ao baixar projetos: " + error.message);
  }

  for (const projeto of data || []) {
    await salvarProjetoLocal({
      ...projeto,
      sincronizado: true,
      sincronizado_em: new Date().toISOString(),
    });
  }
  return (data || []).length;
}

async function baixarPocosSupabase() {
  const { data, error } = await supabaseClient.from("pocos").select("*");

  if (error) {
    throw new Error("Erro ao baixar PMs: " + error.message);
  }

  for (const poco of data || []) {
    await salvarPocoLocal({
      ...poco,
      sincronizado: true,
      sincronizado_em: new Date().toISOString(),
    });
  }
  return (data || []).length;
}

async function baixarCampanhasSupabase() {
  const { data, error } = await supabaseClient.from("campanhas").select("*");

  if (error) {
    throw new Error("Erro ao baixar campanhas: " + error.message);
  }

  for (const campanha of data || []) {
    await salvarCampanhaLocal({
      ...campanha,
      sincronizado: true,
      sincronizado_em: new Date().toISOString(),
    });
  }
  return (data || []).length;
}

async function baixarMedicoesSupabase() {
  const { data, error } = await supabaseClient.from("medicoes").select("*");

  if (error) {
    throw new Error("Erro ao baixar medições: " + error.message);
  }

  for (const medicao of data || []) {
    await salvarMedicaoLocal({
      ...medicao,
      sincronizado: true,
      sincronizado_em: new Date().toISOString(),
    });
  }
  return (data || []).length;
}

/* PROJETOS */

async function sincronizarProjetos() {
  const projetos = await listarProjetosLocais();
  const pendentes = projetos.filter((p) => !p.sincronizado);

  for (const projeto of pendentes) {
    const { error } = await supabaseClient.from("projetos").upsert(
      {
        local_id: projeto.local_id,
        usuario_id: projeto.usuario_id,

        nome: projeto.nome,
        cliente: projeto.cliente,
        processo_comercial: projeto.processo_comercial || null,
        local: projeto.local,
        descricao: projeto.descricao,

        ativo: projeto.ativo !== false,

        criado_em: projeto.criado_em,
        atualizado_em: projeto.atualizado_em || null,
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

    await atualizarProjetoLocal(projeto);
  }
}

/* PMS / POÇOS */

async function sincronizarPocos() {
  const pocos = await listarPocosLocais();
  const pendentes = pocos.filter((p) => !p.sincronizado);

  for (const poco of pendentes) {
    const { error } = await supabaseClient.from("pocos").upsert(
      {
        local_id: poco.local_id,
        usuario_id: poco.usuario_id,

        projeto_local_id: poco.projeto_local_id || null,

        nome: poco.nome,
        tipo: poco.tipo,
        local_propriedade: poco.local_propriedade,

        utm_e: poco.utm_e,
        utm_n: poco.utm_n,
        zona_utm: poco.zona_utm || null,
        hemisferio_utm: poco.hemisferio_utm || null,

        latitude: poco.latitude || null,
        longitude: poco.longitude || null,
        precisao_gps: poco.precisao_gps || null,
        altitude_gps: poco.altitude_gps || null,
        gps_capturado_em: poco.gps_capturado_em || null,
        gps: poco.gps || null,

        profundidade_total: poco.profundidade_total || null,
        diametro: poco.diametro,
        perfil_construtivo: poco.perfil_construtivo || null,

        fotos: poco.fotos || [],

        ativo: poco.ativo !== false,

        criado_em: poco.criado_em,
        atualizado_em: poco.atualizado_em || null,
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

    await atualizarPocoLocal(poco);
  }
}

/* CAMPANHAS */

async function sincronizarCampanhas() {
  const campanhas = await listarCampanhasLocais();
  const pendentes = campanhas.filter((c) => !c.sincronizado);

  for (const campanha of pendentes) {
    const { error } = await supabaseClient.from("campanhas").upsert(
      {
        local_id: campanha.local_id,

        projeto_local_id: campanha.projeto_local_id,
        usuario_id: campanha.usuario_id,

        nome: campanha.nome,
        mes_referencia: campanha.mes_referencia,

        data_inicio: campanha.data_inicio || null,
        data_fim: campanha.data_fim || null,

        observacoes: campanha.observacoes,

        ativo: campanha.ativo !== false,

        criado_em: campanha.criado_em,
        atualizado_em: campanha.atualizado_em || null,
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

    await atualizarCampanhaLocal(campanha);
  }
}

/* MEDIÇÕES */

async function sincronizarMedicoes() {
  const medicoes = await listarMedicoesLocais();
  const pendentes = medicoes.filter((m) => !m.sincronizado);

  for (const medicao of pendentes) {
    const { error } = await supabaseClient.from("medicoes").upsert(
      {
        local_id: medicao.local_id,

        poco_local_id: medicao.poco_local_id,
        poco_nome: medicao.poco_nome,

        campanha_local_id: medicao.campanha_local_id || null,

        usuario_id: medicao.usuario_id,
        coletor_nome: medicao.coletor_nome,

        codigo_frascaria: medicao.codigo_frascaria || null,
        responsavel_als: medicao.responsavel_als || null,

        data_medicao: medicao.data_medicao || null,
        mes_referencia: medicao.mes_referencia,

        profundidade_total_mes: medicao.profundidade_total_mes || null,
        nivel_agua: medicao.nivel_agua || null,
        profundidade_bomba: medicao.profundidade_bomba || null,

        coluna_agua: medicao.coluna_agua || null,
        volume_estagnado: medicao.volume_estagnado || null,
        volume_purga: medicao.volume_purga || null,
        volume_total_esgotado: medicao.volume_total_esgotado || null,

        leituras: medicao.leituras || [],
        estabilizacao: medicao.estabilizacao || null,
        alertas: medicao.alertas || [],

        condicoes_ambientais: medicao.condicoes_ambientais || {},

        fotos: medicao.fotos || [],

        criado_em: medicao.criado_em,
        atualizado_em: medicao.atualizado_em || null,
        duplicada_de: medicao.duplicada_de || null,
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

    await atualizarMedicaoLocal(medicao);
  }
}

window.addEventListener("online", () => {
  sincronizarDados();
});

window.sincronizarDados = sincronizarDados;
window.baixarDadosSupabase = baixarDadosSupabase;
