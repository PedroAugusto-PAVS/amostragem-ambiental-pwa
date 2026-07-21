const usuarioLocal = JSON.parse(localStorage.getItem("usuario") || "null");

let usuarioLogado = usuarioLocal;
let usuariosCarregados = [];
let operacaoEmAndamento = false;
let mensagemTimer = null;

const mensagensErro = {
  EMAIL_EXISTS: "Este e-mail já está cadastrado.",
  PASSWORD_TOO_SHORT: "A senha deve possuir pelo menos 6 caracteres.",
  INVALID_EMAIL: "Informe um e-mail válido.",
  NO_CONNECTION: "Sem conexão com a internet.",
  NO_PERMISSION: "Você não possui permissão para realizar esta operação.",
  USER_INACTIVE: "Seu usuário está inativo.",
  LAST_ACTIVE_ADMIN: "O último administrador ativo não pode ser inativado, removido ou rebaixado.",
  SELF_DEACTIVATE: "Você não pode inativar sua própria conta.",
  SELF_DELETE: "Você não pode excluir sua própria conta.",
  USER_NOT_FOUND: "Usuário não encontrado.",
  INVALID_DATA: "Revise os dados informados.",
  UNEXPECTED: "Não foi possível concluir a operação. Tente novamente."
};

function textoSeguro(valor, padrao = "-") {
  const texto = String(valor || "").trim();
  return texto || padrao;
}

function normalizarPesquisa(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mostrarMensagem(mensagem, tipo = "success") {
  const elemento = document.getElementById("adminMessage");
  clearTimeout(mensagemTimer);
  elemento.textContent = mensagem;
  elemento.className = `admin-message ${tipo}`;
  elemento.hidden = false;

  mensagemTimer = setTimeout(() => {
    elemento.hidden = true;
  }, 6000);
}

function mensagemPorCodigo(codigo) {
  return mensagensErro[codigo] || mensagensErro.UNEXPECTED;
}

function definirCarregando(carregando, texto = "Processando...") {
  operacaoEmAndamento = carregando;
  document.querySelectorAll("button, input, select").forEach((elemento) => {
    if (elemento.id === "pesquisaUsuario" || elemento.id.startsWith("filtro")) {
      elemento.disabled = carregando;
      return;
    }

    elemento.disabled = carregando;
  });

  const botaoSalvar = document.getElementById("salvarUsuarioBtn");

  if (botaoSalvar) {
    botaoSalvar.textContent = carregando ? texto : "Salvar usuário";
  }

  if (!carregando) {
    atualizarEstadoFormulario();
  }
}

function atualizarEstadoFormulario() {
  const emEdicao = Boolean(document.getElementById("usuarioIdEdicao").value);
  document.getElementById("statusUsuario").disabled = !emEdicao || operacaoEmAndamento;
  document.getElementById("campoSenhaUsuario").hidden = emEdicao;
  document.getElementById("senhaUsuario").disabled = emEdicao || operacaoEmAndamento;
}

async function validarAdministradorAtual() {
  const { data: authData, error: authError } = await supabaseClient.auth.getUser();
  const authUser = authData?.user;

  if (authError || !authUser) {
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
    return false;
  }

  const { data: perfil, error: perfilError } = await supabaseClient
    .from("usuarios")
    .select("id, nome, email, tipo, ativo")
    .eq("id", authUser.id)
    .maybeSingle();

  if (perfilError || !perfil || perfil.ativo === false || perfil.tipo !== "admin") {
    await supabaseClient.auth.signOut();
    localStorage.removeItem("usuario");
    alert(
      perfil?.ativo === false
        ? "Seu usuário está inativo."
        : "Você não possui permissão para acessar esta página."
    );
    window.location.href = "index.html";
    return false;
  }

  usuarioLogado = perfil;
  localStorage.setItem("usuario", JSON.stringify(perfil));
  return true;
}

async function invocarAdminUsers(action, payload = {}) {
  if (!navigator.onLine) {
    throw { code: "NO_CONNECTION" };
  }

  const { data: sessaoData, error: sessaoError } = await supabaseClient.auth.getSession();
  const accessToken = sessaoData?.session?.access_token;

  if (sessaoError || !accessToken) {
    throw { code: "NO_PERMISSION" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const resposta = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });
    const resultado = await resposta.json().catch(() => ({}));

    if (!resposta.ok || resultado.ok === false) {
      throw { code: resultado.code || (resposta.status === 403 ? "NO_PERMISSION" : "UNEXPECTED") };
    }

    return resultado;
  } catch (error) {
    if (error?.code) throw error;
    throw { code: navigator.onLine ? "UNEXPECTED" : "NO_CONNECTION" };
  } finally {
    clearTimeout(timeout);
  }
}

