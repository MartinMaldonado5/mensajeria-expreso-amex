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
 * 1. Coincidencia directa de subcadena en texto normalizado (sin tildes)
 * 2. Coincidencia alfanumérica sin guiones ni espacios (ej: "wr10452" coincide con "WR-10452")
 * 3. Coincidencia numérica pura sin ceros iniciales (ej: "10452" o "452" coincide con "WR-0010452")
 * 4. Búsqueda multi-palabra (todos los términos ingresados deben coincidir en alguno de los campos)
 *
 * @param query Texto ingresado por el usuario en el buscador
 * @param fields Lista de campos o textos del registro a evaluar
 */
export function matchesFuzzySearch(
  query: string | null | undefined,
  fields: Array<string | number | null | undefined>
): boolean {
  if (!query || !query.trim()) return true;

  const rawQuery = query.trim();
  const normalizedQuery = normalizeText(rawQuery);
  const cleanQuery = cleanAlphanumeric(rawQuery);
  const queryDigits = extractDigits(rawQuery);
  const queryDigitsNoZero = stripLeadingZeros(rawQuery);

  // Dividir en términos separados por espacio para búsqueda multi-palabra (ej: "perez 10452")
  const queryTerms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

  // Normalizar todos los campos del registro
  const normalizedFields = fields.map(f => normalizeText(f)).filter(Boolean);
  const cleanFields = fields.map(f => cleanAlphanumeric(f)).filter(Boolean);
  const digitFields = fields.map(f => extractDigits(f)).filter(Boolean);
  const noZeroDigitFields = fields.map(f => stripLeadingZeros(f)).filter(Boolean);

  // Concatenación total del registro para búsquedas compuestas
  const fullRowText = normalizedFields.join(' ');
  const fullRowClean = cleanFields.join(' ');

  // 1. Verificar si CADA término de la búsqueda aparece en algún lugar del registro
  const allTermsMatch = queryTerms.every(term => {
    const termClean = cleanAlphanumeric(term);
    const termDigits = extractDigits(term);
    const termDigitsNoZero = stripLeadingZeros(term);

    // Coincidencia exacta de subcadena
    if (fullRowText.includes(term)) return true;

    // Coincidencia alfanumérica sin guiones (ej: "a1p1" -> "a1-p1", "wr10452" -> "wr-10452")
    if (termClean && fullRowClean.includes(termClean)) return true;

    // Coincidencia de números sin ceros iniciales (ej: "10452" -> "0010452")
    if (termDigitsNoZero && termDigitsNoZero.length >= 2) {
      if (
        digitFields.some(df => df.includes(termDigitsNoZero) || termDigits.includes(df)) ||
        noZeroDigitFields.some(nz => nz.includes(termDigitsNoZero) || termDigitsNoZero.includes(nz))
      ) {
        return true;
      }
    }

    return false;
  });

  if (allTermsMatch) return true;

  // 2. Coincidencia directa alfanumérica global
  if (cleanQuery && fullRowClean.includes(cleanQuery)) return true;

  // 3. Coincidencia directa por dígitos si la consulta tiene al menos 2 números
  if (queryDigitsNoZero && queryDigitsNoZero.length >= 2) {
    if (
      noZeroDigitFields.some(nz => nz.includes(queryDigitsNoZero)) ||
      digitFields.some(df => df.includes(queryDigits))
    ) {
      return true;
    }
  }

  return false;
}
