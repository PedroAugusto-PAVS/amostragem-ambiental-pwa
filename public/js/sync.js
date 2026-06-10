async function sincronizarDados() {
  if (!navigator.onLine) {
    alert("Você está offline. Os dados continuarão salvos no aparelho.");
    return;
  }

  const statusSync = document.getElementById("statusSync");

  if (statusSync) {
    statusSync.innerText = "Sincronizando...";
  }

  const fichas = await listarFichasLocais();
  const pendentes = fichas.filter((ficha) => !ficha.sincronizado);

  if (pendentes.length === 0) {
    if (statusSync) {
      statusSync.innerText = "Nada pendente";
    }

    alert("Nenhuma ficha pendente.");
    return;
  }

  for (const ficha of pendentes) {
    const { error } = await supabaseClient.from("fichas_campo").insert({
      local_id: ficha.local_id,
      usuario_id: ficha.usuario_id,
      coletor_nome: ficha.coletor_nome,

      tipo_poco: ficha.tipo_poco,
      nome_poco: ficha.nome_poco,
      local_propriedade: ficha.local_propriedade,

      utm_e: ficha.utm_e,
      utm_n: ficha.utm_n,
      gps: ficha.gps,
      latitude: ficha.latitude,
      longitude: ficha.longitude,

      profundidade_total: ficha.profundidade_total,
      nivel_agua: ficha.nivel_agua,
      profundidade_bomba: ficha.profundidade_bomba,

      coluna_agua: ficha.coluna_agua,
      volume_estagnado: ficha.volume_estagnado,
      volume_purga: ficha.volume_purga,

      leituras: ficha.leituras,
      condicoes_ambientais: ficha.condicoes_ambientais,

      foto_base64: ficha.foto_base64,
      criado_em: ficha.criado_em,
    });

    if (!error) {
      ficha.sincronizado = true;
      await atualizarFichaLocal(ficha);
    } else {
      console.error(error);
      alert("Erro ao sincronizar: " + error.message);
    }
  }

  if (statusSync) {
    statusSync.innerText = "Sincronização finalizada";
  }

  alert("Dados sincronizados com o Supabase.");

  if (typeof carregarMedicoes === "function") {
    carregarMedicoes();
  }
}

window.addEventListener("online", () => {
  sincronizarDados();
});
