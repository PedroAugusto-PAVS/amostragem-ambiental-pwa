const usuarioLocal = JSON.parse(localStorage.getItem("usuario") || "null");

let usuarioLogado = usuarioLocal;
let usuariosCarregados = [];
let formularioEmProcessamento = false;
let mensagemTimer = null;
const usuariosEmProcessamento = new Set();

const mensagensErro = {
  EMAIL_ALREADY_EXISTS: "Este e-mail já está cadastrado.",
  PASSWORD_TOO_SHORT: "A senha deve possuir pelo menos 6 caracteres.",
  INVALID_EMAIL: "Informe um e-mail válido.",
  INVALID_NAME: "Informe um nome válido.",
  INVALID_TYPE: "Informe um tipo de usuário válido.",
  INVALID_DATA: "Revise os dados informados.",
  NO_CONNECTION: "Sem conexão com a internet.",
  UNAUTHORIZED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Você não possui permissão para realizar esta operação.",
  USER_INACTIVE: "Seu usuário está inativo. Entre em contato com o administrador.",
  LAST_ACTIVE_ADMIN: "Não é possível remover ou inativar o último administrador ativo.",
  SELF_DEACTIVATE: "Você não pode inativar sua própria conta.",
  SELF_DELETE: "Você não pode excluir sua própria conta.",
  USER_NOT_FOUND: "Usuário não encontrado.",
  UNEXPECTED_ERROR: "Não foi possível concluir a operação. Tente novamente."
};

function tipoCanonico(tipo) {
  return tipo === "admin" ? "administrador" : tipo;
}

function mostrarMensagem(mensagem, tipo = "success") {
  const elemento = document.getElementById("adminMessage");
  clearTimeout(mensagemTimer);
  elemento.textContent = mensagem;
  elemento.className = `admin-message ${tipo}`;
  elemento.hidden = false;
  mensagemTimer = setTimeout(() => { elemento.hidden = true; }, 6000);
}

function mensagemPorErro(error) {
  if (!navigator.onLine || error?.name === "TypeError") return mensagensErro.NO_CONNECTION;
  return mensagensErro[error?.code] || error?.message || mensagensErro.UNEXPECTED_ERROR;
}

function textoSeguro(valor, padrao = "-") {
  return String(valor || "").trim() || padrao;
}

