const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const loginButton = loginForm.querySelector('button[type="submit"]');

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.error("Erro ao registrar o Service Worker:", error);
    });
  });
}

function mostrarErroLogin(mensagem) {
  loginMessage.innerText = mensagem;
  loginMessage.classList.add("login-error");
}

function definirLoginCarregando(carregando) {
  loginButton.disabled = carregando;
  loginButton.innerText = carregando ? "Entrando..." : "Entrar";
}

function erroLoginAmigavel(error) {
  const codigo = String(error?.code || "").toLowerCase();
  const mensagem = String(error?.message || "").toLowerCase();

  if (codigo.includes("banned") || mensagem.includes("banned")) {
    return "Seu usuário está inativo. Entre em contato com o administrador.";
  }

  if (!navigator.onLine) {
    return "Sem conexão com a internet.";
  }

  return "E-mail ou senha inválidos.";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  loginMessage.innerText = "";
  loginMessage.classList.remove("login-error");
  definirLoginCarregando(true);

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      mostrarErroLogin(erroLoginAmigavel(error));
      return;
    }

    const { data: perfil, error: perfilError } = await supabaseClient
      .from("usuarios")
      .select("id, nome, email, tipo, ativo")
      .eq("id", data.user.id)
      .maybeSingle();

    if (perfilError || !perfil) {
      await supabaseClient.auth.signOut();
      localStorage.removeItem("usuario");
      mostrarErroLogin("Não foi possível validar seu usuário. Entre em contato com o administrador.");
      return;
    }

    if (perfil.ativo === false) {
      await supabaseClient.auth.signOut();
      localStorage.removeItem("usuario");
      mostrarErroLogin("Seu usuário está inativo. Entre em contato com o administrador.");
      return;
    }

    localStorage.setItem("usuario", JSON.stringify(perfil));
    window.location.href = perfil.tipo === "admin" ? "admin.html" : "dashboard.html";
  } catch (_error) {
    mostrarErroLogin(
      navigator.onLine
        ? "Não foi possível entrar. Tente novamente."
        : "Sem conexão com a internet."
    );
  } finally {
    definirLoginCarregando(false);
  }
});
