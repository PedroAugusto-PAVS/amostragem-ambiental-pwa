const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

let fichasCarregadas = [];

async function carregarMedicoes() {
  fichasCarregadas = await listarFichasLocais();

  const lista = document.getElementById("listaMedicoes");
  lista.innerHTML = "";

  if (fichasCarregadas.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhuma medição encontrada</strong>
        <p>Adicione uma ficha para aparecer aqui.</p>
      </div>
    `;
    return;
  }

  [...fichasCarregadas].reverse().forEach((ficha) => {
    const data = new Date(ficha.criado_em).toLocaleDateString("pt-BR");

    lista.innerHTML += `
      <div class="card">
        <label style="display:flex; gap:10px; align-items:center;">
          <input 
            type="checkbox" 
            class="checkFicha" 
            value="${ficha.local_id}"
            style="width:20px; height:20px;"
          >

          <strong>${ficha.nome_poco || "Sem nome"}</strong>
        </label>

        <p>Data: ${data}</p>
        <p>Local: ${ficha.local_propriedade || "-"}</p>
        <p>Tipo: ${ficha.tipo_poco || "-"}</p>
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