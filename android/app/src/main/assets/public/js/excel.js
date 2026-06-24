async function exportarExcelMedicoes(medicoes, contexto = {}) {
  if (!window.XLSX) {
    alert("Biblioteca Excel não carregou. Verifique se libs/xlsx.full.min.js existe.");
    return;
  }

  if (!medicoes || medicoes.length === 0) {
    alert("Nenhuma medição selecionada.");
    return;
  }

  const projetos = contexto.projetos || await listarProjetosLocais();
  const pocos = contexto.pocos || await listarPocosLocais();
  const campanhas = contexto.campanhas || await listarCampanhasLocais();

  const dados = [];

  medicoes.forEach((medicao) => {
    const poco = pocos.find((p) => p.local_id === medicao.poco_local_id);
    const projeto = projetos.find((p) => p.local_id === poco?.projeto_local_id);
    const campanha = campanhas.find((c) => c.local_id === medicao.campanha_local_id);
    const c = medicao.condicoes_ambientais || {};
    const leituras = medicao.leituras && medicao.leituras.length > 0
      ? medicao.leituras
      : [{}];

    leituras.forEach((leitura, index) => {
      dados.push({
        projeto: projeto?.nome || "",
        processo_comercial: projeto?.processo_comercial || "",
        cliente: projeto?.cliente || "",
        local_projeto: projeto?.local || "",

        campanha: campanha?.nome || "",
        mes_referencia: medicao.mes_referencia || "",

        pm: poco?.nome || medicao.poco_nome || "",
        tipo_pm: poco?.tipo || "",
        local_propriedade: poco?.local_propriedade || "",

        codigo_frascaria: medicao.codigo_frascaria || "",
        responsavel_als: medicao.responsavel_als || medicao.coletor_nome || "",
        coletor: medicao.coletor_nome || "",

        data_medicao: medicao.data_medicao || "",

        utm_e: poco?.utm_e || "",
        utm_n: poco?.utm_n || "",
        zona_utm: poco?.zona_utm || "",
        hemisferio_utm: poco?.hemisferio_utm || "",
        latitude: poco?.latitude || "",
        longitude: poco?.longitude || "",

        profundidade_total_pm: poco?.profundidade_total || "",
        profundidade_total_mes: medicao.profundidade_total_mes || "",
        nivel_agua_na: medicao.nivel_agua || "",
        profundidade_bomba: medicao.profundidade_bomba || "",
        diametro: poco?.diametro || "",

        coluna_agua: medicao.coluna_agua || "",
        volume_estagnado_l: medicao.volume_estagnado || "",
        volume_esgotado_minimo_l: medicao.volume_purga || "",
        volume_esgotado_minimo_ml: medicao.volume_purga
          ? Math.round(Number(medicao.volume_purga) * 1000)
          : "",
        volume_total_esgotado_l: medicao.volume_total_esgotado || "",

        leitura_numero: index + 1,
        horario: leitura.horario || "",
        ph: leitura.ph || "",
        condutividade: leitura.condutividade || "",
        temperatura: leitura.temperatura || "",
        od: leitura.od || "",
        orp: leitura.orp || "",
        turbidez: leitura.turbidez || "",
        aspecto: leitura.aspecto || "",

        cor_agua: c.cor_agua || "",
        odor_agua: c.odor_agua || "",
        oleo_agua: c.oleo_agua || "",
        material_flutuante: c.material_flutuante || "",
        espuma: c.espuma_agua || "",
        chuva_24h: c.chuva_24h || "",
        temperatura_ambiente: c.temperatura_ambiente || "",
        observacoes: c.observacoes_gerais || "",

        sincronizado: medicao.sincronizado ? "Sim" : "Não",
        criado_em: medicao.criado_em || "",
        atualizado_em: medicao.atualizado_em || ""
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(dados);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Fichas");

  XLSX.writeFile(workbook, "fichas-selecionadas.xlsx");
}

async function exportarExcelSelecionadas() {
  if (typeof obterFichasSelecionadas !== "function") {
    alert("Abra a tela de exportação para selecionar as fichas.");
    return;
  }

  const fichas = obterFichasSelecionadas();

  if (fichas.length === 0) return;

  await exportarExcelMedicoes(fichas);
}

async function exportarExcel() {
  await exportarExcelSelecionadas();
}

window.exportarExcelMedicoes = exportarExcelMedicoes;
window.exportarExcelSelecionadas = exportarExcelSelecionadas;
window.exportarExcel = exportarExcel;