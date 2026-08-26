/**
 * AMEX Courier ERP - Motor de Búsqueda Inteligente, Fuzzy y Multicriterio
 * Permite coincidencias parciales, subcadenas numéricas sin prefijos (ej: "10452" -> "WR-0010452"),
 * búsqueda sin guiones ("wr10452" -> "WR-10452"), sin tildes ("perez" -> "Pérez"), y multi-términos.
 */

/**
 * Normaliza un texto eliminando tildes, caracteres especiales y convirtiendo a minúsculas
 */
export function normalizeText(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Extrae solo los dígitos y letras limpias (eliminando guiones, espacios, puntos, etc.)
 * Ej: "WR-0010452 / A1-P1" -> "wr0010452a1p1"
 */
export function cleanAlphanumeric(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return normalizeText(text).replace(/[^a-z0-9]/g, '');
}

/**
 * Extrae solo los dígitos numéricos
 * Ej: "WR-0010452" -> "0010452"
 */
export function extractDigits(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return text.toString().replace(/\D/g, '');
}

/**
 * Quita ceros iniciales de una secuencia numérica
 * Ej: "0010452" -> "10452"
 */
export function stripLeadingZeros(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const digits = extractDigits(text);
  return digits.replace(/^0+/, '') || digits;
}

/**
 * Evalúa si un registro coincide con la consulta de búsqueda usando múltiples estrategias inteligentes:
/**
 * Evalúa si un registro coincide con la consulta de búsqueda usando criterios inteligentes:
 * 1. Búsqueda multi-término: CADA término ingresado (separado por espacio) debe coincidir en el registro.
 * 2. Coincidencia directa de subcadena normalizada (ignora mayúsculas y tildes).
 * 3. Coincidencia alfanumérica sin guiones ni espacios (ej: "wr448379" o "a1p1").
 * 4. Coincidencia numérica: si el término es un número (ej: "448379" o "452"), algún campo numérico del
 *    registro debe CONTENER esa secuencia numérica (ej: "WR-000448379" contiene "448379").
 * 
 * Si un registro no coincide con todos los términos, se descarta (desaparece de la tabla).
 *
 * @param query Texto ingresado por el usuario en el buscador
 * @param fields Lista de campos del registro a evaluar
 */
export function matchesFuzzySearch(
  query: string | null | undefined,
  fields: Array<string | number | null | undefined>
): boolean {
  if (!query || !query.trim()) return true;

  const rawQuery = query.trim();
  const normalizedQuery = normalizeText(rawQuery);
  if (!normalizedQuery) return true;

  // Dividir la búsqueda en términos por espacio (ej: "wr 448379" o "perez 10452")
  const queryTerms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

  // Normalizar los campos del registro
  const normalizedFields = fields.map(f => normalizeText(f)).filter(Boolean);
  const cleanFields = fields.map(f => cleanAlphanumeric(f)).filter(Boolean);
  const digitFields = fields.map(f => extractDigits(f)).filter(Boolean);
  const noZeroDigitFields = fields.map(f => stripLeadingZeros(f)).filter(Boolean);

  const fullRowText = normalizedFields.join(' ');
  const fullRowClean = cleanFields.join(' ');

  // CADA término ingresado debe cumplirse en el registro
  return queryTerms.every(term => {
    const termClean = cleanAlphanumeric(term);
    const termDigits = extractDigits(term);
    const termDigitsNoZero = stripLeadingZeros(term);

    // 1. Coincidencia directa en el texto normalizado (ej: "448379" en "wr-448379")
    if (fullRowText.includes(term)) return true;

    // 2. Coincidencia alfanumérica limpia sin guiones (ej: "wr448379" en "wr448379")
    if (termClean && fullRowClean.includes(termClean)) return true;

    // 3. Coincidencia numérica: si el término tiene al menos 2 dígitos numéricos,
    // algún campo del registro debe CONTENER esos dígitos (ej: "000448379" contiene "448379")
    if (termDigitsNoZero && termDigitsNoZero.length >= 2) {
      const matchInDigits = digitFields.some(df => df.includes(termDigitsNoZero) || df.includes(termDigits));
      const matchInNoZero = noZeroDigitFields.some(nz => nz.includes(termDigitsNoZero));
      if (matchInDigits || matchInNoZero) return true;
    }

    return false;
  });
}
