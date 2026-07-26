const HYDROTRACK_BACKUP_FORMAT = "hydrotrack-indexeddb-backup";
const HYDROTRACK_BACKUP_VERSION = 1;
const HYDROTRACK_ULTIMO_BACKUP_KEY = "hydrotrack_ultimo_backup_local";

let backupLocalEmAndamento = false;

function elementoBackup(id) {
  return document.getElementById(id);
}

function statusBackup(mensagem) {
  const elemento = elementoBackup("statusBackupLocal");
  if (elemento) elemento.textContent = mensagem;
}

function bloquearBotoesBackup(bloquear) {
  ["btnExportarBackupLocal", "btnImportarBackupLocal"].forEach((id) => {
    const botao = elementoBackup(id);
    if (botao) botao.disabled = bloquear;
  });
}

function carimboArquivo(data = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(
    data.getDate()
  )}_${p(data.getHours())}-${p(data.getMinutes())}-${p(data.getSeconds())}`;
}

function bufferParaBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  const bloco = 0x8000;

  for (let i = 0; i < bytes.length; i += bloco) {
    binario += String.fromCharCode(...bytes.subarray(i, i + bloco));
  }

  return btoa(binario);
}

function base64ParaBuffer(base64) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }

  return bytes.buffer;
}

async function serializarBackup(valor) {
  if (
    valor === null ||
    valor === undefined ||
    typeof valor === "string" ||
    typeof valor === "number" ||
    typeof valor === "boolean"
  ) {
    return valor;
  }

  if (typeof valor === "bigint") {
    return { __hydrotrack_tipo: "BigInt", valor: valor.toString() };
  }

  if (valor instanceof Date) {
    return { __hydrotrack_tipo: "Date", valor: valor.toISOString() };
  }

  if (valor instanceof Blob) {
    return {
      __hydrotrack_tipo: valor instanceof File ? "File" : "Blob",
      mime: valor.type || "application/octet-stream",
      nome: valor instanceof File ? valor.name : null,
      ultima_modificacao: valor instanceof File ? valor.lastModified : null,
      dados: bufferParaBase64(await valor.arrayBuffer()),
    };
  }

  if (valor instanceof ArrayBuffer) {
    return {
      __hydrotrack_tipo: "ArrayBuffer",
      dados: bufferParaBase64(valor),
    };
  }

  if (ArrayBuffer.isView(valor)) {
    const buffer = valor.buffer.slice(
      valor.byteOffset,
      valor.byteOffset + valor.byteLength
    );

    return {
      __hydrotrack_tipo: "TypedArray",
      construtor: valor.constructor.name,
      dados: bufferParaBase64(buffer),
    };
  }

  if (Array.isArray(valor)) {
    return Promise.all(valor.map(serializarBackup));
  }

  const saida = {};
  for (const [chave, conteudo] of Object.entries(valor)) {
    saida[chave] = await serializarBackup(conteudo);
  }
  return saida;
}

async function desserializarBackup(valor) {
  if (valor === null || valor === undefined || typeof valor !== "object") {
    return valor;
  }

  if (valor.__hydrotrack_tipo === "BigInt") {
    return BigInt(valor.valor);
  }

  if (valor.__hydrotrack_tipo === "Date") {
    return new Date(valor.valor);
  }

  if (
    valor.__hydrotrack_tipo === "Blob" ||
    valor.__hydrotrack_tipo === "File"
  ) {
    const buffer = base64ParaBuffer(valor.dados || "");

    if (valor.__hydrotrack_tipo === "File" && typeof File !== "undefined") {
      return new File([buffer], valor.nome || "arquivo", {
        type: valor.mime || "application/octet-stream",
        lastModified: Number(valor.ultima_modificacao) || Date.now(),
      });
    }

    return new Blob([buffer], {
      type: valor.mime || "application/octet-stream",
    });
  }

  if (valor.__hydrotrack_tipo === "ArrayBuffer") {
    return base64ParaBuffer(valor.dados || "");
  }

  if (valor.__hydrotrack_tipo === "TypedArray") {
    const buffer = base64ParaBuffer(valor.dados || "");
    const construtor = globalThis[valor.construtor];

    if (
      typeof construtor === "function" &&
      typeof construtor.BYTES_PER_ELEMENT === "number"
    ) {
      return new construtor(buffer);
    }

    return new Uint8Array(buffer);
  }

  if (Array.isArray(valor)) {
    return Promise.all(valor.map(desserializarBackup));
  }

  const saida = {};
  for (const [chave, conteudo] of Object.entries(valor)) {
    saida[chave] = await desserializarBackup(conteudo);
  }
  return saida;
}

function lerStoreParaBackup(banco, nomeStore) {
  return new Promise((resolve, reject) => {
    const tx = banco.transaction([nomeStore], "readonly");
    const store = tx.objectStore(nomeStore);
    const reqValores = store.getAll();
    const reqChaves = store.getAllKeys();

    tx.oncomplete = async () => {
      try {
        const valores = reqValores.result || [];
        const chaves = reqChaves.result || [];
        const registros = [];

        for (let i = 0; i < valores.length; i += 1) {
          registros.push({
            chave: await serializarBackup(chaves[i]),
            valor: await serializarBackup(valores[i]),
          });
        }

        resolve({
          key_path: store.keyPath,
          auto_increment: store.autoIncrement,
          quantidade: registros.length,
          registros,
        });
      } catch (erro) {
        reject(erro);
      }
    };

    tx.onerror = () =>
      reject(tx.error || new Error(`Erro ao ler ${nomeStore}.`));
    tx.onabort = () =>
      reject(tx.error || new Error(`Leitura cancelada em ${nomeStore}.`));
  });
}

async function montarBackupLocal() {
  if (typeof abrirBancoLocal !== "function") {
    throw new Error("A função abrirBancoLocal() não foi encontrada.");
  }

  const banco = await abrirBancoLocal();
  const nomesStores = Array.from(banco.objectStoreNames);
  const stores = {};
  let total = 0;

  for (const nomeStore of nomesStores) {
    statusBackup(`Lendo dados locais: ${nomeStore}...`);
    stores[nomeStore] = await lerStoreParaBackup(banco, nomeStore);
    total += stores[nomeStore].quantidade;
  }

  return {
    formato: HYDROTRACK_BACKUP_FORMAT,
    versao_formato: HYDROTRACK_BACKUP_VERSION,
    aplicativo: "HydroTrack",
    criado_em: new Date().toISOString(),
    banco: {
      nome: typeof DB_NAME === "string" ? DB_NAME : banco.name,
      versao: banco.version,
      stores: nomesStores,
    },
    total_registros: total,
    stores,
  };
}

function baixarArquivo(conteudo, nomeArquivo) {
  const blob =
    conteudo instanceof Blob
      ? conteudo
      : new Blob([conteudo], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function compartilharOuBaixar(json, nomeArquivo, compartilhar = true) {
  const arquivo = new File([json], nomeArquivo, { type: "application/json" });

  if (
    compartilhar &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [arquivo] })
  ) {
    try {
      await navigator.share({
        title: "Backup local do HydroTrack",
        text: "Guarde este arquivo em um local seguro.",
        files: [arquivo],
      });
      return "compartilhado";
    } catch (erro) {
      if (erro?.name === "AbortError") return "cancelado";
      console.warn("Compartilhamento indisponível; usando download.", erro);
    }
  }

  baixarArquivo(arquivo, nomeArquivo);
  return "baixado";
}

async function exportarBackupLocal({
  motivo = "manual",
  compartilhar = true,
  registrar = true,
} = {}) {
  if (backupLocalEmAndamento) return null;

  backupLocalEmAndamento = true;
  bloquearBotoesBackup(true);

  try {
    statusBackup("Preparando backup do banco local...");
    const backup = await montarBackupLocal();
    const sufixo = motivo === "antes-restauracao" ? "-antes-restauracao" : "";
    const nomeArquivo = `hydrotrack-backup${sufixo}-${carimboArquivo()}.json`;
    const json = JSON.stringify(backup, null, 2);
    const resultado = await compartilharOuBaixar(
      json,
      nomeArquivo,
      compartilhar
    );

    if (resultado === "cancelado") {
      statusBackup("Compartilhamento cancelado. Nenhum dado foi alterado.");
      return { backup, nomeArquivo, resultado };
    }

    if (registrar) {
      localStorage.setItem(HYDROTRACK_ULTIMO_BACKUP_KEY, backup.criado_em);
    }

    statusBackup(
      `Backup criado: ${nomeArquivo} (${backup.total_registros} registros).`
    );
    return { backup, nomeArquivo, resultado };
  } catch (erro) {
    console.error("Erro ao exportar backup:", erro);
    statusBackup(`Erro ao exportar backup: ${erro.message || erro}`);
    alert(`Não foi possível exportar o backup.\n\n${erro.message || erro}`);
    throw erro;
  } finally {
    backupLocalEmAndamento = false;
    bloquearBotoesBackup(false);
  }
}

function validarBackup(backup) {
  if (!backup || typeof backup !== "object") {
    throw new Error("Arquivo de backup inválido.");
  }

  if (backup.formato !== HYDROTRACK_BACKUP_FORMAT) {
    throw new Error("Este não é um backup oficial do HydroTrack.");
  }

  if (backup.versao_formato !== HYDROTRACK_BACKUP_VERSION) {
    throw new Error(
      `Versão de backup não suportada: ${backup.versao_formato}.`
    );
  }

  if (!backup.stores || typeof backup.stores !== "object") {
    throw new Error("O backup não contém as stores do banco local.");
  }

  for (const [nomeStore, store] of Object.entries(backup.stores)) {
    if (!store || !Array.isArray(store.registros)) {
      throw new Error(`A store ${nomeStore} está inválida.`);
    }
  }
}

function resumoBackup(backup) {
  return Object.entries(backup.stores)
    .map(([nome, store]) => `• ${nome}: ${store.registros.length} registro(s)`)
    .join("\n");
}

function chaveComparavel(chave) {
  if (chave instanceof Date) return `date:${chave.toISOString()}`;
  if (Array.isArray(chave)) return `array:${JSON.stringify(chave)}`;
  return `${typeof chave}:${String(chave)}`;
}

function timestampRegistro(registro) {
  if (!registro || typeof registro !== "object") return 0;

  const datas = [
    registro.atualizado_em,
    registro.updated_at,
    registro.sincronizado_em,
    registro.criado_em,
    registro.created_at,
  ];

  for (const data of datas) {
    const timestamp = Date.parse(data);
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return 0;
}

function registroPendente(registro) {
  return (
    !!registro &&
    (registro.sincronizado === false || registro.excluido === true)
  );
}

function usarVersaoBackup(atual, backup) {
  const atualPendente = registroPendente(atual);
  const backupPendente = registroPendente(backup);

  if (backupPendente && !atualPendente) return true;
  if (atualPendente && !backupPendente) return false;
  return timestampRegistro(backup) > timestampRegistro(atual);
}

function lerStoreAtual(banco, nomeStore) {
  return new Promise((resolve, reject) => {
    const tx = banco.transaction([nomeStore], "readonly");
    const store = tx.objectStore(nomeStore);
    const reqValores = store.getAll();
    const reqChaves = store.getAllKeys();

    tx.oncomplete = () => {
      const mapa = new Map();
      const valores = reqValores.result || [];
      const chaves = reqChaves.result || [];

      for (let i = 0; i < valores.length; i += 1) {
        mapa.set(chaveComparavel(chaves[i]), {
          chave: chaves[i],
          valor: valores[i],
        });
      }

      resolve({ mapa, keyPath: store.keyPath });
    };

    tx.onerror = () =>
      reject(tx.error || new Error(`Erro ao ler ${nomeStore}.`));
    tx.onabort = () =>
      reject(tx.error || new Error(`Leitura cancelada em ${nomeStore}.`));
  });
}

function gravarStore(banco, nomeStore, registros, keyPath) {
  return new Promise((resolve, reject) => {
    if (registros.length === 0) {
      resolve();
      return;
    }

    const tx = banco.transaction([nomeStore], "readwrite");
    const store = tx.objectStore(nomeStore);

    registros.forEach(({ chave, valor }) => {
      if (keyPath === null) store.put(valor, chave);
      else store.put(valor);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error || new Error(`Erro ao restaurar ${nomeStore}.`));
    tx.onabort = () =>
      reject(tx.error || new Error(`Restauração cancelada em ${nomeStore}.`));
  });
}

async function restaurarMesclando(backup) {
  const banco = await abrirBancoLocal();
  const storesAtuais = new Set(Array.from(banco.objectStoreNames));
  const resultado = {
    adicionados: 0,
    atualizados: 0,
    preservados: 0,
    ignoradas: [],
  };

  for (const [nomeStore, snapshot] of Object.entries(backup.stores)) {
    statusBackup(`Restaurando: ${nomeStore}...`);

    if (!storesAtuais.has(nomeStore)) {
      resultado.ignoradas.push(nomeStore);
      continue;
    }

    const atual = await lerStoreAtual(banco, nomeStore);
    const paraGravar = [];

    for (const item of snapshot.registros) {
      const chave = await desserializarBackup(item.chave);
      const valor = await desserializarBackup(item.valor);
      const existente = atual.mapa.get(chaveComparavel(chave));

      if (!existente) {
        paraGravar.push({ chave, valor });
        resultado.adicionados += 1;
      } else if (usarVersaoBackup(existente.valor, valor)) {
        paraGravar.push({ chave, valor });
        resultado.atualizados += 1;
      } else {
        resultado.preservados += 1;
      }
    }

    await gravarStore(banco, nomeStore, paraGravar, atual.keyPath);
  }

  return resultado;
}

async function processarArquivoBackup(arquivo) {
  if (!arquivo || backupLocalEmAndamento) return;

  backupLocalEmAndamento = true;
  bloquearBotoesBackup(true);

  try {
    statusBackup("Validando arquivo de backup...");
    const backup = JSON.parse(await arquivo.text());
    validarBackup(backup);

    const confirmado = confirm(
      "Backup validado.\n\n" +
        `Criado em: ${new Date(backup.criado_em).toLocaleString("pt-BR")}\n` +
        resumoBackup(backup) +
        "\n\nA restauração será feita por mesclagem e preservará dados locais pendentes. Continuar?"
    );

    if (!confirmado) {
      statusBackup("Restauração cancelada. Nenhum dado foi alterado.");
      return;
    }

    backupLocalEmAndamento = false;
    const seguranca = await exportarBackupLocal({
      motivo: "antes-restauracao",
      compartilhar: false,
      registrar: false,
    });

    if (!seguranca) {
      throw new Error("Não foi possível criar o backup de segurança.");
    }

    backupLocalEmAndamento = true;
    bloquearBotoesBackup(true);
    const resultado = await restaurarMesclando(backup);

    const ignoradas = resultado.ignoradas.length
      ? `\nStores ignoradas: ${resultado.ignoradas.join(", ")}`
      : "";

    statusBackup("Restauração concluída com segurança.");
    alert(
      "Backup restaurado com sucesso!\n\n" +
        `Adicionados: ${resultado.adicionados}\n` +
        `Atualizados: ${resultado.atualizados}\n` +
        `Preservados: ${resultado.preservados}` +
        ignoradas +
        "\n\nO HydroTrack será recarregado."
    );

    window.location.reload();
  } catch (erro) {
    console.error("Erro ao restaurar backup:", erro);
    statusBackup(`Erro ao restaurar: ${erro.message || erro}`);
    alert(`Não foi possível restaurar o backup.\n\n${erro.message || erro}`);
  } finally {
    backupLocalEmAndamento = false;
    bloquearBotoesBackup(false);
    const input = elementoBackup("arquivoBackupLocal");
    if (input) input.value = "";
  }
}

function mostrarUltimoBackup() {
  const valor = localStorage.getItem(HYDROTRACK_ULTIMO_BACKUP_KEY);
  const data = valor ? new Date(valor) : null;

  if (data && !Number.isNaN(data.getTime())) {
    statusBackup(`Último backup exportado: ${data.toLocaleString("pt-BR")}.`);
  } else {
    statusBackup("Nenhum backup oficial foi exportado neste aparelho.");
  }
}

function inicializarBackupLocal() {
  const exportar = elementoBackup("btnExportarBackupLocal");
  const importar = elementoBackup("btnImportarBackupLocal");
  const input = elementoBackup("arquivoBackupLocal");

  if (exportar) exportar.addEventListener("click", () => exportarBackupLocal());
  if (importar && input)
    importar.addEventListener("click", () => input.click());
  if (input) {
    input.addEventListener("change", (evento) => {
      processarArquivoBackup(evento.target.files?.[0]);
    });
  }

  mostrarUltimoBackup();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarBackupLocal, {
    once: true,
  });
} else {
  inicializarBackupLocal();
}

window.exportarBackupLocal = exportarBackupLocal;
