const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const statusInternet = document.getElementById("statusInternet");
const statusSync = document.getElementById("statusSync");

window.addEventListener("online", atualizarStatusInternet);
window.addEventListener("offline", atualizarStatusInternet);

function atualizarStatusInternet() {
  statusInternet.innerText = navigator.onLine ? "Online" : "Offline";
}

atualizarStatusInternet();

const profundidadeTotalInput = document.getElementById("profundidadeTotal");
const nivelAguaInput = document.getElementById("nivelAgua");
const profundidadeBombaInput = document.getElementById("profundidadeBomba");

profundidadeTotalInput.addEventListener("input", atualizarCalculos);
nivelAguaInput.addEventListener("input", atualizarCalculos);
profundidadeBombaInput.addEventListener("input", atualizarCalculos);

function atualizarCalculos() {
  const profundidadeTotal = Number(profundidadeTotalInput.value);
  const nivelAgua = Number(nivelAguaInput.value);
  const profundidadeBomba = Number(profundidadeBombaInput.value);

  const coluna = calcularColunaAgua(profundidadeTotal, nivelAgua);
  const volumeEstagnado = calcularVolumeEstagnado(coluna);
  const volumePurga = calcularVolumePurga(profundidadeBomba);

  document.getElementById("colunaAgua").innerText = coluna;
  document.getElementById("volumeEstagnado").innerText = volumeEstagnado;
  document.getElementById("volumePurga").innerText = volumePurga;
}

function gerarHorarios() {
  const tbody = document.getElementById("leiturasBody");
  tbody.innerHTML = "";

  const agora = new Date();

  for (let i = 0; i < 6; i++) {
    const horario = new Date(agora.getTime() + i * 3 * 60000);

    const horaFormatada = horario.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });

    tbody.innerHTML += `
      <tr>
        <td><input value="${horaFormatada}" /></td>
        <td><input type="number" step="0.01" /></td>
        <td><input type="number" step="0.01" /></td>
        <td><input type="number" step="0.01" /></td>
        <td><input type="number" step="0.01" /></td>
        <td><input type="number" step="0.01" /></td>
      </tr>
    `;
  }
}

function obterLeituras() {
  const linhas = document.querySelectorAll("#leiturasBody tr");
  const leituras = [];

  linhas.forEach((linha) => {
    const inputs = linha.querySelectorAll("input");

    leituras.push({
      horario: inputs[0].value,
      ph: inputs[1].value,
      condutividade: inputs[2].value,
      temperatura: inputs[3].value,
      od: inputs[4].value,
      orp: inputs[5].value
    });
  });

  return leituras;
}

async function converterFotoBase64(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function capturarGPS() {
  if (!navigator.geolocation) {
    alert("GPS não disponível neste aparelho.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      alert(
        `GPS capturado: ${position.coords.latitude}, ${position.coords.longitude}`
      );

      localStorage.setItem(
        "gps_atual",
        JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      );
    },
    () => {
      alert("Não foi possível capturar o GPS.");
    }
  );
}

document.getElementById("fichaForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  atualizarCalculos();

  const fotoFile = document.getElementById("fotoPoco").files[0];
  const fotoBase64 = await converterFotoBase64(fotoFile);

  const gps = JSON.parse(localStorage.getItem("gps_atual")) || null;

  const ficha = {
    local_id: crypto.randomUUID(),
    usuario_id: usuario.id,
    coletor_nome: usuario.nome,
    tipo_poco: document.getElementById("tipoPoco").value,
    nome_poco: document.getElementById("nomePoco").value,
    local_propriedade: document.getElementById("localPropriedade").value,
    utm_e: document.getElementById("utmE").value,
    utm_n: document.getElementById("utmN").value,
    gps,
    profundidade_total: Number(document.getElementById("profundidadeTotal").value),
    nivel_agua: Number(document.getElementById("nivelAgua").value),
    profundidade_bomba: Number(document.getElementById("profundidadeBomba").value),
    coluna_agua: Number(document.getElementById("colunaAgua").innerText),
    volume_estagnado: Number(document.getElementById("volumeEstagnado").innerText),
    volume_purga: Number(document.getElementById("volumePurga").innerText),
    leituras: obterLeituras(),
    foto_base64: fotoBase64,
    sincronizado: false,
    criado_em: new Date().toISOString()
  };

  await salvarFichaLocal(ficha);

  alert("Ficha salva offline com sucesso!");
});

async function logout() {
  await supabaseClient.auth.signOut();
  localStorage.clear();
  window.location.href = "index.html";
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}