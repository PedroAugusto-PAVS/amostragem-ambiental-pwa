const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

if (usuario.tipo !== "admin") {
  alert("Acesso permitido apenas para administradores.");
  window.location.href = "dashboard.html";
}

async function carregarAdmin() {
  const projetos = await listarProjetosLocais();
  const pocos = await listarPocosLocais();
  const medicoes = await listarMedicoesLocais();

  document.getElementById("totalProjetos").innerText = projetos.length;
  document.getElementById("totalPocos").innerText = pocos.length;
  document.getElementById("totalMedicoes").innerText = medicoes.length;

  document.getElementById("totalPendentes").innerText =
    medicoes.filter((m) => !m.sincronizado).length;

  document.getElementById("totalInativos").innerText =
    pocos.filter((p) => p.ativo === false).length;

  await carregarColetores();
  carregarUltimasMedicoes(medicoes);
}

async function carregarColetores() {
  const lista = document.getElementById("listaColetores");
  lista.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("usuarios")
    .select("id, nome, email, tipo, ativo")
    .order("nome", { ascending: true });

  if (error) {
    lista.innerHTML = `
      <div class="card">
        <strong>Erro ao carregar coletores</strong>
        <p>${error.message}</p>
      </div>
    `;
    return;
  }

  document.getElementById("totalColetores").innerText = data.length;

  data.forEach((u) => {
    lista.innerHTML += `
      <div class="card">
        <strong>${u.nome || "Sem nome"}</strong>
        <p>Email: ${u.email}</p>
        <p>Tipo: ${u.tipo}</p>
        <p>Status: ${u.ativo ? "Ativo" : "Inativo"}</p>

        <div class="card-actions">
          <button class="btn-blue" onclick="alterarStatusUsuario('${u.id}', ${u.ativo})">
            ${u.ativo ? "Desativar" : "Ativar"}
          </button>
        </div>
      </div>
    `;
  });
}

async function alterarStatusUsuario(id, ativoAtual) {
  const confirmar = confirm(
    ativoAtual
      ? "Deseja desativar este coletor?"
      : "Deseja ativar este coletor?"
  );

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("usuarios")
    .update({ ativo: !ativoAtual })
    .eq("id", id);

  if (error) {
    alert("Erro ao atualizar coletor: " + error.message);
    return;
  }

  alert("Coletor atualizado com sucesso.");
  carregarAdmin();
}

function carregarUltimasMedicoes(medicoes) {
  const lista = document.getElementById("listaUltimasMedicoes");
  lista.innerHTML = "";

  const ultimas = [...medicoes]
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
    .slice(0, 10);

  if (ultimas.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhuma medição encontrada</strong>
      </div>
    `;
    return;
  }

  ultimas.forEach((m) => {
    lista.innerHTML += `
      <div class="card">
        <strong>${m.poco_nome || "PM"}</strong>
        <p>Coletor: ${m.coletor_nome || "-"}</p>
        <p>Data: ${m.data_medicao || "-"}</p>
        <p>Mês: ${m.mes_referencia || "-"}</p>
        <p>Status: ${m.sincronizado ? "Sincronizada" : "Pendente"}</p>
        <p>Estabilização: ${
          m.estabilizacao?.estavel ? "✅ Estável" : "⚠ Não estabilizado"
        }</p>
      </div>
    `;
  });
}

carregarAdmin();