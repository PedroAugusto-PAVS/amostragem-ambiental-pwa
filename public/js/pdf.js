function texto(valor) {
  if (valor === null || valor === undefined || valor === "") return "-";
  return String(valor);
}

function quebrarTexto(doc, texto, largura) {
  return doc.splitTextToSize(String(texto || "-"), largura);
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

  const jsPDF =
  window.jspdf?.jsPDF ||
  window.jsPDF ||
  window.jspdf;

if (!jsPDF) {
  alert("Biblioteca PDF não carregada.");
  return;
}

const doc = new jsPDF("p", "mm", "a4");


  let y = 12;

  function linha(label, valor) {
    if (y > 280) {
      doc.addPage();
      y = 12;
    }

    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 10, y);

    doc.setFont("helvetica", "normal");
    doc.text(texto(valor), 62, y);

    y += 7;
  }

  function titulo(t) {
    if (y > 270) {
      doc.addPage();
      y = 12;
    }

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(t, 10, y);
    y += 7;
    doc.setFontSize(10);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FICHA DE CAMPO - AMOSTRAGEM AMBIENTAL", 10, y);

  y += 10;
  doc.setFontSize(10);

  titulo("1. Projeto");
  linha("Projeto", projeto?.nome);
  linha("Cliente", projeto?.cliente);
  linha("Local", projeto?.local);

  titulo("2. Identificação do PM");
  linha("PM / Poço", poco?.nome || medicao.poco_nome);
  linha("Tipo", poco?.tipo);
  linha("Local / Propriedade", poco?.local_propriedade);
  linha("Coletor", medicao.coletor_nome);
  linha("Data da medição", medicao.data_medicao);
  linha("Mês referência", medicao.mes_referencia);

  titulo("3. Localização");
  linha("UTM E", poco?.utm_e);
  linha("UTM N", poco?.utm_n);
  linha("Zona UTM", poco?.zona_utm);
  linha("Hemisfério", poco?.hemisferio_utm);
  linha("Latitude", poco?.latitude);
  linha("Longitude", poco?.longitude);
  linha(
    "Precisão GPS",
    poco?.precisao_gps ? `${Number(poco.precisao_gps).toFixed(2)} m` : "-"
  );
  linha(
    "Altitude",
    poco?.altitude_gps ? `${Number(poco.altitude_gps).toFixed(2)} m` : "-"
  );

  titulo("4. Dados Hidráulicos");
  linha("Profundidade total cadastrada", `${texto(poco?.profundidade_total)} m`);
  linha("Profundidade total medida", `${texto(medicao.profundidade_total_mes)} m`);
  linha("Nível d'água", `${texto(medicao.nivel_agua)} m`);
  linha("Profundidade da bomba", `${texto(medicao.profundidade_bomba)} m`);
  linha("Coluna d'água", `${texto(medicao.coluna_agua)} m`);
  linha("Volume estagnado", `${texto(medicao.volume_estagnado)} L`);
  linha("Volume esgotado mínimo", `${texto(medicao.volume_purga)} L`);
  linha("Volume total esgotado", `${texto(medicao.volume_total_esgotado)} L`);

  titulo("5. Leituras da Sonda");

  const leituras = medicao.leituras || [];

  if (leituras.length === 0) {
    linha("Leituras", "Nenhuma leitura registrada");
  } else {
    doc.setFont("helvetica", "bold");
    doc.text("Hora", 10, y);
    doc.text("pH", 32, y);
    doc.text("Cond.", 50, y);
    doc.text("Temp.", 78, y);
    doc.text("OD", 105, y);
    doc.text("ORP", 125, y);
    doc.text("Turb.", 148, y);
    doc.text("Aspecto", 170, y);

    y += 6;
    doc.setFont("helvetica", "normal");

    leituras.forEach((l) => {
      if (y > 280) {
        doc.addPage();
        y = 12;
      }

      doc.text(texto(l.horario), 10, y);
      doc.text(texto(l.ph), 32, y);
      doc.text(texto(l.condutividade), 50, y);
      doc.text(texto(l.temperatura), 78, y);
      doc.text(texto(l.od), 105, y);
      doc.text(texto(l.orp), 125, y);
      doc.text(texto(l.turbidez), 148, y);
      doc.text(texto(l.aspecto), 170, y);

      y += 6;
    });
  }

  titulo("6. Estabilização");

  if (medicao.estabilizacao) {
    linha("Resultado", medicao.estabilizacao.estavel ? "Estável para coleta" : "Não estabilizado");
    linha("Mensagem", medicao.estabilizacao.mensagem);

    const limites = medicao.estabilizacao.limites;

    if (limites) {
      linha("pH permitido", `${limites.phMin.toFixed(2)} até ${limites.phMax.toFixed(2)}`);
      linha("ORP permitido", `${limites.orpMin.toFixed(2)} até ${limites.orpMax.toFixed(2)} mV`);
      linha("Cond. permitida", `${limites.condMin.toFixed(2)} até ${limites.condMax.toFixed(2)}`);
      linha("OD permitido", `${limites.odMin.toFixed(2)} até ${limites.odMax.toFixed(2)}`);
      linha("Temp. permitida", `${limites.tempMin.toFixed(2)} até ${limites.tempMax.toFixed(2)} °C`);
    }
  } else {
    linha("Resultado", "Não avaliado");
  }

  titulo("7. Alertas Ambientais");

  if (medicao.alertas && medicao.alertas.length > 0) {
    medicao.alertas.forEach((a, index) => {
      linha(`Alerta ${index + 1}`, a);
    });
  } else {
    linha("Alertas", "Nenhum alerta registrado");
  }

  titulo("8. Condições da Água e Ambiente");

  const c = medicao.condicoes_ambientais || {};

  linha("Cor da água", c.cor_agua);
  linha("Odor", c.odor_agua);
  linha("Óleo", c.oleo_agua);
  linha("Material flutuante", c.material_flutuante);
  linha("Espuma", c.espuma_agua);
  linha("Chuva 24h", c.chuva_24h);
  linha("Temperatura ambiente", c.temperatura_ambiente ? `${c.temperatura_ambiente} °C` : "-");

  doc.setFont("helvetica", "bold");
  doc.text("Observações:", 10, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  const obs = quebrarTexto(doc, c.observacoes_gerais || "-", 180);
  doc.text(obs, 10, y);
  y += obs.length * 6 + 10;

  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  titulo("9. Assinaturas");

  y += 12;
  doc.line(20, y, 90, y);
  doc.line(120, y, 190, y);

  y += 6;
  doc.text("Coletor", 45, y);
  doc.text("Responsável / Cliente", 135, y);

  const nomeArquivo = `ficha-${poco?.nome || medicao.poco_nome || "pm"}-${medicao.mes_referencia || "medicao"}.pdf`
    .replaceAll("/", "-")
    .replaceAll(" ", "-");

    try {
      doc.save(nomeArquivo);
    } catch (erro) {
      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
  
      window.open(url, "_blank");
    }
  }
  
  window.imprimirFichaMedicao = imprimirFichaMedicao;

 