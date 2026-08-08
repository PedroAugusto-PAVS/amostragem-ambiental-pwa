const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function obterCodigosDaMedicao(medicao) {
  if (
    Array.isArray(medicao.codigos_amostras) &&
    medicao.codigos_amostras.length
  ) {
    return medicao.codigos_amostras;
  }

  return medicao.codigo_frascaria
    ? [{ codigo: medicao.codigo_frascaria, tipo: "normal" }]
    : [];
}

function formatarTipoCodigoAmostra(tipo) {
  const rotulos = {
    normal: "Normal",
    duplicata: "Duplicata",
    branco: "Branco",
    branco_campo: "Branco de campo",
    branco_viagem: "Branco de viagem",
    controle: "Controle",
    outro: "Outro",
  };

  return rotulos[tipo] || rotulos.outro;
}

function obterCodigoPrincipal(codigos) {
  const principal = codigos.find((item) => item.tipo === "normal") || codigos[0];
  return principal?.codigo || "";
}

function formatarCodigosDaMedicao(medicao, separador = "; ") {
  return obterCodigosDaMedicao(medicao)
    .map(
      (item) =>
        `${item.codigo} — ${formatarTipoCodigoAmostra(item.tipo)}`
    )
    .join(separador);
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

class PdfFalso {
  static instancias = [];

  constructor() {
    this.paginasAdicionadas = 0;
    this.paginaAtual = 1;
    this.textos = [];
    this.textosComPagina = [];
    this.internal = {
      pageSize: {
        height: 297,
        getHeight() {
          return 297;
        },
      },
    };
    PdfFalso.instancias.push(this);
  }

  rect() {}
  line() {}
  setLineWidth() {}
  setFont() {}
  setFontSize() {}
  addImage() {}
  save() {}

  addPage() {
    this.paginasAdicionadas += 1;
    this.paginaAtual += 1;
  }

  text(valor) {
    const partes = Array.isArray(valor) ? valor : [valor];
    const textos = partes.map(String);
    this.textos.push(...textos);
    this.textosComPagina.push(
      ...textos.map((texto) => ({
        pagina: this.paginaAtual,
        texto,
      }))
    );
  }

  splitTextToSize(valor, largura) {
    const texto = String(valor);
    const tamanho = largura < 100 ? 30 : 80;
    const partes = [];

    for (let indice = 0; indice < texto.length; indice += tamanho) {
      partes.push(texto.slice(indice, indice + tamanho));
    }

    return partes.length ? partes : [""];
  }

  output() {
    return "data:application/pdf;base64,QQ==";
  }
}

class ImagemFalsa {
  set src(_valor) {
    this.onload();
  }
}

async function testarPdf(caminho, nomeFuncao, quantidadeCodigos = 35) {
  PdfFalso.instancias.length = 0;
  const codigos = Array.from({ length: quantidadeCodigos }, (_, indice) => ({
    codigo: `AMOSTRA-${String(indice + 1).padStart(2, "0")}`,
    tipo: indice === 1 ? "duplicata" : "normal",
  }));
  const medicao = {
    local_id: "medicao-1",
    poco_local_id: "poco-1",
    codigos_amostras: codigos,
    leituras: [],
    condicoes_ambientais: {},
  };
  const context = {
    console,
    Image: ImagemFalsa,
    alert() {},
    listarPocosLocais: async () => [
      { local_id: "poco-1", projeto_local_id: "projeto-1", nome: "PM-1" },
    ],
    listarMedicoesLocais: async () => [medicao],
    listarProjetosLocais: async () => [
      { local_id: "projeto-1", nome: "Projeto" },
    ],
    obterCodigosDaMedicao,
    obterCodigoPrincipal,
    formatarTipoCodigoAmostra,
    window: {
      jspdf: { jsPDF: PdfFalso },
    },
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(caminho, "utf8"), context);
  await context.window[nomeFuncao]("medicao-1");

  const pdf = PdfFalso.instancias.at(-1);
  const textoCompleto = pdf.textos.join("\n");
  const textoPrimeiraPagina = pdf.textosComPagina
    .filter((item) => item.pagina === 1)
    .map((item) => item.texto)
    .join("\n");

  if (quantidadeCodigos <= 8) {
    assert.equal(
      pdf.paginasAdicionadas,
      0,
      `${caminho} deve manter até oito códigos na primeira página.`,
    );
  } else {
    assert.ok(
      pdf.paginasAdicionadas > 0,
      `${caminho} deve paginar somente os códigos excedentes.`,
    );
  }
  assert.match(textoPrimeiraPagina, /AMOSTRA-01/);
  assert.match(
    textoPrimeiraPagina,
    /AMOSTRA-02/,
    `${caminho} deve exibir a duplicata no campo Código ALS.`,
  );
  assert.match(
    textoPrimeiraPagina,
    /PM-1 e DUPL/,
    `${caminho} deve indicar a duplicata na identificação do PM.`,
  );
  assert.match(textoCompleto, /Códigos das amostras/);
  assert.match(textoCompleto, /AMOSTRA-01/);
  if (quantidadeCodigos > 8) {
    assert.match(textoCompleto, /AMOSTRA-35/);
  }
  assert.match(textoCompleto, /Duplicata/);
}

async function testarFichaImpressao() {
  const caminho = "public/js/ficha-impressao.js";
  const source = fs
    .readFileSync(caminho, "utf8")
    .replace(/\s*carregarFichaImpressao\(\);\s*$/, "");
  const medicao = {
    local_id: "medicao-1",
    poco_local_id: "poco-1",
    codigos_amostras: [
      { codigo: "<script>alert(1)</script>", tipo: "normal" },
      { codigo: "AMOSTRA-DUP", tipo: "duplicata" },
    ],
    leituras: [],
  };
  const fichaContainer = { innerHTML: "" };
  const context = {
    console,
    alert() {},
    history: { back() {} },
    localStorage: {
      getItem(chave) {
        return chave === "medicao_imprimir" ? "medicao-1" : null;
      },
    },
    document: {
      getElementById() {
        return fichaContainer;
      },
    },
    listarPocosLocais: async () => [
      { local_id: "poco-1", projeto_local_id: "projeto-1", nome: "PM-1" },
    ],
    listarMedicoesLocais: async () => [medicao],
    listarProjetosLocais: async () => [
      { local_id: "projeto-1", nome: "Projeto" },
    ],
    obterCodigosDaMedicao,
    formatarTipoCodigoAmostra,
    escaparHtml,
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  await context.carregarFichaImpressao();

  assert.match(fichaContainer.innerHTML, /<ul[\s\S]*codigos-amostras/);
  assert.match(fichaContainer.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(fichaContainer.innerHTML, /<script>alert\(1\)<\/script>/);
  assert.match(fichaContainer.innerHTML, /AMOSTRA-DUP/);
  assert.match(fichaContainer.innerHTML, /Duplicata/);
}

async function executar() {
  await testarPdf("public/js/pdf.js", "imprimirFichaMedicao");
  await testarPdf("public/js/pdf.js", "imprimirFichaMedicao", 2);
  await testarPdf(
    "public/js/pdf-fiscal.js",
    "imprimirFichaMedicaoFiscal"
  );
  await testarPdf(
    "public/js/pdf-fiscal.js",
    "imprimirFichaMedicaoFiscal",
    2
  );
  await testarFichaImpressao();
  console.log("relatorios-codigos.test.js: ok");
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