async function carregarAdmin() {
  const lista = document.getElementById("listaUsuarios");
  lista.replaceChildren(criarEstadoLista("Carregando usuários..."));

  const { data, error } = await supabaseClient
    .from("usuarios")
    .select("id, nome, email, tipo, ativo, criado_em, atualizado_em")
    .order("nome", { ascending: true });

  if (error) {
    lista.replaceChildren(criarEstadoLista("Não foi possível carregar os usuários."));
    mostrarMensagem(mensagensErro.UNEXPECTED, "error");
    return;
  }

  usuariosCarregados = data || [];
  document.getElementById("totalUsuarios").textContent = usuariosCarregados.length;
  document.getElementById("totalColetores").textContent =
    usuariosCarregados.filter((usuario) => usuario.tipo === "coletor").length;
  document.getElementById("totalAdmins").textContent =
    usuariosCarregados.filter((usuario) => usuario.tipo === "admin").length;

  renderizarUsuarios();
}

function criarEstadoLista(texto) {
  const estado = document.createElement("div");
  estado.className = "dashboard-empty-state";
  const mensagem = document.createElement("p");
  mensagem.textContent = texto;
  estado.appendChild(mensagem);
  return estado;
}

function usuariosFiltrados() {
  const pesquisa = normalizarPesquisa(document.getElementById("pesquisaUsuario").value);
  const tipo = document.getElementById("filtroTipo").value;
  const status = document.getElementById("filtroStatus").value;

  return usuariosCarregados.filter((usuario) => {
    const correspondePesquisa = !pesquisa || normalizarPesquisa(
      `${usuario.nome || ""} ${usuario.email || ""}`
    ).includes(pesquisa);
    const correspondeTipo = tipo === "todos" || usuario.tipo === tipo;
    const correspondeStatus =
      status === "todos" ||
      (status === "ativo" && usuario.ativo !== false) ||
      (status === "inativo" && usuario.ativo === false);

    return correspondePesquisa && correspondeTipo && correspondeStatus;
  });
}

function criarBotao(texto, classe, acao) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = classe;
  botao.textContent = texto;
  botao.addEventListener("click", acao);
  return botao;
}

function criarLinhaInfo(rotulo, valor) {
  const linha = document.createElement("p");
  const titulo = document.createElement("span");
  titulo.textContent = `${rotulo}: `;
  linha.append(titulo, document.createTextNode(textoSeguro(valor)));
  return linha;
}

function criarCardUsuario(usuario) {
  const card = document.createElement("article");
  card.className = "card admin-user-card";

  const cabecalho = document.createElement("div");
  cabecalho.className = "admin-user-header";
  const identidade = document.createElement("div");
  const nome = document.createElement("strong");
  nome.textContent = textoSeguro(usuario.nome, "Sem nome");
  const email = document.createElement("p");
  email.textContent = textoSeguro(usuario.email);
  identidade.append(nome, email);

  const status = document.createElement("span");
  status.className = `admin-status ${usuario.ativo === false ? "inactive" : "active"}`;
  status.textContent = usuario.ativo === false ? "Inativo" : "Ativo";
  cabecalho.append(identidade, status);

  const detalhes = document.createElement("div");
  detalhes.className = "admin-user-details";
  detalhes.appendChild(
    criarLinhaInfo("Tipo", usuario.tipo === "admin" ? "Administrador" : "Coletor")
  );

  const acoes = document.createElement("div");
  acoes.className = "card-actions admin-user-actions";
  acoes.append(
    criarBotao("Editar", "btn-blue compact-btn", () => editarUsuario(usuario.id)),
    criarBotao(
      usuario.ativo === false ? "Ativar" : "Inativar",
      `compact-btn ${usuario.ativo === false ? "btn-activate" : "btn-deactivate"}`,
      () => alternarStatusUsuario(usuario.id)
    ),
    criarBotao("Excluir", "btn-danger compact-btn", () => excluirUsuario(usuario.id))
  );

  card.append(cabecalho, detalhes, acoes);
  return card;
}

function renderizarUsuarios() {
  const lista = document.getElementById("listaUsuarios");
  const filtrados = usuariosFiltrados();
  lista.replaceChildren();

  document.getElementById("usuariosVisiveis").textContent =
    `${filtrados.length} ${filtrados.length === 1 ? "usuário" : "usuários"}`;

  if (filtrados.length === 0) {
    lista.appendChild(criarEstadoLista("Nenhum usuário encontrado."));
    return;
  }

  filtrados.forEach((usuario) => lista.appendChild(criarCardUsuario(usuario)));
}

function limparFormularioUsuario() {
  document.getElementById("usuarioForm").reset();
  document.getElementById("usuarioIdEdicao").value = "";
  document.getElementById("tipoUsuario").value = "coletor";
  document.getElementById("statusUsuario").value = "true";
  atualizarEstadoFormulario();
}

