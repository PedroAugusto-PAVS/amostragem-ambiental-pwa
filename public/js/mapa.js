const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

let pocosCarregados = [];
let projetosCarregados = [];

async function carregarMapa() {
  pocosCarregados = await listarPocosLocais();
  projetosCarregados = await listarProjetosLocais();

  renderizarMapa(pocosCarregados);
}

function renderizarMapa(pocos) {
  const lista = document.getElementById("listaMapa");

  lista.innerHTML = "";

  const pocosComGps = pocos.filter(
    (p) =>
      p.ativo !== false &&
      p.latitude &&
      p.longitude
  );

  if (pocosComGps.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhum PM com GPS</strong>
        <p>Cadastre ou edite um PM e capture o GPS para aparecer aqui.</p>
      </div>
    `;
    return;
  }

  pocosComGps.forEach((poco) => {
    const projeto = projetosCarregados.find(
      (p) => p.local_id === poco.projeto_local_id
    );

    lista.innerHTML += `
      <div class="card">
        <strong>${poco.nome || "PM sem nome"}</strong>

        <p>Projeto: ${projeto ? projeto.nome : "Sem projeto"}</p>
        <p>Local: ${poco.local_propriedade || "-"}</p>

        <hr style="border:none;border-top:1px solid #dde6f2;margin:12px 0;">

        <p>UTM E: ${poco.utm_e || "-"}</p>
        <p>UTM N: ${poco.utm_n || "-"}</p>
        <p>Zona UTM: ${poco.zona_utm || "-"}</p>
        <p>Hemisfério: ${poco.hemisferio_utm || "-"}</p>

        <p>Latitude: ${poco.latitude || "-"}</p>
        <p>Longitude: ${poco.longitude || "-"}</p>

        <p>Precisão: ${
          poco.precisao_gps
            ? Number(poco.precisao_gps).toFixed(2) + " m"
            : "-"
        }</p>

        <p>Altitude: ${
          poco.altitude_gps
            ? Number(poco.altitude_gps).toFixed(2) + " m"
            : "-"
        }</p>

        <p>GPS capturado em: ${
          poco.gps_capturado_em
            ? new Date(poco.gps_capturado_em).toLocaleString("pt-BR")
            : "-"
        }</p>

        <div class="card-actions">
          <button class="btn-blue" onclick="abrirHistorico('${poco.local_id}')">
            Histórico
          </button>

          <button class="btn-blue" onclick="abrirGoogleMaps('${poco.latitude}', '${poco.longitude}')">
            Mapa
          </button>
        </div>

        <div class="card-actions">
          <button class="btn-blue" onclick="navegarAtePM('${poco.latitude}', '${poco.longitude}')">
            Navegar
          </button>
        </div>
      </div>
    `;
  });
}

function abrirGoogleMaps(lat, lng) {
  if (!lat || !lng) {
    alert("Coordenadas não disponíveis.");
    return;
  }

  window.open(
    `https://www.google.com/maps?q=${lat},${lng}`,
    "_blank"
  );
}

function navegarAtePM(lat, lng) {
  if (!lat || !lng) {
    alert("Coordenadas não disponíveis.");
    return;
  }

  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    "_blank"
  );
}

function abrirHistorico(localId) {
  localStorage.setItem("poco_selecionado", localId);
  window.location.href = "historico-poco.html";
}

function filtrarMapa() {
  const termo = document.getElementById("pesquisaMapa")?.value.toLowerCase() || "";

  const filtrados = pocosCarregados.filter((poco) =>
    String(poco.nome || "").toLowerCase().includes(termo) ||
    String(poco.local_propriedade || "").toLowerCase().includes(termo)
  );

  renderizarMapa(filtrados);
}

carregarMapa();