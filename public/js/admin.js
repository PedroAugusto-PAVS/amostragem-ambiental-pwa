const usuarioLocal = JSON.parse(
  localStorage.getItem("usuario") || "null"
);

let usuarioLogado = usuarioLocal;
let usuariosCarregados = [];
let formularioEmProcessamento = false;
let mensagemTimer = null;

const usuariosEmProcessamento = new Set();

const mensagensErro = {
  EMAIL_ALREADY_EXISTS:
    "Este e-mail já está cadastrado.",

  PASSWORD_TOO_SHORT:
    "A senha deve possuir pelo menos 6 caracteres.",

  INVALID_EMAIL:
    "Informe um e-mail válido.",

  INVALID_NAME:
    "Informe um nome válido.",

  INVALID_TYPE:
    "Informe um tipo de usuário válido.",

  INVALID_DATA:
    "Revise os dados informados.",

  NO_CONNECTION:
    "Sem conexão com a internet.",

  UNAUTHORIZED:
    "Sua sessão expirou. Entre novamente.",

  FORBIDDEN:
    "Você não possui permissão para realizar esta operação.",

  USER_INACTIVE:
    "Seu usuário está inativo. Entre em contato com o administrador.",

  LAST_ACTIVE_ADMIN:
    "Não é possível remover ou inativar o último administrador ativo.",

  SELF_DEACTIVATE:
    "Você não pode inativar sua própria conta.",

  SELF_DELETE:
    "Você não pode excluir sua própria conta.",

  MAIN_ADMIN_REQUIRED:
    "Somente o administrador principal pode excluir usuários.",

  MAIN_ADMIN_PROTECTED:
    "O administrador principal não pode ser inativado ou transformado em coletor.",

  MAIN_ADMIN_DELETE_NOT_ALLOWED:
    "O administrador principal não pode ser excluído.",

  USER_NOT_FOUND:
    "Usuário não encontrado.",

  UNEXPECTED_ERROR:
    "Não foi possível concluir a operação. Tente novamente."
};

/*
 * O banco utiliza:
 * - admin
 * - coletor
 *
 * A interface utiliza:
 * - administrador
 * - coletor
 */
function tipoCanonico(tipo) {
  return tipo === "admin"
    ? "administrador"
    : tipo;
}

function mostrarMensagem(
  mensagem,
  tipo = "success"
) {
  const elemento =
    document.getElementById("adminMessage");

  if (!elemento) {
    return;
  }

  clearTimeout(mensagemTimer);

  elemento.textContent = mensagem;
  elemento.className =
    `admin-message ${tipo}`;

  elemento.hidden = false;

  mensagemTimer = setTimeout(() => {
    elemento.hidden = true;
  }, 6000);
}

function mensagemPorErro(error) {
  if (
    !navigator.onLine ||
    error?.name === "TypeError"
  ) {
    return mensagensErro.NO_CONNECTION;
  }

  return (
    mensagensErro[error?.code] ||
    error?.message ||
    mensagensErro.UNEXPECTED_ERROR
  );
}

function textoSeguro(
  valor,
  padrao = "-"
) {
  return (
    String(valor || "").trim() ||
    padrao
  );
}

