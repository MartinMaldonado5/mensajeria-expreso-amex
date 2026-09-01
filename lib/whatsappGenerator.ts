/**
 * Generador de enlaces y mensajes de WhatsApp para choferes de reparto AMEX Courier.
 */

export function sanitizePeruvianPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Remover espacios, guiones, paréntesis y símbolos
  let clean = phone.replace(/[^\d+]/g, '');

  if (clean.startsWith('+')) {
    clean = clean.substring(1);
  }

  // Si son 9 dígitos y empieza con 9 (número celular peruano), anteponer 51
  if (/^9\d{8}$/.test(clean)) {
    clean = `51${clean}`;
  }

  return clean;
}

export interface WhatsAppMessageParams {
  clienteNombre: string;
  telefono: string;
  direccion: string;
  distrito?: string;
  codigosWrs: string[];
  cantidadPaquetes: number;
  choferNombre?: string;
  montoCobrar?: number;
  monedaCobro?: 'PEN' | 'USD';
}

export function generateDriverWhatsAppUrl({
  clienteNombre,
  telefono,
  direccion,
  distrito,
  codigosWrs,
  cantidadPaquetes,
  choferNombre = 'Chofer AMEX Courier',
  montoCobrar,
  monedaCobro = 'PEN'
}: WhatsAppMessageParams): string {
  const sanitizedPhone = sanitizePeruvianPhoneNumber(telefono);
  if (!sanitizedPhone) return '';

  const wrsText = codigosWrs.length > 0 ? codigosWrs.join(', ') : 'tus paquetes';
  const fullAddress = distrito ? `${direccion} (${distrito})` : direccion;
  const countText = cantidadPaquetes === 1 ? '1 paquete' : `${cantidadPaquetes} paquetes`;

  let message = `Hola *${clienteNombre.trim()}*, te saluda *${choferNombre.trim()}* de *AMEX Courier* 🚚.\n\n`;
  message += `Estoy en camino para entregarte *${countText}* (Recibos: *${wrsText}*) en tu dirección:\n📍 *${fullAddress}*.\n\n`;

  if (montoCobrar && montoCobrar > 0) {
    const symbol = monedaCobro === 'USD' ? '$' : 'S/';
    message += `💰 *Monto a cancelar en entrega:* ${symbol} ${montoCobrar.toFixed(2)}\n\n`;
  }

  message += `¿Te encuentras en el domicilio o hay alguien disponible para recepcionar? Quedo atento, ¡gracias!`;

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${sanitizedPhone}?text=${encodedMessage}`;
}

export function generateMapsUrl(address: string, district?: string): string {
  const query = district ? `${address}, ${district}, Lima, Peru` : `${address}, Lima, Peru`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
