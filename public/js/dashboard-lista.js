const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

let pocosCarregados = [];
let medicoesCarregadas = [];

async function carregarDashboard() {
  pocosCarregados = await listarPocosLocais();
  medicoesCarregadas = await listarMedicoesLocais();

  document.getElementById("totalPocos").innerText =
    pocosCarregados.filter((p) => p.ativo !== false).length;

  document.getElementById("totalMedicoes").innerText = medicoesCarregadas.length;

  document.getElementById("totalPendentes").innerText =
    medicoesCarregadas.filter((m) => !m.sincronizado).length;

  renderizarPocos(pocosCarregados);
}

function renderizarPocos(pocos) {
  const lista = document.getElementById("listaPocos");
  lista.innerHTML = "";

  const pocosAtivos = pocos.filter((poco) => poco.ativo !== false);

  if (pocosAtivos.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhum poço ativo cadastrado</strong>
        <p>Clique em adicionar para cadastrar um ponto fixo.</p>
      </div>
    `;
    return;
  }

  pocosAtivos.forEach((poco) => {
    const medicoesDoPoco = medicoesCarregadas.filter(
      (m) => m.poco_local_id === poco.local_id
    );

    const ultimaMedicao = medicoesDoPoco[medicoesDoPoco.length - 1];

    const letras = poco.nome
      ? poco.nome.substring(0, 2).toUpperCase()
      : "PO";

    lista.innerHTML += `
      <div class="poco-item" onclick="abrirHistorico('${poco.local_id}')">
        <div class="avatar">${letras}</div>

        <div class="poco-info">
          <strong>${poco.nome}</strong>
          <span>Local: ${poco.local_propriedade || "-"}</span>
          <span>Tipo: ${poco.tipo || "-"}</span>
          <span>Medições: ${medicoesDoPoco.length}</span>
        </div>

        <div class="poco-value">
          ${
            ultimaMedicao
              ? `💧 ${ultimaMedicao.nivel_agua || "-"} m`
              : "Sem<br>dados"
          }
        </div>
      </div>
    `;
  });
}

function filtrarPocos() {
  const termo = document.getElementById("pesquisaPoco").value.toLowerCase();

  const filtrados = pocosCarregados.filter((poco) =>
    poco.nome.toLowerCase().includes(termo)
  );

  renderizarPocos(filtrados);
}

function abrirHistorico(localId) {
  localStorage.setItem("poco_selecionado", localId);
  window.location.href = "historico-poco.html";
}

carregarDashboard();