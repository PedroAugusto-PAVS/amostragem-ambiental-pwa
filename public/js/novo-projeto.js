const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

async function salvarProjeto() {
  const nome = document.getElementById("nomeProjeto").value.trim();

  if (!nome) {
    alert("Informe o nome do projeto.");
    return;
  }

  const projeto = {
    local_id: crypto.randomUUID(),
    usuario_id: usuario.id,
    nome,
    cliente: document.getElementById("clienteProjeto").value,
    local: document.getElementById("localProjeto").value,
    descricao: document.getElementById("descricaoProjeto").value,
    sincronizado: false,
    criado_em: new Date().toISOString()
  };

  await salvarProjetoLocal(projeto);

  alert("Projeto criado com sucesso.");
  window.location.href = "projetos.html";
}