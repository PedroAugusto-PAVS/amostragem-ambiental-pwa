function texto(valor) {
  if (valor === null || valor === undefined || valor === "") return "-";
  return String(valor);
}

function n(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  return Number(String(valor).replace(",", "."));
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
  const perfil = poco?.perfil_construtivo || {};
  const cond = medicao.condicoes_ambientais || {};
  const leituras = medicao.leituras || [];

  const jsPDF =
    window.jspdf?.jsPDF ||
    window.jsPDF ||
    window.jspdf;

  if (!jsPDF) {
    alert("Biblioteca PDF não carregada.");
    return;
  }

  const doc = new jsPDF("l", "mm", "a4");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  function box(x, y, w, h) {
    doc.rect(x, y, w, h);
  }

  function txt(text, x, y, size = 7, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(String(text || ""), x, y);
  }

  function center(text, x, y, w, size = 9, bold = true) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(String(text || ""), x + w / 2, y, { align: "center" });
  }

  const margem = 8;
  const largura = 281;
  let y = 8;

  box(margem, y, largura, 20);
  txt("ALS", 14, y + 12, 12, true);
  center("FICHA DE CAMPO", 45, y + 12, 150, 14, true);
  txt("REN-AMS-009", 220, y + 8, 8, true);
  txt("Rev: 00 - REFERÊNCIA: POP 139", 220, y + 14, 7, false);

  y += 20;

  box(margem, y, 190, 40);
  box(198, y, 91, 40);

  

  

  txt("Cliente:", 10, y + 7, 7, true);
txt(texto(projeto?.cliente), 35, y + 7);

txt("Local:", 10, y + 14, 7, true);
txt(texto(projeto?.local || poco?.local_propriedade), 35, y + 14);

txt("Projeto:", 10, y + 21, 7, true);
txt(texto(projeto?.nome), 35, y + 21);

txt("Processo Comercial:", 10, y + 28, 7, true);
txt(texto(projeto?.processo_comercial), 50, y + 28);

txt("Responsável ALS:", 10, y + 35, 7, true);
txt(texto(medicao.coletor_nome), 42, y + 35);

