const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

let gpsAtual = null;

function latLonToUTM(lat, lon) {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;

  const e = Math.sqrt(f * (2 - f));
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;

  const zone = Math.floor((lon + 180) / 6) + 1;
  const lonOrigin = (zone - 1) * 6 - 180 + 3;
  const lonOriginRad = lonOrigin * Math.PI / 180;

  const ePrimeSq = (e * e) / (1 - e * e);

  const N = a / Math.sqrt(1 - e * e * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = ePrimeSq * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lonRad - lonOriginRad);

  const M = a * (
    (1 - e * e / 4 - 3 * e ** 4 / 64 - 5 * e ** 6 / 256) * latRad
    - (3 * e * e / 8 + 3 * e ** 4 / 32 + 45 * e ** 6 / 1024) * Math.sin(2 * latRad)
    + (15 * e ** 4 / 256 + 45 * e ** 6 / 1024) * Math.sin(4 * latRad)
    - (35 * e ** 6 / 3072) * Math.sin(6 * latRad)
  );

  let utmE = k0 * N * (
    A +
    (1 - T + C) * A ** 3 / 6 +
    (5 - 18 * T + T ** 2 + 72 * C - 58 * ePrimeSq) * A ** 5 / 120
  ) + 500000.0;

  let utmN = k0 * (
    M +
    N * Math.tan(latRad) * (
      A ** 2 / 2 +
      (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 +
      (61 - 58 * T + T ** 2 + 600 * C - 330 * ePrimeSq) * A ** 6 / 720
    )
  );

  const hemisferio = lat < 0 ? "Sul" : "Norte";

  if (lat < 0) {
    utmN += 10000000.0;
  }

  return {
    zona: zone,
    hemisferio,
    utmE: Math.round(utmE),
    utmN: Math.round(utmN)
  };
}

function capturarGPS() {
  if (!navigator.geolocation) {
    alert("GPS não disponível neste aparelho.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const precisao = position.coords.accuracy;
      const altitude = position.coords.altitude;

      const utm = latLonToUTM(latitude, longitude);

      gpsAtual = {
        latitude,
        longitude,
        precisao,
        altitude,
        zona_utm: utm.zona,
        hemisferio_utm: utm.hemisferio,
        utm_e: utm.utmE,
        utm_n: utm.utmN,
        capturado_em: new Date().toISOString()
      };

      document.getElementById("latitudeGps").value = latitude;
      document.getElementById("longitudeGps").value = longitude;

      document.getElementById("precisaoGps").value = precisao
        ? `${precisao.toFixed(2)} m`
        : "";

      document.getElementById("altitudeGps").value = altitude
        ? `${altitude.toFixed(2)} m`
        : "Não disponível";

      document.getElementById("utmE").value = utm.utmE;
      document.getElementById("utmN").value = utm.utmN;
      document.getElementById("zonaUtm").value = utm.zona;
      document.getElementById("hemisferioUtm").value = utm.hemisferio;

      document.getElementById("dataHoraGps").value =
        new Date(gpsAtual.capturado_em).toLocaleString("pt-BR");

      alert("GPS capturado com sucesso.");
    },
    () => {
      alert("Não foi possível capturar o GPS. Verifique a permissão de localização.");
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
}

function abrirGoogleMaps() {
  const lat = document.getElementById("latitudeGps").value;
  const lng = document.getElementById("longitudeGps").value;

  if (!lat || !lng) {
    alert("Capture o GPS primeiro.");
    return;
  }

  window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
}

function converterFotosBase64(files) {
  return Promise.all(
    Array.from(files).map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = () => {
          resolve({
            nome: file.name,
            tipo: file.type,
            base64: reader.result,
            criado_em: new Date().toISOString()
          });
        };

        reader.readAsDataURL(file);
      });
    })
  );
}

async function carregarProjetosNoSelect() {
  const projetos = await listarProjetosLocais();
  const container = document.getElementById("projetoSelect");

  container.innerHTML = "";
  const projetoSelecionado = localStorage.getItem("projeto_selecionado");

  projetos.forEach((projeto) => {
    const label = document.createElement("label");
    label.className = "selection-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = projeto.local_id;
    checkbox.checked = projeto.local_id === projetoSelecionado;
    checkbox.dataset.projetoId = projeto.local_id;

    const nome = document.createElement("span");
    nome.textContent = projeto.nome;

    label.append(checkbox, nome);
    container.appendChild(label);
  });
}

function obterProjetosSelecionados() {
  return Array.from(
    document.querySelectorAll('#projetoSelect input[type="checkbox"]:checked')
  ).map((checkbox) => checkbox.dataset.projetoId);
}

function obterPerfilConstrutivo() {
  return {
    boca_tubo: document.getElementById("bocaTubo").value,
    cota_terreno: document.getElementById("cotaTerreno").value,
    cota_tubo: document.getElementById("cotaTubo").value,
    nivel_estatico: document.getElementById("nivelEstatico").value,

    zona_filtrante_inicio: document.getElementById("zonaFiltranteInicio").value,
    zona_filtrante_fim: document.getElementById("zonaFiltranteFim").value,

    secao_filtrante: document.getElementById("secaoFiltrante").value,
    pre_filtro: document.getElementById("preFiltro").value,
    revestimento: document.getElementById("revestimento").value,

    tipo_tampa: document.getElementById("tipoTampa").value,
    condicao_poco: document.getElementById("condicaoPoco").value,
    status_amostragem: document.getElementById("statusAmostragem")?.value || "",

    observacoes_construtivas: document.getElementById("observacoesConstrutivas").value
  };
}

async function salvarPoco() {
  const nome = document.getElementById("nomePoco").value.trim();
  const tipo = document.getElementById("tipoPoco").value;

  if (!nome || !tipo) {
    alert("Preencha o nome e o tipo do PM.");
    return;
  }

  const fotosFiles = document.getElementById("fotosPoco").files;
  const fotosBase64 = await converterFotosBase64(fotosFiles);

  const poco = {
    local_id: crypto.randomUUID(),
    usuario_id: usuario.id,

    projeto_local_ids: obterProjetosSelecionados(),
    projeto_local_id: obterProjetosSelecionados()[0] || null,

    nome,
    tipo,

    local_propriedade: document.getElementById("localPropriedade").value,

    utm_e: document.getElementById("utmE").value,
    utm_n: document.getElementById("utmN").value,
    zona_utm: document.getElementById("zonaUtm").value,
    hemisferio_utm: document.getElementById("hemisferioUtm").value,

    latitude: document.getElementById("latitudeGps").value,
    longitude: document.getElementById("longitudeGps").value,
    precisao_gps: gpsAtual ? gpsAtual.precisao : null,
    altitude_gps: gpsAtual ? gpsAtual.altitude : null,
    gps_capturado_em: gpsAtual ? gpsAtual.capturado_em : null,

    gps: gpsAtual,

    profundidade_total: Number(document.getElementById("profundidadeTotal").value),
    diametro: document.getElementById("diametro").value,

poco_com_cap: document.getElementById("pocoComCap").value,

    perfil_construtivo: obterPerfilConstrutivo(),

    fotos: fotosBase64,

    ativo: true,
    sincronizado: false,
    criado_em: new Date().toISOString()
  };

  await salvarPocoLocal(poco);

  alert("PM cadastrado com sucesso.");

  localStorage.removeItem("projeto_selecionado");

  window.location.href = "dashboard.html";
}

carregarProjetosNoSelect();
