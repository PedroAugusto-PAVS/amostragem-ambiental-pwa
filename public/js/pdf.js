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
  const perfil = poco?.perfil_construtivo || {};

  const jsPDF =
    window.jspdf?.jsPDF ||
    window.jsPDF ||
    window.jspdf;

  if (!jsPDF) {
    alert("Biblioteca PDF não carregada. Verifique se libs/jspdf.umd.min.js existe.");
    return;
  }

  const doc = new jsPDF("p", "mm", "a4");

  let y = 12;

  function novaPaginaSePreciso(espaco = 10) {
    if (y + espaco > 285) {
      doc.addPage();
      y = 12;
    }
  }

  function linha(label, valor) {
    novaPaginaSePreciso(8);

    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 10, y);

    doc.setFont("helvetica", "normal");

    const valorTexto = texto(valor);
    const linhas = quebrarTexto(doc, valorTexto, 135);

    doc.text(linhas, 65, y);

    y += Math.max(7, linhas.length * 5);
  }

  function titulo(t) {
    novaPaginaSePreciso(15);

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(t, 10, y);

    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
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

  titulo("4. Perfil Construtivo do Poço");
  linha("Boca do tubo", perfil.boca_tubo ? `${perfil.boca_tubo} m` : "-");
  linha("Cota do terreno", perfil.cota_terreno ? `${perfil.cota_terreno} m` : "-");
  linha("Cota do tubo", perfil.cota_tubo ? `${perfil.cota_tubo} m` : "-");
  linha("Nível estático", perfil.nivel_estatico ? `${perfil.nivel_estatico} m` : "-");
  linha(
    "Zona filtrante",
    `${texto(perfil.zona_filtrante_inicio)} a ${texto(perfil.zona_filtrante_fim)} m`
  );
  linha("Seção filtrante", perfil.secao_filtrante);
  linha("Pré-filtro", perfil.pre_filtro);
  linha("Revestimento", perfil.revestimento);
  linha("Tipo de tampa", perfil.tipo_tampa);
  linha("Condição do poço", perfil.condicao_poco);
  linha("Observações construtivas", perfil.observacoes_construtivas);

  titulo("5. Dados Hidráulicos");
  linha("Profundidade total cadastrada", `${texto(poco?.profundidade_total)} m`);
  linha("Profundidade total medida", `${texto(medicao.profundidade_total_mes)} m`);
  linha("Nível d'água", `${texto(medicao.nivel_agua)} m`);
  linha("Profundidade da bomba", `${texto(medicao.profundidade_bomba)} m`);
  linha("Coluna d'água", `${texto(medicao.coluna_agua)} m`);
  linha("Volume estagnado", `${texto(medicao.volume_estagnado)} L`);
  linha("Volume esgotado mínimo", `${texto(medicao.volume_purga)} L`);
  linha("Volume total esgotado", `${texto(medicao.volume_total_esgotado)} L`);

  titulo("6. Leituras da Sonda");

  const leituras = medicao.leituras || [];

  if (leituras.length === 0) {
    linha("Leituras", "Nenhuma leitura registrada");
  } else {
    novaPaginaSePreciso(20);

    doc.setFont("helvetica", "bold");
    doc.text("Hora", 10, y);
    doc.text("pH", 31, y);
    doc.text("Cond.", 47, y);
    doc.text("Temp.", 74, y);
    doc.text("OD", 100, y);
    doc.text("ORP", 119, y);
    doc.text("Turb.", 142, y);
    doc.text("Aspecto", 165, y);

    y += 6;
    doc.setFont("helvetica", "normal");

    leituras.forEach((l) => {
      novaPaginaSePreciso(8);

      doc.text(texto(l.horario), 10, y);
      doc.text(texto(l.ph), 31, y);
      doc.text(texto(l.condutividade), 47, y);
      doc.text(texto(l.temperatura), 74, y);
      doc.text(texto(l.od), 100, y);
      doc.text(texto(l.orp), 119, y);
      doc.text(texto(l.turbidez), 142, y);

      const aspecto = quebrarTexto(doc, texto(l.aspecto), 35);
      doc.text(aspecto, 165, y);

      y += Math.max(6, aspecto.length * 5);
    });
  }

  titulo("7. Estabilização");

  if (medicao.estabilizacao) {
    linha(
      "Resultado",
      medicao.estabilizacao.estavel
        ? "Estável para coleta"
        : "Não estabilizado"
    );

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

  titulo("8. Alertas Ambientais");

  if (medicao.alertas && medicao.alertas.length > 0) {
    medicao.alertas.forEach((a, index) => {
      linha(`Alerta ${index + 1}`, a);
    });
  } else {
    linha("Alertas", "Nenhum alerta registrado");
  }

  titulo("9. Condições da Água e Ambiente");

  const c = medicao.condicoes_ambientais || {};

  linha("Cor da água", c.cor_agua);
  linha("Odor", c.odor_agua);
  linha("Óleo", c.oleo_agua);
  linha("Material flutuante", c.material_flutuante);
  linha("Espuma", c.espuma_agua);
  linha("Chuva 24h", c.chuva_24h);
  linha(
    "Temperatura ambiente",
    c.temperatura_ambiente ? `${c.temperatura_ambiente} °C` : "-"
  );
  linha("Observações", c.observacoes_gerais);

  novaPaginaSePreciso(45);

  titulo("10. Assinaturas");

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
    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);

    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

  } catch (erro) {
    try {
      doc.save(nomeArquivo);
    } catch (erro2) {
      alert("Erro ao gerar PDF: " + erro2.message);
    }
  }
}

window.imprimirFichaMedicao = imprimirFichaMedicao;