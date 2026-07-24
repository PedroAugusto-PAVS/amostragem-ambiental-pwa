const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const campanhaLocalId = localStorage.getItem("campanha_selecionada");

if (!campanhaLocalId) {
  window.location.href = "campanhas.html";
}

let campanhaAtual = null;
let projetoAtual = null;
let pmsCampanha = [];
let medicoesCampanha = [];

function obterStatusAmostragemPoco(poco) {
  const status = poco?.perfil_construtivo?.status_amostragem || "";

  if (status === "SECO") {
    return { texto: "Poco seco", classe: "status-dry" };
  }

  if (status === "SEM_ALIQUOTA") {
    return { texto: "Sem aliquota suficiente", classe: "status-low-sample" };
  }

  return null;
}

async function normalizarMedicoesDaCampanha(medicoes, campanhas) {
  const pmsPorId = new Map(pmsCampanha.map((pm) => [pm.local_id, pm]));
  const medicoesNormalizadas = [];

  for (const medicao of medicoes) {
    const pm = pmsPorId.get(medicao.poco_local_id);

    if (!pm) {
      continue;
    }

    const compativelComCampanhaAtual = medicaoEhCompativelComCampanha(
      campanhaAtual,
      medicao,
      pm,
      campanhas
    );

    if (!compativelComCampanhaAtual) {
      continue;
    }

    if (medicao.campanha_local_id !== campanhaAtual.local_id) {
      medicao.campanha_local_id = campanhaAtual.local_id;
      medicao.sincronizado = false;
      medicao.atualizado_em = new Date().toISOString();

      await atualizarMedicaoLocal(medicao);
    }

    medicoesNormalizadas.push(medicao);
  }

  return medicoesNormalizadas;
}

async function carregarCampanha() {
  const campanhas = await listarCampanhasLocais();
  const projetos = await listarProjetosLocais();
  const pocos = await listarPocosLocais();
  const medicoes = await listarMedicoesLocais();

  campanhaAtual = campanhas.find((campanha) => campanha.local_id === campanhaLocalId);

  if (!campanhaAtual) {
    alert("Campanha nao encontrada.");
    window.location.href = "campanhas.html";
    return;
  }

  projetoAtual = projetos.find(
    (projeto) => projeto.local_id === campanhaAtual.projeto_local_id
  );

  pmsCampanha = pocos.filter(
    (poco) =>
      poco.projeto_local_id === campanhaAtual.projeto_local_id &&
      poco.ativo !== false
  );

  medicoesCampanha = await normalizarMedicoesDaCampanha(medicoes, campanhas);

  renderizarResumoCampanha();
  renderizarPmsCampanha(pmsCampanha);
}

function obterMedicoesUnicasPorPm() {
  return new Set(medicoesCampanha.map((medicao) => medicao.poco_local_id));
}

function renderizarResumoCampanha() {
  const total = pmsCampanha.length;
  const coletados = obterMedicoesUnicasPorPm().size;
  const pendentes = Math.max(total - coletados, 0);
  const progresso = total > 0 ? Math.round((coletados / total) * 100) : 0;

  document.getElementById("tituloCampanha").innerText =
    campanhaAtual.nome || "Campanha";
  document.getElementById("subtituloCampanha").innerText = projetoAtual
    ? projetoAtual.nome
    : "Sem projeto";

  const btnStatus = document.getElementById("btnStatusCampanha");

  if (btnStatus) {
    btnStatus.innerText =
      campanhaAtual.ativo === false ? "Reativar" : "Inativar";
    btnStatus.style.background =
      campanhaAtual.ativo === false ? "#16a34a" : "#f59e0b";
  }

  document.getElementById("resumoCampanha").innerHTML = `
    <div class="card campaign-summary-card">
      <strong>Resumo</strong>
      <p>Projeto: ${projetoAtual ? projetoAtual.nome : "-"}</p>
      <p>Mes: ${campanhaAtual.mes_referencia || "-"}</p>
      <p>Periodo: ${campanhaAtual.data_inicio || "-"} ate ${campanhaAtual.data_fim || "-"}</p>
      <p>Status: ${campanhaAtual.ativo === false ? "Inativa" : "Ativa"}</p>

      <div class="campaign-summary-grid">
        <div><strong>${total}</strong><span>PMs</span></div>
        <div><strong>${coletados}</strong><span>coletados</span></div>
        <div><strong>${pendentes}</strong><span>pendentes</span></div>
      </div>

      <div class="campaign-progress">
        <div style="width:${progresso}%"></div>
      </div>

      <p>${progresso}% concluido</p>

      ${
        campanhaAtual.observacoes
          ? `<p>Observacoes: ${campanhaAtual.observacoes}</p>`
          : ""
      }
    </div>
  `;
}

