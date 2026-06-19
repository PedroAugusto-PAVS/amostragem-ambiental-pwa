async function exportarExcelSelecionadas() {
  const fichas = obterFichasSelecionadas();

  if (fichas.length === 0) return;

  if (!window.XLSX) {
    alert("Biblioteca Excel não carregou. Verifique sua internet ou os scripts do XLSX.");
    return;
  }

  const dados = [];

  fichas.forEach((ficha) => {
    const c = ficha.condicoes_ambientais || {};

    if (ficha.leituras && ficha.leituras.length > 0) {
      ficha.leituras.forEach((leitura) => {
        dados.push({
          coletor: ficha.coletor_nome,
          poco: ficha.nome_poco,
          tipo: ficha.tipo_poco,
          local: ficha.local_propriedade,
          utm_e: ficha.utm_e,
          utm_n: ficha.utm_n,
          latitude: ficha.latitude,
          longitude: ficha.longitude,
          profundidade_total: ficha.profundidade_total,
          nivel_agua: ficha.nivel_agua,
          profundidade_bomba: ficha.profundidade_bomba,
          coluna_agua: ficha.coluna_agua,
          volume_estagnado: ficha.volume_estagnado,
          volume_purga: ficha.volume_purga,
          horario: leitura.horario,
          ph: leitura.ph,
          condutividade: leitura.condutividade,
          temperatura: leitura.temperatura,
          od: leitura.od,
          orp: leitura.orp,
          turbidez: leitura.turbidez,
          aspecto: leitura.aspecto,
          cor_agua: c.cor_agua,
          odor_agua: c.odor_agua,
          oleo_agua: c.oleo_agua,
          material_flutuante: c.material_flutuante,
          espuma: c.espuma_agua,
          chuva_24h: c.chuva_24h,
          temperatura_ambiente: c.temperatura_ambiente,
          condicao_climatica: c.condicao_climatica,
          profundidade_coleta: c.profundidade_coleta,
          observacoes: c.observacoes_gerais,
          sincronizado: ficha.sincronizado ? "Sim" : "Não",
          criado_em: ficha.criado_em
        });
      });
    } else {
      dados.push({
        coletor: ficha.coletor_nome,
        poco: ficha.nome_poco,
        tipo: ficha.tipo_poco,
        local: ficha.local_propriedade,
        utm_e: ficha.utm_e,
        utm_n: ficha.utm_n,
        latitude: ficha.latitude,
        longitude: ficha.longitude,
        profundidade_total: ficha.profundidade_total,
        nivel_agua: ficha.nivel_agua,
        profundidade_bomba: ficha.profundidade_bomba,
        coluna_agua: ficha.coluna_agua,
        volume_estagnado: ficha.volume_estagnado,
        volume_purga: ficha.volume_purga,
        sincronizado: ficha.sincronizado ? "Sim" : "Não",
        criado_em: ficha.criado_em
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(dados);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Fichas");

  XLSX.writeFile(workbook, "fichas-selecionadas.xlsx");
}

async function exportarExcel() {
  await exportarExcelSelecionadas();
}