function editarUsuario(id) {
  const usuario = usuariosCarregados.find((item) => item.id === id);

  if (!usuario) {
    mostrarMensagem(mensagensErro.USER_NOT_FOUND, "error");
    return;
  }

  document.getElementById("usuarioIdEdicao").value = usuario.id;
  document.getElementById("nomeUsuario").value = usuario.nome || "";
  document.getElementById("emailUsuario").value = usuario.email || "";
  document.getElementById("senhaUsuario").value = "";
  document.getElementById("tipoUsuario").value = usuario.tipo || "coletor";
  document.getElementById("statusUsuario").value = usuario.ativo === false ? "false" : "true";
  atualizarEstadoFormulario();
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("nomeUsuario").focus();
}

function validarFormulario({ nome, email, senha, emEdicao }) {
  if (!nome) return "Informe o nome do usuário.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mensagensErro.INVALID_EMAIL;
  if (!emEdicao && senha.length < 6) return mensagensErro.PASSWORD_TOO_SHORT;
  return "";
}

async function salvarUsuarioAdmin() {
  if (operacaoEmAndamento) return;

  const id = document.getElementById("usuarioIdEdicao").value;
  const dados = {
    id,
    nome: document.getElementById("nomeUsuario").value.trim(),
    email: document.getElementById("emailUsuario").value.trim().toLowerCase(),
    senha: document.getElementById("senhaUsuario").value,
    tipo: document.getElementById("tipoUsuario").value,
    ativo: document.getElementById("statusUsuario").value === "true"
  };
  const erroValidacao = validarFormulario({ ...dados, emEdicao: Boolean(id) });

  if (erroValidacao) {
    mostrarMensagem(erroValidacao, "error");
    return;
  }

  if (id && !confirm("Deseja salvar as alterações deste usuário?")) return;

  definirCarregando(true, id ? "Salvando..." : "Criando...");

  try {
    await invocarAdminUsers(
      id ? "update" : "create",
      id
        ? { id, nome: dados.nome, email: dados.email, tipo: dados.tipo, ativo: dados.ativo }
        : { nome: dados.nome, email: dados.email, senha: dados.senha, tipo: dados.tipo }
    );
    mostrarMensagem(id ? "Usuário atualizado com sucesso." : "Usuário criado com sucesso.");
    limparFormularioUsuario();
    await carregarAdmin();
  } catch (error) {
    mostrarMensagem(mensagemPorCodigo(error.code), "error");
  } finally {
    definirCarregando(false);
  }
}

async function alternarStatusUsuario(id) {
  if (operacaoEmAndamento) return;
  const usuario = usuariosCarregados.find((item) => item.id === id);

  if (!usuario) {
    mostrarMensagem(mensagensErro.USER_NOT_FOUND, "error");
    return;
  }

  const ativar = usuario.ativo === false;

  if (!ativar && usuario.id === usuarioLogado.id) {
    mostrarMensagem(mensagensErro.SELF_DEACTIVATE, "error");
    return;
  }

  if (!confirm(`${ativar ? "Ativar" : "Inativar"} ${textoSeguro(usuario.nome, usuario.email)}?`)) {
    return;
  }

  definirCarregando(true);

  try {
    await invocarAdminUsers(ativar ? "activate" : "deactivate", { id });
    mostrarMensagem(`Usuário ${ativar ? "ativado" : "inativado"} com sucesso.`);
    await carregarAdmin();
  } catch (error) {
    mostrarMensagem(mensagemPorCodigo(error.code), "error");
  } finally {
    definirCarregando(false);
  }
}

async function excluirUsuario(id) {
  if (operacaoEmAndamento) return;
  const usuario = usuariosCarregados.find((item) => item.id === id);

  if (!usuario) {
    mostrarMensagem(mensagensErro.USER_NOT_FOUND, "error");
    return;
  }

  if (usuario.id === usuarioLogado.id) {
    mostrarMensagem(mensagensErro.SELF_DELETE, "error");
    return;
  }

  if (!confirm(`Excluir permanentemente ${textoSeguro(usuario.nome, usuario.email)}? Esta ação não pode ser desfeita.`)) {
    return;
  }

  definirCarregando(true, "Excluindo...");

  try {
    await invocarAdminUsers("delete", { id });
    mostrarMensagem("Usuário excluído com sucesso.");
    limparFormularioUsuario();
    await carregarAdmin();
  } catch (error) {
    mostrarMensagem(mensagemPorCodigo(error.code), "error");
  } finally {
    definirCarregando(false);
  }
}

document.getElementById("usuarioForm").addEventListener("submit", (event) => {
  event.preventDefault();
  salvarUsuarioAdmin();
});
document.getElementById("pesquisaUsuario").addEventListener("input", renderizarUsuarios);
document.getElementById("filtroTipo").addEventListener("change", renderizarUsuarios);
document.getElementById("filtroStatus").addEventListener("change", renderizarUsuarios);

async function inicializarAdmin() {
  definirCarregando(true, "Carregando...");

  try {
    if (await validarAdministradorAtual()) {
      limparFormularioUsuario();
      await carregarAdmin();
    }
  } catch (_error) {
    mostrarMensagem(mensagensErro.UNEXPECTED, "error");
  } finally {
    definirCarregando(false);
  }
}

inicializarAdmin();