function normalizarPesquisa(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

function usuarioAtualEhPrincipal() {
  return (
    usuarioLogado?.admin_principal === true
  );
}

function usuarioEhOAtual(usuario) {
  return (
    usuario?.id &&
    usuarioLogado?.id &&
    usuario.id === usuarioLogado.id
  );
}

function usuarioEhPrincipal(usuario) {
  return (
    usuario?.admin_principal === true
  );
}

function atualizarEstadoFormulario() {
  const campoId =
    document.getElementById(
      "usuarioIdEdicao"
    );

  const campoSenha =
    document.getElementById(
      "campoSenhaUsuario"
    );

  const senha =
    document.getElementById(
      "senhaUsuario"
    );

  const status =
    document.getElementById(
      "statusUsuario"
    );

  const tipo =
    document.getElementById(
      "tipoUsuario"
    );

  const salvar =
    document.getElementById(
      "salvarUsuarioBtn"
    );

  const limpar =
    document.getElementById(
      "limparUsuarioBtn"
    );

  const editando =
    Boolean(campoId?.value);

  const usuarioEmEdicao =
    usuariosCarregados.find(
      (usuario) =>
        usuario.id === campoId?.value
    );

  const editandoPrincipal =
    usuarioEmEdicao?.admin_principal === true;

  if (campoSenha) {
    campoSenha.hidden = editando;
  }

  if (senha) {
    senha.disabled =
      editando ||
      formularioEmProcessamento;
  }

  if (status) {
    status.disabled =
      !editando ||
      formularioEmProcessamento ||
      editandoPrincipal;
  }

  /*
   * O administrador principal não pode
   * ser transformado em coletor.
   */
  if (tipo) {
    tipo.disabled =
      formularioEmProcessamento ||
      editandoPrincipal;
  }

  if (salvar) {
    salvar.disabled =
      formularioEmProcessamento;
  }

  if (limpar) {
    limpar.disabled =
      formularioEmProcessamento;
  }
}

function definirFormularioCarregando(
  carregando,
  texto = "Processando..."
) {
  formularioEmProcessamento =
    carregando;

  const botao =
    document.getElementById(
      "salvarUsuarioBtn"
    );

  if (botao) {
    botao.textContent =
      carregando
        ? texto
        : "Salvar usuário";
  }

  atualizarEstadoFormulario();
}

async function executarOperacaoUsuario(
  chave,
  operacao,
  botao
) {
  if (
    usuariosEmProcessamento.has(chave)
  ) {
    return;
  }

  usuariosEmProcessamento.add(chave);

  if (botao) {
    botao.disabled = true;
  }

  try {
    return await operacao();
  } finally {
    usuariosEmProcessamento.delete(chave);

    if (
      botao?.isConnected
    ) {
      botao.disabled = false;
    }
  }
}

/*
 * Valida o usuário utilizando o sistema
 * de autenticação já existente.
 *
 * Depois busca diretamente no banco
 * o campo admin_principal.
 */
async function validarAdministradorAtual() {
  const perfil =
    await window.hydrotrackAuth
      ?.validarUsuarioAtivo({
        exigirAdministrador: true
      });

  if (!perfil) {
    return false;
  }

  const {
    data: perfilAtual,
    error
  } = await supabaseClient
    .from("usuarios")
    .select(`
      id,
      nome,
      email,
      tipo,
      ativo,
      admin_principal
    `)
    .eq("id", perfil.id)
    .maybeSingle();

  if (
    error ||
    !perfilAtual
  ) {
    console.error(
      "Erro ao validar administrador:",
      error
    );

    throw {
      code: "UNAUTHORIZED",
      message:
        "Não foi possível validar o administrador atual."
    };
  }

  if (
    perfilAtual.ativo !== true ||
    perfilAtual.tipo !== "admin"
  ) {
    throw {
      code: "FORBIDDEN"
    };
  }

  usuarioLogado = {
    ...perfil,
    ...perfilAtual,

    tipo:
      tipoCanonico(
        perfilAtual.tipo
      ),

    admin_principal:
      perfilAtual
        .admin_principal === true
  };

  return true;
}

async function invocarAdminUsers(
  action,
  data = {}
) {
  if (!navigator.onLine) {
    throw {
      code: "NO_CONNECTION"
    };
  }

  const {
    data: resultado,
    error
  } =
    await supabaseClient.functions.invoke(
      "admin-users",
      {
        body: {
          action,
          data
        }
      }
    );

  if (error) {
    let payload = resultado;

    /*
     * Algumas versões do Supabase colocam
     * a resposta da Edge Function dentro
     * de error.context.
     */
    if (
      !payload &&
      error.context?.json
    ) {
      payload =
        await error.context
          .json()
          .catch(() => null);
    }

    throw {
      code:
        payload?.code ||
        (
          error.context?.status === 403
            ? "FORBIDDEN"
            : "UNEXPECTED_ERROR"
        ),

      message:
        payload?.message ||
        error?.message
    };
  }

  if (
    !resultado?.success
  ) {
    throw {
      code:
        resultado?.code ||
        "UNEXPECTED_ERROR",

      message:
        resultado?.message
    };
  }

  return resultado;
}

function criarEstadoLista(texto) {
  const estado =
    document.createElement("div");

  estado.className =
    "dashboard-empty-state";

  const mensagem =
    document.createElement("p");

  mensagem.textContent = texto;

  estado.appendChild(mensagem);

  return estado;
}

async function carregarAdmin() {
  const lista =
    document.getElementById(
      "listaUsuarios"
    );

  if (!lista) {
    return;
  }

  lista.replaceChildren(
    criarEstadoLista(
      "Carregando usuários..."
    )
  );

  const {
    data,
    error
  } = await supabaseClient
    .from("usuarios")
    .select(`
      id,
      nome,
      email,
      tipo,
      ativo,
      admin_principal,
      criado_em,
      atualizado_em
    `)
    .order("nome");

  if (error) {
    console.error(
      "Erro ao carregar usuários:",
      error
    );

    lista.replaceChildren(
      criarEstadoLista(
        "Não foi possível carregar os usuários."
      )
    );

    mostrarMensagem(
      mensagensErro.UNEXPECTED_ERROR,
      "error"
    );

    return;
  }

  usuariosCarregados =
    (data || []).map(
      (usuario) => ({
        ...usuario,

        tipo:
          tipoCanonico(
            usuario.tipo
          ),

        admin_principal:
          usuario
            .admin_principal === true
      })
    );

  const totalUsuarios =
    document.getElementById(
      "totalUsuarios"
    );

  const totalColetores =
    document.getElementById(
      "totalColetores"
    );

  const totalAdmins =
    document.getElementById(
      "totalAdmins"
    );

  if (totalUsuarios) {
    totalUsuarios.textContent =
      usuariosCarregados.length;
  }

  if (totalColetores) {
    totalColetores.textContent =
      usuariosCarregados.filter(
        (usuario) =>
          usuario.tipo === "coletor"
      ).length;
  }

  if (totalAdmins) {
    totalAdmins.textContent =
      usuariosCarregados.filter(
        (usuario) =>
          usuario.tipo ===
          "administrador"
      ).length;
  }

  renderizarUsuarios();
}

function usuariosFiltrados() {
  const campoPesquisa =
    document.getElementById(
      "pesquisaUsuario"
    );

  const campoTipo =
    document.getElementById(
      "filtroTipo"
    );

  const campoStatus =
    document.getElementById(
      "filtroStatus"
    );

  const pesquisa =
    normalizarPesquisa(
      campoPesquisa?.value
    );

  const tipo =
    campoTipo?.value || "todos";

  const status =
    campoStatus?.value || "todos";

  return usuariosCarregados.filter(
    (usuario) => {
      const texto =
        normalizarPesquisa(
          `${usuario.nome || ""} ${usuario.email || ""}`
        );

      const correspondePesquisa =
        !pesquisa ||
        texto.includes(pesquisa);

      const correspondeTipo =
        tipo === "todos" ||
        usuario.tipo === tipo;

      const correspondeStatus =
        status === "todos" ||
        (
          status === "ativo"
        ) === (
          usuario.ativo !== false
        );

      return (
        correspondePesquisa &&
        correspondeTipo &&
        correspondeStatus
      );
    }
  );
}

function criarBotao(
  texto,
  classe,
  acao,
  id
) {
  const botao =
    document.createElement("button");

  botao.type = "button";
  botao.className = classe;
  botao.textContent = texto;

  botao.disabled =
    usuariosEmProcessamento
      .has(id);

  botao.addEventListener(
    "click",
    () => acao(botao)
  );

  return botao;
}

function criarIdentificadorPrincipal() {
  const selo =
    document.createElement("span");

  selo.className =
    "admin-principal-badge";

  selo.textContent =
    "Administrador principal";

  selo.title =
    "Este administrador possui a permissão exclusiva de excluir usuários.";

  return selo;
}

function criarCardUsuario(usuario) {
  const card =
    document.createElement("article");

  card.className =
    "card admin-user-card";

  if (
    usuarioEhPrincipal(usuario)
  ) {
    card.classList.add(
      "admin-user-main"
    );
  }

  const cabecalho =
    document.createElement("div");

  cabecalho.className =
    "admin-user-header";

  const identidade =
    document.createElement("div");

  const nome =
    document.createElement("strong");

  nome.textContent =
    textoSeguro(
      usuario.nome,
      "Sem nome"
    );

  const email =
    document.createElement("p");

  email.textContent =
    textoSeguro(usuario.email);

  identidade.append(
    nome,
    email
  );

  if (
    usuarioEhPrincipal(usuario)
  ) {
    identidade.appendChild(
      criarIdentificadorPrincipal()
    );
  }

  const status =
    document.createElement("span");

  status.className =
    `admin-status ${
      usuario.ativo === false
        ? "inactive"
        : "active"
    }`;

  status.textContent =
    usuario.ativo === false
      ? "Inativo"
      : "Ativo";

  cabecalho.append(
    identidade,
    status
  );

  const detalhes =
    document.createElement("div");

  detalhes.className =
    "admin-user-details";

  const tipo =
    document.createElement("p");

  tipo.textContent =
    `Tipo: ${
      usuario.tipo ===
      "administrador"
        ? "Administrador"
        : "Coletor"
    }`;

  detalhes.appendChild(tipo);

  if (
    usuarioEhOAtual(usuario)
  ) {
    const contaAtual =
      document.createElement("p");

    contaAtual.className =
      "admin-current-user";

    contaAtual.textContent =
      "Esta é sua conta";

    detalhes.appendChild(
      contaAtual
    );
  }

  const acoes =
    document.createElement("div");

  acoes.className =
    "card-actions admin-user-actions";

  const botaoEditar =
    criarBotao(
      "Editar",
      "btn-blue compact-btn",
      () =>
        editarUsuario(usuario.id),
      usuario.id
    );

  acoes.appendChild(botaoEditar);

  /*
   * Não permite exibir o botão de
   * inativação para:
   * - a própria conta;
   * - o administrador principal.
   *
   * O botão Ativar continua aparecendo
   * para contas comuns inativas.
   */
  const podeAlterarStatus =
    !usuarioEhPrincipal(usuario) &&
    !usuarioEhOAtual(usuario);

  if (
    podeAlterarStatus
  ) {
    const botaoStatus =
      criarBotao(
        usuario.ativo === false
          ? "Ativar"
          : "Inativar",

        `compact-btn ${
          usuario.ativo === false
            ? "btn-activate"
            : "btn-deactivate"
        }`,

        (botao) =>
          alternarStatusUsuario(
            usuario.id,
            botao
          ),

        usuario.id
      );

    acoes.appendChild(
      botaoStatus
    );
  }

  /*
   * Excluir aparece somente quando:
   * - usuário logado é admin principal;
   * - alvo não é a própria conta;
   * - alvo não é outro admin principal.
   */
  const podeExcluir =
    usuarioAtualEhPrincipal() &&
    !usuarioEhOAtual(usuario) &&
    !usuarioEhPrincipal(usuario);

  if (
    podeExcluir
  ) {
    const botaoExcluir =
      criarBotao(
        "Excluir",
        "btn-danger compact-btn",

        (botao) =>
          excluirUsuario(
            usuario.id,
            botao
          ),

        usuario.id
      );

    acoes.appendChild(
      botaoExcluir
    );
  }

  card.append(
    cabecalho,
    detalhes,
    acoes
  );

  return card;
}

function renderizarUsuarios() {
  const lista =
    document.getElementById(
      "listaUsuarios"
    );

  if (!lista) {
    return;
  }

  const filtrados =
    usuariosFiltrados();

  lista.replaceChildren();

  const usuariosVisiveis =
    document.getElementById(
      "usuariosVisiveis"
    );

  if (usuariosVisiveis) {
    usuariosVisiveis.textContent =
      `${filtrados.length} ${
        filtrados.length === 1
          ? "usuário"
          : "usuários"
      }`;
  }

  if (
    !filtrados.length
  ) {
    lista.appendChild(
      criarEstadoLista(
        "Nenhum usuário encontrado."
      )
    );

    return;
  }

  filtrados.forEach(
    (usuario) => {
      lista.appendChild(
        criarCardUsuario(usuario)
      );
    }
  );
}

function limparFormularioUsuario() {
  const formulario =
    document.getElementById(
      "usuarioForm"
    );

  formulario?.reset();

  const idEdicao =
    document.getElementById(
      "usuarioIdEdicao"
    );

  const tipoUsuario =
    document.getElementById(
      "tipoUsuario"
    );

  const statusUsuario =
    document.getElementById(
      "statusUsuario"
    );

  const senhaUsuario =
    document.getElementById(
      "senhaUsuario"
    );

  if (idEdicao) {
    idEdicao.value = "";
  }

  if (tipoUsuario) {
    tipoUsuario.value =
      "coletor";

    tipoUsuario.disabled = false;
  }

  if (statusUsuario) {
    statusUsuario.value =
      "true";
  }

  if (senhaUsuario) {
    senhaUsuario.value = "";
  }

  atualizarEstadoFormulario();
}

function editarUsuario(id) {
  const usuario =
    usuariosCarregados.find(
      (item) => item.id === id
    );

  if (!usuario) {
    mostrarMensagem(
      mensagensErro.USER_NOT_FOUND,
      "error"
    );

    return;
  }

  const idEdicao =
    document.getElementById(
      "usuarioIdEdicao"
    );

  const nome =
    document.getElementById(
      "nomeUsuario"
    );

  const email =
    document.getElementById(
      "emailUsuario"
    );

  const senha =
    document.getElementById(
      "senhaUsuario"
    );

  const tipo =
    document.getElementById(
      "tipoUsuario"
    );

  const status =
    document.getElementById(
      "statusUsuario"
    );

  if (idEdicao) {
    idEdicao.value =
      usuario.id;
  }

  if (nome) {
    nome.value =
      usuario.nome || "";
  }

  if (email) {
    email.value =
      usuario.email || "";
  }

  if (senha) {
    senha.value = "";
  }

  if (tipo) {
    tipo.value =
      tipoCanonico(
        usuario.tipo
      );
  }

  if (status) {
    status.value =
      String(
        usuario.ativo !== false
      );
  }

  atualizarEstadoFormulario();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  if (
    usuarioEhPrincipal(usuario)
  ) {
    mostrarMensagem(
      "O administrador principal pode ter nome e e-mail editados, mas não pode ser inativado ou transformado em coletor.",
      "info"
    );
  }
}

async function salvarUsuarioAdmin() {
  if (
    formularioEmProcessamento
  ) {
    return;
  }

  const id =
    document.getElementById(
      "usuarioIdEdicao"
    )?.value || "";

  const usuarioAtual =
    usuariosCarregados.find(
      (usuario) =>
        usuario.id === id
    );

  const data = {
    nome:
      document
        .getElementById(
          "nomeUsuario"
        )
        ?.value
        .trim() || "",

    email:
      document
        .getElementById(
          "emailUsuario"
        )
        ?.value
        .trim()
        .toLowerCase() || "",

    tipo:
      document
        .getElementById(
          "tipoUsuario"
        )
        ?.value || "coletor"
  };

  if (id) {
    Object.assign(
      data,
      {
        id,

        ativo:
          document
            .getElementById(
              "statusUsuario"
            )
            ?.value === "true"
      }
    );

    /*
     * Caso seja o administrador principal,
     * mantém os valores protegidos mesmo
     * que alguém tente mudar pelo HTML.
     */
    if (
      usuarioAtual
        ?.admin_principal === true
    ) {
      data.tipo =
        "administrador";

      data.ativo = true;
    }
  } else {
    data.senha =
      document
        .getElementById(
          "senhaUsuario"
        )
        ?.value || "";
  }

  if (
    id &&
    !confirm(
      "Deseja salvar as alterações deste usuário?"
    )
  ) {
    return;
  }

  definirFormularioCarregando(
    true,
    id
      ? "Salvando..."
      : "Criando..."
  );

  try {
    const resultado =
      await invocarAdminUsers(
        id
          ? "update"
          : "create",
        data
      );

    mostrarMensagem(
      resultado.message
    );

    limparFormularioUsuario();

    await carregarAdmin();
  } catch (error) {
    console.error(
      "Erro ao salvar usuário:",
      error
    );

    mostrarMensagem(
      mensagemPorErro(error),
      "error"
    );
  } finally {
    definirFormularioCarregando(
      false
    );
  }
}

async function alternarStatusUsuario(
  id,
  botao
) {
  const usuario =
    usuariosCarregados.find(
      (item) => item.id === id
    );

  if (!usuario) {
    mostrarMensagem(
      mensagensErro.USER_NOT_FOUND,
      "error"
    );

    return;
  }

  if (
    usuarioEhPrincipal(usuario)
  ) {
    mostrarMensagem(
      mensagensErro.MAIN_ADMIN_PROTECTED,
      "error"
    );

    return;
  }

  if (
    usuarioEhOAtual(usuario)
  ) {
    mostrarMensagem(
      mensagensErro.SELF_DEACTIVATE,
      "error"
    );

    return;
  }

  const ativar =
    usuario.ativo === false;

  if (
    !ativar &&
    !confirm(
      `Inativar ${textoSeguro(
        usuario.nome,
        usuario.email
      )}?`
    )
  ) {
    return;
  }

  await executarOperacaoUsuario(
    id,

    async () => {
      try {
        const resultado =
          await invocarAdminUsers(
            ativar
              ? "activate"
              : "deactivate",
            { id }
          );

        mostrarMensagem(
          resultado.message
        );

        await carregarAdmin();
      } catch (error) {
        console.error(
          "Erro ao alterar status:",
          error
        );

        mostrarMensagem(
          mensagemPorErro(error),
          "error"
        );
      }
    },

    botao
  );
}

async function excluirUsuario(
  id,
  botao
) {
  if (
    !usuarioAtualEhPrincipal()
  ) {
    mostrarMensagem(
      mensagensErro.MAIN_ADMIN_REQUIRED,
      "error"
    );

    return;
  }

  const usuario =
    usuariosCarregados.find(
      (item) => item.id === id
    );

  if (!usuario) {
    mostrarMensagem(
      mensagensErro.USER_NOT_FOUND,
      "error"
    );

    return;
  }

  if (
    usuarioEhOAtual(usuario)
  ) {
    mostrarMensagem(
      mensagensErro.SELF_DELETE,
      "error"
    );

    return;
  }

  if (
    usuarioEhPrincipal(usuario)
  ) {
    mostrarMensagem(
      mensagensErro
        .MAIN_ADMIN_DELETE_NOT_ALLOWED,
      "error"
    );

    return;
  }

  const confirmou =
    confirm(
      `Excluir permanentemente ${textoSeguro(
        usuario.nome,
        usuario.email
      )}?\n\nEsta ação não pode ser desfeita.`
    );

  if (!confirmou) {
    return;
  }

  await executarOperacaoUsuario(
    id,

    async () => {
      try {
        const resultado =
          await invocarAdminUsers(
            "delete",
            { id }
          );

        mostrarMensagem(
          resultado.message
        );

        limparFormularioUsuario();

        await carregarAdmin();
      } catch (error) {
        console.error(
          "Erro ao excluir usuário:",
          error
        );

        mostrarMensagem(
          mensagemPorErro(error),
          "error"
        );
      }
    },

    botao
  );
}

function adicionarEventosAdmin() {
  const formulario =
    document.getElementById(
      "usuarioForm"
    );

  const pesquisa =
    document.getElementById(
      "pesquisaUsuario"
    );

  const filtroTipo =
    document.getElementById(
      "filtroTipo"
    );

  const filtroStatus =
    document.getElementById(
      "filtroStatus"
    );

  const limpar =
    document.getElementById(
      "limparUsuarioBtn"
    );

  formulario?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      salvarUsuarioAdmin();
    }
  );

  pesquisa?.addEventListener(
    "input",
    renderizarUsuarios
  );

  filtroTipo?.addEventListener(
    "change",
    renderizarUsuarios
  );

  filtroStatus?.addEventListener(
    "change",
    renderizarUsuarios
  );

  limpar?.addEventListener(
    "click",
    limparFormularioUsuario
  );
}

async function inicializarAdmin() {
  definirFormularioCarregando(
    true,
    "Carregando..."
  );

  try {
    const autorizado =
      await validarAdministradorAtual();

    if (autorizado) {
      limparFormularioUsuario();
      await carregarAdmin();
    }
  } catch (error) {
    console.error(
      "Erro ao inicializar administração:",
      error
    );

    mostrarMensagem(
      mensagemPorErro(error),
      "error"
    );
  } finally {
    definirFormularioCarregando(
      false
    );
  }
}

adicionarEventosAdmin();
inicializarAdmin();
