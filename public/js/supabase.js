const SUPABASE_URL =
  "https://ecmctjixtznsixajfclt.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbWN0aml4dHpuc2l4YWpmY2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Mjk0MzIsImV4cCI6MjA5NjMwNTQzMn0.x7TW6TvS04iyqaMBidEkbDTDHC5Oi79Tyulsp9LWhT0";

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

const MENSAGEM_USUARIO_INATIVO =
  "Seu usuário está inativo. Entre em contato com o administrador.";

const MENSAGEM_SEM_PERMISSAO =
  "Você não possui permissão para realizar esta operação.";

let validacaoUsuarioEmAndamento = null;

/**
 * Converte o tipo utilizado no banco para
 * o tipo utilizado pela interface.
 *
 * Banco:
 * - admin
 * - coletor
 *
 * Interface:
 * - administrador
 * - coletor
 */
function tipoUsuarioCanonico(tipo) {
  return tipo === "admin"
    ? "administrador"
    : tipo;
}

/**
 * Retorna o usuário salvo localmente.
 */
function obterUsuarioLocal() {
  try {
    return JSON.parse(
      localStorage.getItem("usuario") ||
      "null"
    );
  } catch (error) {
    console.error(
      "Erro ao ler usuário local:",
      error
    );

    localStorage.removeItem("usuario");

    return null;
  }
}

/**
 * Salva o perfil validado no navegador.
 */
function salvarUsuarioLocal(perfil) {
  localStorage.setItem(
    "usuario",
    JSON.stringify(perfil)
  );
}

/**
 * Encerra a sessão e, quando necessário,
 * redireciona o usuário para o login.
 */
async function encerrarSessaoHydroTrack(
  mensagem,
  redirecionar = true
) {
  try {
    await supabaseClient.auth.signOut();
  } catch (error) {
    console.error(
      "Erro ao encerrar sessão:",
      error
    );
  }

  localStorage.removeItem("usuario");

  if (mensagem) {
    sessionStorage.setItem(
      "mensagem_auth",
      mensagem
    );
  }

  const estaNaPaginaLogin =
    location.pathname.endsWith(
      "/index.html"
    ) ||
    location.pathname === "/" ||
    location.pathname.endsWith("/");

  if (
    redirecionar &&
    !estaNaPaginaLogin
  ) {
    location.replace("index.html");
  }
}

/**
 * Consulta o perfil atual no banco.
 */
