const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const projetoLocalId = localStorage.getItem("projeto_selecionado");

if (!projetoLocalId) {
  window.location.href = "projetos.html";
}

let projetoAtual = null;

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
      <p>Processo Comercial: ${projetoAtual.processo_comercial || "-"}</p>
      <p>Local: ${projetoAtual.local || "-"}</p>
      <p>${projetoAtual.descricao || ""}</p>

      <br>

      <button class="btn-blue" onclick="editarProjeto()">
        Editar Projeto
      </button>
    </div>
  `;

  const pocosDoProjeto = pocos.filter(
    (p) => p.projeto_local_id === projetoAtual.local_id && p.ativo !== false
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
    const statusAmostragem = obterStatusAmostragemPoco(poco);

    lista.innerHTML += `
      <div
        class="poco-item interactive-card"
        role="link"
        tabindex="0"
        onclick="abrirHistorico('${poco.local_id}')"
        onkeydown="if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); abrirHistorico('${poco.local_id}'); }"
      >
        <div class="avatar">${poco.nome.substring(0, 2).toUpperCase()}</div>

        <div class="poco-info">
          <strong>${poco.nome}</strong>
          <div class="pm-meta">
            <small>${poco.tipo || "Tipo nao informado"}</small>
            ${
              statusAmostragem
                ? `<small class="${statusAmostragem.classe}">${statusAmostragem.texto}</small>`
                : ""
            }
          </div>
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

function editarProjeto() {
  localStorage.setItem("projeto_selecionado", projetoAtual.local_id);
  window.location.href = "editar-projeto.html";
}

function abrirHistorico(pocoLocalId) {
  localStorage.setItem("poco_selecionado", pocoLocalId);
  window.location.href = "historico-poco.html";
}

async function excluirProjeto() {
  if (!projetoAtual) {
    alert("Projeto não encontrado.");
    return;
  }

  const confirmar = confirm(
    `Tem certeza que deseja excluir o projeto "${projetoAtual.nome}"?`
  );

  if (!confirmar) return;

  projetoAtual.exclusao_remota_necessaria =
    projetoAtual.sincronizado === true || !!projetoAtual.sincronizado_em;
  projetoAtual.excluido = true;
  projetoAtual.sincronizado = false;
  projetoAtual.atualizado_em = new Date().toISOString();

  await atualizarProjetoLocal(projetoAtual);

  await sincronizarDados();

  alert("Projeto excluído com sucesso.");

  if (window.history.length > 1) {
    history.back();
  } else {
    window.location.href = "projetos.html";
  }
}

carregarProjeto();
