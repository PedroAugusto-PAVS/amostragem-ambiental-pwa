function t(valor) {
    if (valor === null || valor === undefined || valor === "") return "-";
    return String(valor);
  }

  function formatarDataFicha(data) {
    const textoData = t(data);
    const partes = textoData.match(/^(\d{4})-(\d{2})-(\d{2})/);

    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : textoData;
  }
  
  async function carregarFichaImpressao() {
    const medicaoId = localStorage.getItem("medicao_imprimir");
  
    if (!medicaoId) {
      alert("Nenhuma medição selecionada.");
      history.back();
      return;
    }
  
    const pocos = await listarPocosLocais();
    const medicoes = await listarMedicoesLocais();
    const projetos = await listarProjetosLocais();
  
    const medicao = medicoes.find((m) => m.local_id === medicaoId);
  
    if (!medicao) {
      alert("Medição não encontrada.");
      history.back();
      return;
    }
  
    const poco = pocos.find((p) => p.local_id === medicao.poco_local_id);
    const projeto = projetos.find((p) => p.local_id === poco?.projeto_local_id);
  
    const leituras = medicao.leituras || [];
    const cond = medicao.condicoes_ambientais || {};
    const estabilizacao = medicao.estabilizacao || {};
    const perfil = poco?.perfil_construtivo || {};
    const codigosAmostras = obterCodigosDaMedicao(medicao);
    const listaCodigosAmostras = codigosAmostras.length
      ? `
        <ul
          class="codigos-amostras"
          style="padding-left:20px;overflow-wrap:anywhere;"
        >
          ${codigosAmostras
            .map(
              (item) => `
                <li
                  style="break-inside:avoid;page-break-inside:avoid;margin-bottom:4px;"
                >
                  <strong>${escaparHtml(item.codigo)}</strong>
                  — ${escaparHtml(formatarTipoCodigoAmostra(item.tipo))}
                </li>
              `
            )
            .join("")}
        </ul>
      `
      : `<div class="linha">-</div>`;
  
    document.getElementById("fichaContainer").innerHTML = `
      <h1>Ficha de Campo - Amostragem Ambiental</h1>
  
      <h2>1. Projeto</h2>
      <div class="linha"><strong>Projeto:</strong> ${t(projeto?.nome)}</div>
      <div class="linha"><strong>Cliente:</strong> ${t(projeto?.cliente)}</div>
      <div class="linha"><strong>Local:</strong> ${t(projeto?.local)}</div>
  
      <h2>2. Identificação do PM</h2>
      <div class="linha"><strong>PM / Poço:</strong> ${t(poco?.nome || medicao.poco_nome)}</div>
      <div class="linha"><strong>Tipo:</strong> ${t(poco?.tipo)}</div>
      <div class="linha"><strong>Local / Propriedade:</strong> ${t(poco?.local_propriedade)}</div>
      <div class="linha"><strong>Coletor:</strong> ${t(medicao.coletor_nome)}</div>
      <div class="linha"><strong>Data da medição:</strong> ${formatarDataFicha(medicao.data_medicao)}</div>
      <div class="linha"><strong>Mês referência:</strong> ${t(medicao.mes_referencia)}</div>
      <h3 style="break-after:avoid;page-break-after:avoid;">Códigos das amostras</h3>
      ${listaCodigosAmostras}

      <h2>3. Localização</h2>
      <div class="linha"><strong>UTM E:</strong> ${t(poco?.utm_e)}</div>
      <div class="linha"><strong>UTM N:</strong> ${t(poco?.utm_n)}</div>
      <div class="linha"><strong>Zona UTM:</strong> ${t(poco?.zona_utm)}</div>
      <div class="linha"><strong>Hemisfério:</strong> ${t(poco?.hemisferio_utm)}</div>
      <div class="linha"><strong>Latitude:</strong> ${t(poco?.latitude)}</div>
      <div class="linha"><strong>Longitude:</strong> ${t(poco?.longitude)}</div>
  
      <h2>4. Perfil Construtivo</h2>
      <div class="linha"><strong>Boca do tubo:</strong> ${t(perfil.boca_tubo)} m</div>
      <div class="linha"><strong>Cota do terreno:</strong> ${t(perfil.cota_terreno)} m</div>
      <div class="linha"><strong>Cota do tubo:</strong> ${t(perfil.cota_tubo)} m</div>
      <div class="linha"><strong>Nível estático:</strong> ${t(perfil.nivel_estatico)} m</div>
      <div class="linha"><strong>Zona filtrante:</strong> ${t(perfil.zona_filtrante_inicio)} a ${t(perfil.zona_filtrante_fim)} m</div>
      <div class="linha"><strong>Seção filtrante:</strong> ${t(perfil.secao_filtrante)}</div>
      <div class="linha"><strong>Pré-filtro:</strong> ${t(perfil.pre_filtro)}</div>
      <div class="linha"><strong>Revestimento:</strong> ${t(perfil.revestimento)}</div>
      <div class="linha"><strong>Tipo de tampa:</strong> ${t(perfil.tipo_tampa)}</div>
      <div class="linha"><strong>Condição:</strong> ${t(perfil.condicao_poco)}</div>
      <div class="linha"><strong>Observações construtivas:</strong> ${t(perfil.observacoes_construtivas)}</div>
  
      <h2>5. Dados Hidráulicos</h2>
      <div class="linha"><strong>Profundidade total cadastrada:</strong> ${t(poco?.profundidade_total)} m</div>
      <div class="linha"><strong>Profundidade total medida:</strong> ${t(medicao.profundidade_total_mes)} m</div>
      <div class="linha"><strong>Nível d'água:</strong> ${t(medicao.nivel_agua)} m</div>
      <div class="linha"><strong>Profundidade da bomba:</strong> ${t(medicao.profundidade_bomba)} m</div>
      <div class="linha"><strong>Coluna d'água:</strong> ${t(medicao.coluna_agua)} m</div>
      <div class="linha"><strong>Volume estagnado:</strong> ${t(medicao.volume_estagnado)} L</div>
      <div class="linha"><strong>Volume esgotado mínimo:</strong> ${t(medicao.volume_purga)} L</div>
      <div class="linha"><strong>Volume total esgotado:</strong> ${t(medicao.volume_total_esgotado)} L</div>
  
      <h2>6. Leituras da Sonda</h2>
      <table>
        <thead>
          <tr>
            <th>Hora</th>
            <th>pH</th>
            <th>Cond.</th>
            <th>Temp.</th>
            <th>OD</th>
            <th>ORP</th>
            <th>Turb.</th>
            <th>Aspecto</th>
          </tr>
        </thead>
        <tbody>
          ${
            leituras.length
              ? leituras.map(l => `
                <tr>
                  <td>${t(l.horario)}</td>
                  <td>${t(l.ph)}</td>
                  <td>${t(l.condutividade)}</td>
                  <td>${t(l.temperatura)}</td>
                  <td>${t(l.od)}</td>
                  <td>${t(l.orp)}</td>
                  <td>${t(l.turbidez)}</td>
                  <td>${t(l.aspecto)}</td>
                </tr>
              `).join("")
              : `<tr><td colspan="8">Nenhuma leitura registrada</td></tr>`
          }
        </tbody>
      </table>
  
      <h2>7. Estabilização</h2>
      <div class="linha"><strong>Resultado:</strong> ${estabilizacao.estavel ? "Estável para coleta" : "Não estabilizado / Não avaliado"}</div>
      <div class="linha"><strong>Mensagem:</strong> ${t(estabilizacao.mensagem)}</div>
  
      <h2>8. Alertas Ambientais</h2>
      <div class="linha">
        ${
          medicao.alertas && medicao.alertas.length
            ? medicao.alertas.join(", ")
            : "Nenhum alerta registrado"
        }
      </div>
  
      <h2>9. Condições da Água e Ambiente</h2>
      <div class="linha"><strong>Cor da água:</strong> ${t(cond.cor_agua)}</div>
      <div class="linha"><strong>Odor:</strong> ${t(cond.odor_agua)}</div>
      <div class="linha"><strong>Óleo:</strong> ${t(cond.oleo_agua)}</div>
      <div class="linha"><strong>Material flutuante:</strong> ${t(cond.material_flutuante)}</div>
      <div class="linha"><strong>Espuma:</strong> ${t(cond.espuma_agua)}</div>
      <div class="linha"><strong>Chuva 24h:</strong> ${t(cond.chuva_24h)}</div>
      <div class="linha"><strong>Temperatura ambiente:</strong> ${t(cond.temperatura_ambiente)} °C</div>
      <div class="linha"><strong>Observações:</strong> ${t(cond.observacoes_gerais)}</div>
  
      <div class="assinaturas">
        <div class="assinatura">Coletor</div>
        <div class="assinatura">Responsável / Cliente</div>
      </div>
    `;
  }
  
  carregarFichaImpressao();