function renderizarPmsCampanha(pms) {
  const lista = document.getElementById("listaPmsCampanha");
  const resumo = document.getElementById("resumoListaPmsCampanha");
  const total = pmsCampanha.length;
  const pmsOrdenados = [...pms].sort((a, b) =>
    String(a.nome || "").localeCompare(String(b.nome || ""))
  );

  lista.innerHTML = "";

  if (resumo) {
    resumo.innerText =
      pmsOrdenados.length === total
        ? `${total} PM${total === 1 ? "" : "s"} nesta campanha`
        : `${pmsOrdenados.length} de ${total} PMs encontrados`;
  }

  if (pmsOrdenados.length === 0) {
    lista.innerHTML = `
      <div class="dashboard-empty-state">
        <strong>Nenhum PM encontrado</strong>
        <p>Altere a pesquisa ou vincule PMs ao projeto desta campanha.</p>
      </div>
    `;
    return;
  }

  pmsOrdenados.forEach((pm) => {
    const medicao = medicoesCampanha.find(
      (item) => item.poco_local_id === pm.local_id
    );
    const coletado = !!medicao;
    const letras = pm.nome ? pm.nome.substring(0, 2).toUpperCase() : "PM";
    const statusAmostragem = obterStatusAmostragemPoco(pm);

    lista.innerHTML += `
      <article class="poco-item dashboard-pm-card campaign-pm-card">
        <div class="avatar">${letras}</div>

        <div class="poco-info">
          <strong>${pm.nome || "PM sem nome"}</strong>
          <span>${pm.local_propriedade || "Local nao informado"}</span>
          <div class="pm-meta">
            <small>${pm.tipo || "Tipo nao informado"}</small>
            <small class="${coletado ? "status-ok" : "status-pending"}">
              ${coletado ? "Coletado" : "Pendente"}
            </small>
            ${
              statusAmostragem
                ? `<small class="${statusAmostragem.classe}">${statusAmostragem.texto}</small>`
                : ""
            }
          </div>
        </div>

        <div class="campaign-pm-actions">
          ${
            coletado
              ? `<button class="btn-blue compact-btn" onclick="editarMedicao('${medicao.local_id}')">Editar</button>`
              : `
                <button class="btn-blue compact-btn" onclick="novaMedicao('${pm.local_id}')">Coletar</button>
                <button class="btn-blue compact-btn secondary-btn" onclick="marcarPmColetado('${pm.local_id}')">Marcar coletado</button>
              `
          }
        </div>
      </article>
    `;
  });
}

function filtrarPmsCampanha() {
  const termo = document
    .getElementById("pesquisaPmCampanha")
    .value.toLowerCase();

  const filtrados = pmsCampanha.filter(
    (pm) =>
      String(pm.nome || "").toLowerCase().includes(termo) ||
      String(pm.local_propriedade || "").toLowerCase().includes(termo) ||
      String(pm.tipo || "").toLowerCase().includes(termo)
  );

  renderizarPmsCampanha(filtrados);
}

function novaMedicao(pocoLocalId) {
  if (campanhaAtual.ativo === false) {
    alert("Esta campanha esta inativa. Reative antes de adicionar coleta.");
    return;
  }

  localStorage.setItem("poco_selecionado", pocoLocalId);
  localStorage.setItem("campanha_selecionada", campanhaAtual.local_id);
  window.location.href = "nova-medicao.html";
}

