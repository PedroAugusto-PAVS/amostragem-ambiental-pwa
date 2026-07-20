function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  return Number(String(valor).replace(",", "."));
}

function calcularColunaAgua(profundidadeTotal, nivelAgua) {
  const pt = numero(profundidadeTotal);
  const na = numero(nivelAgua);

  if (pt <= 0 || na < 0) return 0;

  return Number((pt - na).toFixed(2));
}

function calcularAreaDiametro(diametro) {
  const d = String(diametro || "")
    .trim()
    .toLowerCase()
    .replace(",", ".");

  if (!d) return 0;

  if (["5", "5.0", "5cm", "5 cm", "50mm", "50 mm"].includes(d)) return 2.03;
  if (
    ["2.5", "2.50", "2.5cm", "2.5 cm", "25mm", "25 mm"].includes(d)
  )
    return 0.51;

  return 0;
}

function calcularVolumeEstagnado(colunaAgua, diametro) {
  const coluna = numero(colunaAgua);
  const area = calcularAreaDiametro(diametro);

  if (coluna <= 0 || area <= 0) return 0;

  return Number((coluna * area).toFixed(2));
}

function calcularVolumePurga(profundidadeBomba) {
  const profundidade = numero(profundidadeBomba);

  if (profundidade <= 0) return 0;

  const volumeMl =
    profundidade * 14 +
    400 +
    150;

  return Number((volumeMl / 1000).toFixed(2));
}

function calcularVolumeTotalEsgotado(volumeEstagnado) {
  const volume = numero(volumeEstagnado);

  if (volume <= 0) return 0;

  return Number((volume * 3).toFixed(2));
}
