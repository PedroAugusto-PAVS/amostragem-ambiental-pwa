const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

let projetosCarregados = [];
let pocosCarregados = [];

async function carregarProjetos() {
  projetosCarregados = await listarProjetosLocais();
  pocosCarregados = await listarPocosLocais();

  renderizarProjetos(projetosCarregados);
}

function renderizarProjetos(projetos) {
  const lista = document.getElementById("listaProjetos");
  lista.innerHTML = "";

  if (projetos.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhum projeto cadastrado</strong>
        <p>Clique no botão + para criar um projeto.</p>
      </div>
    `;
    return;
  }

  projetos.forEach((projeto) => {
    const pocosDoProjeto = pocosCarregados.filter(
      (p) => p.projeto_local_id === projeto.local_id
    );

    lista.innerHTML += `
      <div class="poco-item" onclick="abrirProjeto('${projeto.local_id}')">
        <div class="avatar">PR</div>

        <div class="poco-info">
          <strong>${projeto.nome}</strong>
          <span>Cliente: ${projeto.cliente || "-"}</span>
          <span>Local: ${projeto.local || "-"}</span>
          <span>Poços: ${pocosDoProjeto.length}</span>
        </div>

        <div class="poco-value">
          →
        </div>
      </div>
    `;
  });
}

function filtrarProjetos() {
  const termo = document.getElementById("pesquisaProjeto").value.toLowerCase();

  const filtrados = projetosCarregados.filter((projeto) =>
    projeto.nome.toLowerCase().includes(termo) ||
    String(projeto.cliente || "").toLowerCase().includes(termo)
  );

  renderizarProjetos(filtrados);
}

function abrirProjeto(localId) {
  localStorage.setItem("projeto_selecionado", localId);
  window.location.href = "projeto-detalhe.html";
}

carregarProjetos();