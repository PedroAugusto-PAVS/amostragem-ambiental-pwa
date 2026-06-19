const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  loginMessage.innerText = "Entrando...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    loginMessage.innerText = "Erro no login: " + error.message;
    return;
  }

  const userId = data.user.id;

  const { data: perfil, error: perfilError } = await supabaseClient
    .from("usuarios")
    .select("id, nome, email, tipo, ativo")
    .eq("id", userId)
    .maybeSingle();

  if (perfilError) {
    console.error(perfilError);
    loginMessage.innerText = "Erro ao buscar perfil: " + perfilError.message;
    return;
  }

  if (!perfil) {
    loginMessage.innerText = "Usuário logado, mas sem perfil na tabela usuarios.";
    return;
  }

  if (!perfil.ativo) {
    loginMessage.innerText = "Usuário inativo. Fale com o administrador.";
    return;
  }

  localStorage.setItem("usuario", JSON.stringify(perfil));

  if (perfil.tipo === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "dashboard.html";
  }
});