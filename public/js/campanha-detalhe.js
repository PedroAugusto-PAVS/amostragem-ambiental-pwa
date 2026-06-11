const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const campanhaLocalId = localStorage.getItem("campanha_selecionada");

if (!campanhaLocalId) {
  window.location.href = "campanhas.html";
}

let campanhaAtual = null;

async function carregarCampanha() {
  const campanhas = await listarCampanhasLocais();
  const projetos = await listarProjetosLocais();
  const pocos = await listarPocosLocais();
  const medicoes = await listarMedicoesLocais();

  campanhaAtual = campanhas.find(c => c.local_id === campanhaLocalId);

  if (!campanhaAtual) {
    alert("Campanha não encontrada.");
    window.location.href = "campanhas.html";
    return;
  }

  const projeto = projetos.find(p => p.local_id === campanhaAtual.projeto_local_id);

  const pms = pocos.filter(
    p => p.projeto_local_id === campanhaAtual.projeto_local_id && p.ativo !== false
  );

  const medicoesCampanha = medicoes.filter(
    m => m.campanha_local_id === campanhaAtual.local_id
  );

  const total = pms.length;
  const coletados = medicoesCampanha.length;
  const pendentes = total - coletados;
  const progresso = total > 0 ? Math.round((coletados / total) * 100) : 0;

  document.getElementById("tituloCampanha").innerText = campanhaAtual.nome;
  document.getElementById("subtituloCampanha").innerText =
    projeto ? projeto.nome : "Sem projeto";

  document.getElementById("resumoCampanha").innerHTML = `
    <div class="card">
      <strong>Resumo</strong>
      <p>Projeto: ${projeto ? projeto.nome : "-"}</p>
      <p>Mês: ${campanhaAtual.mes_referencia || "-"}</p>
      <p>Total PMs: ${total}</p>
      <p>Coletados: ${coletados}</p>
      <p>Pendentes: ${pendentes}</p>

      <div style="background:#e5e7eb;border-radius:10px;height:14px;margin-top:10px;">
        <div style="width:${progresso}%;background:#005eea;height:14px;border-radius:10px;"></div>
      </div>

      <p>${progresso}% concluído</p>
    </div>
  `;

  const lista = document.getElementById("listaPmsCampanha");
  lista.innerHTML = "";

  if (pms.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhum PM neste projeto</strong>
      </div>
    `;
    return;
  }

  pms.forEach((pm) => {
    const medicao = medicoesCampanha.find(m => m.poco_local_id === pm.local_id);
    const coletado = !!medicao;

    lista.innerHTML += `
      <div class="poco-item">
        <div class="avatar">${pm.nome.substring(0,2).toUpperCase()}</div>

        <div class="poco-info">
          <strong>${pm.nome}</strong>
          <span>${pm.local_propriedade || "-"}</span>
          <span>Status: ${coletado ? "✅ Coletado" : "❌ Pendente"}</span>
        </div>

        <div class="poco-value">
          ${
            coletado
              ? `<button class="btn-blue" onclick="editarMedicao('${medicao.local_id}')">Editar</button>`
              : `<button class="btn-blue" onclick="novaMedicao('${pm.local_id}')">Coletar</button>`
          }
        </div>
      </div>
    `;
  });
}

function novaMedicao(pocoLocalId) {
  localStorage.setItem("poco_selecionado", pocoLocalId);
  localStorage.setItem("campanha_selecionada", campanhaAtual.local_id);
  window.location.href = "nova-medicao.html";
}

function editarMedicao(medicaoLocalId) {
  localStorage.setItem("medicao_selecionada", medicaoLocalId);
  window.location.href = "editar-medicao.html";
}

carregarCampanha();