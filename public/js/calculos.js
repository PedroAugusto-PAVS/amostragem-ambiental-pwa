function calcularColunaAgua(profundidadeTotal, nivelAgua) {
  if (!profundidadeTotal || !nivelAgua) return 0;

  const coluna = profundidadeTotal - nivelAgua;

  if (coluna < 0) return 0;

  return Number(coluna.toFixed(2));
}

function obterAreaPorDiametro(diametro) {
  if (String(diametro) === "5") {
    return 2.03;
  }

  if (String(diametro) === "2.5") {
    return 0.51;
  }

  return 0;
}

function calcularVolumeEstagnado(colunaAgua, diametro) {
  const area = obterAreaPorDiametro(diametro);

  if (!colunaAgua || !area) return 0;

  const volume = area * colunaAgua;

  return Number(volume.toFixed(2));
}

function calcularVolumePurga(profundidadeBomba, diametroBomba = "1") {
  if (!profundidadeBomba) return 0;

  let fatorBomba = 0;

  if (String(diametroBomba) === "1") {
    fatorBomba = 0.51;
  }

  const volume = profundidadeBomba * fatorBomba;

  return Number(volume.toFixed(2));
}

function calcularVolumeTotalEsgotado(volumeEstagnado) {
  if (!volumeEstagnado) return 0;

  const total = volumeEstagnado * 3;

  return Number(total.toFixed(2));
}