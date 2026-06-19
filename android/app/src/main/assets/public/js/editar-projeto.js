const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const projetoLocalId = localStorage.getItem("projeto_selecionado");

if (!projetoLocalId) {
  alert("Selecione um projeto primeiro.");
  window.location.href = "projetos.html";
}

let projetoAtual = null;

async function carregarProjeto() {
  const projetos = await listarProjetosLocais();

  projetoAtual = projetos.find((p) => p.local_id === projetoLocalId);

  if (!projetoAtual) {
    alert("Projeto não encontrado.");
    window.location.href = "projetos.html";
    return;
  }

  document.getElementById("nomeProjeto").value = projetoAtual.nome || "";
  document.getElementById("clienteProjeto").value = projetoAtual.cliente || "";
  document.getElementById("processoComercial").value =
    projetoAtual.processo_comercial || "";
  document.getElementById("localProjeto").value = projetoAtual.local || "";
  document.getElementById("descricaoProjeto").value = projetoAtual.descricao || "";
}

async function salvarEdicaoProjeto() {
  const nome = document.getElementById("nomeProjeto").value.trim();

  if (!nome) {
    alert("Informe o nome do projeto.");
    return;
  }

  projetoAtual.nome = nome;
  projetoAtual.cliente = document.getElementById("clienteProjeto").value;
  projetoAtual.processo_comercial =
    document.getElementById("processoComercial").value;
  projetoAtual.local = document.getElementById("localProjeto").value;
  projetoAtual.descricao = document.getElementById("descricaoProjeto").value;

  projetoAtual.sincronizado = false;
  projetoAtual.atualizado_em = new Date().toISOString();

  await atualizarProjetoLocal(projetoAtual);

  alert("Projeto atualizado com sucesso.");
  window.location.href = "projeto-detalhe.html";
}

carregarProjeto();