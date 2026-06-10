const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const projetoLocalId = localStorage.getItem("projeto_selecionado");

if (!projetoLocalId) {
  window.location.href = "projetos.html";
}

let projetoAtual = null;

async function carregarProjeto() {
  const projetos = await listarProjetosLocais();
  const pocos = await listarPocosLocais();

  projetoAtual = projetos.find((p) => p.local_id === projetoLocalId);

  if (!projetoAtual) {
    alert("Projeto não encontrado.");
    window.location.href = "projetos.html";
    return;
  }

  document.getElementById("tituloProjeto").innerText = projetoAtual.nome;

  document.getElementById("infoProjeto").innerHTML = `
    <div class="card">
      <strong>${projetoAtual.nome}</strong>
      <p>Cliente: ${projetoAtual.cliente || "-"}</p>
      <p>Local: ${projetoAtual.local || "-"}</p>
      <p>${projetoAtual.descricao || ""}</p>
    </div>
  `;

  const pocosDoProjeto = pocos.filter(
    (p) => p.projeto_local_id === projetoAtual.local_id
  );

  const lista = document.getElementById("listaPocosProjeto");
  lista.innerHTML = "";

  if (pocosDoProjeto.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhum PM neste projeto</strong>
        <p>Adicione um ponto fixo para começar o monitoramento.</p>
      </div>
    `;
    return;
  }

  pocosDoProjeto.forEach((poco) => {
    lista.innerHTML += `
      <div class="poco-item" onclick="abrirHistorico('${poco.local_id}')">
        <div class="avatar">${poco.nome.substring(0,2).toUpperCase()}</div>

        <div class="poco-info">
          <strong>${poco.nome}</strong>
          <span>Tipo: ${poco.tipo || "-"}</span>
          <span>UTM E: ${poco.utm_e || "-"}</span>
          <span>UTM N: ${poco.utm_n || "-"}</span>
        </div>

        <div class="poco-value">→</div>
      </div>
    `;
  });
}

function novoPocoProjeto() {
  localStorage.setItem("projeto_selecionado", projetoAtual.local_id);
  window.location.href = "novo-poco.html";
}

function abrirHistorico(pocoLocalId) {
  localStorage.setItem("poco_selecionado", pocoLocalId);
  window.location.href = "historico-poco.html";
}

carregarProjeto();