txt("Resp. Cliente:", 115, y + 35, 7, true);
txt("-", 145, y + 35);

  txt("DIÂMETRO:", 220, y + 10, 7, true);
  txt(`${texto(poco?.diametro)} cm`, 245, y + 10);

  txt("NÍVEL ESTÁTICO:", 220, y + 18, 7, true);
  txt(`${texto(medicao.nivel_agua)} m`, 250, y + 18);

  txt("COLUNA D'ÁGUA:", 220, y + 26, 7, true);
  txt(`${texto(medicao.coluna_agua)} m`, 250, y + 26);

  txt("PROFUNDIDADE:", 220, y + 34, 7, true);
  txt(`${texto(poco?.profundidade_total || medicao.profundidade_total_mes)} m`, 250, y + 34);

  y += 40;

  box(margem, y, largura, 18);

  txt("Identificação do Cliente:", 10, y + 6, 8, true);
  txt("Código ALS:", 10, y + 14, 7, true);
  txt(texto(poco?.nome || medicao.poco_nome), 35, y + 14);

  txt("Data da Amostragem:", 115, y + 8, 7, true);
  txt(texto(medicao.data_medicao), 155, y + 8);

  txt("Data do Esgotamento:", 115, y + 15, 7, true);
  txt(texto(medicao.data_medicao), 155, y + 15);

  txt("Vol. Estagnado:", 205, y + 8, 7, true);
  txt(`${texto(medicao.volume_estagnado)} L`, 235, y + 8);

  txt("Vol. Esgot. Mín:", 250, y + 8, 7, true);
  txt(`${texto(medicao.volume_purga)} L`, 278, y + 8);

  txt("Prof. da Amostragem:", 205, y + 15, 7, true);
  txt(`${texto(medicao.profundidade_bomba)} m`, 240, y + 15);

  txt("Vol. Total Esgotado:", 250, y + 15, 7, true);
  txt(`${texto(medicao.volume_total_esgotado)} L`, 282, y + 15);

  y += 18;

  box(margem, y, largura, 10);
  center("Parâmetros de Estabilização de Coleta - Medidas de Campo", margem, y + 7, largura, 8, true);

  y += 10;

  const startY = y;
  const colunas = [
    { t: "Hora", x: 8, w: 24 },
    { t: "Nível\nEstático\n(m)", x: 32, w: 22 },
    { t: "Condut.\n(µS/cm)", x: 54, w: 25 },
    { t: "OD\n(mg/L)", x: 79, w: 22 },
    { t: "pH", x: 101, w: 18 },
    { t: "Potencial\nRedox\n(mV)", x: 119, w: 28 },
    { t: "Temp.\n(°C)", x: 147, w: 22 },
    { t: "Turbidez\n(NTU)", x: 169, w: 22 },
    { t: "Aspecto\n(L/T)", x: 191, w: 25 },
    { t: "Características", x: 216, w: 73 }
  ];

  colunas.forEach(c => {
    box(c.x, y, c.w, 14);
    center(c.t, c.x, y + 5, c.w, 6, true);
  });

  y += 14;

  for (let i = 0; i < 8; i++) {
    const l = leituras[i] || {};
    colunas.forEach(c => box(c.x, y, c.w, 8));

    txt(texto(l.horario), 10, y + 5);
txt(texto(medicao.nivel_agua), 35, y + 5);
txt(texto(l.condutividade), 57, y + 5);
txt(texto(l.od), 83, y + 5);
txt(texto(l.ph), 104, y + 5);
txt(texto(l.orp), 124, y + 5);
txt(texto(l.temperatura), 151, y + 5);
txt(texto(l.turbidez), 173, y + 5);
txt(texto(l.aspecto), 194, y + 5);

    if (i === 0) {
      txt(`Poço com CAP? ${texto(cond.poco_com_cap || "-")}`, 219, y + 5);
    }

    if (i === 1) {
      txt(`Odor: ${texto(cond.odor_agua)}`, 219, y + 5);
    }

    if (i === 2) {
      txt(`Óleo: ${texto(cond.oleo_agua)}`, 219, y + 5);
    }

    if (i === 3) {
      txt(`Espuma: ${texto(cond.espuma_agua)}`, 219, y + 5);
    }

    if (i === 4) {
      txt(`Cor: ${texto(cond.cor_agua)}`, 219, y + 5);
    }

    if (i === 5) {
      txt(`Chuva 24h: ${texto(cond.chuva_24h)}`, 219, y + 5);
    }

    y += 8;
  }

  y += 3;

  box(margem, y, largura, 12);
  txt("Parâmetro de Estabilização:", 10, y + 5, 6, true);
  txt("pH +/- 0,2 unidades", 60, y + 5, 6);
  txt("ORP (Redox) +/- 20 mV", 100, y + 5, 6);
  txt("Condutividade +/- 5% do valor medido", 145, y + 5, 6);
  txt("OD +/- 10% do valor medido", 210, y + 5, 6);
  txt("Temperatura 0,5 °C", 255, y + 5, 6);

  txt(`Diâmetro ${texto(poco?.diametro)} cm`, 10, y + 10, 6);
  txt(`Coluna d'água = ${texto(medicao.coluna_agua)} m`, 60, y + 10, 6);
  txt(`Volume estagnado = ${texto(medicao.volume_estagnado)} L`, 115, y + 10, 6);
  txt(`Volume a ser esgotado = ${texto(medicao.volume_total_esgotado)} L`, 190, y + 10, 6);

  y += 18;

  txt("Hora Inicial da Purga:", 10, y, 7, true);
  txt(texto(leituras[0]?.horario), 50, y);

  txt("Hora Final da Amostragem:", 10, y + 7, 7, true);
  txt(texto(leituras[leituras.length - 1]?.horario), 60, y + 7);

  txt("Observação do Poço:", 10, y + 14, 7, true);
  const obs = doc.splitTextToSize(texto(cond.observacoes_gerais || perfil.observacoes_construtivas), 180);
  doc.text(obs, 50, y + 14);

  y += 28;

  txt("Responsável ALS:", 10, y, 8, true);
  doc.line(45, y, 125, y);

  txt("Responsável Cliente:", 145, y, 8, true);
  doc.line(185, y, 280, y);

  const nomeArquivo = `ficha-${poco?.nome || medicao.poco_nome || "pm"}-${medicao.mes_referencia || "medicao"}.pdf`
    .replaceAll(" ", "-")
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .replaceAll(":", "-");

  try {
    const pdfBase64 = doc.output("datauristring");
    const base64Data = pdfBase64.split(",")[1];

    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const resultado = await window.Capacitor.Plugins.Filesystem.writeFile({
        path: nomeArquivo,
        data: base64Data,
        directory: "DOCUMENTS"
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