function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = reject;

    img.src = src;
  });
}

function texto(valor) {
  if (valor === null || valor === undefined || valor === "") return "-";
  return String(valor);
}

function num(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  return Number(String(valor).replace(",", "."));
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
    tempMax: temp ? temp + 0.5 : null
  };
}

function faixaTexto(min, max, unidade = "") {
  if (min === null || max === null) return "-";
  return `${min.toFixed(2)} a ${max.toFixed(2)}${unidade}`;
}

async function imprimirFichaMedicaoFiscal(medicaoLocalId) {
  const logo = await carregarImagem("icons/hydrotrack_logo.png");
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
  const codigosAmostras =
    typeof obterCodigosDaMedicao === "function"
      ? obterCodigosDaMedicao(medicao)
      : [];
  const codigoAlsPrincipal =
    typeof obterCodigoPrincipal === "function"
      ? obterCodigoPrincipal(codigosAmostras)
      : medicao.codigo_frascaria;
  const codigosAls = [
    codigoAlsPrincipal,
    ...codigosAmostras
      .filter((item) => item.tipo === "duplicata")
      .map((item) => item.codigo),
  ]
    .filter(
      (codigo, indice, codigos) =>
        codigo && codigos.indexOf(codigo) === indice
    )
    .join(" / ") || medicao.codigo_frascaria;
  const temDuplicata = codigosAmostras.some(
    (item) => item.tipo === "duplicata"
  );
  const nomePoco = texto(poco?.nome || medicao.poco_nome);
  const identificacaoPoco =
    temDuplicata && !/\bDUPL\b/i.test(nomePoco)
      ? `${nomePoco} e DUPL`
      : nomePoco;

  const jsPDF = window.jspdf?.jsPDF || window.jsPDF || window.jspdf;

  if (!jsPDF) {
    alert("Biblioteca PDF não carregada.");
    return;
  }

  const doc = new jsPDF("p", "mm", "a4");

  function box(x, y, w, h) {
    doc.rect(x, y, w, h);
  }

  function line(x1, y1, x2, y2) {
    doc.line(x1, y1, x2, y2);
  }

  function txt(text, x, y, size = 6.5, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(String(text || ""), x, y);
  }

  function center(text, x, y, w, size = 7, bold = true) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(String(text || ""), x + w / 2, y, { align: "center" });
  }

  function labelValor(label, valor, x, y, wLabel = 32, size = 6.2) {
    txt(label, x, y, size, true);
    txt(texto(valor), x + wLabel, y, size, false);
  }

  function labelValorMultilinha(
    label,
    valor,
    x,
    y,
    wLabel = 32,
    size = 6.2,
    maxWidth = 35
  ) {
    txt(label, x, y, size, true);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);

    const linhas = doc.splitTextToSize(texto(valor), maxWidth);
    const alturaLinha = size * (25.4 / 72) * 1.05;
    const deslocamento = ((linhas.length - 1) * alturaLinha) / 2;

    doc.text(linhas, x + wLabel, y - deslocamento, {
      lineHeightFactor: 1.05,
    });
  }

  function adicionarCodigosAmostras(yInicial) {
    const codigos = codigosAmostras;
    if (codigos.length === 0) return;

    const itensPrimeiraPagina = 8;
    const codigosPrimeiraPagina = codigos.slice(0, itensPrimeiraPagina);

    txt("Códigos das amostras", margem, yInicial, 7, true);
    codigosPrimeiraPagina.forEach((item, indice) => {
      const tipo =
        typeof formatarTipoCodigoAmostra === "function"
          ? formatarTipoCodigoAmostra(item.tipo)
          : texto(item.tipo);
      const coluna = indice % 2;
      const linha = Math.floor(indice / 2);
      txt(
        `${indice + 1}. ${texto(item.codigo)} - ${tipo}`,
        margem + coluna * 97,
        yInicial + 7 + linha * 6,
        6
      );
    });

    const itensPorPagina = 24;

    for (
      let inicio = itensPrimeiraPagina;
      inicio < codigos.length;
      inicio += itensPorPagina
    ) {
      doc.addPage();
      txt("Códigos das amostras", margem, 18, 12, true);
      txt(
        `${identificacaoPoco} - ${texto(medicao.data_medicao)}`,
        margem,
        25,
        7
      );

      codigos
        .slice(inicio, inicio + itensPorPagina)
        .forEach((item, indice) => {
          const tipo =
            typeof formatarTipoCodigoAmostra === "function"
              ? formatarTipoCodigoAmostra(item.tipo)
              : texto(item.tipo);
          txt(
            `${inicio + indice + 1}. ${texto(item.codigo)} - ${tipo}`,
            margem,
            35 + indice * 9,
            7
          );
        });
    }
  }

  const margem = 8;
  const largura = 194;
  let y = 8;

  doc.setLineWidth(0.2);



  /* CABEÇALHO */
  box(margem, y, largura, 20);
  line(35, y, 35, y + 20);
  line(150, y, 150, y + 20);
