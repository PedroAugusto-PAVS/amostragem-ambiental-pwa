function n(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  return Number(String(valor).replace(",", "."));
}

function calcularColunaAgua(profundidadeTotal, nivelAgua) {
  const total = n(profundidadeTotal);
  const nivel = n(nivelAgua);

  if (total <= 0 || nivel <= 0) return 0;

  const coluna = total - nivel;
  return coluna > 0 ? Number(coluna.toFixed(2)) : 0;
}

function obterAreaPorDiametro(diametro) {
  const d = String(diametro).replace(",", ".");

  if (d === "5") return 2.03;
  if (d === "2.5") return 0.51;

  return 0;
}

function calcularVolumeEstagnado(colunaAgua, diametro) {
  const coluna = n(colunaAgua);
  const area = obterAreaPorDiametro(diametro);

  if (coluna <= 0 || area <= 0) return 0;

  return Number((area * coluna).toFixed(2));
}

function calcularVolumePurga(profundidadeBomba) {
  const bomba = n(profundidadeBomba);

  if (bomba <= 0) return 0;

  const areaBomba1Polegada = 0.51;

  return Number((bomba * areaBomba1Polegada).toFixed(2));
}

function calcularVolumeTotalEsgotado(volumeEstagnado) {
  const volume = n(volumeEstagnado);

  if (volume <= 0) return 0;

  return Number((volume * 3).toFixed(2));
}