async function buscarPerfilUsuario(
  usuarioId
) {
  const {
    data: perfil,
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
    .eq("id", usuarioId)
    .maybeSingle();

  if (error) {
    console.error(
      "Erro ao buscar perfil do usuário:",
      error
    );

    throw error;
  }

  if (!perfil) {
    return null;
  }

  return {
    ...perfil,

    tipo:
      tipoUsuarioCanonico(
        perfil.tipo
      ),

    ativo:
      perfil.ativo !== false,

    admin_principal:
      perfil.admin_principal === true
  };
}

/**
 * Valida a sessão e confirma se o usuário
 * ainda está ativo no banco.
 *
 * Opções disponíveis:
 *
 * redirecionar:
 * false impede o redirecionamento automático.
 *
 * exigirAdministrador:
 * true permite somente administrador.
 *
 * exigirAdminPrincipal:
 * true permite somente o administrador principal.
 */
async function validarUsuarioAtivo(
  opcoes = {}
) {
  const {
    redirecionar = true,
    exigirAdministrador = false,
    exigirAdminPrincipal = false
  } = opcoes;

  /*
   * Modo offline:
   * utiliza o último perfil validado e salvo.
   */
  if (!navigator.onLine) {
    const conhecido =
      obterUsuarioLocal();

    if (!conhecido) {
      return null;
    }

    if (
      conhecido.ativo === false
    ) {
      await encerrarSessaoHydroTrack(
        MENSAGEM_USUARIO_INATIVO,
        redirecionar
      );

      return null;
    }

    if (
      exigirAdministrador &&
      conhecido.tipo !== "administrador"
    ) {
      await encerrarSessaoHydroTrack(
        MENSAGEM_SEM_PERMISSAO,
        redirecionar
      );

      return null;
    }

    if (
      exigirAdminPrincipal &&
      conhecido.admin_principal !== true
    ) {
      await encerrarSessaoHydroTrack(
        "Somente o administrador principal possui permissão para realizar esta operação.",
        redirecionar
      );

      return null;
    }

    return conhecido;
  }

  /*
   * Evita várias consultas simultâneas ao banco.
   */
  if (validacaoUsuarioEmAndamento) {
    return validacaoUsuarioEmAndamento;
  }

  validacaoUsuarioEmAndamento =
    (async () => {
      const {
        data: sessao,
        error: erroSessao
      } =
        await supabaseClient.auth
          .getSession();

      if (erroSessao) {
        console.error(
          "Erro ao consultar sessão:",
          erroSessao
        );

        throw erroSessao;
      }

      const usuarioAuth =
        sessao?.session?.user;

      if (!usuarioAuth) {
        localStorage.removeItem(
          "usuario"
        );

        return null;
      }

      const perfil =
        await buscarPerfilUsuario(
          usuarioAuth.id
        );

      if (
        !perfil ||
        perfil.ativo === false
      ) {
        await encerrarSessaoHydroTrack(
          MENSAGEM_USUARIO_INATIVO,
          redirecionar
        );

        return null;
      }

      salvarUsuarioLocal(perfil);

      if (
        exigirAdministrador &&
        perfil.tipo !==
          "administrador"
      ) {
        await encerrarSessaoHydroTrack(
          MENSAGEM_SEM_PERMISSAO,
          redirecionar
        );

        return null;
      }

      if (
        exigirAdminPrincipal &&
        perfil.admin_principal !== true
      ) {
        await encerrarSessaoHydroTrack(
          "Somente o administrador principal possui permissão para realizar esta operação.",
          redirecionar
        );

        return null;
      }

      return perfil;
    })().finally(() => {
      validacaoUsuarioEmAndamento =
        null;
    });

  return validacaoUsuarioEmAndamento;
}

/**
 * Retorna o usuário atualmente salvo.
 */
function obterUsuarioAtual() {
  return obterUsuarioLocal();
}

/**
 * Verifica se o usuário atual é administrador.
 */
function usuarioAtualEhAdministrador() {
  const usuario =
    obterUsuarioLocal();

  return (
    usuario?.tipo ===
    "administrador"
  );
}

/**
 * Verifica se o usuário atual é o
 * administrador principal.
 */
function usuarioAtualEhAdminPrincipal() {
  const usuario =
    obterUsuarioLocal();

  return (
    usuario?.tipo ===
      "administrador" &&
    usuario?.admin_principal === true
  );
}

window.hydrotrackAuth = {
  validarUsuarioAtivo,
  encerrarSessaoHydroTrack,
  obterUsuarioAtual,
  usuarioAtualEhAdministrador,
  usuarioAtualEhAdminPrincipal
};

/**
 * Atualiza o perfil local quando:
 * - o usuário entra;
 * - a página recupera a sessão;
 * - o token é renovado.
 */
supabaseClient.auth.onAuthStateChange(
  (evento, sessao) => {
    const eventosComSessao = [
      "SIGNED_IN",
      "TOKEN_REFRESHED",
      "INITIAL_SESSION",
      "USER_UPDATED"
    ];

    if (
      eventosComSessao.includes(evento) &&
      sessao
    ) {
      setTimeout(() => {
        validarUsuarioAtivo()
          .catch((error) => {
            console.error(
              "Erro ao atualizar perfil autenticado:",
              error
            );
          });
      }, 0);
    }

    if (
      evento === "SIGNED_OUT"
    ) {
      localStorage.removeItem(
        "usuario"
      );
    }
  }
);

/**
 * Quando a conexão voltar, valida novamente
 * o usuário no banco.
 */
window.addEventListener(
  "online",
  () => {
    validarUsuarioAtivo()
      .catch((error) => {
        console.error(
          "Erro ao validar usuário após recuperar conexão:",
          error
        );
      });
  }
);