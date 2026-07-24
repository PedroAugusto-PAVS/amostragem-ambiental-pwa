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
  const codigosAmostras = obterCodigosDaMedicao(medicao);

  const jsPDF = window.jspdf?.jsPDF || window.jsPDF || window.jspdf;

  if (!jsPDF) {
    alert("Biblioteca PDF não carregada.");
    return;
  }

  const doc = new jsPDF("p", "mm", "a4");
  const fontes = {
    titulo: 17,
    secao: 12,
    metadado: 9,
    campo: 10,
    campoCompacto: 10,
    tabela: 10,
    rodape: 9
  };
  const mmPorPonto = 25.4 / 72;

  function box(x, y, w, h) {
    doc.rect(x, y, w, h);
  }

  function line(x1, y1, x2, y2) {
    doc.line(x1, y1, x2, y2);
  }

  function definirFonte(size, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
  }

  function txt(text, x, y, size = fontes.campo, bold = false) {
    definirFonte(size, bold);
    doc.text(String(text || ""), x, y);
  }

  function linhasTexto(valor, maxWidth, size, bold = false) {
    definirFonte(size, bold);
    return doc.splitTextToSize(texto(valor), maxWidth);
  }

  function center(text, x, y, w, size = fontes.secao, bold = true) {
    const linhas = linhasTexto(text, w - 4, size, bold);
    doc.text(linhas, x + w / 2, y, {
      align: "center",
      lineHeightFactor: 1.05
    });
  }

  function labelValor(
    label,
    valor,
    x,
    yTexto,
    wLabel = 32,
    size = fontes.campo,
    maxWidth = null
  ) {
    txt(label, x, yTexto, size, true);
    const valorX = x + wLabel;

    if (!maxWidth) {
      txt(texto(valor), valorX, yTexto, size, false);
      return [texto(valor)];
    }

    const linhas = linhasTexto(valor, maxWidth, size, false);
    doc.text(linhas, valorX, yTexto, { lineHeightFactor: 1.05 });
    return linhas;
  }

  const margem = 8;
  const largura = 194;
  const alturaPagina =
    typeof doc.internal.pageSize.getHeight === "function"
      ? doc.internal.pageSize.getHeight()
      : doc.internal.pageSize.height;
  const limiteInferior = alturaPagina - margem;
  let y = margem;

  function novaPagina() {
    doc.addPage();
    y = margem;
  }

  function garantirEspaco(alturaNecessaria) {
    if (y + alturaNecessaria > limiteInferior) novaPagina();
  }

  doc.setLineWidth(0.2);

  /* CABEÇALHO */
  const alturaCabecalho = 24;
  box(margem, y, largura, alturaCabecalho);
  line(35, y, 35, y + alturaCabecalho);
  line(150, y, 150, y + alturaCabecalho);

  try {
    doc.addImage(logo, "PNG", 10, y + 2, 22, 14);
  } catch (e) {
    console.error("Erro ao inserir logo:", e);
  }

  center("FICHA DE FISCALIZAÇÃO", 35, y + 15, 115, fontes.titulo, true);
  txt("HYDROTRACK", 154, y + 6.5, fontes.metadado, true);
  txt("Rev: 01", 154, y + 12.5, fontes.metadado);
  txt("Ficha Fiscal", 154, y + 18.5, fontes.metadado);

  y += alturaCabecalho;

  /* DADOS DO PROJETO */
  const alturaProjeto = 56;
  box(margem, y, largura, alturaProjeto);
  line(145, y, 145, y + alturaProjeto);

  [10, 20, 30, 40].forEach((deslocamento) => {
    line(margem, y + deslocamento, 145, y + deslocamento);
  });
  [14, 28, 42].forEach((deslocamento) => {
    line(145, y + deslocamento, margem + largura, y + deslocamento);
  });

  labelValor("Cliente:", projeto?.cliente, 10, y + 5.2, 25, fontes.campo, 108);
  labelValor(
    "Local:",
    projeto?.local || poco?.local_propriedade,
    10,
    y + 15.2,
    25,
    fontes.campo,
    108
  );
  labelValor("Projeto:", projeto?.nome, 10, y + 25.2, 25, fontes.campo, 108);
  labelValor(
    "Proc. Comercial:",
    projeto?.processo_comercial,
    10,
    y + 35.2,
    35,
    fontes.campo,
    98
  );
  labelValor(
    "Responsável Pela Coleta:",
    " ",
    10,
    y + 44.7,
    38,
    fontes.campo,
    35
  );
  labelValor(
    "Fiscal Responsável:",
    " ",
    85,
    y + 44.7,
    30,
    fontes.campo,
    28
  );
  labelValor(
    "DIÂMETRO:",
    `${texto(poco?.diametro)} cm`,
    148,
    y + 8.5,
    26,
    fontes.campoCompacto,
    26
  );
  labelValor(
    "NÍVEL ESTÁTICO:",
    `${texto(medicao.nivel_agua)} m`,
    148,
    y + 22.5,
    35,
    fontes.campoCompacto,
    17
  );
  labelValor(
    "COLUNA D'ÁGUA:",
    `${texto(medicao.coluna_agua)} m`,
    148,
    y + 36.5,
    35,
    fontes.campoCompacto,
    17
  );
  labelValor(
    "PROFUNDIDADE:",
    `${texto(poco?.profundidade_total || medicao.profundidade_total_mes)} m`,
    148,
    y + 50.5,
    34,
    fontes.campoCompacto,
    18
  );

  y += alturaProjeto;

  /* IDENTIFICAÇÃO */
  const linhasPm = linhasTexto(
    poco?.nome || medicao.poco_nome,
    25,
    fontes.campo,
    false
  );
  const linhasCodigoPrincipal = linhasTexto(
    obterCodigoPrincipal(codigosAmostras),
    33,
    fontes.campo,
    false
  );
  const alturaTextoCampo = fontes.campo * mmPorPonto * 1.05;
  const alturaIdentificacao1 = Math.max(
    16,
    6 + linhasPm.length * alturaTextoCampo
  );
  const alturaIdentificacao2 = Math.max(
    16,
    6 + linhasCodigoPrincipal.length * alturaTextoCampo
  );
  const alturaIdentificacao = alturaIdentificacao1 + alturaIdentificacao2;

  box(margem, y, largura, alturaIdentificacao);
  line(
    margem,
    y + alturaIdentificacao1,
    margem + largura,
    y + alturaIdentificacao1
  );
  line(75, y, 75, y + alturaIdentificacao);
  line(135, y, 135, y + alturaIdentificacao);

  labelValor(
    "Identificação do PM:",
    poco?.nome || medicao.poco_nome,
    10,
    y + 5.5,
    38,
    fontes.campo,
    25
  );
  labelValor(
    "Código principal:",
    obterCodigoPrincipal(codigosAmostras),
    10,
    y + alturaIdentificacao1 + 5.5,
    30,
    fontes.campo,
    33
  );

  labelValor(
    "Data Amostragem:",
    medicao.data_medicao,
    78,
    y + 5.5,
    34,
    fontes.campo,
    21
  );
  labelValor(
    "Prof. Bomba:",
    `${texto(medicao.profundidade_bomba)} m`,
    78,
    y + alturaIdentificacao1 + 5.5,
    28,
    fontes.campo,
    27
  );

  labelValor(
    "Vol. Estagnado:",
    `${texto(medicao.volume_estagnado)} L`,
    138,
    y + 6.5,
    32,
    fontes.campoCompacto,
    30
  );
  labelValor(
    "Vol. Esg. Mín:",
    `${texto(medicao.volume_purga)} L`,
    138,
    y + alturaIdentificacao1 + 5.5,
    30,
    fontes.campoCompacto,
    32
  );
  labelValor(
    "Vol. Total:",
    `${texto(medicao.volume_total_esgotado)} L`,
    138,
    y + alturaIdentificacao - 2.5,
    25,
    fontes.campoCompacto,
    37
  );

  y += alturaIdentificacao;

  /* TABELA DE ESTABILIZAÇÃO */
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
  const caracteristicas = [
    `CAP? ${texto(poco?.poco_com_cap || "-")}`,
    `Odor: ${texto(cond.odor_agua)}`,
    `Óleo: ${texto(cond.oleo_agua)}`,
    `Espuma: ${texto(cond.espuma_agua)}`
  ];
  const linhasTabela = Array.from({ length: 4 }, (_, indice) => {
    const leitura = leituras[indice] || {};
    const valores = [
      texto(leitura.horario),
      texto(leitura.nivel_agua || medicao.nivel_agua),
      texto(leitura.condutividade),
      texto(leitura.od),
      texto(leitura.ph),
      texto(leitura.orp),
      texto(leitura.temperatura),
      texto(leitura.turbidez),
      texto(leitura.aspecto),
      caracteristicas[indice] || "-"
    ];

    return valores.map((valor, colunaIndice) =>
      linhasTexto(valor, colunas[colunaIndice].w - 4, fontes.tabela, false)
    );
  });
  const alturaLinhaTabela = fontes.tabela * mmPorPonto * 1.12;
  const alturasTabela = linhasTabela.map((celulas) =>
    Math.max(
      12,
      Math.max(...celulas.map((linhas) => linhas.length)) * alturaLinhaTabela + 4
    )
  );
  const alturaTituloTabela = 10;
  const alturaCabecalhoTabela = 18;

  function desenharTituloTabela() {
    box(margem, y, largura, alturaTituloTabela);
    center(
      "Parâmetros de Estabilização de Coleta - Medidas de Campo",
      margem,
      y + 7,
      largura,
      fontes.secao,
      true
    );
    y += alturaTituloTabela;
  }

  function desenharCabecalhoTabela() {
    colunas.forEach((coluna) => {
      box(coluna.x, y, coluna.w, alturaCabecalhoTabela);
      const linhas = linhasTexto(
        coluna.t,
        coluna.w - 3,
        fontes.tabela,
        true
      );
      doc.text(linhas, coluna.x + coluna.w / 2, y + 5, {
        align: "center",
        lineHeightFactor: 1
      });
    });
    y += alturaCabecalhoTabela;
  }

  garantirEspaco(
    alturaTituloTabela + alturaCabecalhoTabela + alturasTabela[0]
  );
  desenharTituloTabela();
  desenharCabecalhoTabela();

  linhasTabela.forEach((celulas, indice) => {
    const alturaLinha = alturasTabela[indice];

    if (y + alturaLinha > limiteInferior) {
      novaPagina();
      desenharTituloTabela();
      desenharCabecalhoTabela();
    }

    colunas.forEach((coluna, colunaIndice) => {
      box(coluna.x, y, coluna.w, alturaLinha);
      definirFonte(fontes.tabela, false);
      doc.text(celulas[colunaIndice], coluna.x + 2, y + 5.3, {
        lineHeightFactor: 1.12
      });
    });

    y += alturaLinha;
  });

  y += 3;

  /* FAIXAS */
  const alturaFaixas = 45;
  garantirEspaco(alturaFaixas);
  box(margem, y, largura, alturaFaixas);
  line(margem, y + 10, margem + largura, y + 10);
  line(margem, y + 28, margem + largura, y + 28);

  center(
    "Faixas de Aceitação da Estabilização calculadas pela 1ª leitura",
    margem,
    y + 7,
    largura,
    fontes.secao,
    true
  );

  txt("pH:", 10, y + 18, fontes.campo, true);
  txt(
    faixas ? faixaTexto(faixas.phMin, faixas.phMax) : "-",
    20,
    y + 18,
    fontes.campo
  );
  txt("ORP:", 50, y + 18, fontes.campo, true);
  txt(
    faixas ? faixaTexto(faixas.orpMin, faixas.orpMax, " mV") : "-",
    64,
    y + 18,
    fontes.campo
  );
  txt("Cond.:", 105, y + 18, fontes.campo, true);
  txt(
    faixas ? faixaTexto(faixas.condMin, faixas.condMax) : "-",
    122,
    y + 18,
    fontes.campo
  );
  txt("OD:", 10, y + 25, fontes.campo, true);
  txt(
    faixas ? faixaTexto(faixas.odMin, faixas.odMax) : "-",
    20,
    y + 25,
    fontes.campo
  );
  txt("Temp.:", 50, y + 25, fontes.campo, true);
  txt(
    faixas ? faixaTexto(faixas.tempMin, faixas.tempMax, " °C") : "-",
    65,
    y + 25,
    fontes.campo
  );

  txt("Critérios:", 10, y + 38, fontes.campo, true);
  definirFonte(fontes.campo, false);
  const linhasCriterios = doc.splitTextToSize(
    "pH ±0,2 | ORP ±20 mV | Condutividade ±5% | OD ±10% | Temperatura ±0,5 °C",
    166
  );
  doc.text(linhasCriterios, 32, y + 38, { lineHeightFactor: 1.05 });

  y += alturaFaixas;

  /* RESUMO */
  const linhasObservacoes = linhasTexto(
    cond.observacoes_gerais,
    163,
    fontes.campo,
    true
  );
  const alturaLinhaObservacao = fontes.campo * mmPorPonto * 1.12;
  const alturaObservacoes = Math.max(
    14,
    linhasObservacoes.length * alturaLinhaObservacao + 5
  );
  const alturaResumo = 20 + alturaObservacoes;

  garantirEspaco(alturaResumo);
  box(margem, y, largura, alturaResumo);
  line(margem, y + 10, margem + largura, y + 10);
  line(margem, y + 20, margem + largura, y + 20);
  line(75, y, 75, y + 20);
  line(140, y, 140, y + 20);

  labelValor(
    "Hora Inicial:",
    leituras[0]?.horario,
    10,
    y + 6.5,
    28,
    fontes.campo,
    35
  );
  labelValor(
    "Hora Final:",
    leituras[3]?.horario || leituras[leituras.length - 1]?.horario,
    78,
    y + 6.5,
    25,
    fontes.campo,
    35
  );
  labelValor(
    "Diâmetro:",
    `${texto(poco?.diametro)} cm`,
    143,
    y + 6.5,
    22,
    fontes.campo,
    35
  );

  txt("Observações:", 10, y + 25.5, fontes.campo, true);
  definirFonte(fontes.campo, true);
  doc.text(linhasObservacoes, 35, y + 25.5, { lineHeightFactor: 1.12 });

  y += alturaResumo + 4;

  /* CÓDIGOS DAS AMOSTRAS */
  const alturaTituloCodigos = 10;
  const alturaLinhaCodigo = 4.5;
  const paddingCodigo = 4;

  function desenharTituloCodigos(continuacao = false) {
    box(margem, y, largura, alturaTituloCodigos);
    center(
      `Códigos das amostras${continuacao ? " (continuação)" : ""}`,
      margem,
      y + 7,
      largura,
      fontes.secao,
      true
    );
    y += alturaTituloCodigos;
  }

  function adicionarPaginaCodigos() {
    novaPagina();
    desenharTituloCodigos(true);
  }

  if (y + alturaTituloCodigos + alturaLinhaCodigo + paddingCodigo > limiteInferior) {
    novaPagina();
  }
  desenharTituloCodigos();

  const itensCodigos = codigosAmostras.length
    ? codigosAmostras.map((item) => {
        const codigo = texto(item.codigo);
        const tipo = formatarTipoCodigoAmostra(item.tipo);
        return `• ${codigo} — ${tipo}`;
      })
    : ["-"];

  itensCodigos.forEach((item) => {
    const linhas = linhasTexto(item, largura - 8, fontes.campo, false);
    const alturaItem = linhas.length * alturaLinhaCodigo + paddingCodigo;
    const alturaDisponivelPaginaNova =
      limiteInferior - margem - alturaTituloCodigos;

    if (
      y + alturaItem > limiteInferior &&
      alturaItem <= alturaDisponivelPaginaNova
    ) {
      adicionarPaginaCodigos();
    }

    let indiceLinha = 0;
    while (indiceLinha < linhas.length) {
      let linhasDisponiveis = Math.floor(
        (limiteInferior - y - paddingCodigo) / alturaLinhaCodigo
      );

      if (linhasDisponiveis < 1) {
        adicionarPaginaCodigos();
        linhasDisponiveis = Math.floor(
          (limiteInferior - y - paddingCodigo) / alturaLinhaCodigo
        );
      }

      const trecho = linhas.slice(
        indiceLinha,
        indiceLinha + linhasDisponiveis
      );
      const alturaTrecho = trecho.length * alturaLinhaCodigo + paddingCodigo;

      box(margem, y, largura, alturaTrecho);
      definirFonte(fontes.campo, false);
      doc.text(trecho, margem + 4, y + 5.5, { lineHeightFactor: 1.15 });

      y += alturaTrecho;
      indiceLinha += trecho.length;
      if (indiceLinha < linhas.length) adicionarPaginaCodigos();
    }
  });

  y += 4;

  /* ASSINATURAS */
  const alturaAssinaturas = 40;
  garantirEspaco(alturaAssinaturas);
  box(margem, y, largura, alturaAssinaturas);
  line(margem, y + 10, margem + largura, y + 10);
  center("Assinaturas", margem, y + 7, largura, fontes.secao, true);

  txt("Fiscal Responsável:", 12, y + 25, fontes.rodape, true);
  line(48, y + 25, 95, y + 25);
  txt("Assinatura", 50, y + 32, fontes.rodape);

  txt("Responsável Pela Coleta:", 110, y + 25, fontes.rodape, true);
  line(152, y + 25, 195, y + 25);
  txt("Assinatura", 158, y + 32, fontes.rodape);
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
