const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

async function carregarProjetos() {
  const projetos = await listarProjetosLocais();
  const select = document.getElementById("projetoSelect");

  select.innerHTML = `<option value="">Selecione</option>`;

  projetos.forEach((projeto) => {
    const option = document.createElement("option");
    option.value = projeto.local_id;
    option.textContent = projeto.nome;
    select.appendChild(option);
  });

  const hoje = new Date();
  document.getElementById("mesReferencia").value = hoje.toISOString().slice(0, 7);
  document.getElementById("dataInicio").value = hoje.toISOString().split("T")[0];
}

async function salvarCampanha() {
  const projetoLocalId = document.getElementById("projetoSelect").value;
  const nome = document.getElementById("nomeCampanha").value.trim();

  if (!projetoLocalId || !nome) {
    alert("Informe o projeto e o nome da campanha.");
    return;
  }

  const campanha = {
    local_id: crypto.randomUUID(),
    usuario_id: usuario.id,
    projeto_local_id: projetoLocalId,
    nome,
    mes_referencia: document.getElementById("mesReferencia").value,
    data_inicio: document.getElementById("dataInicio").value,
    data_fim: document.getElementById("dataFim").value,
    observacoes: document.getElementById("observacoes").value,
    ativo: true,
    sincronizado: false,
    criado_em: new Date().toISOString()
  };

  await salvarCampanhaLocal(campanha);

  alert("Campanha criada com sucesso.");
  window.location.href = "campanhas.html";
}

carregarProjetos();