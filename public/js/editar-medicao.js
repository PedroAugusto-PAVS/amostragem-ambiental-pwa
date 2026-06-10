const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const medicaoLocalId = localStorage.getItem("medicao_selecionada");

if (!medicaoLocalId) {
  alert("Selecione uma medição primeiro.");
  window.location.href = "dashboard.html";
}

let medicaoAtual = null;
let pocoAtual = null;

const profundidadeTotalMesInput = document.getElementById("profundidadeTotalMes");
const nivelAguaInput = document.getElementById("nivelAgua");
const profundidadeBombaInput = document.getElementById("profundidadeBomba");

profundidadeTotalMesInput.addEventListener("input", atualizarCalculos);
nivelAguaInput.addEventListener("input", atualizarCalculos);
profundidadeBombaInput.addEventListener("input", atualizarCalculos);

async function carregarEdicao() {
  const medicoes = await listarMedicoesLocais();
  const pocos = await listarPocosLocais();

  medicaoAtual = medicoes.find((m) => m.local_id === medicaoLocalId);

  if (!medicaoAtual) {
    alert("Medição não encontrada.");
    window.location.href = "dashboard.html";
    return;
  }

  pocoAtual = pocos.find((p) => p.local_id === medicaoAtual.poco_local_id);

  if (!pocoAtual) {
    alert("Poço da medição não encontrado.");
    window.location.href = "dashboard.html";
    return;
  }

  document.getElementById("nomePocoSelecionado").innerText = pocoAtual.nome;

  document.getElementById("dataMedicao").value = medicaoAtual.data_medicao || "";
  document.getElementById("mesReferencia").value = medicaoAtual.mes_referencia || "";
  document.getElementById("profundidadeTotalMes").value = medicaoAtual.profundidade_total_mes || "";
  document.getElementById("nivelAgua").value = medicaoAtual.nivel_agua || "";
  document.getElementById("profundidadeBomba").value = medicaoAtual.profundidade_bomba || "";

  const c = medicaoAtual.condicoes_ambientais || {};

  document.getElementById("corAgua").value = c.cor_agua || "";
  document.getElementById("odorAgua").value = c.odor_agua || "";
  document.getElementById("oleoAgua").value = c.oleo_agua || "";
  document.getElementById("materialFlutuante").value = c.material_flutuante || "";
  document.getElementById("espumaAgua").value = c.espuma_agua || "";
  document.getElementById("chuva24h").value = c.chuva_24h || "";
  document.getElementById("temperaturaAmbiente").value = c.temperatura_ambiente || "";
  document.getElementById("observacoesGerais").value = c.observacoes_gerais || "";

  renderizarLeituras(medicaoAtual.leituras || []);

  atualizarCalculos();
}

function atualizarCalculos() {
  if (!pocoAtual) return;

  const profundidadeTotal = document.getElementById("profundidadeTotalMes").value;
  const nivelAgua = document.getElementById("nivelAgua").value;
  const profundidadeBomba = document.getElementById("profundidadeBomba").value;
  const diametroPoco = pocoAtual.diametro;

  const coluna = calcularColunaAgua(profundidadeTotal, nivelAgua);
  const volumeEstagnado = calcularVolumeEstagnado(coluna, diametroPoco);
  const volumePurga = calcularVolumePurga(profundidadeBomba);
  const volumeTotalEsgotado = calcularVolumeTotalEsgotado(volumeEstagnado);

  document.getElementById("colunaAgua").innerText = coluna;
  document.getElementById("volumeEstagnado").innerText = volumeEstagnado;
  document.getElementById("volumePurga").innerText = volumePurga;
  document.getElementById("volumeTotalEsgotado").innerText = volumeTotalEsgotado;
}

