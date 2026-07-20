const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

let pocosCarregados = [];
let medicoesCarregadas = [];

function obterStatusAmostragemPoco(poco) {
  const status = poco?.perfil_construtivo?.status_amostragem || "";

  if (status === "SECO") {
    return { texto: "Poco seco", classe: "status-dry" };
  }

  if (status === "SEM_ALIQUOTA") {
    return { texto: "Sem aliquota suficiente", classe: "status-low-sample" };
  }

  return null;
}

async function carregarDashboard() {
  pocosCarregados = await listarPocosLocais();
  medicoesCarregadas = await listarMedicoesLocais();

  const pocosAtivos = pocosCarregados.filter((poco) => poco.ativo !== false);

  document.getElementById("totalPocos").innerText = pocosAtivos.length;
  document.getElementById("totalMedicoes").innerText = medicoesCarregadas.length;
  document.getElementById("totalPendentes").innerText =
    medicoesCarregadas.filter((medicao) => !medicao.sincronizado).length;

  renderizarPocos(pocosCarregados);
}

function renderizarPocos(pocos) {
  const lista = document.getElementById("listaPocos");
  const resumo = document.getElementById("resumoListaPocos");

  lista.innerHTML = "";

  const pocosAtivos = pocos
    .filter((poco) => poco.ativo !== false)
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));

  if (resumo) {
    const total = pocosCarregados.filter((poco) => poco.ativo !== false).length;

    resumo.innerText =
      pocosAtivos.length === total
        ? `${total} PM${total === 1 ? "" : "s"} ativo${total === 1 ? "" : "s"}`
        : `${pocosAtivos.length} de ${total} PMs encontrados`;
  }

  if (pocosAtivos.length === 0) {
    lista.innerHTML = `
      <div class="dashboard-empty-state">
        <strong>Nenhum PM ativo encontrado</strong>
        <p>Cadastre um ponto fixo para comecar o monitoramento.</p>
      </div>
    `;
    return;
  }

  pocosAtivos.forEach((poco) => {
    const medicoesDoPoco = medicoesCarregadas.filter(
      (medicao) => medicao.poco_local_id === poco.local_id
    );

    const ultimaMedicao = medicoesDoPoco[medicoesDoPoco.length - 1];
    const letras = poco.nome ? poco.nome.substring(0, 2).toUpperCase() : "PM";
    const ultimaData = ultimaMedicao?.data_medicao
      ? new Date(ultimaMedicao.data_medicao).toLocaleDateString("pt-BR")
      : null;
    const statusAmostragem = obterStatusAmostragemPoco(poco);

    lista.innerHTML += `
      <article class="poco-item dashboard-pm-card" onclick="abrirHistorico('${poco.local_id}')">
        <div class="avatar">${letras}</div>

        <div class="poco-info">
          <strong>${poco.nome || "PM sem nome"}</strong>
          <span>${poco.local_propriedade || "Local nao informado"}</span>

          <div class="pm-meta">
            <small>${poco.tipo || "Tipo nao informado"}</small>
            <small>${medicoesDoPoco.length} medicao${medicoesDoPoco.length === 1 ? "" : "es"}</small>
            ${
              statusAmostragem
                ? `<small class="${statusAmostragem.classe}">${statusAmostragem.texto}</small>`
                : ""
            }
          </div>
        </div>

        <div class="poco-value">
          ${
            ultimaMedicao
              ? `<span class="pm-water-level">${ultimaMedicao.nivel_agua || "-"} m</span><small>${ultimaData || "ultima coleta"}</small>`
              : `<span class="pm-water-level empty">-</span><small>sem dados</small>`
          }
        </div>
      </article>
    `;
  });
}

function filtrarPocos() {
  const termo = document.getElementById("pesquisaPoco").value.toLowerCase();

  const filtrados = pocosCarregados.filter(
    (poco) =>
      String(poco.nome || "").toLowerCase().includes(termo) ||
      String(poco.local_propriedade || "").toLowerCase().includes(termo) ||
      String(poco.tipo || "").toLowerCase().includes(termo)
  );

  renderizarPocos(filtrados);
}

function abrirHistorico(localId) {
  localStorage.setItem("poco_selecionado", localId);
  window.location.href = "historico-poco.html";
}

carregarDashboard();
