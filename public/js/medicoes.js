const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

let fichasCarregadas = [];

async function carregarMedicoes() {
  fichasCarregadas = await listarMedicoesLocais();

  const lista = document.getElementById("listaMedicoes");
  lista.innerHTML = "";

  if (fichasCarregadas.length === 0) {
    lista.innerHTML = `
      <div class="card empty-state">
        <strong>Nenhuma medição encontrada</strong>
        <p>Adicione uma ficha para aparecer aqui.</p>
      </div>
    `;
    return;
  }

  [...fichasCarregadas].reverse().forEach((ficha) => {
    const dataBase = ficha.data_medicao || ficha.criado_em;
    const data = dataBase
      ? new Date(dataBase).toLocaleDateString("pt-BR")
      : "-";

    lista.innerHTML += `
      <div class="card">
        <label class="selection-row">
          <input 
            type="checkbox" 
            class="checkFicha" 
            value="${ficha.local_id}"
          >

          <strong>${ficha.poco_nome || "Sem nome"}</strong>
        </label>

        <p>Data: ${data}</p>
        <p>Mês referência: ${ficha.mes_referencia || "-"}</p>
        <p>Códigos das amostras: ${
          escaparHtml(formatarCodigosDaMedicao(ficha)) || "-"
        }</p>
        <p>Status: ${ficha.sincronizado ? "Sincronizado" : "Pendente"}</p>
        <p>Volume estagnado: ${ficha.volume_estagnado || 0} L</p>
      </div>
    `;
  });
}

function obterFichasSelecionadas() {
  const selecionadas = Array.from(document.querySelectorAll(".checkFicha:checked"))
    .map((check) => check.value);

  if (selecionadas.length === 0) {
    alert("Selecione pelo menos uma ficha.");
    return [];
  }

  return fichasCarregadas.filter((ficha) =>
    selecionadas.includes(ficha.local_id)
  );
}

function selecionarTodas() {
  document.querySelectorAll(".checkFicha").forEach((check) => {
    check.checked = true;
  });
}

carregarMedicoes();
