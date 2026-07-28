const usuario =
JSON.parse(
localStorage.getItem(
"usuario"
)
);

if (!usuario) {
  window.location.href =
  "index.html";
}

const pocoLocalId =
localStorage.getItem(
"poco_selecionado"
);

if (!pocoLocalId) {
  window.location.href =
  "dashboard.html";
}

async function carregarFotos() {

  const pocos =
  await listarPocosLocais();

  const medicoes =
  await listarMedicoesLocais();

  const poco =
  pocos.find(
    p =>
    p.local_id ===
    pocoLocalId
  );

  if (!poco) {

    alert(
      "PM não encontrado."
    );

    window.location.href =
    "dashboard.html";

    return;
  }

  document.getElementById(
    "subtituloFotos"
  ).innerText =
  poco.nome;

  const fotosPocoContainer =
  document.getElementById(
    "fotosPocoContainer"
  );

  const fotosMedicoesContainer =
  document.getElementById(
    "fotosMedicoesContainer"
  );

  fotosPocoContainer.innerHTML =
  "";

  fotosMedicoesContainer.innerHTML =
  "";

  const fotosPoco =
  poco.fotos || [];

  fotosPoco.forEach(
    (foto, index) => {

      fotosPocoContainer.innerHTML +=
      `
      <div class="card">

        <strong>
        Foto ${index + 1}
        </strong>

        <img
        src="${foto.base64}"
        class="media-photo"
        alt="Foto ${index + 1} do PM">

      </div>
      `;
    }
  );

  const medicoesDoPoco =
  medicoes.filter(
    m =>
    m.poco_local_id ===
    poco.local_id
  );

  medicoesDoPoco.forEach(
    medicao => {

      const fotos =
      medicao.fotos || [];

      fotos.forEach(
        (foto,index) => {

          fotosMedicoesContainer.innerHTML +=
          `
          <div class="card">

            <strong>
            ${medicao.mes_referencia}
            - Foto ${index + 1}
            </strong>

            <img
            src="${foto.base64}"
            class="media-photo"
            alt="Foto ${index + 1} da medição ${medicao.mes_referencia || ""}">

          </div>
          `;
        }
      );
    }
  );
}

carregarFotos();
