const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

const pocoLocalId = localStorage.getItem("poco_selecionado");

if (!pocoLocalId) {
  window.location.href = "dashboard.html";
}

let pocoAtual = null;
let medicoesDoPoco = [];

async function carregarHistorico() {
  const pocos = await listarPocosLocais();
  const medicoes = await listarMedicoesLocais();

  pocoAtual = pocos.find((p) => p.local_id === pocoLocalId);

  if (!pocoAtual) {
    alert("PM não encontrado.");
    window.location.href = "dashboard.html";
    return;
  }

  medicoesDoPoco = medicoes.filter((m) => m.poco_local_id === pocoLocalId);

  document.getElementById("tituloPoco").innerText = pocoAtual.nome;

  document.getElementById("infoPoco").innerHTML = `
    <div class="card">
      <strong>${pocoAtual.nome}</strong>

      <p>Tipo: ${pocoAtual.tipo || "-"}</p>
      <p>Local: ${pocoAtual.local_propriedade || "-"}</p>

      <hr class="content-divider">

      <strong>Localização</strong>
      <p>UTM E: ${pocoAtual.utm_e || "-"}</p>
      <p>UTM N: ${pocoAtual.utm_n || "-"}</p>
      <p>Zona UTM: ${pocoAtual.zona_utm || "-"}</p>
      <p>Hemisfério: ${pocoAtual.hemisferio_utm || "-"}</p>
      <p>Latitude: ${pocoAtual.latitude || "-"}</p>
      <p>Longitude: ${pocoAtual.longitude || "-"}</p>
      <p>Precisão GPS: ${
        pocoAtual.precisao_gps
          ? Number(pocoAtual.precisao_gps).toFixed(2) + " m"
          : "-"
      }</p>
      <p>Altitude: ${
        pocoAtual.altitude_gps
          ? Number(pocoAtual.altitude_gps).toFixed(2) + " m"
          : "-"
      }</p>

      <hr class="content-divider">

      <strong>Dados do PM</strong>
      <p>Profundidade total cadastrada: ${
        pocoAtual.profundidade_total || 0
      } m</p>
      <p>Diâmetro: ${pocoAtual.diametro || "-"} cm</p>
      <p>Fotos do PM: ${(pocoAtual.fotos || []).length}</p>
      <p>Status: ${pocoAtual.ativo === false ? "Inativo" : "Ativo"}</p>
    </div>
  `;

  const btnStatus = document.getElementById("btnStatusPoco");

  if (btnStatus) {
    btnStatus.innerText =
      pocoAtual.ativo === false ? "Reativar PM" : "Inativar PM";
    btnStatus.style.background =
      pocoAtual.ativo === false ? "#16a34a" : "#f59e0b";
  }

  const historico = [...medicoesDoPoco].sort(
    (a, b) => new Date(b.criado_em) - new Date(a.criado_em)
  );

  const lista = document.getElementById("listaHistorico");
  lista.innerHTML = "";

  if (historico.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhuma medição cadastrada</strong>
        <p>Adicione a primeira medição mensal desse PM.</p>
      </div>
    `;
    return;
  }

  historico.forEach((m) => {
    const codigos = obterCodigosDaMedicao(m);
    const codigosHtml = codigos.length
      ? `
        <div class="sample-codes-summary">
          <strong>Códigos das amostras</strong>
          <ul>
            ${codigos
              .map(
                (item) =>
                  `<li><span>${escaparHtml(item.codigo)}</span> — ${escaparHtml(
                    formatarTipoCodigoAmostra(item.tipo)
                  )}</li>`
              )
              .join("")}
          </ul>
        </div>
      `
      : `<p>Códigos das amostras: -</p>`;

    lista.innerHTML += `
      <div class="card">
        <strong>${m.mes_referencia || "Medição"}</strong>

        <p>Data: ${m.data_medicao || "-"}</p>
        ${codigosHtml}
        <p>Profundidade total medida: ${m.profundidade_total_mes || 0} m</p>
        <p>Nível d'água: ${m.nivel_agua || 0} m</p>
        <p>Coluna d'água: ${m.coluna_agua || 0} m</p>
        <p>Volume estagnado: ${m.volume_estagnado || 0} L</p>
        <p>Volume esgotado mínimo: ${m.volume_purga || 0} L</p>
        <p>Volume total esgotado: ${m.volume_total_esgotado || 0} L</p>
        <p>Fotos: ${(m.fotos || []).length}</p>

        <p>Estabilização: ${
          m.estabilizacao?.estavel ? "✅ Estável" : "⚠ Não estabilizado"
        }</p>

        ${
          m.alertas && m.alertas.length > 0
            ? `<p>Alertas: ${m.alertas.join(", ")}</p>`
            : `<p>Alertas: Nenhum</p>`
        }

        <p>Status: ${m.sincronizado ? "Sincronizado" : "Pendente"}</p>

        <div class="card-actions">
          <button class="btn-blue" onclick="editarMedicao('${m.local_id}')">
            Editar
          </button>

<button class="btn-blue" onclick="window.imprimirFichaMedicao('${m.local_id}')">
  Imprimir ficha
</button>

<button class="btn-danger" onclick="excluirMedicao('${
      m.local_id
    }')">
  Excluir
</button>
        </div>
      </div>
    `;
  });
}

function novaMedicao() {
  if (pocoAtual.ativo === false) {
    alert("Este PM está inativo. Reative antes de adicionar medição.");
    return;
  }

  localStorage.setItem("poco_selecionado", pocoAtual.local_id);
  localStorage.removeItem("campanha_selecionada");
  window.location.href = "nova-medicao.html";
}

function duplicarMedicaoAnterior() {
  if (pocoAtual.ativo === false) {
    alert("Este PM está inativo. Reative antes de duplicar medição.");
    return;
  }

  if (medicoesDoPoco.length === 0) {
    alert("Este PM ainda não possui medições para duplicar.");
    return;
  }

  localStorage.setItem("poco_selecionado", pocoAtual.local_id);
  localStorage.removeItem("campanha_selecionada");
  window.location.href = "duplicar-medicao.html";
}

function editarPoco() {
  localStorage.setItem("poco_selecionado", pocoAtual.local_id);
  window.location.href = "editar-poco.html";
}

function verFotos() {
  localStorage.setItem("poco_selecionado", pocoAtual.local_id);
  window.location.href = "foto-poco.html";
}

function editarMedicao(localId) {
  localStorage.setItem("medicao_selecionada", localId);
  window.location.href = "editar-medicao.html";
}

function abrirGoogleMaps() {
  if (!pocoAtual.latitude || !pocoAtual.longitude) {
    alert("Este PM não possui coordenadas GPS.");
    return;
  }

  window.open(
    `https://www.google.com/maps?q=${pocoAtual.latitude},${pocoAtual.longitude}`,
    "_blank"
  );
}

