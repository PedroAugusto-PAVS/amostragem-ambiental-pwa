function texto(valor) {
  if (valor === null || valor === undefined || valor === "") return "-";
  return String(valor);
}

function num(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  return Number(String(valor).replace(",", "."));
}

function fix(valor, casas = 2) {
  const n = num(valor);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(casas);
}

function calcularFaixasAceitacao(leituras) {
  if (!leituras || leituras.length === 0) return null;

  const ref = leituras[0];

  const ph = num(ref.ph);
  const orp = num(ref.orp);
  const cond = num(ref.condutividade);
  const od = num(ref.od);
  const temp = num(ref.temperatura);

  return {
    phMin: ph ? ph - 0.2 : null,
    phMax: ph ? ph + 0.2 : null,

    orpMin: orp ? orp - 20 : null,
    orpMax: orp ? orp + 20 : null,

    condMin: cond ? cond * 0.95 : null,
    condMax: cond ? cond * 1.05 : null,

    odMin: od ? od * 0.9 : null,
    odMax: od ? od * 1.1 : null,

    tempMin: temp ? temp - 0.5 : null,
    tempMax: temp ? temp + 0.5 : null,
  };
}

function faixaTexto(min, max, unidade = "") {
  if (min === null || max === null) return "-";
  return `${min.toFixed(2)} a ${max.toFixed(2)}${unidade}`;
}