try {
  doc.addImage(
    logo,
    "PNG",
    10,
    y + 2,
    22,
    14
  );
} catch (e) {
  console.error("Erro ao inserir logo:", e);
}
  // txt("HT", 17, y + 12, 11, true);
  center("FICHA DE FISCALIZAÇÃO", 35, y + 12, 115, 13, true);
  txt("HYDROTRACK", 154, y + 7, 7, true);
txt("Rev: 01", 154, y + 12, 6);
txt("Ficha Fiscal", 170, y + 12, 5.5);

  y += 20;

  /* DADOS DO PROJETO */
  box(margem, y, largura, 36);
  line(145, y, 145, y + 36);

  for (let i = 7; i < 36; i += 7) {
    line(margem, y + i, 145, y + i);
  }

  line(145, y + 9, margem + largura, y + 9);
  line(145, y + 18, margem + largura, y + 18);
  line(145, y + 27, margem + largura, y + 27);

  labelValor("Cliente:", projeto?.cliente, 10, y + 5, 25);
  labelValor("Local:", projeto?.local || poco?.local_propriedade, 10, y + 12, 25);
  labelValor("Projeto:", projeto?.nome, 10, y + 19, 25);
  labelValor("Proc. Comercial:", projeto?.processo_comercial, 10, y + 26, 35);
  labelValor("Responsável Pela Coleta:"," ", 10, y + 33, 38);
  labelValor("Fiscal Responsável:", " ", 85, y + 33, 30);

  labelValor("DIÂMETRO:", `${texto(poco?.diametro)} cm`, 148, y + 6, 26, 5.8);
  labelValor("NÍVEL ESTÁTICO:", `${texto(medicao.nivel_agua)} m`, 148, y + 15, 35, 5.8);
  labelValor("COLUNA D'ÁGUA:", `${texto(medicao.coluna_agua)} m`, 148, y + 24, 35, 5.8);
  labelValor(
    "PROFUNDIDADE:",
    `${texto(poco?.profundidade_total || medicao.profundidade_total_mes)} m`,
    148,
    y + 33,
    34,
    5.8
  );

  y += 36;

  /* IDENTIFICAÇÃO */
  box(margem, y, largura, 24);
  line(margem, y + 12, margem + largura, y + 12);
  line(75, y, 75, y + 24);
  line(135, y, 135, y + 24);

  labelValor("Identificação do PM:", identificacaoPoco, 10, y + 8, 38, 6);
  labelValorMultilinha("Código ALS:", codigosAls, 10, y + 20, 28, 6, 35);

  labelValor("Data Amostragem:", medicao.data_medicao, 78, y + 8, 34, 6);
  labelValor("Prof. Bomba:", `${texto(medicao.profundidade_bomba)} m`, 78, y + 20, 28, 6);

  labelValor("Vol. Estagnado:", `${texto(medicao.volume_estagnado)} L`, 138, y + 7, 32, 5.6);
  labelValor("Vol. Esg. Mín:", `${texto(medicao.volume_purga)} L`, 138, y + 15, 30, 5.6);
  labelValor("Vol. Total:", `${texto(medicao.volume_total_esgotado)} L`, 138, y + 22, 25, 5.6);

  y += 24;

  /* TÍTULO DA TABELA */
  box(margem, y, largura, 8);
  center("Parâmetros de Estabilização de Coleta - Medidas de Campo", margem, y + 5.5, largura, 7, true);

  y += 8;

  /* TABELA */
  const colunas = [
    { t: "Hora", x: 8, w: 18 },
    { t: "Nível\nEstático\n(m)", x: 26, w: 22 },
    { t: "Condut.\n(µS/cm)", x: 48, w: 22 },
    { t: "OD\n(mg/L)", x: 70, w: 18 },
    { t: "pH", x: 88, w: 14 },
    { t: "Redox\n(mV)", x: 102, w: 20 },
    { t: "Temp.\n(°C)", x: 122, w: 18 },
    { t: "Turb.\n(NTU)", x: 140, w: 20 },
    { t: "Aspecto", x: 160, w: 20 },
    { t: "Características", x: 180, w: 22 }
  ];

  colunas.forEach((c) => {
    box(c.x, y, c.w, 15);
    center(c.t, c.x, y + 5, c.w, 4.8, true);
  });

  y += 15;

  const caracteristicas = [
    `CAP? ${texto(poco?.poco_com_cap || "-")}`,
    `Odor: ${texto(cond.odor_agua)}`,
    `Óleo: ${texto(cond.oleo_agua)}`,
    `Espuma: ${texto(cond.espuma_agua)}`
  ];

  for (let i = 0; i < 4; i++) {
    const l = leituras[i] || {};

    colunas.forEach((c) => box(c.x, y, c.w, 10));

    txt(texto(l.horario), 10, y + 6, 5.2);
    txt(texto(l.nivel_agua || medicao.nivel_agua), 28, y + 6, 5.2);
    txt(texto(l.condutividade), 50, y + 6, 5.2);
    txt(texto(l.od), 72, y + 6, 5.2);
    txt(texto(l.ph), 91, y + 6, 5.2);
    txt(texto(l.orp), 105, y + 6, 5.2);
    txt(texto(l.temperatura), 125, y + 6, 5.2);
    txt(texto(l.turbidez), 143, y + 6, 5.2);
    txt(texto(l.aspecto), 162, y + 6, 5);
    txt(caracteristicas[i] || "-", 181, y + 6, 4.7);

    y += 10;
  }

  y += 3;

  /* FAIXAS */
  box(margem, y, largura, 35);
  line(margem, y + 8, margem + largura, y + 8);
  line(margem, y + 21, margem + largura, y + 21);

  center("Faixas de Aceitação da Estabilização calculadas pela 1ª leitura", margem, y + 5.5, largura, 6.5, true);

  txt("pH:", 10, y + 15, 5.4, true);
  txt(faixas ? faixaTexto(faixas.phMin, faixas.phMax) : "-", 20, y + 15, 5.2);

  txt("ORP:", 50, y + 15, 5.4, true);
  txt(faixas ? faixaTexto(faixas.orpMin, faixas.orpMax, " mV") : "-", 64, y + 15, 5.2);

  txt("Cond.:", 105, y + 15, 5.4, true);
  txt(faixas ? faixaTexto(faixas.condMin, faixas.condMax) : "-", 122, y + 15, 5.2);

  txt("OD:", 10, y + 20, 5.4, true);
  txt(faixas ? faixaTexto(faixas.odMin, faixas.odMax) : "-", 20, y + 20, 5.2);

  txt("Temp.:", 50, y + 20, 5.4, true);
  txt(faixas ? faixaTexto(faixas.tempMin, faixas.tempMax, " °C") : "-", 65, y + 20, 5.2);

  txt("Critérios:", 10, y + 28, 5.4, true);
  txt("pH ±0,2 | ORP ±20 mV | Condutividade ±5% | OD ±10% | Temperatura ±0,5 °C", 32, y + 28, 5.2);

  y += 35;

  /* RESUMO */
  box(margem, y, largura, 24);
  line(margem, y + 8, margem + largura, y + 8);
  line(margem, y + 16, margem + largura, y + 16);
  line(75, y, 75, y + 16);
  line(140, y, 140, y + 16);

  labelValor("Hora Inicial:", leituras[0]?.horario, 10, y + 5, 28, 5.6);
  labelValor("Hora Final:", leituras[3]?.horario || leituras[leituras.length - 1]?.horario, 78, y + 5, 25, 5.6);
  labelValor("Diâmetro:", `${texto(poco?.diametro)} cm`, 143, y + 5, 22, 5.6);

  txt("Observações:", 10, y + 21, 5.6, true);
  const obs = doc.splitTextToSize(texto(cond.observacoes_gerais), 160);
  doc.text(obs, 35, y + 21);

  y += 28;

  /* ASSINATURAS */
  box(margem, y, largura, 34);
  line(margem, y + 8, margem + largura, y + 8);
  center("Assinaturas", margem, y + 5.5, largura, 6.5, true);

  txt("Fiscal Responsável:", 12, y + 22, 6, true);
  line(48, y + 22, 95, y + 22);
  txt("Assinatura", 50, y + 27, 5.4);

  txt("Responsável Pela Coleta:", 110, y + 22, 6, true);
  line(152, y + 22, 195, y + 22);
  txt("Assinatura", 158, y + 27, 5.4);

  adicionarCodigosAmostras(y + 40);

  const nomeArquivo = `ficha-${poco?.nome || medicao.poco_nome || "pm"}-${medicao.mes_referencia || "medicao"}.pdf`
    .replaceAll(" ", "-")
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .replaceAll(":", "-");

  try {
    const pdfBase64 = doc.output("datauristring");
    const base64Data = pdfBase64.split(",")[1];

    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const { Filesystem, Share } = window.Capacitor.Plugins;

      await Filesystem.writeFile({
        path: `fichas/${nomeArquivo}`,
        data: base64Data,
        directory: "CACHE",
        recursive: true
      });

      const arquivo = await Filesystem.getUri({
        path: `fichas/${nomeArquivo}`,
        directory: "CACHE"
      });

      await Share.share({
        title: "Ficha de Campo",
        text: "Ficha de Campo Ambiental",
        url: arquivo.uri,
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

window.imprimirFichaMedicaoFiscal = imprimirFichaMedicaoFiscal;
