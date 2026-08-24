export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      almacenes_sedes: {
        Row: {
          actualizado_en: string | null
          ciudad: string | null
          codigo: string
          creado_en: string | null
          direccion: string | null
          es_activo: boolean | null
          id: string
          nombre: string
          pais: string | null
          tipo: string | null
        }
        Insert: {
          actualizado_en?: string | null
          ciudad?: string | null
          codigo: string
          creado_en?: string | null
          direccion?: string | null
          es_activo?: boolean | null
          id?: string
          nombre: string
          pais?: string | null
          tipo?: string | null
        }
        Update: {
          actualizado_en?: string | null
          ciudad?: string | null
          codigo?: string
          creado_en?: string | null
          direccion?: string | null
          es_activo?: boolean | null
          id?: string
          nombre?: string
          pais?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          actualizado_en: string | null
          agencia_destino: string | null
          codigo_casillero: string
          creado_en: string | null
          departamento: string | null
          direccion_entrega: string | null
          distrito: string | null
          dni_frontal_url: string | null
          dni_reverso_url: string | null
          documento_identidad: string
          email: string | null
          id: string
          nombre: string
          provincia: string | null
          telefono: string | null
          transportista_preferido: string | null
        }
        Insert: {
          actualizado_en?: string | null
          agencia_destino?: string | null
          codigo_casillero: string
          creado_en?: string | null
          departamento?: string | null
          direccion_entrega?: string | null
          distrito?: string | null
          dni_frontal_url?: string | null
          dni_reverso_url?: string | null
          documento_identidad: string
          email?: string | null
          id?: string
          nombre: string
          provincia?: string | null
          telefono?: string | null
          transportista_preferido?: string | null
        }
        Update: {
          actualizado_en?: string | null
          agencia_destino?: string | null
          codigo_casillero?: string
          creado_en?: string | null
          departamento?: string | null
          direccion_entrega?: string | null
          distrito?: string | null
          dni_frontal_url?: string | null
          dni_reverso_url?: string | null
          documento_identidad?: string
          email?: string | null
          id?: string
          nombre?: string
          provincia?: string | null
          telefono?: string | null
          transportista_preferido?: string | null
        }
        Relationships: []
      }
      embarques_master: {
        Row: {
          actualizado_en: string | null
          almacen_destino: string | null
          almacen_origen: string | null
          codigo_guia_master: string
          creado_en: string | null
          despachado_miami_en: string | null
          estado: string | null
          id: string
          notas: string | null
          recibido_peru_en: string | null
          referencia_socio: string | null
        }
        Insert: {
          actualizado_en?: string | null
          almacen_destino?: string | null
          almacen_origen?: string | null
          codigo_guia_master: string
          creado_en?: string | null
          despachado_miami_en?: string | null
          estado?: string | null
          id?: string
          notas?: string | null
          recibido_peru_en?: string | null
          referencia_socio?: string | null
        }
        Update: {
          actualizado_en?: string | null
          almacen_destino?: string | null
          almacen_origen?: string | null
          codigo_guia_master?: string
          creado_en?: string | null
          despachado_miami_en?: string | null
          estado?: string | null
          id?: string
          notas?: string | null
          recibido_peru_en?: string | null
          referencia_socio?: string | null
        }
        Relationships: []
      }
      escaneos_log: {
        Row: {
          codigo: string
          creado_en: string | null
          formato: string | null
          id: string
          modo_workflow: string | null
          operador: string | null
          paquete_id: string | null
          ubicacion: string | null
        }
        Insert: {
          codigo: string
          creado_en?: string | null
          formato?: string | null
          id?: string
          modo_workflow?: string | null
          operador?: string | null
          paquete_id?: string | null
          ubicacion?: string | null
        }
        Update: {
          codigo?: string
          creado_en?: string | null
          formato?: string | null
          id?: string
          modo_workflow?: string | null
          operador?: string | null
          paquete_id?: string | null
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escaneos_log_paquete_id_fkey"
            columns: ["paquete_id"]
            isOneToOne: false
            referencedRelation: "paquetes"
            referencedColumns: ["id"]
          }
        ]
      }
      estanterias_posiciones: {
        Row: {
          actualizado_en: string | null
          almacen_id: string | null
          capacidad_max_paquetes: number | null
          codigo_estante: string
          codigo_posicion: string
          creado_en: string | null
          descripcion: string | null
          id: string
          nivel_piso: string
          peso_max_kg: number | null
          zona_tipo: string | null
        }
        Insert: {
          actualizado_en?: string | null
          almacen_id?: string | null
          capacidad_max_paquetes?: number | null
          codigo_estante: string
          codigo_posicion: string
          creado_en?: string | null
          descripcion?: string | null
          id?: string
          nivel_piso: string
          peso_max_kg?: number | null
          zona_tipo?: string | null
        }
        Update: {
          actualizado_en?: string | null
          almacen_id?: string | null
          capacidad_max_paquetes?: number | null
          codigo_estante?: string
          codigo_posicion?: string
          creado_en?: string | null
          descripcion?: string | null
          id?: string
          nivel_piso?: string
          peso_max_kg?: number | null
          zona_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estanterias_posiciones_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes_sedes"
            referencedColumns: ["id"]
          }
        ]
      }
      historial_trazabilidad: {
        Row: {
          descripcion_evento: string
          fecha_hora: string | null
          id: string
          paquete_id: string | null
          ubicacion: string
          usuario_operador: string | null
        }
        Insert: {
          descripcion_evento: string
          fecha_hora?: string | null
          id?: string
          paquete_id?: string | null
          ubicacion: string
          usuario_operador?: string | null
        }
        Update: {
          descripcion_evento?: string
          fecha_hora?: string | null
          id?: string
          paquete_id?: string | null
          ubicacion?: string
          usuario_operador?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_trazabilidad_paquete_id_fkey"
            columns: ["paquete_id"]
            isOneToOne: false
            referencedRelation: "paquetes"
            referencedColumns: ["id"]
          }
        ]
      }
      movimientos_kardex: {
        Row: {
          codigo_paquete: string
          consignatario: string | null
          creado_en: string | null
          destino_descripcion: string
          id: string
          motivo: string | null
          origen_descripcion: string
          paquete_id: string | null
          tipo_movimiento: string
          usuario_operador: string | null
        }
        Insert: {
          codigo_paquete: string
          consignatario?: string | null
          creado_en?: string | null
          destino_descripcion: string
          id?: string
          motivo?: string | null
          origen_descripcion: string
          paquete_id?: string | null
          tipo_movimiento: string
          usuario_operador?: string | null
        }
        Update: {
          codigo_paquete?: string
          consignatario?: string | null
          creado_en?: string | null
          destino_descripcion?: string
          id?: string
          motivo?: string | null
          origen_descripcion?: string
          paquete_id?: string | null
          tipo_movimiento?: string
          usuario_operador?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_kardex_paquete_id_fkey"
            columns: ["paquete_id"]
            isOneToOne: false
            referencedRelation: "paquetes"
            referencedColumns: ["id"]
          }
        ]
      }
      ordenes_liquidacion: {
        Row: {
          cargo_admin_usd: number | null
          codigo_casillero: string
          comprobante_pago_url: string | null
          creado_en: string | null
          esta_pagado: boolean | null
          id: string
          metodo_pago: string | null
          moneda_pago: string | null
          monto_flete_usd: number | null
          monto_pagado: number | null
          monto_total_usd: number | null
          nombre_cliente: string
          pagado_en: string | null
          paquete_id: string | null
          referencia_pago: string | null
        }
        Insert: {
          cargo_admin_usd?: number | null
          codigo_casillero: string
          comprobante_pago_url?: string | null
          creado_en?: string | null
          esta_pagado?: boolean | null
          id?: string
          metodo_pago?: string | null
          moneda_pago?: string | null
          monto_flete_usd?: number | null
          monto_pagado?: number | null
          monto_total_usd?: number | null
          nombre_cliente: string
          pagado_en?: string | null
          paquete_id?: string | null
          referencia_pago?: string | null
        }
        Update: {
          cargo_admin_usd?: number | null
          codigo_casillero?: string
          comprobante_pago_url?: string | null
          creado_en?: string | null
          esta_pagado?: boolean | null
          id?: string
          metodo_pago?: string | null
          moneda_pago?: string | null
          monto_flete_usd?: number | null
          monto_pagado?: number | null
          monto_total_usd?: number | null
          nombre_cliente?: string
          pagado_en?: string | null
          paquete_id?: string | null
          referencia_pago?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_liquidacion_paquete_id_fkey"
            columns: ["paquete_id"]
            isOneToOne: false
            referencedRelation: "paquetes"
            referencedColumns: ["id"]
          }
        ]
      }
      paquetes: {
        Row: {
          actualizado_en: string | null
          anaquel: string | null
          cliente_id: string | null
          codigo_casillero: string
          creado_en: string | null
          descripcion: string | null
          dni_consignatario: string | null
          embarque_id: string | null
          estado_entrega: string | null
          factura_pdf_url: string | null
          id: string
          metodo_entrega: string | null
          nombre_consignatario: string | null
          numero_factura: string | null
          numero_recibo_bodega: string
          peso_kg: number | null
          piso: string | null
          posicion_estante: string | null
          tipo_empaque: string | null
          tracking_usa: string
          ubicacion_actual: string | null
          valor_declarado_usd: number | null
        }
        Insert: {
          actualizado_en?: string | null
          anaquel?: string | null
          cliente_id?: string | null
          codigo_casillero: string
          creado_en?: string | null
          descripcion?: string | null
          dni_consignatario?: string | null
          embarque_id?: string | null
          estado_entrega?: string | null
          factura_pdf_url?: string | null
          id?: string
          metodo_entrega?: string | null
          nombre_consignatario?: string | null
          numero_factura?: string | null
          numero_recibo_bodega: string
          peso_kg?: number | null
          piso?: string | null
          posicion_estante?: string | null
          tipo_empaque?: string | null
          tracking_usa: string
          ubicacion_actual?: string | null
          valor_declarado_usd?: number | null
        }
        Update: {
          actualizado_en?: string | null
          anaquel?: string | null
          cliente_id?: string | null
          codigo_casillero?: string
          creado_en?: string | null
          descripcion?: string | null
          dni_consignatario?: string | null
          embarque_id?: string | null
          estado_entrega?: string | null
          factura_pdf_url?: string | null
          id?: string
          metodo_entrega?: string | null
          nombre_consignatario?: string | null
          numero_factura?: string | null
          numero_recibo_bodega?: string
          peso_kg?: number | null
          piso?: string | null
          posicion_estante?: string | null
          tipo_empaque?: string | null
          tracking_usa?: string
          ubicacion_actual?: string | null
          valor_declarado_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paquetes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paquetes_embarque_id_fkey"
            columns: ["embarque_id"]
            isOneToOne: false
            referencedRelation: "embarques_master"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
