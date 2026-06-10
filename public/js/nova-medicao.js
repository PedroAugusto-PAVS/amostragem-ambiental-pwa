const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const pocoLocalId = localStorage.getItem("poco_selecionado");

if (!pocoLocalId) {
  alert("Selecione um PM primeiro.");
  window.location.href = "dashboard.html";
}

let pocoAtual = null;

const profundidadeTotalMesInput = document.getElementById("profundidadeTotalMes");
const nivelAguaInput = document.getElementById("nivelAgua");
const profundidadeBombaInput = document.getElementById("profundidadeBomba");

profundidadeTotalMesInput.addEventListener("input", atualizarCalculos);
nivelAguaInput.addEventListener("input", atualizarCalculos);
profundidadeBombaInput.addEventListener("input", atualizarCalculos);

async function carregarPoco() {
  const pocos = await listarPocosLocais();

  pocoAtual = pocos.find((p) => p.local_id === pocoLocalId);

  if (!pocoAtual) {
    alert("PM não encontrado.");
    window.location.href = "dashboard.html";
    return;
  }

  if (pocoAtual.ativo === false) {
    alert("Este PM está inativo. Reative antes de adicionar medição.");
    window.location.href = "historico-poco.html";
    return;
  }

  document.getElementById("nomePocoSelecionado").innerText = pocoAtual.nome;

  const hoje = new Date();

  document.getElementById("dataMedicao").value = hoje.toISOString().split("T")[0];
  document.getElementById("mesReferencia").value = hoje.toISOString().slice(0, 7);

  document.getElementById("profundidadeTotalMes").value =
    pocoAtual.profundidade_total || "";

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

function gerarHorarios() {
  const tbody = document.getElementById("leiturasBody");
  tbody.innerHTML = "";

  const horarioInicial = document.getElementById("horarioInicial").value;
  const quantidade = Number(document.getElementById("quantidadeLeituras").value) || 6;

  if (!horarioInicial) {
    alert("Informe o horário inicial.");
    return;
  }

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

    tbody.innerHTML += `
      <tr>
        <td><input value="${horaFormatada}"></td>
        <td><input type="number" step="0.01"></td>
        <td><input type="number" step="0.01"></td>
        <td><input type="number" step="0.01"></td>
        <td><input type="number" step="0.01"></td>
        <td><input type="number" step="0.01"></td>
        <td><input type="number" step="0.01"></td>
        <td>
          <select>
            <option value="Limpa">Limpa</option>
            <option value="Levemente Turva">Levemente Turva</option>
            <option value="Turva">Turva</option>
            <option value="Muito Turva">Muito Turva</option>
          </select>
        </td>
      </tr>
    `;
  }
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

function converterFotosBase64(files) {
  return Promise.all(
    Array.from(files).map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = () => {
          resolve({
            nome: file.name,
            tipo: file.type,
            base64: reader.result,
            criado_em: new Date().toISOString()
          });
        };

        reader.readAsDataURL(file);
      });
    })
  );
}

async function salvarMedicao() {
  atualizarCalculos();

  const dataMedicao = document.getElementById("dataMedicao").value;
  const mesReferencia = document.getElementById("mesReferencia").value;

  if (!dataMedicao || !mesReferencia) {
    alert("Informe a data da medição e o mês de referência.");
    return;
  }

  if (!document.getElementById("profundidadeTotalMes").value) {
    alert("Informe a profundidade total medida.");
    return;
  }

  const fotosFiles = document.getElementById("fotosMedicao").files;
  const fotosBase64 = await converterFotosBase64(fotosFiles);

  const medicao = {
    local_id: crypto.randomUUID(),
    poco_local_id: pocoAtual.local_id,
    poco_nome: pocoAtual.nome,

    usuario_id: usuario.id,
    coletor_nome: usuario.nome,

    data_medicao: dataMedicao,
    mes_referencia: mesReferencia,

    profundidade_total_mes: Number(document.getElementById("profundidadeTotalMes").value),
    nivel_agua: Number(document.getElementById("nivelAgua").value),
    profundidade_bomba: Number(document.getElementById("profundidadeBomba").value),

    coluna_agua: Number(document.getElementById("colunaAgua").innerText),
    volume_estagnado: Number(document.getElementById("volumeEstagnado").innerText),
    volume_purga: Number(document.getElementById("volumePurga").innerText),
    volume_total_esgotado: Number(document.getElementById("volumeTotalEsgotado").innerText),

    leituras: obterLeituras(),

    condicoes_ambientais: {
      cor_agua: document.getElementById("corAgua").value,
      odor_agua: document.getElementById("odorAgua").value,
      oleo_agua: document.getElementById("oleoAgua").value,
      material_flutuante: document.getElementById("materialFlutuante").value,
      espuma_agua: document.getElementById("espumaAgua").value,
      chuva_24h: document.getElementById("chuva24h").value,
      temperatura_ambiente: document.getElementById("temperaturaAmbiente").value,
      observacoes_gerais: document.getElementById("observacoesGerais").value
    },

    fotos: fotosBase64,

    sincronizado: false,
    criado_em: new Date().toISOString()
  };

  await salvarMedicaoLocal(medicao);

  alert("Medição salva com sucesso.");

  localStorage.setItem("poco_selecionado", pocoAtual.local_id);
  window.location.href = "historico-poco.html";
}

carregarPoco();