function navegarAtePM() {
  if (!pocoAtual.latitude || !pocoAtual.longitude) {
    alert("Este PM não possui coordenadas GPS.");
    return;
  }

  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${pocoAtual.latitude},${pocoAtual.longitude}`,
    "_blank"
  );
}

async function alternarStatusPoco() {
  if (!pocoAtual) return;

  const estaInativo = pocoAtual.ativo === false;

  const confirmar = confirm(
    estaInativo
      ? "Deseja reativar este PM?"
      : "Deseja inativar este PM? O histórico será mantido."
  );

  if (!confirmar) return;

  pocoAtual.ativo = estaInativo ? true : false;
  pocoAtual.sincronizado = false;
  pocoAtual.atualizado_em = new Date().toISOString();

  await atualizarPocoLocal(pocoAtual);

  alert(
    estaInativo ? "PM reativado com sucesso." : "PM inativado com sucesso."
  );

  carregarHistorico();
}

async function excluirPoco() {
  if (!pocoAtual) return;

  if (medicoesDoPoco.length > 0) {
    const confirmarComHistorico = confirm(
      `Este PM possui ${medicoesDoPoco.length} medição(ões). O recomendado é inativar. Deseja excluir mesmo assim?`
    );

    if (!confirmarComHistorico) return;
  }

  const confirmar = confirm(
    `Tem certeza que deseja excluir o PM "${pocoAtual.nome}"?`
  );

  if (!confirmar) return;

  // Marca para exclusão
  pocoAtual.exclusao_remota_necessaria =
    pocoAtual.sincronizado === true || !!pocoAtual.sincronizado_em;
  pocoAtual.excluido = true;
  pocoAtual.sincronizado = false;
  pocoAtual.atualizado_em = new Date().toISOString();

  await atualizarPocoLocal(pocoAtual);

  // sincroniza imediatamente se houver internet
  await sincronizarDados();

  alert("PM excluído com sucesso.");

  window.location.href = "dashboard.html";
}

function abrirFichaImpressao(medicaoId) {
  localStorage.setItem("medicao_imprimir", medicaoId);
  window.location.href = "ficha-impressao.html";
}

async function excluirMedicao(localId) {
  const confirmar = confirm("Tem certeza que deseja excluir esta medição?");

  if (!confirmar) return;

  const medicao = medicoesDoPoco.find((m) => m.local_id === localId);

  if (!medicao) {
    alert("Medição não encontrada.");
    return;
  }

  medicao.exclusao_remota_necessaria =
    medicao.sincronizado === true || !!medicao.sincronizado_em;
  medicao.excluido = true;
  medicao.sincronizado = false;
  medicao.atualizado_em = new Date().toISOString();

  await atualizarMedicaoLocal(medicao);

  await sincronizarDados();

  alert("Medição excluída com sucesso.");

  carregarHistorico();
}

carregarHistorico();
