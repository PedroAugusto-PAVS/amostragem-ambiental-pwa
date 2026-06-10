const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

async function carregarMapa() {
  const fichas = await listarFichasLocais();
  const lista = document.getElementById("listaMapa");

  lista.innerHTML = "";

  if (fichas.length === 0) {
    lista.innerHTML = `
      <div class="card">
        <strong>Nenhum poço encontrado</strong>
        <p>Cadastre uma ficha com GPS para aparecer aqui.</p>
      </div>
    `;
    return;
  }

  fichas.reverse().forEach((ficha) => {
    lista.innerHTML += `
      <div class="card">
        <strong>${ficha.nome_poco || "Sem nome"}</strong>
        <p>Local: ${ficha.local_propriedade || "-"}</p>
        <p>UTM E: ${ficha.utm_e || "-"}</p>
        <p>UTM N: ${ficha.utm_n || "-"}</p>
        <p>Latitude: ${ficha.latitude || ficha.gps?.latitude || "-"}</p>
        <p>Longitude: ${ficha.longitude || ficha.gps?.longitude || "-"}</p>

        ${
          ficha.gps?.latitude && ficha.gps?.longitude
            ? `<button class="btn-blue" onclick="abrirGoogleMaps(${ficha.gps.latitude}, ${ficha.gps.longitude})">
                Abrir no Google Maps
              </button>`
            : ""
        }
      </div>
    `;
  });
}

function abrirGoogleMaps(lat, lng) {
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
}

carregarMapa();