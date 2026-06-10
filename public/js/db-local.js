const DB_NAME = "amostragem_offline";
const DB_VERSION = 2;

let db;

function abrirBancoLocal() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject("Erro ao abrir IndexedDB");

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;

      if (!db.objectStoreNames.contains("pocos")) {
        db.createObjectStore("pocos", {
          keyPath: "local_id"
        });
      }

      if (!db.objectStoreNames.contains("medicoes")) {
        db.createObjectStore("medicoes", {
          keyPath: "local_id"
        });
      }
if (!db.objectStoreNames.contains("projetos")) {
  db.createObjectStore("projetos", {
    keyPath: "local_id"
  });
}
    };
  });
}

async function salvarPocoLocal(poco) {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["pocos"], "readwrite");
    const store = tx.objectStore("pocos");

    store.put(poco);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Erro ao salvar poço");
  });
}

async function listarPocosLocais() {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["pocos"], "readonly");
    const store = tx.objectStore("pocos");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Erro ao listar poços");
  });
}

async function salvarMedicaoLocal(medicao) {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["medicoes"], "readwrite");
    const store = tx.objectStore("medicoes");

    store.put(medicao);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Erro ao salvar medição");
  });
}

async function listarMedicoesLocais() {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["medicoes"], "readonly");
    const store = tx.objectStore("medicoes");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Erro ao listar medições");
  });
}

async function atualizarMedicaoLocal(medicao) {
  await abrirBancoLocal();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["medicoes"], "readwrite");
    const store = tx.objectStore("medicoes");

    store.put(medicao);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Erro ao atualizar medição");
  });
}