function renderizarLeituras(leituras) {
  const tbody = document.getElementById("leiturasBody");
  tbody.innerHTML = "";

  leituras.forEach((l) => {
    tbody.innerHTML += `
      <tr>
        <td><input value="${l.horario || ""}"></td>
        <td><input type="number" step="0.01" value="${l.ph || ""}"></td>
        <td><input type="number" step="0.01" value="${l.condutividade || ""}"></td>
        <td><input type="number" step="0.01" value="${l.temperatura || ""}"></td>
        <td><input type="number" step="0.01" value="${l.od || ""}"></td>
        <td><input type="number" step="0.01" value="${l.orp || ""}"></td>
        <td><input type="number" step="0.01" value="${l.turbidez || ""}"></td>
        <td>
          <select>
            <option value="Limpa" ${l.aspecto === "Limpa" ? "selected" : ""}>Limpa</option>
            <option value="Levemente Turva" ${l.aspecto === "Levemente Turva" ? "selected" : ""}>Levemente Turva</option>
            <option value="Turva" ${l.aspecto === "Turva" ? "selected" : ""}>Turva</option>
            <option value="Muito Turva" ${l.aspecto === "Muito Turva" ? "selected" : ""}>Muito Turva</option>
          </select>
        </td>
      </tr>
    `;
  });
}

function gerarHorarios() {
  const horarioInicial = document.getElementById("horarioInicial").value;
  const quantidade = Number(document.getElementById("quantidadeLeituras").value) || 6;

  if (!horarioInicial) {
    alert("Informe o horário inicial.");
    return;
  }

  const leituras = [];
  const [hora, minuto] = horarioInicial.split(":").map(Number);

  const dataBase = new Date();
  dataBase.setHours(hora);
  dataBase.setMinutes(minuto);
  dataBase.setSeconds(0);

  for (let i = 0; i < quantidade; i++) {
    const horario = new Date(dataBase.getTime() + i * 3 * 60000);

    const horaFormatada = horario.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });

    leituras.push({
      horario: horaFormatada,
      ph: "",
      condutividade: "",
      temperatura: "",
      od: "",
      orp: "",
      turbidez: "",
      aspecto: "Limpa"
    });
  }

  renderizarLeituras(leituras);
}

function obterLeituras() {
  const linhas = document.querySelectorAll("#leiturasBody tr");
  const leituras = [];

  linhas.forEach((linha) => {
    const inputs = linha.querySelectorAll("input");
    const select = linha.querySelector("select");

    leituras.push({
      horario: inputs[0].value,
      ph: inputs[1].value,
      condutividade: inputs[2].value,
      temperatura: inputs[3].value,
      od: inputs[4].value,
      orp: inputs[5].value,
      turbidez: inputs[6].value,
      aspecto: select.value
    });
  });

  return leituras;
}

async function salvarEdicaoMedicao() {
  atualizarCalculos();

  medicaoAtual.data_medicao = document.getElementById("dataMedicao").value;
  medicaoAtual.mes_referencia = document.getElementById("mesReferencia").value;

  medicaoAtual.profundidade_total_mes = Number(document.getElementById("profundidadeTotalMes").value);
  medicaoAtual.nivel_agua = Number(document.getElementById("nivelAgua").value);
  medicaoAtual.profundidade_bomba = Number(document.getElementById("profundidadeBomba").value);

  medicaoAtual.coluna_agua = Number(document.getElementById("colunaAgua").innerText);
  medicaoAtual.volume_estagnado = Number(document.getElementById("volumeEstagnado").innerText);
  medicaoAtual.volume_purga = Number(document.getElementById("volumePurga").innerText);
  medicaoAtual.volume_total_esgotado = Number(document.getElementById("volumeTotalEsgotado").innerText);

  medicaoAtual.leituras = obterLeituras();

  medicaoAtual.condicoes_ambientais = {
    cor_agua: document.getElementById("corAgua").value,
    odor_agua: document.getElementById("odorAgua").value,
    oleo_agua: document.getElementById("oleoAgua").value,
    material_flutuante: document.getElementById("materialFlutuante").value,
    espuma_agua: document.getElementById("espumaAgua").value,
    chuva_24h: document.getElementById("chuva24h").value,
    temperatura_ambiente: document.getElementById("temperaturaAmbiente").value,
    observacoes_gerais: document.getElementById("observacoesGerais").value
  };

  medicaoAtual.sincronizado = false;
  medicaoAtual.atualizado_em = new Date().toISOString();

  await atualizarMedicaoLocal(medicaoAtual);

  alert("Medição atualizada com sucesso.");

  localStorage.setItem("poco_selecionado", medicaoAtual.poco_local_id);
  window.location.href = "historico-poco.html";
}

carregarEdicao();