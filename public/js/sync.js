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
    await sincronizarMedicoes();

    if (statusSync) {
      statusSync.innerText = "Sincronização finalizada";
    }

    alert("Dados sincronizados com o Supabase.");

    if (typeof carregarMedicoes === "function") {
      carregarMedicoes();
    }

    if (typeof carregarDashboard === "function") {
      carregarDashboard();
    }

  } catch (error) {
    console.error(error);

    if (statusSync) {
      statusSync.innerText = "Erro na sincronização";
    }

    alert("Erro ao sincronizar: " + error.message);
  }
}

/* SINCRONIZAR PROJETOS */

async function sincronizarProjetos() {
  const projetos = await listarProjetosLocais();
  const pendentes = projetos.filter((p) => !p.sincronizado);

  for (const projeto of pendentes) {
    const { error } = await supabaseClient
      .from("projetos")
      .upsert({
        local_id: projeto.local_id,
        usuario_id: projeto.usuario_id,
        nome: projeto.nome,
        cliente: projeto.cliente,
        local: projeto.local,
        descricao: projeto.descricao,
        ativo: projeto.ativo !== false,
        criado_em: projeto.criado_em,
        atualizado_em: projeto.atualizado_em || null
      }, {
        onConflict: "local_id"
      });

    if (error) {
      console.error(error);
      throw new Error("Erro ao sincronizar projeto: " + error.message);
    }

    projeto.sincronizado = true;
    projeto.sincronizado_em = new Date().toISOString();

    await atualizarProjetoLocal(projeto);
  }
}

/* SINCRONIZAR POÇOS */

async function sincronizarPocos() {
  const pocos = await listarPocosLocais();
  const pendentes = pocos.filter((p) => !p.sincronizado);

  for (const poco of pendentes) {
    const { error } = await supabaseClient
      .from("pocos")
      .upsert({
        local_id: poco.local_id,
        usuario_id: poco.usuario_id,
        projeto_local_id: poco.projeto_local_id || null,

        nome: poco.nome,
        tipo: poco.tipo,
        local_propriedade: poco.local_propriedade,

        utm_e: poco.utm_e,
        utm_n: poco.utm_n,
        latitude: poco.latitude || null,
        longitude: poco.longitude || null,

        profundidade_total: poco.profundidade_total || null,
        diametro: poco.diametro,

        fotos: poco.fotos || [],

        ativo: poco.ativo !== false,
        criado_em: poco.criado_em,
        atualizado_em: poco.atualizado_em || null
      }, {
        onConflict: "local_id"
      });

    if (error) {
      console.error(error);
      throw new Error("Erro ao sincronizar PM: " + error.message);
    }

    poco.sincronizado = true;
    poco.sincronizado_em = new Date().toISOString();

    await atualizarPocoLocal(poco);
  }
}

/* SINCRONIZAR MEDIÇÕES */

async function sincronizarMedicoes() {
  const medicoes = await listarMedicoesLocais();
  const pendentes = medicoes.filter((m) => !m.sincronizado);

  for (const medicao of pendentes) {
    const { error } = await supabaseClient
      .from("medicoes")
      .upsert({
        local_id: medicao.local_id,
        poco_local_id: medicao.poco_local_id,
        poco_nome: medicao.poco_nome,

        usuario_id: medicao.usuario_id,
        coletor_nome: medicao.coletor_nome,

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
        condicoes_ambientais: medicao.condicoes_ambientais || {},
        fotos: medicao.fotos || [],

        criado_em: medicao.criado_em,
        atualizado_em: medicao.atualizado_em || null
      }, {
        onConflict: "local_id"
      });

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