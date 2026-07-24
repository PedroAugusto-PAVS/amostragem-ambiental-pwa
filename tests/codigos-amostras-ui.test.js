const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class ElementoFalso {
  constructor(tagName, documento) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = documento;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.className = "";
    this.value = "";
    this.textContent = "";
  }

  append(...filhos) {
    filhos.forEach((filho) => this.appendChild(filho));
  }

  appendChild(filho) {
    if (filho.parentNode) {
      filho.remove();
    }
    filho.parentNode = this;
    this.children.push(filho);
    return filho;
  }

  replaceChildren(...filhos) {
    this.children.forEach((filho) => {
      filho.parentNode = null;
    });
    this.children = [];
    this.append(...filhos);
  }

  remove() {
    if (!this.parentNode) return;
    const indice = this.parentNode.children.indexOf(this);
    if (indice >= 0) {
      this.parentNode.children.splice(indice, 1);
    }
    this.parentNode = null;
  }

  setAttribute(nome, valor) {
    this.attributes[nome] = String(valor);
  }

  getAttribute(nome) {
    return Object.hasOwn(this.attributes, nome)
      ? this.attributes[nome]
      : null;
  }

  removeAttribute(nome) {
    delete this.attributes[nome];
  }

  addEventListener(tipo, listener) {
    this.listeners[tipo] ||= [];
    this.listeners[tipo].push(listener);
  }

  disparar(tipo) {
    for (const listener of this.listeners[tipo] || []) {
      listener({ type: tipo, target: this });
    }
  }

  click() {
    this.disparar("click");
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  corresponde(seletor) {
    const partes = seletor.match(
      /^\.([a-zA-Z0-9_-]+)(?:\[([^=\]]+)="([^"]*)"\])?$/,
    );
    if (!partes) return false;

    const classes = this.className.split(/\s+/).filter(Boolean);
    if (!classes.includes(partes[1])) return false;
    if (!partes[2]) return true;

    return this.getAttribute(partes[2]) === partes[3];
  }

  querySelectorAll(seletor) {
    const encontrados = [];

    function visitar(elemento) {
      for (const filho of elemento.children) {
        if (filho.corresponde(seletor)) {
          encontrados.push(filho);
        }
        visitar(filho);
      }
    }

    visitar(this);
    return encontrados;
  }

  querySelector(seletor) {
    return this.querySelectorAll(seletor)[0] || null;
  }
}

class DocumentoFalso {
  constructor() {
    this.activeElement = null;
    this.elementosPorId = new Map();
  }

  createElement(tagName) {
    return new ElementoFalso(tagName, this);
  }

  getElementById(id) {
    return this.elementosPorId.get(id) || null;
  }

  registrar(id, elemento) {
    elemento.id = id;
    this.elementosPorId.set(id, elemento);
    return elemento;
  }
}

const documento = new DocumentoFalso();
const lista = documento.registrar(
  "listaCodigosAmostras",
  documento.createElement("div"),
);
const botaoAdicionar = documento.registrar(
  "adicionarCodigoAmostra",
  documento.createElement("button"),
);
const alertas = [];
const janela = {};
const contexto = {
  console,
  document: documento,
  window: janela,
  alert(mensagem) {
    alertas.push(mensagem);
  },
};

vm.createContext(contexto);
vm.runInContext(
  fs.readFileSync("public/js/codigos-amostras-form.js", "utf8"),
  contexto,
);

const {
  inicializarFormularioCodigosAmostras,
  obterCodigosFormularioAmostras,
  focarPrimeiroCodigoAmostraInvalido,
} = janela;

function obterItens() {
  return lista.querySelectorAll(".codigo-amostra-item");
}

function obterInputs() {
  return lista.querySelectorAll(".codigo-amostra-valor");
}

function obterTipos() {
  return lista.querySelectorAll(".codigo-amostra-tipo");
}

