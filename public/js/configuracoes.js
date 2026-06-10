const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

document.getElementById("usuarioLogado").innerText =
  `${usuario.nome} - ${usuario.email}`;

async function logout() {
  await supabaseClient.auth.signOut();
  localStorage.clear();
  window.location.href = "index.html";
}