async function marcarPmColetado(pocoLocalId) {
  if (campanhaAtual.ativo === false) {
    alert("Esta campanha esta inativa. Reative antes de marcar coleta.");
    return;
  }

  const pm = pmsCampanha.find((item) => item.local_id === pocoLocalId);

  if (!pm) {
    alert("PM nao encontrado.");
    return;
  }

  const jaColetado = medicoesCampanha.some(
    (medicao) => medicao.poco_local_id === pocoLocalId
  );

  if (jaColetado) {
    alert("Este PM ja esta marcado como coletado nesta campanha.");
    return;
  }

  const confirmar = confirm(
    `Marcar o PM "${pm.nome || "sem nome"}" como coletado sem preencher a ficha completa?`
  );

  if (!confirmar) return;

  const agora = new Date();
  const dataMedicao = agora.toISOString().split("T")[0];

  const medicao = {
    local_id: crypto.randomUUID(),
    poco_local_id: pm.local_id,
    poco_nome: pm.nome || "",
    campanha_local_id: campanhaAtual.local_id,
    usuario_id: usuario.id,
    coletor_nome: usuario.nome || "",
    codigos_amostras: [],
    codigo_frascaria: "Marcado manualmente",
    responsavel_als: usuario.nome || "",
    data_medicao: dataMedicao,
    mes_referencia:
      campanhaAtual.mes_referencia || dataMedicao.substring(0, 7),
    profundidade_total_mes: null,
    nivel_agua: null,
    profundidade_bomba: null,
    coluna_agua: null,
    volume_estagnado: null,
    volume_purga: null,
    volume_total_esgotado: null,
    leituras: [],
    estabilizacao: null,
    alertas: [],
    condicoes_ambientais: {
      observacoes_gerais: "PM marcado como coletado manualmente na campanha.",
    },
    fotos: [],
    marcado_manual: true,
    sincronizado: false,
    criado_em: agora.toISOString(),
    atualizado_em: agora.toISOString(),
  };

  await salvarMedicaoLocal(medicao);

  medicoesCampanha.push(medicao);
  renderizarResumoCampanha();
  filtrarPmsCampanha();

  alert("PM marcado como coletado.");
}

function editarMedicao(medicaoLocalId) {
  localStorage.setItem("medicao_selecionada", medicaoLocalId);
  window.location.href = "editar-medicao.html";
}

function editarCampanha() {
  localStorage.setItem("campanha_selecionada", campanhaAtual.local_id);
  window.location.href = "editar-campanha.html";
}

async function alternarStatusCampanha() {
  const estaInativa = campanhaAtual.ativo === false;

  const confirmar = confirm(
    estaInativa
      ? "Deseja reativar esta campanha?"
      : "Deseja inativar esta campanha? O historico sera mantido."
  );

  if (!confirmar) return;

  campanhaAtual.ativo = estaInativa ? true : false;
  campanhaAtual.sincronizado = false;
  campanhaAtual.atualizado_em = new Date().toISOString();

  await atualizarCampanhaLocal(campanhaAtual);

  alert(
    estaInativa
      ? "Campanha reativada com sucesso."
      : "Campanha inativada com sucesso."
  );

  carregarCampanha();
}

async function excluirCampanha() {
  if (!campanhaAtual) {
    alert("Campanha nao encontrada.");
    return;
  }

  const confirmar = confirm(
    `Tem certeza que deseja excluir a campanha "${campanhaAtual.nome}"?`
  );

  if (!confirmar) return;

  campanhaAtual.excluido = true;
  campanhaAtual.sincronizado = false;
  campanhaAtual.atualizado_em = new Date().toISOString();

  await atualizarCampanhaLocal(campanhaAtual);
  await sincronizarDados();

  alert("Campanha excluida com sucesso.");

  if (window.history.length > 1) {
    history.back();
  } else {
    window.location.href = "campanhas.html";
  }
}

carregarCampanha();