function normalizarPesquisa(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function atualizarEstadoFormulario() {
  const editando = Boolean(document.getElementById("usuarioIdEdicao").value);
  document.getElementById("campoSenhaUsuario").hidden = editando;
  document.getElementById("senhaUsuario").disabled = editando || formularioEmProcessamento;
  document.getElementById("statusUsuario").disabled = !editando || formularioEmProcessamento;
  document.getElementById("salvarUsuarioBtn").disabled = formularioEmProcessamento;
  document.getElementById("limparUsuarioBtn").disabled = formularioEmProcessamento;
}

function definirFormularioCarregando(carregando, texto = "Processando...") {
  formularioEmProcessamento = carregando;
  const botao = document.getElementById("salvarUsuarioBtn");
  botao.textContent = carregando ? texto : "Salvar usuário";
  atualizarEstadoFormulario();
}

async function executarOperacaoUsuario(chave, operacao, botao) {
  if (usuariosEmProcessamento.has(chave)) return;
  usuariosEmProcessamento.add(chave);
  if (botao) botao.disabled = true;
  try {
    return await operacao();
  } finally {
    usuariosEmProcessamento.delete(chave);
    if (botao?.isConnected) botao.disabled = false;
  }
}

async function validarAdministradorAtual() {
  const perfil = await window.hydrotrackAuth?.validarUsuarioAtivo({ exigirAdministrador: true });
  if (!perfil) return false;
  usuarioLogado = perfil;
  return true;
}

async function invocarAdminUsers(action, data = {}) {
  if (!navigator.onLine) throw { code: "NO_CONNECTION" };
  const { data: resultado, error } = await supabaseClient.functions.invoke("admin-users", {
    body: { action, data }
  });
  if (error) {
    let payload = resultado;
    if (!payload && error.context?.json) payload = await error.context.json().catch(() => null);
    throw { code: payload?.code || (error.context?.status === 403 ? "FORBIDDEN" : "UNEXPECTED_ERROR") };
  }
  if (!resultado?.success) throw { code: resultado?.code || "UNEXPECTED_ERROR" };
  return resultado;
}

function criarEstadoLista(texto) {
  const estado = document.createElement("div");
  estado.className = "dashboard-empty-state";
  const mensagem = document.createElement("p");
  mensagem.textContent = texto;
  estado.appendChild(mensagem);
  return estado;
}

async function carregarAdmin() {
  const lista = document.getElementById("listaUsuarios");
  lista.replaceChildren(criarEstadoLista("Carregando usuários..."));
  const { data, error } = await supabaseClient.from("usuarios")
    .select("id, nome, email, tipo, ativo, criado_em, atualizado_em").order("nome");
  if (error) {
    lista.replaceChildren(criarEstadoLista("Não foi possível carregar os usuários."));
    mostrarMensagem(mensagensErro.UNEXPECTED_ERROR, "error");
    return;
  }
  usuariosCarregados = (data || []).map((usuario) => ({ ...usuario, tipo: tipoCanonico(usuario.tipo) }));
  document.getElementById("totalUsuarios").textContent = usuariosCarregados.length;
  document.getElementById("totalColetores").textContent = usuariosCarregados.filter((u) => u.tipo === "coletor").length;
  document.getElementById("totalAdmins").textContent = usuariosCarregados.filter((u) => u.tipo === "administrador").length;
  renderizarUsuarios();
}

function usuariosFiltrados() {
  const pesquisa = normalizarPesquisa(document.getElementById("pesquisaUsuario").value);
  const tipo = document.getElementById("filtroTipo").value;
  const status = document.getElementById("filtroStatus").value;
  return usuariosCarregados.filter((usuario) => {
    const texto = normalizarPesquisa(`${usuario.nome || ""} ${usuario.email || ""}`);
    return (!pesquisa || texto.includes(pesquisa)) &&
      (tipo === "todos" || usuario.tipo === tipo) &&
      (status === "todos" || (status === "ativo") === (usuario.ativo !== false));
  });
}

function criarBotao(texto, classe, acao, id) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = classe;
  botao.textContent = texto;
  botao.disabled = usuariosEmProcessamento.has(id);
  botao.addEventListener("click", () => acao(botao));
  return botao;
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
  const tipo = document.createElement("p");
  tipo.textContent = `Tipo: ${usuario.tipo === "administrador" ? "Administrador" : "Coletor"}`;
  detalhes.appendChild(tipo);
  const acoes = document.createElement("div");
  acoes.className = "card-actions admin-user-actions";
  acoes.append(
    criarBotao("Editar", "btn-blue compact-btn", () => editarUsuario(usuario.id), usuario.id),
    criarBotao(usuario.ativo === false ? "Ativar" : "Inativar", `compact-btn ${usuario.ativo === false ? "btn-activate" : "btn-deactivate"}`, (botao) => alternarStatusUsuario(usuario.id, botao), usuario.id),
    criarBotao("Excluir", "btn-danger compact-btn", (botao) => excluirUsuario(usuario.id, botao), usuario.id)
  );
  card.append(cabecalho, detalhes, acoes);
  return card;
}