inicializarFormularioCodigosAmostras();
assert.equal(obterItens().length, 1, "O formulário deve iniciar com uma linha.");
assert.equal(obterTipos()[0].value, "normal", "A primeira linha deve ser Normal.");

obterItens()[0].querySelector(".codigo-amostra-remover").click();
assert.equal(obterItens().length, 1, "Não pode remover a última linha.");
assert.equal(alertas.length, 1);
assert.match(alertas[0], /pelo menos um código/i);

botaoAdicionar.click();
botaoAdicionar.click();
botaoAdicionar.click();
assert.equal(obterItens().length, 4, "Deve permitir três ou mais códigos.");
assert.equal(
  documento.activeElement,
  obterInputs()[3],
  "O código recém-adicionado deve receber foco.",
);

["AM-01", "AM-01-D", "BC-01", "CTRL-01"].forEach((codigo, indice) => {
  obterInputs()[indice].value = codigo;
});
["normal", "duplicata", "branco_campo", "controle"].forEach(
  (tipo, indice) => {
    obterTipos()[indice].value = tipo;
  },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(obterCodigosFormularioAmostras())),
  [
    { codigo: "AM-01", tipo: "normal" },
    { codigo: "AM-01-D", tipo: "duplicata" },
    { codigo: "BC-01", tipo: "branco_campo" },
    { codigo: "CTRL-01", tipo: "controle" },
  ],
);

obterItens()[1].querySelector(".codigo-amostra-remover").click();
assert.equal(obterItens().length, 3);
assert.equal(
  obterItens()[1]
    .querySelector(".codigo-amostra-remover")
    .getAttribute("aria-label"),
  "Remover código 2",
);

inicializarFormularioCodigosAmostras([
  {
    local_id: "11111111-1111-4111-8111-111111111111",
    codigo: "PRESERVADO",
    tipo: "normal",
    criado_em: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "id-remoto",
    codigo: "DUPLICATA",
    tipo: "duplicata",
  },
]);
assert.equal(obterItens().length, 2);
assert.deepEqual(
  JSON.parse(JSON.stringify(obterCodigosFormularioAmostras())),
  [
    {
      local_id: "11111111-1111-4111-8111-111111111111",
      codigo: "PRESERVADO",
      tipo: "normal",
      criado_em: "2026-07-01T00:00:00.000Z",
    },
    { id: "id-remoto", codigo: "DUPLICATA", tipo: "duplicata" },
  ],
  "A edição deve preservar os identificadores dos códigos.",
);

inicializarFormularioCodigosAmostras([
  { codigo: " repetido ", tipo: "normal" },
  { codigo: "REPETIDO", tipo: "duplicata" },
]);
focarPrimeiroCodigoAmostraInvalido();
assert.equal(obterInputs()[0].getAttribute("aria-invalid"), "true");
assert.equal(obterInputs()[1].getAttribute("aria-invalid"), "true");
assert.equal(documento.activeElement, obterInputs()[1]);

obterInputs()[1].value = "OUTRO";
obterInputs()[1].disparar("input");
assert.equal(obterInputs()[0].getAttribute("aria-invalid"), null);
assert.equal(obterInputs()[1].getAttribute("aria-invalid"), null);

inicializarFormularioCodigosAmostras([
  { codigo: "", tipo: "normal" },
  { codigo: "OK", tipo: "duplicata" },
]);
focarPrimeiroCodigoAmostraInvalido();
assert.equal(obterInputs()[0].getAttribute("aria-invalid"), "true");
assert.equal(documento.activeElement, obterInputs()[0]);

inicializarFormularioCodigosAmostras();
const antesDeAdicionar = obterItens().length;
botaoAdicionar.click();
assert.equal(
  obterItens().length,
  antesDeAdicionar + 1,
  "Reinicializar não pode duplicar o listener do botão Adicionar.",
);
assert.equal(botaoAdicionar.listeners.click.length, 1);

console.log("codigos-amostras-ui.test.js: ok");
