async function exportarPDFSelecionadas() {
  const fichas = obterFichasSelecionadas();

  if (fichas.length === 0) return;

  if (!window.jspdf) {
    alert("Biblioteca PDF não carregou. Verifique sua internet ou os scripts do jsPDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  fichas.forEach((ficha, index) => {
    if (index > 0) doc.addPage();

    doc.setFontSize(16);
    doc.text("Ficha de Campo - Amostragem Ambiental", 10, 15);

    doc.setFontSize(11);

    let y = 30;

    doc.text(`Coletor: ${ficha.coletor_nome || ""}`, 10, y); y += 8;
    doc.text(`Poço/Ponto: ${ficha.nome_poco || ""}`, 10, y); y += 8;
    doc.text(`Tipo: ${ficha.tipo_poco || ""}`, 10, y); y += 8;
    doc.text(`Local: ${ficha.local_propriedade || ""}`, 10, y); y += 8;
    doc.text(`UTM E: ${ficha.utm_e || ""}`, 10, y); y += 8;
    doc.text(`UTM N: ${ficha.utm_n || ""}`, 10, y); y += 8;
    doc.text(`Latitude: ${ficha.latitude || ""}`, 10, y); y += 8;
    doc.text(`Longitude: ${ficha.longitude || ""}`, 10, y); y += 12;

    doc.text(`Profundidade total: ${ficha.profundidade_total || 0} m`, 10, y); y += 8;
    doc.text(`Nível d'água: ${ficha.nivel_agua || 0} m`, 10, y); y += 8;
    doc.text(`Profundidade da bomba: ${ficha.profundidade_bomba || 0} m`, 10, y); y += 8;
    doc.text(`Coluna d'água: ${ficha.coluna_agua || 0} m`, 10, y); y += 8;
    doc.text(`Volume estagnado: ${ficha.volume_estagnado || 0} L`, 10, y); y += 8;
    doc.text(`Volume de purga: ${ficha.volume_purga || 0} mL`, 10, y); y += 12;

    const c = ficha.condicoes_ambientais || {};

    doc.text("Condições da Água e Ambiente", 10, y); y += 8;
    doc.text(`Cor da água: ${c.cor_agua || ""}`, 10, y); y += 8;
    doc.text(`Odor: ${c.odor_agua || ""}`, 10, y); y += 8;
    doc.text(`Óleo: ${c.oleo_agua || ""}`, 10, y); y += 8;
    doc.text(`Material flutuante: ${c.material_flutuante || ""}`, 10, y); y += 8;
    doc.text(`Espuma: ${c.espuma_agua || ""}`, 10, y); y += 8;
    doc.text(`Chuva 24h: ${c.chuva_24h || ""}`, 10, y); y += 8;
    doc.text(`Temperatura ambiente: ${c.temperatura_ambiente || ""} °C`, 10, y); y += 8;
    doc.text(`Condição climática: ${c.condicao_climatica || ""}`, 10, y); y += 8;
    doc.text(`Profundidade da coleta: ${c.profundidade_coleta || ""} m`, 10, y); y += 12;

    doc.text("Leituras da Sonda", 10, y); y += 8;

    if (ficha.leituras && ficha.leituras.length > 0) {
      ficha.leituras.forEach((l) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }

        doc.text(
          `${l.horario || ""} | pH:${l.ph || ""} | Cond:${l.condutividade || ""} | Temp:${l.temperatura || ""} | OD:${l.od || ""} | ORP:${l.orp || ""} | Turb:${l.turbidez || ""} | ${l.aspecto || ""}`,
          10,
          y
        );

        y += 8;
      });
    }

    if (ficha.foto_base64) {
      doc.addPage();
      doc.text(`Foto - ${ficha.nome_poco || ""}`, 10, 15);

      try {
        doc.addImage(ficha.foto_base64, "JPEG", 10, 25, 180, 120);
      } catch (e) {
        doc.text("Não foi possível inserir a foto no PDF.", 10, 30);
      }
    }
  });

  doc.save("fichas-selecionadas.pdf");
}

async function gerarPDF() {
  await exportarPDFSelecionadas();
}