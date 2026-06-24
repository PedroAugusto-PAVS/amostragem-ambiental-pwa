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

      alert("GPS atualizado com sucesso.");
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
    alert("Este PM ainda não possui latitude e longitude.");
    return;
  }

  window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
}

async function carregarProjetosNoSelect() {
  const projetos = await listarProjetosLocais();
  const select = document.getElementById("projetoSelect");

  select.innerHTML = `<option value="">Sem projeto</option>`;

  projetos.forEach((projeto) => {
    const option = document.createElement("option");
    option.value = projeto.local_id;
    option.textContent = projeto.nome;
    select.appendChild(option);
  });
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
    observacoes_construtivas: document.getElementById("observacoesConstrutivas").value
  };
}

function preencherPerfilConstrutivo(perfil) {
  document.getElementById("bocaTubo").value = perfil.boca_tubo || "";
  document.getElementById("cotaTerreno").value = perfil.cota_terreno || "";
  document.getElementById("cotaTubo").value = perfil.cota_tubo || "";
  document.getElementById("nivelEstatico").value = perfil.nivel_estatico || "";

  document.getElementById("zonaFiltranteInicio").value =
    perfil.zona_filtrante_inicio || "";

  document.getElementById("zonaFiltranteFim").value =
    perfil.zona_filtrante_fim || "";

  document.getElementById("secaoFiltrante").value = perfil.secao_filtrante || "";
  document.getElementById("preFiltro").value = perfil.pre_filtro || "";
  document.getElementById("revestimento").value = perfil.revestimento || "";
  document.getElementById("tipoTampa").value = perfil.tipo_tampa || "";
  document.getElementById("condicaoPoco").value = perfil.condicao_poco || "";

  document.getElementById("observacoesConstrutivas").value =
    perfil.observacoes_construtivas || "";
}

async function carregarPoco() {
  const pocos = await listarPocosLocais();

  pocoAtual = pocos.find((p) => p.local_id === pocoLocalId);

  if (!pocoAtual) {
    alert("PM não encontrado.");
    window.location.href = "dashboard.html";
    return;
  }

  await carregarProjetosNoSelect();

  gpsAtual = pocoAtual.gps || {
    latitude: pocoAtual.latitude,
    longitude: pocoAtual.longitude,
    precisao: pocoAtual.precisao_gps,
    altitude: pocoAtual.altitude_gps,
    zona_utm: pocoAtual.zona_utm,
    hemisferio_utm: pocoAtual.hemisferio_utm,
    utm_e: pocoAtual.utm_e,
    utm_n: pocoAtual.utm_n,
    capturado_em: pocoAtual.gps_capturado_em
  };

  document.getElementById("projetoSelect").value = pocoAtual.projeto_local_id || "";
  document.getElementById("nomePoco").value = pocoAtual.nome || "";
  document.getElementById("tipoPoco").value = pocoAtual.tipo || "";
  document.getElementById("localPropriedade").value = pocoAtual.local_propriedade || "";

  document.getElementById("utmE").value = pocoAtual.utm_e || "";
  document.getElementById("utmN").value = pocoAtual.utm_n || "";
  document.getElementById("zonaUtm").value = pocoAtual.zona_utm || "";
  document.getElementById("hemisferioUtm").value = pocoAtual.hemisferio_utm || "";

  document.getElementById("latitudeGps").value = pocoAtual.latitude || "";
  document.getElementById("longitudeGps").value = pocoAtual.longitude || "";

  document.getElementById("precisaoGps").value = pocoAtual.precisao_gps
    ? `${Number(pocoAtual.precisao_gps).toFixed(2)} m`
    : "";

  document.getElementById("altitudeGps").value = pocoAtual.altitude_gps
    ? `${Number(pocoAtual.altitude_gps).toFixed(2)} m`
    : "Não disponível";

  document.getElementById("dataHoraGps").value = pocoAtual.gps_capturado_em
    ? new Date(pocoAtual.gps_capturado_em).toLocaleString("pt-BR")
    : "";

  document.getElementById("profundidadeTotal").value = pocoAtual.profundidade_total || "";
  document.getElementById("diametro").value = pocoAtual.diametro || "";

document.getElementById("pocoComCap").value = pocoAtual.poco_com_cap || "";
  preencherPerfilConstrutivo(pocoAtual.perfil_construtivo || {});
}

async function salvarEdicaoPoco() {
  const nome = document.getElementById("nomePoco").value.trim();
  const tipo = document.getElementById("tipoPoco").value;

  if (!nome || !tipo) {
    alert("Preencha o nome e o tipo do PM.");
    return;
  }

  pocoAtual.projeto_local_id = document.getElementById("projetoSelect").value;

  pocoAtual.nome = nome;
  pocoAtual.tipo = tipo;
  pocoAtual.local_propriedade = document.getElementById("localPropriedade").value;

  pocoAtual.utm_e = document.getElementById("utmE").value;
  pocoAtual.utm_n = document.getElementById("utmN").value;
  pocoAtual.zona_utm = document.getElementById("zonaUtm").value;
  pocoAtual.hemisferio_utm = document.getElementById("hemisferioUtm").value;

  pocoAtual.latitude = document.getElementById("latitudeGps").value;
  pocoAtual.longitude = document.getElementById("longitudeGps").value;

  pocoAtual.precisao_gps = gpsAtual ? gpsAtual.precisao : pocoAtual.precisao_gps;
  pocoAtual.altitude_gps = gpsAtual ? gpsAtual.altitude : pocoAtual.altitude_gps;
  pocoAtual.gps_capturado_em = gpsAtual ? gpsAtual.capturado_em : pocoAtual.gps_capturado_em;
  pocoAtual.gps = gpsAtual;

  pocoAtual.profundidade_total = Number(document.getElementById("profundidadeTotal").value);
  pocoAtual.diametro = document.getElementById("diametro").value;

 pocoAtual.poco_com_cap = document.getElementById("pocoComCap").value;

  pocoAtual.perfil_construtivo = obterPerfilConstrutivo();

  pocoAtual.sincronizado = false;
  pocoAtual.atualizado_em = new Date().toISOString();

  await atualizarPocoLocal(pocoAtual);

  alert("PM atualizado com sucesso.");

  localStorage.setItem("poco_selecionado", pocoAtual.local_id);
  window.location.href = "historico-poco.html";
}

carregarPoco();