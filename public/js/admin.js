const usuarioAdmin = JSON.parse(localStorage.getItem("usuario"));

if (!usuarioAdmin) {
  window.location.href = "index.html";
}

if (usuarioAdmin.tipo !== "admin") {
  alert("Acesso permitido apenas para administrador.");
  window.location.href = "dashboard.html";
}

document.getElementById("coletorForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  alert(
    "Por segurança, o cadastro de login de novos coletores deve ser feito no Supabase Authentication. Depois cadastre o perfil na tabela usuarios."
  );
});

async function carregarFichas() {
  const { data, error } = await supabaseClient
    .from("fichas_campo")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const tbody = document.getElementById("fichasAdmin");
  tbody.innerHTML = "";

  data.forEach((ficha) => {
    tbody.innerHTML += `
      <tr>
        <td>${ficha.coletor_nome}</td>
        <td>${ficha.nome_poco}</td>
        <td>${ficha.tipo_poco}</td>
        <td>${new Date(ficha.criado_em).toLocaleString("pt-BR")}</td>
      </tr>
    `;
  });
}

async function logout() {
  await supabaseClient.auth.signOut();
  localStorage.clear();
  window.location.href = "index.html";
}

carregarFichas();