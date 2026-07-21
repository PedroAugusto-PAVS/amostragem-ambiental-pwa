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
  loginMessage.textContent = mensagem;
  loginMessage.classList.add("login-error");
}

function definirLoginCarregando(carregando) {
  loginButton.disabled = carregando;
  loginButton.textContent = carregando ? "Entrando..." : "Entrar";
}

function erroLoginAmigavel(error) {
  const texto = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  if (texto.includes("banned")) return "Seu usuário está inativo. Entre em contato com o administrador.";
  if (!navigator.onLine) return "Sem conexão com a internet.";
  return "E-mail ou senha inválidos.";
}

const mensagemPendente = sessionStorage.getItem("mensagem_auth");
if (mensagemPendente) {
  sessionStorage.removeItem("mensagem_auth");
  mostrarErroLogin(mensagemPendente);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  loginMessage.classList.remove("login-error");
  definirLoginCarregando(true);
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: document.getElementById("email").value.trim().toLowerCase(),
      password: document.getElementById("password").value
    });
    if (error || !data.user) return mostrarErroLogin(erroLoginAmigavel(error));
    const perfil = await window.hydrotrackAuth.validarUsuarioAtivo({ redirecionar: false });
    if (!perfil) return mostrarErroLogin("Seu usuário está inativo. Entre em contato com o administrador.");
    window.location.href = perfil.tipo === "administrador" ? "admin.html" : "dashboard.html";
  } catch (_error) {
    mostrarErroLogin(navigator.onLine ? "Não foi possível entrar. Tente novamente." : "Sem conexão com a internet.");
  } finally {
    definirLoginCarregando(false);
  }
});
