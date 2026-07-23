const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

let projetosExportacao = [];
let campanhasExportacao = [];
let pocosExportacao = [];
let medicoesExportacao = [];

async function carregarExportacaoFiscal() {
  projetosExportacao = await listarProjetosLocais();
  campanhasExportacao = await listarCampanhasLocais();
  pocosExportacao = await listarPocosLocais();
  medicoesExportacao = await listarMedicoesLocais();

  document.getElementById("tipoExportacaoTexto").innerText =
    "Selecione as fichas para gerar PDF Fiscal";

  carregarProjetosSelect();
  carregarCampanhasSelect();
  carregarPocosSelect();

  renderizarMedicoesExportacao();
}

function carregarProjetosSelect() {
  const select = document.getElementById("filtroProjeto");

  select.innerHTML = `<option value="">Todos os projetos</option>`;

  projetosExportacao.forEach((projeto) => {
    select.innerHTML += `
      <option value="${projeto.local_id}">
        ${projeto.nome || "Projeto sem nome"}
      </option>
    `;
  });
}

function carregarCampanhasSelect() {
  const projetoId = document.getElementById("filtroProjeto").value;
  const select = document.getElementById("filtroCampanha");

  select.innerHTML = `<option value="">Todas as campanhas</option>`;

  const campanhasFiltradas = campanhasExportacao.filter((campanha) => {
    if (!projetoId) return true;
    return campanha.projeto_local_id === projetoId;
  });

  campanhasFiltradas.forEach((campanha) => {
    select.innerHTML += `
      <option value="${campanha.local_id}">
        ${campanha.nome || campanha.mes_referencia || "Campanha sem nome"}
      </option>
    `;
  });
}

function carregarPocosSelect() {
  const projetoSelecionadoId = document.getElementById("filtroProjeto").value;
  const campanhaId = document.getElementById("filtroCampanha").value;
  const campanhaSelecionada = campanhasExportacao.find(
    (campanha) => campanha.local_id === campanhaId
  );
  const projetoId =
    projetoSelecionadoId || campanhaSelecionada?.projeto_local_id || "";
  const container = document.getElementById("listaPocosFiltro");

  const pocosFiltrados = pocosExportacao.filter((poco) => {
    if (!projetoId) return true;
    return poco.projeto_local_id === projetoId;
  });

  if (pocosFiltrados.length === 0) {
    container.innerHTML = `<p>Nenhum PM encontrado.</p>`;
    return;
  }

  container.innerHTML = `
      <label style="display:flex;gap:10px;align-items:center;">
        <input type="checkbox" id="todosPocos" onchange="alternarTodosPocos()">
        <strong>Selecionar todos os PMs</strong>
      </label>
      <hr>
    `;

  pocosFiltrados.forEach((poco) => {
    container.innerHTML += `
        <label style="display:flex;gap:10px;align-items:center;margin:8px 0;">
          <input 
            type="checkbox" 
            class="checkPocoFiltro" 
            value="${poco.local_id}"
            onchange="renderizarMedicoesExportacao()"
          >
          ${poco.nome || "PM sem nome"}
        </label>
      `;
  });
}

function alternarTodosPocos() {
  const marcado = document.getElementById("todosPocos").checked;

  document.querySelectorAll(".checkPocoFiltro").forEach((check) => {
    check.checked = marcado;
  });

  renderizarMedicoesExportacao();
}

function atualizarFiltroProjeto() {
  carregarCampanhasSelect();
  carregarPocosSelect();
  renderizarMedicoesExportacao();
}

function atualizarFiltroCampanha() {
  if (!document.getElementById("filtroProjeto").value) {
    carregarPocosSelect();
  }

  renderizarMedicoesExportacao();
}

function obterMedicoesFiltradas() {
  const projetoId = document.getElementById("filtroProjeto").value;
  const campanhaId = document.getElementById("filtroCampanha").value;
  const campanhaSelecionada = campanhasExportacao.find(
    (campanha) => campanha.local_id === campanhaId
  );
  const pocosSelecionados = Array.from(
    document.querySelectorAll(".checkPocoFiltro:checked")
  ).map((check) => check.value);

  return medicoesExportacao.filter((medicao) => {
    const poco = pocosExportacao.find(
      (p) => p.local_id === medicao.poco_local_id
    );

    if (projetoId && poco?.projeto_local_id !== projetoId) return false;
    if (
      campanhaId &&
      !medicaoEhCompativelComCampanha(
        campanhaSelecionada,
        medicao,
        poco,
        campanhasExportacao
      )
    )
      return false;
    if (
      pocosSelecionados.length > 0 &&
      !pocosSelecionados.includes(medicao.poco_local_id)
    )
      return false;

    return true;
  });
}

function renderizarMedicoesExportacao() {
  const lista = document.getElementById("listaMedicoesExportacao");
  const medicoes = obterMedicoesFiltradas();

  lista.innerHTML = "";

  if (medicoes.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhuma medição encontrada</strong>
        <p>Altere os filtros ou cadastre novas medições.</p>
      </div>
    `;
    return;
  }

  medicoes
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
    .forEach((medicao) => {
      const poco = pocosExportacao.find(
        (p) => p.local_id === medicao.poco_local_id
      );
      const projeto = projetosExportacao.find(
        (p) => p.local_id === poco?.projeto_local_id
      );
      const campanha = campanhasExportacao.find(
        (c) => c.local_id === medicao.campanha_local_id
      );

      lista.innerHTML += `
        <div class="card">
          <label style="display:flex;gap:10px;align-items:center;">
            <input 
              type="checkbox" 
              class="checkMedicaoExportacao" 
              value="${medicao.local_id}"
              style="width:20px;height:20px;"
            >

            <strong>${poco?.nome || medicao.poco_nome || "PM sem nome"}</strong>
          </label>

          <p>Projeto: ${projeto?.nome || "-"}</p>
          <p>Campanha: ${campanha?.nome || medicao.mes_referencia || "-"}</p>
          <p>Data: ${medicao.data_medicao || "-"}</p>
          <p>Código ALS: ${medicao.codigo_frascaria || "-"}</p>
          <p>Volume estagnado: ${medicao.volume_estagnado || 0} L</p>
          <p>Status: ${medicao.sincronizado ? "Sincronizado" : "Pendente"}</p>
        </div>
      `;
    });
}

function selecionarTodasExportacao() {
  document.querySelectorAll(".checkMedicaoExportacao").forEach((check) => {
    check.checked = true;
  });
}

function limparSelecaoExportacao() {
  document.querySelectorAll(".checkMedicaoExportacao").forEach((check) => {
    check.checked = false;
  });
}

function obterMedicoesSelecionadasExportacao() {
  const ids = Array.from(
    document.querySelectorAll(".checkMedicaoExportacao:checked")
  ).map((check) => check.value);

  if (ids.length === 0) {
    alert("Selecione pelo menos uma medição.");
    return [];
  }

  return medicoesExportacao.filter((medicao) => ids.includes(medicao.local_id));
}

async function executarExportacaoFiscal() {
  const selecionadas = obterMedicoesSelecionadasExportacao();

  if (selecionadas.length === 0) return;

  for (const medicao of selecionadas) {
    await imprimirFichaMedicaoFiscal(medicao.local_id);
  }
}

carregarExportacaoFiscal();
