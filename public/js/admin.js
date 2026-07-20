const usuarioLogado = JSON.parse(localStorage.getItem("usuario"));

if (!usuarioLogado) {
  window.location.href = "index.html";
}

if (usuarioLogado.tipo !== "admin") {
  alert("Acesso permitido apenas para administradores.");
  window.location.href = "dashboard.html";
}

let usuariosCarregados = [];

async function carregarAdmin() {
  const { data, error } = await supabaseClient
    .from("usuarios")
    .select("id, nome, email, tipo, ativo, criado_em, atualizado_em")
    .order("nome", { ascending: true });

  if (error) {
    alert("Erro ao carregar usuarios: " + error.message);
    return;
  }

  usuariosCarregados = data || [];

  document.getElementById("totalUsuarios").innerText = usuariosCarregados.length;

  document.getElementById("totalColetores").innerText =
    usuariosCarregados.filter((u) => u.tipo === "coletor").length;

  document.getElementById("totalAdmins").innerText =
    usuariosCarregados.filter((u) => u.tipo === "admin").length;

  renderizarUsuarios();
}

function renderizarUsuarios() {
  const lista = document.getElementById("listaUsuarios");
  lista.innerHTML = "";

  if (usuariosCarregados.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhum usuario cadastrado</strong>
      </div>
    `;
    return;
  }

  usuariosCarregados.forEach((u) => {
    lista.innerHTML += `
      <div class="card">
        <strong>${u.nome || "Sem nome"}</strong>
        <p>Email: ${u.email || "-"}</p>
        <p>Tipo: ${u.tipo || "-"}</p>
        <p>Status: ${u.ativo === false ? "Inativo" : "Ativo"}</p>

        <div class="card-actions">
          <button class="btn-blue" onclick="editarUsuario('${u.id}')">
            Editar
          </button>

          <button
            class="btn-blue"
            style="background:${u.ativo === false ? "#16a34a" : "#f59e0b"}"
            onclick="alternarStatusUsuario('${u.id}')"
          >
            ${u.ativo === false ? "Ativar" : "Desativar"}
          </button>

          <button class="btn-danger" onclick="excluirUsuario('${u.id}')">
            Excluir
          </button>
        </div>
      </div>
    `;
  });
}

function limparFormularioUsuario() {
  document.getElementById("usuarioIdEdicao").value = "";
  document.getElementById("nomeUsuario").value = "";
  document.getElementById("emailUsuario").value = "";
  document.getElementById("senhaUsuario").value = "";
  document.getElementById("tipoUsuario").value = "coletor";
  document.getElementById("statusUsuario").value = "true";

  document.getElementById("emailUsuario").disabled = false;
  document.getElementById("senhaUsuario").disabled = false;
}

function editarUsuario(id) {
  const usuario = usuariosCarregados.find((u) => u.id === id);

  if (!usuario) {
    alert("Usuario nao encontrado.");
    return;
  }

  document.getElementById("usuarioIdEdicao").value = usuario.id;
  document.getElementById("nomeUsuario").value = usuario.nome || "";
  document.getElementById("emailUsuario").value = usuario.email || "";
  document.getElementById("senhaUsuario").value = "";
  document.getElementById("tipoUsuario").value = usuario.tipo || "coletor";
  document.getElementById("statusUsuario").value =
    usuario.ativo === false ? "false" : "true";

  document.getElementById("emailUsuario").disabled = true;
  document.getElementById("senhaUsuario").disabled = true;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function salvarUsuarioAdmin() {
  const idEdicao = document.getElementById("usuarioIdEdicao").value;

  const nome = document.getElementById("nomeUsuario").value.trim();
  const email = document.getElementById("emailUsuario").value.trim();
  const senha = document.getElementById("senhaUsuario").value;
  const tipo = document.getElementById("tipoUsuario").value;
  const ativo = document.getElementById("statusUsuario").value === "true";

  if (!nome || !email) {
    alert("Preencha nome e email.");
    return;
  }

  if (idEdicao) {
    await atualizarUsuario(idEdicao, {
      nome,
      tipo,
      ativo,
      atualizado_em: new Date().toISOString()
    });

    return;
  }

  if (!senha || senha.length < 6) {
    alert("Informe uma senha com pelo menos 6 caracteres.");
    return;
  }

  await criarUsuarioAuth({
    nome,
    email,
    senha,
    tipo,
    ativo
  });
}

async function criarUsuarioAuth({ nome, email, senha, tipo, ativo }) {
  const { data: sessaoAdmin, error: erroSessao } =
    await supabaseClient.auth.getSession();
  const accessToken = sessaoAdmin?.session?.access_token;

  if (erroSessao || !accessToken) {
    alert("Sessao do administrador expirada. Entre novamente para criar usuarios.");
    return;
  }

  const resposta = await fetch("/api/admin/usuarios", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      nome,
      email,
      senha,
      tipo,
      ativo
    })
  });

  const resultado = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    alert("Erro ao criar login: " + (resultado.error || "erro desconhecido."));
    return;
  }

  alert(
    resultado.recuperado
      ? "Usuario existente atualizado. Email confirmado e senha redefinida com sucesso."
      : "Usuario criado com sucesso. O email ja esta confirmado para login."
  );

  limparFormularioUsuario();
  carregarAdmin();
}

async function atualizarUsuario(id, dados) {
  const confirmar = confirm("Deseja salvar as alteracoes deste usuario?");

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("usuarios")
    .update(dados)
    .eq("id", id);

  if (error) {
    alert("Erro ao atualizar usuario: " + error.message);
    return;
  }

  alert("Usuario atualizado com sucesso.");

  limparFormularioUsuario();
  carregarAdmin();
}

async function alternarStatusUsuario(id) {
  const usuario = usuariosCarregados.find((u) => u.id === id);

  if (!usuario) {
    alert("Usuario nao encontrado.");
    return;
  }

  if (usuario.id === usuarioLogado.id) {
    alert("Voce nao pode desativar seu proprio usuario.");
    return;
  }

  const novoStatus = usuario.ativo === false ? true : false;

  const confirmar = confirm(
    novoStatus
      ? `Deseja ativar ${usuario.nome}?`
      : `Deseja desativar ${usuario.nome}?`
  );

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("usuarios")
    .update({
      ativo: novoStatus,
      atualizado_em: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    alert("Erro ao alterar status: " + error.message);
    return;
  }

  alert("Status atualizado com sucesso.");
  carregarAdmin();
}

async function excluirUsuario(id) {
  const usuario = usuariosCarregados.find((u) => u.id === id);

  if (!usuario) {
    alert("Usuario nao encontrado.");
    return;
  }

  if (usuario.id === usuarioLogado.id) {
    alert("Voce nao pode excluir seu proprio usuario.");
    return;
  }

  const confirmar = confirm(
    `Excluir permanentemente o usuario ${usuario.nome || usuario.email}? Esta acao nao pode ser desfeita.`
  );

  if (!confirmar) return;

  const { data: sessaoAdmin, error: erroSessao } =
    await supabaseClient.auth.getSession();
  const accessToken = sessaoAdmin?.session?.access_token;

  if (erroSessao || !accessToken) {
    alert("Sessao do administrador expirada. Entre novamente para excluir usuarios.");
    return;
  }

  const resposta = await fetch(`/api/admin/usuarios/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const resultado = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    alert("Erro ao excluir usuario: " + (resultado.error || "erro desconhecido."));
    return;
  }

  alert("Usuario excluido com sucesso.");
  limparFormularioUsuario();
  carregarAdmin();
}

carregarAdmin();