function renderizarUsuarios() {
  const lista = document.getElementById("listaUsuarios");
  const filtrados = usuariosFiltrados();
  lista.replaceChildren();
  document.getElementById("usuariosVisiveis").textContent = `${filtrados.length} ${filtrados.length === 1 ? "usuário" : "usuários"}`;
  if (!filtrados.length) lista.appendChild(criarEstadoLista("Nenhum usuário encontrado."));
  else filtrados.forEach((usuario) => lista.appendChild(criarCardUsuario(usuario)));
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
  if (!usuario) return mostrarMensagem(mensagensErro.USER_NOT_FOUND, "error");
  document.getElementById("usuarioIdEdicao").value = usuario.id;
  document.getElementById("nomeUsuario").value = usuario.nome || "";
  document.getElementById("emailUsuario").value = usuario.email || "";
  document.getElementById("senhaUsuario").value = "";
  document.getElementById("tipoUsuario").value = tipoCanonico(usuario.tipo);
  document.getElementById("statusUsuario").value = String(usuario.ativo !== false);
  atualizarEstadoFormulario();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function salvarUsuarioAdmin() {
  if (formularioEmProcessamento) return;
  const id = document.getElementById("usuarioIdEdicao").value;
  const data = {
    nome: document.getElementById("nomeUsuario").value.trim(),
    email: document.getElementById("emailUsuario").value.trim().toLowerCase(),
    tipo: document.getElementById("tipoUsuario").value
  };
  if (id) Object.assign(data, { id, ativo: document.getElementById("statusUsuario").value === "true" });
  else data.senha = document.getElementById("senhaUsuario").value;
  if (id && !confirm("Deseja salvar as alterações deste usuário?")) return;
  definirFormularioCarregando(true, id ? "Salvando..." : "Criando...");
  try {
    const resultado = await invocarAdminUsers(id ? "update" : "create", data);
    mostrarMensagem(resultado.message);
    limparFormularioUsuario();
    await carregarAdmin();
  } catch (error) {
    mostrarMensagem(mensagemPorErro(error), "error");
  } finally {
    definirFormularioCarregando(false);
  }
}

async function alternarStatusUsuario(id, botao) {
  const usuario = usuariosCarregados.find((item) => item.id === id);
  if (!usuario) return mostrarMensagem(mensagensErro.USER_NOT_FOUND, "error");
  const ativar = usuario.ativo === false;
  if (!ativar && !confirm(`Inativar ${textoSeguro(usuario.nome, usuario.email)}?`)) return;
  await executarOperacaoUsuario(id, async () => {
    try {
      const resultado = await invocarAdminUsers(ativar ? "activate" : "deactivate", { id });
      mostrarMensagem(resultado.message);
      await carregarAdmin();
    } catch (error) { mostrarMensagem(mensagemPorErro(error), "error"); }
  }, botao);
}

async function excluirUsuario(id, botao) {
  const usuario = usuariosCarregados.find((item) => item.id === id);
  if (!usuario) return mostrarMensagem(mensagensErro.USER_NOT_FOUND, "error");
  if (!confirm(`Excluir permanentemente ${textoSeguro(usuario.nome, usuario.email)}? Esta ação não pode ser desfeita.`)) return;
  await executarOperacaoUsuario(id, async () => {
    try {
      const resultado = await invocarAdminUsers("delete", { id });
      mostrarMensagem(resultado.message);
      limparFormularioUsuario();
      await carregarAdmin();
    } catch (error) { mostrarMensagem(mensagemPorErro(error), "error"); }
  }, botao);
}

document.getElementById("usuarioForm").addEventListener("submit", (event) => { event.preventDefault(); salvarUsuarioAdmin(); });
document.getElementById("pesquisaUsuario").addEventListener("input", renderizarUsuarios);
document.getElementById("filtroTipo").addEventListener("change", renderizarUsuarios);
document.getElementById("filtroStatus").addEventListener("change", renderizarUsuarios);

async function inicializarAdmin() {
  definirFormularioCarregando(true, "Carregando...");
  try {
    if (await validarAdministradorAtual()) {
      limparFormularioUsuario();
      await carregarAdmin();
    }
  } catch (error) { mostrarMensagem(mensagemPorErro(error), "error"); }
  finally { definirFormularioCarregando(false); }
}

inicializarAdmin();
