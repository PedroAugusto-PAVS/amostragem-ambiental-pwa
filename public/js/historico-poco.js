const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const pocoLocalId = localStorage.getItem("poco_selecionado");

if (!pocoLocalId) {
  window.location.href = "dashboard.html";
}

let pocoAtual = null;

async function carregarHistorico() {
  const pocos = await listarPocosLocais();
  const medicoes = await listarMedicoesLocais();

  pocoAtual = pocos.find((p) => p.local_id === pocoLocalId);

  if (!pocoAtual) {
    alert("Poço não encontrado.");
    window.location.href = "dashboard.html";
    return;
  }

  document.getElementById("tituloPoco").innerText = pocoAtual.nome;

  document.getElementById("infoPoco").innerHTML = `
    <div class="card">
      <strong>${pocoAtual.nome}</strong>
      <p>Tipo: ${pocoAtual.tipo || "-"}</p>
      <p>Local: ${pocoAtual.local_propriedade || "-"}</p>
      <p>UTM E: ${pocoAtual.utm_e || "-"}</p>
      <p>UTM N: ${pocoAtual.utm_n || "-"}</p>
      <p>Latitude: ${pocoAtual.latitude || "-"}</p>
      <p>Longitude: ${pocoAtual.longitude || "-"}</p>
      <p>Profundidade total: ${pocoAtual.profundidade_total || 0} m</p>
    </div>
  `;

  const historico = medicoes
    .filter((m) => m.poco_local_id === pocoLocalId)
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

  const lista = document.getElementById("listaHistorico");
  lista.innerHTML = "";

  if (historico.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhuma medição cadastrada</strong>
        <p>Adicione a primeira medição mensal desse poço.</p>
      </div>
    `;
    return;
  }

  historico.forEach((m) => {
    lista.innerHTML += `
      <div class="card">
        <strong>${m.mes_referencia || "Medição"}</strong>
        <p>Data: ${m.data_medicao || "-"}</p>
        <p>Nível d'água: ${m.nivel_agua || 0} m</p>
        <p>Coluna d'água: ${m.coluna_agua || 0} m</p>
        <p>Volume estagnado: ${m.volume_estagnado || 0} L</p>
        <p>Volume esgotado mínimo: ${m.volume_purga || 0} L</p>
        <p>Volume total esgotado: ${m.volume_total_esgotado || 0} L</p>
        <p>Status: ${m.sincronizado ? "Sincronizado" : "Pendente"}</p>
  
        <div class="card-actions">
          <button class="btn-blue" onclick="editarMedicao('${m.local_id}')">
            Editar
          </button>
        </div>
      </div>
    `;
  });
}

function novaMedicao() {
  localStorage.setItem("poco_selecionado", pocoLocalId);
  window.location.href = "nova-medicao.html";
}

function editarMedicao(localId) {
  localStorage.setItem("medicao_selecionada", localId);
  window.location.href = "editar-medicao.html";
}

carregarHistorico();