async function imprimirFichaMedicao(medicaoLocalId) {
  const pocos = await listarPocosLocais();
  const medicoes = await listarMedicoesLocais();
  const projetos = await listarProjetosLocais();

  const medicao = medicoes.find((m) => m.local_id === medicaoLocalId);

  if (!medicao) {
    alert("Medição não encontrada.");
    return;
  }

  const poco = pocos.find((p) => p.local_id === medicao.poco_local_id);
  const projeto = projetos.find((p) => p.local_id === poco?.projeto_local_id);
  const cond = medicao.condicoes_ambientais || {};
  const leituras = medicao.leituras || [];
  const faixas = calcularFaixasAceitacao(leituras);

  const jsPDF = window.jspdf?.jsPDF || window.jsPDF || window.jspdf;

  if (!jsPDF) {
    alert("Biblioteca PDF não carregada.");
    return;
  }

  const doc = new jsPDF("l", "mm", "a4");

  function box(x, y, w, h) {
    doc.rect(x, y, w, h);
  }

  function line(x1, y1, x2, y2) {
    doc.line(x1, y1, x2, y2);
  }

  function txt(text, x, y, size = 7, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(String(text || ""), x, y);
  }

  function center(text, x, y, w, size = 8, bold = true) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(String(text || ""), x + w / 2, y, { align: "center" });
  }

  function labelValor(label, valor, x, y, wLabel = 25, size = 7) {
    txt(label, x, y, size, true);
    txt(texto(valor), x + wLabel, y, size, false);
  }

  function volumePurgaMl(valorLitros) {
    const litros = num(valorLitros);
    if (!litros) return "-";
    return `${Math.round(litros * 1000)} mL`;
  }

  const margem = 8;
  const largura = 281;
  let y = 8;

  doc.setLineWidth(0.2);

  /* CABEÇALHO */
  box(margem, y, largura, 18);
  line(38, y, 38, y + 18);
  line(205, y, 205, y + 18);

  txt("ALS", 16, y + 11, 12, true);
  center("FICHA DE CAMPO", 38, y + 11, 167, 14, true);
  txt("REN-AMS-009", 212, y + 7, 8, true);
  txt("Rev: 00", 212, y + 12, 7);
  txt("REFERÊNCIA: POP 139", 245, y + 12, 7);

  y += 18;

  /* DADOS DO PROJETO */
  box(margem, y, 190, 38);
  line(margem, y + 7, margem + 190, y + 7);
  line(margem, y + 14, margem + 190, y + 14);
  line(margem, y + 21, margem + 190, y + 21);
  line(margem, y + 28, margem + 190, y + 28);

  labelValor("Cliente:", projeto?.cliente, 10, y + 5);
  labelValor("Local:", projeto?.local || poco?.local_propriedade, 10, y + 12);
  labelValor("Projeto:", projeto?.nome, 10, y + 19);
  labelValor(
    "Processo Comercial:",
    projeto?.processo_comercial,
    10,
    y + 26,
    40
  );
  labelValor(
    "Responsável ALS:",
    medicao.responsavel_als || medicao.coletor_nome,
    10,
    y + 33,
    38
  );
  labelValor("Resp. Cliente:", "-", 112, y + 33, 28);

  /* DADOS DO POÇO */
  box(198, y, 91, 38);
  line(198, y + 9.5, 289, y + 9.5);
  line(198, y + 19, 289, y + 19);
  line(198, y + 28.5, 289, y + 28.5);

  labelValor("DIÂMETRO:", `${texto(poco?.diametro)} cm`, 202, y + 6, 28);
  labelValor(
    "NÍVEL ESTÁTICO:",
    `${texto(medicao.nivel_agua)} m`,
    202,
    y + 16,
    36
  );
  labelValor(
    "COLUNA D'ÁGUA:",
    `${texto(medicao.coluna_agua)} m`,
    202,
    y + 25,
    36
  );
  labelValor(
    "PROFUNDIDADE:",
    `${texto(poco?.profundidade_total || medicao.profundidade_total_mes)} m`,
    202,
    y + 35,
    34
  );

  y += 38;

  /* IDENTIFICAÇÃO */
  box(margem, y, largura, 22);
  line(margem, y + 11, margem + largura, y + 11);
  line(100, y, 100, y + 22);
  line(190, y, 190, y + 22);
  line(240, y, 240, y + 22);

  labelValor(
    "Identificação do PM:",
    poco?.nome || medicao.poco_nome,
    10,
    y + 7,
    38
  );
  labelValor("Código ALS:", medicao.codigo_frascaria, 10, y + 18, 28);

  labelValor("Data da Amostragem:", medicao.data_medicao, 105, y + 7, 42);
  labelValor(
    "Prof. da Amostragem:",
    `${texto(medicao.profundidade_bomba)} m`,
    105,
    y + 18,
    43
  );

  labelValor(
    "Vol. Estagnado:",
    `${texto(medicao.volume_estagnado)} L`,
    195,
    y + 7,
    32
  );
  labelValor(
    "Vol. Total Esgotado:",
    `${texto(medicao.volume_total_esgotado)} L`,
    195,
    y + 18,
    42
  );

  labelValor(
    "Vol. Esg. Mín:",
    volumePurgaMl(medicao.volume_purga),
    243,
    y + 7,
    30
  );

  y += 22;

  /* TÍTULO TABELA */
  box(margem, y, largura, 8);
  center(
    "Parâmetros de Estabilização de Coleta - Medidas de Campo",
    margem,
    y + 5.5,
    largura,
    8,
    true
  );

  y += 8;

  /* TABELA DE LEITURAS */
  const colunas = [
    { t: "Hora", x: 8, w: 22 },
    { t: "Nível\nEstático\n(m)", x: 30, w: 23 },
    { t: "Condut.\n(µS/cm)", x: 53, w: 25 },
    { t: "OD\n(mg/L)", x: 78, w: 22 },
    { t: "pH", x: 100, w: 18 },
    { t: "Redox\n(mV)", x: 118, w: 25 },
    { t: "Temp.\n(°C)", x: 143, w: 22 },
    { t: "Turb.\n(NTU)", x: 165, w: 22 },
    { t: "Aspecto\n(L/T)", x: 187, w: 25 },
    { t: "Características", x: 212, w: 77 },
  ];

  const headerY = y;
  colunas.forEach((c) => {
    box(c.x, headerY, c.w, 13);
    center(c.t, c.x, headerY + 5, c.w, 6, true);
  });

  y += 13;

  for (let i = 0; i < 4; i++) {
    const l = leituras[i] || {};
    colunas.forEach((c) => box(c.x, y, c.w, 8));

    txt(texto(l.horario), 10, y + 5, 6);
    txt(texto(medicao.nivel_agua), 33, y + 5, 6);
    txt(texto(l.condutividade), 56, y + 5, 6);
    txt(texto(l.od), 82, y + 5, 6);
    txt(texto(l.ph), 104, y + 5, 6);
    txt(texto(l.orp), 122, y + 5, 6);
    txt(texto(l.temperatura), 147, y + 5, 6);
    txt(texto(l.turbidez), 169, y + 5, 6);
    txt(texto(l.aspecto), 190, y + 5, 6);

    const caracteristicas = [
      `Poço com CAP? ${texto(cond.poco_com_cap || "-")}`,
      `Odor: ${texto(cond.odor_agua)}`,
      `Óleo: ${texto(cond.oleo_agua)}`,
      `Espuma: ${texto(cond.espuma_agua)}`,
      `Cor: ${texto(cond.cor_agua)}`,
      `Chuva 24h: ${texto(cond.chuva_24h)}`,
      `Material flutuante: ${texto(cond.material_flutuante)}`,
    ];

    txt(caracteristicas[i] || "-", 215, y + 5, 6);

    y += 8;
  }

  y += 2;

  /* FAIXAS DE ACEITAÇÃO */
  box(margem, y, largura, 28);
  line(margem, y + 8, margem + largura, y + 8);
  line(margem, y + 18, margem + largura, y + 18);

  center(
    "Faixas de Aceitação da Estabilização calculadas pela 1ª leitura",
    margem,
    y + 5.5,
    largura,
    7,
    true
  );

  txt("pH:", 10, y + 14, 6, true);
  txt(faixas ? faixaTexto(faixas.phMin, faixas.phMax) : "-", 20, y + 14, 6);

  txt("ORP:", 62, y + 14, 6, true);
  txt(
    faixas ? faixaTexto(faixas.orpMin, faixas.orpMax, " mV") : "-",
    75,
    y + 14,
    6
  );

  txt("Cond.:", 120, y + 14, 6, true);
  txt(
    faixas ? faixaTexto(faixas.condMin, faixas.condMax) : "-",
    138,
    y + 14,
    6
  );

  txt("OD:", 190, y + 14, 6, true);
  txt(faixas ? faixaTexto(faixas.odMin, faixas.odMax) : "-", 202, y + 14, 6);

  txt("Temp.:", 238, y + 14, 6, true);
  txt(
    faixas ? faixaTexto(faixas.tempMin, faixas.tempMax, " °C") : "-",
    255,
    y + 14,
    6
  );

  txt("Critérios:", 10, y + 24, 6, true);
  txt(
    "pH ±0,2 | ORP ±20 mV | Condutividade ±5% | OD ±10% | Temperatura ±0,5 °C",
    32,
    y + 24,
    6
  );

  y += 31;

  /* RESUMO E OBSERVAÇÕES */
  box(margem, y, largura, 24);
  line(margem, y + 8, margem + largura, y + 8);
  line(margem, y + 16, margem + largura, y + 16);
  line(98, y, 98, y + 16);
  line(198, y, 198, y + 16);

  labelValor("Hora Inicial da Purga:", leituras[0]?.horario, 10, y + 5, 42);
  labelValor(
    "Hora Final da Amostragem:",
    leituras[leituras.length - 1]?.horario,
    105,
    y + 5,
    50
  );
  labelValor("Diâmetro:", `${texto(poco?.diametro)} cm`, 205, y + 5, 22);

  labelValor(
    "Coluna d'água:",
    `${texto(medicao.coluna_agua)} m`,
    10,
    y + 13,
    34
  );
  labelValor(
    "Volume estagnado:",
    `${texto(medicao.volume_estagnado)} L`,
    105,
    y + 13,
    38
  );
  labelValor(
    "Volume total esgotado:",
    `${texto(medicao.volume_total_esgotado)} L`,
    205,
    y + 13,
    45
  );

  txt("Observações:", 10, y + 21, 6, true);
  const obs = doc.splitTextToSize(texto(cond.observacoes_gerais), 245);
  doc.text(obs, 35, y + 21);

  y += 28;

  /* ASSINATURAS */
  box(margem, y, largura, 26);
  line(margem, y + 8, margem + largura, y + 8);
  center("Assinaturas", margem, y + 5.5, largura, 7, true);

  txt("Responsável ALS:", 14, y + 16, 7, true);
  line(50, y + 16, 135, y + 16);
  txt(texto(medicao.responsavel_als || medicao.coletor_nome), 52, y + 21, 6);

  txt("Responsável Cliente:", 150, y + 16, 7, true);
  line(190, y + 16, 280, y + 16);
  txt("Nome/Assinatura", 210, y + 21, 6);

  const nomeArquivo = `ficha-${poco?.nome || medicao.poco_nome || "pm"}-${
    medicao.mes_referencia || "medicao"
  }.pdf`
    .replaceAll(" ", "-")
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .replaceAll(":", "-");

    try {
      const pdfBase64 = doc.output("datauristring");
      const base64Data = pdfBase64.split(",")[1];
    
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    
        const { Filesystem } = window.Capacitor.Plugins;
    
        await Filesystem.requestPermissions();
    
        const resultado = await Filesystem.writeFile({
          path: nomeArquivo,
          data: base64Data,
          directory: "Documents"
        });
    
        await window.Capacitor.Plugins.Share.share({
          title: "Ficha de Campo",
          text: "Ficha de Campo Ambiental",
          url: resultado.uri,
          dialogTitle: "Compartilhar ficha"
        });
    
      } else {
        doc.save(nomeArquivo);
      }
    
    } catch (erro) {
    console.error("Erro ao gerar PDF:", erro);
    alert("Erro ao gerar PDF: " + erro.message);
  }
}

window.imprimirFichaMedicao = imprimirFichaMedicao;
