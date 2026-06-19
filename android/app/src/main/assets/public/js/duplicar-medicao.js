const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const pocoLocalId = localStorage.getItem("poco_selecionado");

if (!pocoLocalId) {
  alert("Selecione um PM primeiro.");
  window.location.href = "dashboard.html";
}

let pocoAtual = null;
let medicoesDoPoco = [];

async function carregarDuplicacao() {
  const pocos = await listarPocosLocais();
  const medicoes = await listarMedicoesLocais();

  pocoAtual = pocos.find((p) => p.local_id === pocoLocalId);

  if (!pocoAtual) {
    alert("PM não encontrado.");
    window.location.href = "dashboard.html";
    return;
  }

  document.getElementById("nomePocoSelecionado").innerText = pocoAtual.nome;

  medicoesDoPoco = medicoes
    .filter((m) => m.poco_local_id === pocoLocalId)
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

  const select = document.getElementById("medicaoOrigem");
  select.innerHTML = `<option value="">Selecione uma medição</option>`;

  if (medicoesDoPoco.length === 0) {
    select.innerHTML = `<option value="">Nenhuma medição encontrada</option>`;
    return;
  }

  medicoesDoPoco.forEach((m) => {
    const option = document.createElement("option");
    option.value = m.local_id;

    option.textContent = `${m.mes_referencia || "Sem mês"} - ${m.data_medicao || "Sem data"}`;

    select.appendChild(option);
  });

  const hoje = new Date();
  document.getElementById("novaDataMedicao").value = hoje.toISOString().split("T")[0];
  document.getElementById("novoMesReferencia").value = hoje.toISOString().slice(0, 7);
}

async function duplicarMedicao() {
  const origemId = document.getElementById("medicaoOrigem").value;
  const novaData = document.getElementById("novaDataMedicao").value;
  const novoMes = document.getElementById("novoMesReferencia").value;

  if (!origemId) {
    alert("Selecione uma medição de origem.");
    return;
  }

  if (!novaData || !novoMes) {
    alert("Informe a nova data e o novo mês de referência.");
    return;
  }

  const origem = medicoesDoPoco.find((m) => m.local_id === origemId);

  if (!origem) {
    alert("Medição de origem não encontrada.");
    return;
  }

  const novaMedicao = {
    ...origem,

    local_id: crypto.randomUUID(),

    data_medicao: novaData,
    mes_referencia: novoMes,

    sincronizado: false,
    criado_em: new Date().toISOString(),
    atualizado_em: null,

    duplicada_de: origem.local_id
  };

  await salvarMedicaoLocal(novaMedicao);

  alert("Medição duplicada com sucesso.");

  localStorage.setItem("medicao_selecionada", novaMedicao.local_id);

  window.location.href = "editar-medicao.html";
}

carregarDuplicacao();