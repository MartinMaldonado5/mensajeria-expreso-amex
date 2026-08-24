// Definiciones de tipos en español para AMEX Courier ERP

export type TipoUbicacion = 'TibCourierMiami' | 'TibCourierTingoMaria' | 'TibTingoMaria' | 'AmexLince' | 'Entregado';
export type TipoMetodoEntrega = 'RecojoLince' | 'CarroAmexDomicilio' | 'AgenciaProvincia';
export type TipoEstadoEntrega = 'EnAlmacen' | 'EnRutaCarroAmex' | 'EntregadoDomicilio' | 'RecogidoAlmacen' | 'Entregado';
export type TipoMonedaPago = 'PEN' | 'USD';

export interface Cliente {
  id: string;
  codigoCasillero: string;            // Ej: AMEX-PER-1001
  nombre: string;
  documentoIdentidad: string;        // DNI / RUC
  telefono?: string;
  email?: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccionEntrega?: string;
  transportistaPreferido?: string;
  agenciaDestino?: string;
  dniFrontalUrl?: string;
  dniReversoUrl?: string;
  creadoEn: string;
}

export interface Paquete {
  id: string;
  clienteId?: string;
  embarqueId?: string;
  codigoCasillero: string;
  numeroReciboBodega: string;        // Ej: WR-000451
  trackingUsa: string;
  tipoEmpaque: string;               // CAJA, SOBRE, SACA
  numeroFactura?: string;
  dniConsignatario?: string;
  nombreConsignatario?: string;
  descripcion: string;
  pesoKg: number;
  valorDeclaradoUsd: number;
  ubicacionActual: TipoUbicacion;
  anaquel?: 'A1' | 'A2' | 'RECEPCION' | 'DESPACHO' | string;
  piso?: 'P1' | 'P2' | 'P3' | string;
  posicionEstante?: string;          // Ej: A1-P1, A1-P2, A1-P3, A2-P1, A2-P2, A2-P3
  metodoEntrega: TipoMetodoEntrega;
  estadoEntrega: TipoEstadoEntrega;
  facturaPdfUrl?: string;
  creadoEn: string;
}

export interface EmbarqueMaster {
  id: string;
  codigoGuiaMaster: string;          // Ej: AMX0000001269
  referenciaSocio?: string;          // Ej: WR-TIB-8812
  almacenOrigen: string;
  almacenDestino: string;
  despachadoMiamiEn: string;
  recibidoPeruEn?: string;
  estado: 'EN_TRANSITO' | 'RECIBIDO_PERU' | 'COMPLETADO';
  notas?: string;
  creadoEn: string;
}

export interface OrdenLiquidacion {
  id: string;
  paqueteId: string;
  codigoCasillero: string;
  nombreCliente: string;
  montoFleteUsd: number;
  cargoAdminUsd: number;
  montoTotalUsd: number;
  montoPagado: number;
  monedaPago: TipoMonedaPago;
  metodoPago?: string;
  referenciaPago?: string;
  comprobantePagoUrl?: string;
  estaPagado: boolean;
  pagadoEn?: string;
  creadoEn: string;
}

export interface HistorialTrazabilidad {
  id: string;
  paqueteId: string;
  ubicacion: string;
  descripcionEvento: string;
  usuarioOperador?: string;
  fechaHora: string;
}

export interface UsuarioSession {
  id: string;
  usuario: string;
  nombreCompleto: string;
  email: string;
  rol: string;
  permisosPersonalizados?: string;
  activo: boolean;
}

export interface AlmacenSede {
  id: string;
  codigo: string;                    // MIA, LIN, TGO
  nombre: string;
  tipo?: string;                     // HUB_INTERNACIONAL, CENTRAL_DISTRIBUCION, SUCURSAL_REGIONAL
  direccion?: string;
  ciudad?: string;
  pais?: string;
  esActivo: boolean;
  creadoEn?: string;
}

export interface EstanteriaPosicion {
  id: string;
  almacenId: string;
  codigoEstante: string;             // A1, A2, A3, REC, DSP
  nivelPiso: string;                 // P1, P2, P3, P4
  codigoPosicion: string;            // A1-P1, A1-P2, A2-P1...
  zonaTipo: string;                  // ALMACENAJE, RECEPCION, DESPACHO, DEVOLUCION
  capacidadMaxPaquetes: number;
  pesoMaxKg: number;
  descripcion?: string;
  creadoEn?: string;
}

export interface MovimientoKardex {
  id: string;
  paqueteId?: string;
  codigoPaquete: string;             // WR-000451
  consignatario?: string;
  origenDescripcion: string;
  destinoDescripcion: string;
  tipoMovimiento: string;            // RECEPCION, SLOTTING, REUBICACION, DESPACHO, ENTREGA
  motivo?: string;
  usuarioOperador: string;
  creadoEn: string;
}

