const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const campanhaLocalId = localStorage.getItem("campanha_selecionada");

if (!campanhaLocalId) {
  alert("Selecione uma campanha primeiro.");
  window.location.href = "campanhas.html";
}

let campanhaAtual = null;

async function carregarEdicaoCampanha() {
  const campanhas = await listarCampanhasLocais();
  const projetos = await listarProjetosLocais();

  campanhaAtual = campanhas.find((c) => c.local_id === campanhaLocalId);

  if (!campanhaAtual) {
    alert("Campanha não encontrada.");
    window.location.href = "campanhas.html";
    return;
  }

  const select = document.getElementById("projetoSelect");
  select.innerHTML = `<option value="">Selecione</option>`;

  projetos.forEach((projeto) => {
    const option = document.createElement("option");
    option.value = projeto.local_id;
    option.textContent = projeto.nome;
    select.appendChild(option);
  });

  document.getElementById("projetoSelect").value = campanhaAtual.projeto_local_id || "";
  document.getElementById("nomeCampanha").value = campanhaAtual.nome || "";
  document.getElementById("mesReferencia").value = campanhaAtual.mes_referencia || "";
  document.getElementById("dataInicio").value = campanhaAtual.data_inicio || "";
  document.getElementById("dataFim").value = campanhaAtual.data_fim || "";
  document.getElementById("observacoes").value = campanhaAtual.observacoes || "";
  document.getElementById("statusCampanha").value =
    campanhaAtual.ativo === false ? "false" : "true";
}

async function salvarEdicaoCampanha() {
  const projetoLocalId = document.getElementById("projetoSelect").value;
  const nome = document.getElementById("nomeCampanha").value.trim();

  if (!projetoLocalId || !nome) {
    alert("Informe o projeto e o nome da campanha.");
    return;
  }

  campanhaAtual.projeto_local_id = projetoLocalId;
  campanhaAtual.nome = nome;
  campanhaAtual.mes_referencia = document.getElementById("mesReferencia").value;
  campanhaAtual.data_inicio = document.getElementById("dataInicio").value;
  campanhaAtual.data_fim = document.getElementById("dataFim").value;
  campanhaAtual.observacoes = document.getElementById("observacoes").value;
  campanhaAtual.ativo = document.getElementById("statusCampanha").value === "true";
  campanhaAtual.sincronizado = false;
  campanhaAtual.atualizado_em = new Date().toISOString();

  await atualizarCampanhaLocal(campanhaAtual);

  alert("Campanha atualizada com sucesso.");
  window.location.href = "campanha-detalhe.html";
}

carregarEdicaoCampanha();