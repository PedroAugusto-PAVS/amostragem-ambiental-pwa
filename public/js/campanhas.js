const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

async function carregarCampanhas() {
  const campanhas = await listarCampanhasLocais();
  const projetos = await listarProjetosLocais();
  const pocos = await listarPocosLocais();
  const medicoes = await listarMedicoesLocais();

  const lista = document.getElementById("listaCampanhas");
  lista.innerHTML = "";

  if (campanhas.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhuma campanha cadastrada</strong>
        <p>Clique no botão + para criar uma campanha.</p>
      </div>
    `;
    return;
  }

  campanhas.reverse().forEach((campanha) => {
    const projeto = projetos.find(p => p.local_id === campanha.projeto_local_id);

    const pocosDoProjeto = pocos.filter(
      p => p.projeto_local_id === campanha.projeto_local_id && p.ativo !== false
    );

    const medicoesDaCampanha = medicoes.filter(
      m => m.campanha_local_id === campanha.local_id
    );

    const total = pocosDoProjeto.length;
    const coletados = medicoesDaCampanha.length;
    const pendentes = total - coletados;
    const progresso = total > 0 ? Math.round((coletados / total) * 100) : 0;

    lista.innerHTML += `
      <div class="card" onclick="abrirCampanha('${campanha.local_id}')">
        <strong>${campanha.nome}</strong>
        <p>Projeto: ${projeto ? projeto.nome : "-"}</p>
        <p>Mês: ${campanha.mes_referencia || "-"}</p>
        <p>Total PMs: ${total}</p>
        <p>Coletados: ${coletados}</p>
        <p>Pendentes: ${pendentes}</p>

        <div style="background:#e5e7eb;border-radius:10px;height:14px;margin-top:10px;">
          <div style="width:${progresso}%;background:#005eea;height:14px;border-radius:10px;"></div>
        </div>

        <p>${progresso}% concluído</p>
      </div>
    `;
  });
}

function abrirCampanha(localId) {
  localStorage.setItem("campanha_selecionada", localId);
  window.location.href = "campanha-detalhe.html";
}

carregarCampanhas();