const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

let campanhasCarregadas = [];

async function carregarCampanhas() {
  const campanhas = await listarCampanhasLocais();
  const projetos = await listarProjetosLocais();
  const pocos = await listarPocosLocais();
  const medicoes = await listarMedicoesLocais();

  campanhasCarregadas = [...campanhas].reverse().map((campanha) => {
    const projeto = projetos.find(
      (item) => item.local_id === campanha.projeto_local_id
    );
    const pocosDoProjeto = pocos.filter(
      (poco) =>
        pocoPertenceAoProjeto(poco, campanha.projeto_local_id) &&
        poco.ativo !== false
    );
    const idsPmsDoProjeto = new Set(
      pocosDoProjeto.map((poco) => poco.local_id)
    );
    const medicoesDaCampanha = medicoes.filter((medicao) => {
      const poco = pocosDoProjeto.find(
        (pm) => pm.local_id === medicao.poco_local_id
      );

      if (!poco || !idsPmsDoProjeto.has(medicao.poco_local_id)) {
        return false;
      }

      return medicaoEhCompativelComCampanha(
        campanha,
        medicao,
        poco,
        campanhas
      );
    });
    const total = pocosDoProjeto.length;
    const coletados = new Set(
      medicoesDaCampanha.map((medicao) => medicao.poco_local_id)
    ).size;
    const pendentes = Math.max(total - coletados, 0);
    const progresso = total > 0 ? Math.round((coletados / total) * 100) : 0;

    return { campanha, projeto, total, coletados, pendentes, progresso };
  });

  preencherFiltroProjetos(projetos);
  renderizarCampanhas(campanhasCarregadas);
}

function preencherFiltroProjetos(projetos) {
  const filtro = document.getElementById("filtroProjetoCampanha");
  const idsComCampanha = new Set(
    campanhasCarregadas.map(({ campanha }) => campanha.projeto_local_id)
  );

  projetos
    .filter((projeto) => idsComCampanha.has(projeto.local_id))
    .sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
    )
    .forEach((projeto) => {
      const option = document.createElement("option");
      option.value = projeto.local_id;
      option.textContent = projeto.nome || "Projeto sem nome";
      filtro.appendChild(option);
    });
}

function renderizarCampanhas(itens, filtrosAtivos = false) {
  const lista = document.getElementById("listaCampanhas");
  lista.innerHTML = "";

  if (itens.length === 0) {
    lista.innerHTML = `
      <div class="card empty-state">
        <strong>${filtrosAtivos ? "Nenhuma campanha encontrada" : "Nenhuma campanha cadastrada"}</strong>
        <p>${filtrosAtivos ? "Altere ou limpe os filtros para ver outras campanhas." : "Clique no botão + para criar uma campanha."}</p>
      </div>
    `;
    return;
  }

  itens.forEach(
    ({ campanha, projeto, total, coletados, pendentes, progresso }) => {
      lista.innerHTML += `
        <div
          class="card interactive-card"
          role="link"
          tabindex="0"
          onclick="abrirCampanha('${campanha.local_id}')"
          onkeydown="if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); abrirCampanha('${campanha.local_id}'); }"
        >
          <strong>${campanha.nome}</strong>
          <p>Projeto: ${projeto ? projeto.nome : "-"}</p>
          <p>Mês: ${campanha.mes_referencia || "-"}</p>
          <p>Total PMs: ${total}</p>
          <p>Coletados: ${coletados}</p>
          <p>Pendentes: ${pendentes}</p>

          <div
            class="campaign-progress"
            role="progressbar"
            aria-label="Progresso da campanha"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="${progresso}"
          >
            <div
              class="campaign-progress-value"
              style="--progress:${progresso}%"
            ></div>
          </div>

          <p>${progresso}% concluído</p>
        </div>
      `;
    }
  );
}

function filtrarCampanhas() {
  const projetoId = document.getElementById("filtroProjetoCampanha").value;
  const mes = document.getElementById("filtroMesCampanha").value;
  const situacao = document.getElementById("filtroSituacaoCampanha").value;

  const filtradas = campanhasCarregadas.filter(({ campanha, progresso }) => {
    const correspondeProjeto =
      !projetoId || campanha.projeto_local_id === projetoId;
    const correspondeMes = !mes || campanha.mes_referencia === mes;
    const correspondeSituacao =
      !situacao ||
      (situacao === "concluida" && progresso === 100) ||
      (situacao === "pendente" && progresso < 100);

    return correspondeProjeto && correspondeMes && correspondeSituacao;
  });

  renderizarCampanhas(filtradas, Boolean(projetoId || mes || situacao));
}

function limparFiltrosCampanha() {
  document.getElementById("filtroProjetoCampanha").value = "";
  document.getElementById("filtroMesCampanha").value = "";
  document.getElementById("filtroSituacaoCampanha").value = "";
  renderizarCampanhas(campanhasCarregadas);
}

function abrirCampanha(localId) {
  localStorage.setItem("campanha_selecionada", localId);
  window.location.href = "campanha-detalhe.html";
}

document
  .getElementById("filtroProjetoCampanha")
  .addEventListener("change", filtrarCampanhas);
document
  .getElementById("filtroMesCampanha")
  .addEventListener("change", filtrarCampanhas);
document
  .getElementById("filtroSituacaoCampanha")
  .addEventListener("change", filtrarCampanhas);
document
  .getElementById("limparFiltrosCampanha")
  .addEventListener("click", limparFiltrosCampanha);

carregarCampanhas();
