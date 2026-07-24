(function () {
  const TIPOS_CODIGO_AMOSTRA = [
    { valor: "normal", rotulo: "Normal" },
    { valor: "duplicata", rotulo: "Duplicata" },
    { valor: "branco", rotulo: "Branco" },
    { valor: "branco_campo", rotulo: "Branco de campo" },
    { valor: "branco_viagem", rotulo: "Branco de viagem" },
    { valor: "controle", rotulo: "Controle" },
    { valor: "outro", rotulo: "Outro" },
  ];

  let proximoIdCampo = 0;

  function obterLista() {
    return document.getElementById("listaCodigosAmostras");
  }

  function tipoValido(tipo) {
    return TIPOS_CODIGO_AMOSTRA.some((item) => item.valor === tipo);
  }

  function limparMarcacoesInvalidas() {
    const lista = obterLista();
    if (!lista) return;

    lista
      .querySelectorAll('.codigo-amostra-valor[aria-invalid="true"]')
      .forEach((input) => input.removeAttribute("aria-invalid"));
  }

  function atualizarRotulosRemocao() {
    const lista = obterLista();
    if (!lista) return;

    lista.querySelectorAll(".codigo-amostra-item").forEach((item, indice) => {
      const botao = item.querySelector(".codigo-amostra-remover");
      if (botao) {
        botao.setAttribute("aria-label", `Remover código ${indice + 1}`);
      }
    });
  }

  function removerItem(item) {
    const lista = obterLista();
    if (!lista) return;

    if (lista.querySelectorAll(".codigo-amostra-item").length <= 1) {
      alert("A medição precisa ter pelo menos um código de amostra.");
      return;
    }

    item.remove();
    atualizarRotulosRemocao();
  }

  function criarItem(codigo = {}, deveFocar = false) {
    const lista = obterLista();
    if (!lista) return null;

    proximoIdCampo += 1;
    const sufixo = proximoIdCampo;
    const item = document.createElement("div");
    const grupoCodigo = document.createElement("div");
    const grupoTipo = document.createElement("div");
    const labelCodigo = document.createElement("label");
    const inputCodigo = document.createElement("input");
    const labelTipo = document.createElement("label");
    const selectTipo = document.createElement("select");
    const botaoRemover = document.createElement("button");

    item.className = "codigo-amostra-item";
    item._identificadoresCodigoAmostra = {};

    if (codigo.id !== undefined && codigo.id !== null) {
      item._identificadoresCodigoAmostra.id = codigo.id;
    }

    if (codigo.local_id !== undefined && codigo.local_id !== null) {
      item._identificadoresCodigoAmostra.local_id = codigo.local_id;
    }

    if (codigo.criado_em || codigo.created_at) {
      item._identificadoresCodigoAmostra.criado_em =
        codigo.criado_em || codigo.created_at;
    }

    grupoCodigo.className = "codigo-amostra-campo";
    grupoTipo.className = "codigo-amostra-campo";

    labelCodigo.htmlFor = `codigoAmostra-${sufixo}`;
    labelCodigo.textContent = "Código da amostra";

    inputCodigo.id = `codigoAmostra-${sufixo}`;
    inputCodigo.className = "codigo-amostra-valor";
    inputCodigo.type = "text";
    inputCodigo.placeholder = "Ex.: PM-01-001";
    inputCodigo.autocomplete = "off";
    inputCodigo.maxLength = 200;
    inputCodigo.spellcheck = false;
    inputCodigo.required = true;
    inputCodigo.value = codigo.codigo == null ? "" : String(codigo.codigo);
    inputCodigo.addEventListener("input", limparMarcacoesInvalidas);

    labelTipo.htmlFor = `tipoCodigoAmostra-${sufixo}`;
    labelTipo.textContent = "Tipo";

    selectTipo.id = `tipoCodigoAmostra-${sufixo}`;
    selectTipo.className = "codigo-amostra-tipo";
    selectTipo.setAttribute("aria-label", "Tipo da amostra");

    TIPOS_CODIGO_AMOSTRA.forEach(({ valor, rotulo }) => {
      const option = document.createElement("option");
      option.value = valor;
      option.textContent = rotulo;
      selectTipo.appendChild(option);
    });

    selectTipo.value = tipoValido(codigo.tipo) ? codigo.tipo : "normal";

    botaoRemover.type = "button";
    botaoRemover.className = "btn-danger codigo-amostra-remover";
    botaoRemover.textContent = "Remover";
    botaoRemover.addEventListener("click", () => removerItem(item));

    grupoCodigo.append(labelCodigo, inputCodigo);
    grupoTipo.append(labelTipo, selectTipo);
    item.append(grupoCodigo, grupoTipo, botaoRemover);
    lista.appendChild(item);

    atualizarRotulosRemocao();

    if (deveFocar) {
      inputCodigo.focus();
    }

    return item;
  }

  function adicionarCodigoAmostra() {
    criarItem({ codigo: "", tipo: "normal" }, true);
  }

  function inicializarFormularioCodigosAmostras(codigos = []) {
    const lista = obterLista();
    const botaoAdicionar = document.getElementById("adicionarCodigoAmostra");

    if (!lista || !botaoAdicionar) return;

    lista.replaceChildren();

    const codigosIniciais =
      Array.isArray(codigos) && codigos.length
        ? codigos
        : [{ codigo: "", tipo: "normal" }];

    codigosIniciais.forEach((codigo) => criarItem(codigo));

    if (!botaoAdicionar.dataset.codigosAmostrasConfigurado) {
      botaoAdicionar.addEventListener("click", adicionarCodigoAmostra);
      botaoAdicionar.dataset.codigosAmostrasConfigurado = "true";
    }
  }

  function obterCodigosFormularioAmostras() {
    const lista = obterLista();
    if (!lista) return [];

    return Array.from(lista.querySelectorAll(".codigo-amostra-item")).map(
      (item) => {
        const input = item.querySelector(".codigo-amostra-valor");
        const select = item.querySelector(".codigo-amostra-tipo");

        return {
          ...(item._identificadoresCodigoAmostra || {}),
          codigo: input?.value.trim() || "",
          tipo: select?.value || "normal",
        };
      },
    );
  }

  function focarPrimeiroCodigoAmostraInvalido() {
    const lista = obterLista();
    if (!lista) return;

    const inputs = Array.from(
      lista.querySelectorAll(".codigo-amostra-valor"),
    );
    const codigosVistos = new Map();
    let primeiroInvalido = null;

    inputs.forEach((input) => {
      input.removeAttribute("aria-invalid");
      const codigo = input.value.trim();
      const chave = codigo.toLocaleLowerCase("pt-BR");

      if (!codigo) {
        input.setAttribute("aria-invalid", "true");
        primeiroInvalido ||= input;
        return;
      }

      if (codigosVistos.has(chave)) {
        input.setAttribute("aria-invalid", "true");
        codigosVistos.get(chave).setAttribute("aria-invalid", "true");
        primeiroInvalido ||= input;
        return;
      }

      codigosVistos.set(chave, input);
    });

    (primeiroInvalido || inputs[0])?.focus();
  }

  window.inicializarFormularioCodigosAmostras =
    inicializarFormularioCodigosAmostras;
  window.obterCodigosFormularioAmostras =
    obterCodigosFormularioAmostras;
  window.focarPrimeiroCodigoAmostraInvalido =
    focarPrimeiroCodigoAmostraInvalido;
})();
