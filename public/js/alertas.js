function num(valor) {
    if (valor === null || valor === undefined || valor === "") return 0;
    return Number(String(valor).replace(",", "."));
  }
  
  function calcularEstabilizacao(leituras) {
    if (!leituras || leituras.length < 2) {
      return {
        estavel: false,
        mensagem: "É necessário ter pelo menos 2 leituras.",
        resultados: []
      };
    }
  
    const ref = leituras[0];
  
    const phRef = num(ref.ph);
    const orpRef = num(ref.orp);
    const condRef = num(ref.condutividade);
    const odRef = num(ref.od);
    const tempRef = num(ref.temperatura);
  
    const limites = {
      phMin: phRef - 0.2,
      phMax: phRef + 0.2,
  
      orpMin: orpRef - 20,
      orpMax: orpRef + 20,
  
      condMin: condRef - condRef * 0.05,
      condMax: condRef + condRef * 0.05,
  
      odMin: odRef - odRef * 0.10,
      odMax: odRef + odRef * 0.10,
  
      tempMin: tempRef - 0.5,
      tempMax: tempRef + 0.5
    };
  
    const resultados = leituras.map((l, index) => {
      const ph = num(l.ph);
      const orp = num(l.orp);
      const cond = num(l.condutividade);
      const od = num(l.od);
      const temp = num(l.temperatura);
  
      const dentro = {
        ph: ph >= limites.phMin && ph <= limites.phMax,
        orp: orp >= limites.orpMin && orp <= limites.orpMax,
        condutividade: cond >= limites.condMin && cond <= limites.condMax,
        od: od >= limites.odMin && od <= limites.odMax,
        temperatura: temp >= limites.tempMin && temp <= limites.tempMax
      };
  
      const estavel =
        dentro.ph &&
        dentro.orp &&
        dentro.condutividade &&
        dentro.od &&
        dentro.temperatura;
  
      return {
        linha: index + 1,
        horario: l.horario,
        referencia: index === 0,
        dentro,
        estavel
      };
    });
  
    const depoisDaReferencia = resultados.slice(1);
    const estavel = depoisDaReferencia.every((r) => r.estavel);
  
    return {
      estavel,
      mensagem: estavel
        ? "Poço estável para realizar a coleta."
        : "Poço ainda não estabilizado para coleta.",
      referencia: {
        ph: phRef,
        orp: orpRef,
        condutividade: condRef,
        od: odRef,
        temperatura: tempRef
      },
      limites,
      resultados
    };
  }
  
  function gerarAlertasAmbientais(leituras) {
    const alertas = [];
  
    if (!leituras || leituras.length === 0) {
      return alertas;
    }
  
    const ultima = leituras[leituras.length - 1];
  
    const ph = num(ultima.ph);
    const turbidez = num(ultima.turbidez);
    const od = num(ultima.od);
    const cond = num(ultima.condutividade);
  
    if (ph > 0 && (ph < 6 || ph > 9)) {
      alertas.push("pH fora da faixa recomendada.");
    }
  
    if (turbidez > 5) {
      alertas.push("Turbidez elevada.");
    }
  
    if (od > 0 && od < 2) {
      alertas.push("Oxigênio dissolvido baixo.");
    }
  
    if (cond > 1000) {
      alertas.push("Condutividade elevada.");
    }
  
    return alertas;
  }
  
  function renderizarEstabilizacao(containerId, estabilizacao) {
    const container = document.getElementById(containerId);
  
    if (!container) return;
  
    if (!estabilizacao.limites) {
      container.innerHTML = `
        <div class="card">
          <strong>⚠ Estabilização</strong>
          <p>${estabilizacao.mensagem}</p>
        </div>
      `;
      return;
    }
  
    const linhas = estabilizacao.resultados.map((r) => {
      return `
        <div class="card" style="margin-top:10px;">
          <strong>
            ${r.referencia ? "Referência" : `Linha ${r.linha}`}
            - ${r.horario || ""}
          </strong>
  
          <p>pH: ${r.dentro.ph ? "✅" : "❌"}</p>
          <p>ORP: ${r.dentro.orp ? "✅" : "❌"}</p>
          <p>Condutividade: ${r.dentro.condutividade ? "✅" : "❌"}</p>
          <p>OD: ${r.dentro.od ? "✅" : "❌"}</p>
          <p>Temperatura: ${r.dentro.temperatura ? "✅" : "❌"}</p>
        </div>
      `;
    }).join("");
  
    container.innerHTML = `
      <div class="card">
        <strong>
          ${estabilizacao.estavel ? "✅ Poço estável" : "⚠ Poço não estabilizado"}
        </strong>
  
        <p>${estabilizacao.mensagem}</p>
  
        <hr style="border:none;border-top:1px solid #dde6f2;margin:12px 0;">
  
        <strong>Limites aceitos usando a 1ª leitura como referência</strong>
  
        <p>pH: ${estabilizacao.limites.phMin.toFixed(2)} até ${estabilizacao.limites.phMax.toFixed(2)}</p>
        <p>ORP: ${estabilizacao.limites.orpMin.toFixed(2)} até ${estabilizacao.limites.orpMax.toFixed(2)} mV</p>
        <p>Condutividade: ${estabilizacao.limites.condMin.toFixed(2)} até ${estabilizacao.limites.condMax.toFixed(2)}</p>
        <p>OD: ${estabilizacao.limites.odMin.toFixed(2)} até ${estabilizacao.limites.odMax.toFixed(2)}</p>
        <p>Temperatura: ${estabilizacao.limites.tempMin.toFixed(2)} até ${estabilizacao.limites.tempMax.toFixed(2)} °C</p>
      </div>
  
      ${linhas}
    `;
  }