const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const params = new URLSearchParams(window.location.search);
const tipoExportacao = params.get("tipo") || "pdf";

let projetosExportacao = [];
let campanhasExportacao = [];
let pocosExportacao = [];
let medicoesExportacao = [];

async function carregarExportacao() {
  projetosExportacao = await listarProjetosLocais();
  campanhasExportacao = await listarCampanhasLocais();
  pocosExportacao = await listarPocosLocais();
  medicoesExportacao = await listarMedicoesLocais();

  document.getElementById("tipoExportacaoTexto").innerText =
    tipoExportacao === "excel"
      ? "Selecione as fichas para gerar Excel"
      : "Selecione as fichas para gerar PDF";

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
  const projetoId = document.getElementById("filtroProjeto").value;
  const select = document.getElementById("filtroPoco");

  select.innerHTML = `<option value="">Todos os PMs</option>`;

  const pocosFiltrados = pocosExportacao.filter((poco) => {
    if (!projetoId) return true;
    return poco.projeto_local_id === projetoId;
  });

  pocosFiltrados.forEach((poco) => {
    select.innerHTML += `
      <option value="${poco.local_id}">
        ${poco.nome || "PM sem nome"}
      </option>
    `;
  });
}

function atualizarFiltros() {
  carregarCampanhasSelect();
  carregarPocosSelect();
  renderizarMedicoesExportacao();
}

function obterMedicoesFiltradas() {
  const projetoId = document.getElementById("filtroProjeto").value;
  const campanhaId = document.getElementById("filtroCampanha").value;
  const pocoId = document.getElementById("filtroPoco").value;

  return medicoesExportacao.filter((medicao) => {
    const poco = pocosExportacao.find((p) => p.local_id === medicao.poco_local_id);

    if (projetoId && poco?.projeto_local_id !== projetoId) return false;
    if (campanhaId && medicao.campanha_local_id !== campanhaId) return false;
    if (pocoId && medicao.poco_local_id !== pocoId) return false;

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
      const poco = pocosExportacao.find((p) => p.local_id === medicao.poco_local_id);
      const projeto = projetosExportacao.find((p) => p.local_id === poco?.projeto_local_id);
      const campanha = campanhasExportacao.find((c) => c.local_id === medicao.campanha_local_id);

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
  const ids = Array.from(document.querySelectorAll(".checkMedicaoExportacao:checked"))
    .map((check) => check.value);

  if (ids.length === 0) {
    alert("Selecione pelo menos uma medição.");
    return [];
  }

  return medicoesExportacao.filter((medicao) => ids.includes(medicao.local_id));
}

async function executarExportacao() {
  const selecionadas = obterMedicoesSelecionadasExportacao();

  if (selecionadas.length === 0) return;

  if (tipoExportacao === "excel") {
    await exportarExcelMedicoes(selecionadas, {
      projetos: projetosExportacao,
      pocos: pocosExportacao,
      campanhas: campanhasExportacao
    });
  } else {
    for (const medicao of selecionadas) {
      await imprimirFichaMedicao(medicao.local_id);
    }
  }
}

carregarExportacao();