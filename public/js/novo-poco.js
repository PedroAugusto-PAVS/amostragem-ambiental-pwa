const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
  window.location.href = "index.html";
}

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

  if (lat < 0) {
    utmN += 10000000.0;
  }

  return {
    zona: zone,
    utmE: Math.round(utmE),
    utmN: Math.round(utmN)
  };
}

function capturarGPS() {
  if (!navigator.geolocation) {
    alert("GPS não disponível.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const gps = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        precisao: position.coords.accuracy
      };

      const utm = latLonToUTM(gps.latitude, gps.longitude);

      document.getElementById("latitudeGps").value = gps.latitude;
      document.getElementById("longitudeGps").value = gps.longitude;
      document.getElementById("utmE").value = utm.utmE;
      document.getElementById("utmN").value = utm.utmN;

      alert("GPS e UTM preenchidos.");
    },
    () => {
      alert("Não foi possível capturar o GPS. Verifique a permissão de localização.");
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
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
  const select = document.getElementById("projetoSelect");

  select.innerHTML = `<option value="">Sem projeto</option>`;

  projetos.forEach((projeto) => {
    const option = document.createElement("option");
    option.value = projeto.local_id;
    option.textContent = projeto.nome;
    select.appendChild(option);
  });

  const projetoSelecionado = localStorage.getItem("projeto_selecionado");

  if (projetoSelecionado) {
    select.value = projetoSelecionado;
  }
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

    projeto_local_id: document.getElementById("projetoSelect").value,

    nome,
    tipo,

    local_propriedade: document.getElementById("localPropriedade").value,
    utm_e: document.getElementById("utmE").value,
    utm_n: document.getElementById("utmN").value,

    latitude: document.getElementById("latitudeGps").value,
    longitude: document.getElementById("longitudeGps").value,

    profundidade_total: Number(document.getElementById("profundidadeTotal").value),
    diametro: document.getElementById("diametro").value,

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