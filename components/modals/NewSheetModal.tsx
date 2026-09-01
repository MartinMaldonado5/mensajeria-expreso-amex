'use client';

import React, { useState } from 'react';
import { TipoProcesoCotejo, HojaCotejo } from '@/types';
import { X, Plus, FileSpreadsheet, ShieldCheck, Warehouse, Plane, Truck, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface NewSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (sheet: HojaCotejo) => void;
  operatorName?: string;
}

export default function NewSheetModal({
  isOpen,
  onClose,
  onCreated,
  operatorName = 'Operador Logístico AMEX'
}: NewSheetModalProps) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipoProceso, setTipoProceso] = useState<TipoProcesoCotejo>('RECEPCION_LINCE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setError('El título de la hoja de cotejo es obligatorio');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const { data, error: insertError } = await supabase
        .from('hojas_cotejo')
        .insert({
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          tipo_proceso: tipoProceso,
          creado_por: operatorName
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        onCreated({
          id: data.id,
          titulo: data.titulo,
          descripcion: data.descripcion || '',
          tipoProceso: data.tipo_proceso as TipoProcesoCotejo,
          estado: data.estado || 'ACTIVA',
          creadoPor: data.creado_por || operatorName,
          creadoEn: data.creado_en,
          actualizadoEn: data.actualizado_en
        });
        onClose();
        setTitulo('');
        setDescripcion('');
      }
    } catch (err: unknown) {
      console.error('Error creating sheet:', err);
      setError((err as Error)?.message || 'Error al crear la hoja');
    } finally {
      setIsSubmitting(false);
    }
  };

  const PROCESOS: Array<{ id: TipoProcesoCotejo; label: string; desc: string }> = [
    {
      id: 'RECEPCION_LINCE',
      label: '🏢 Recepción Sede Lince',
      desc: 'Cotejo y pistoleo de bultos ingresando a almacén Lince'
    },
    {
      id: 'RECEPCION_MIAMI',
      label: '✈️ Recepción Miami Hub',
      desc: 'Ingreso inicial y armado de manifiesto aéreo'
    },
    {
      id: 'DESPACHO_RUTA',
      label: '🚚 Despacho y Reparto',
      desc: 'Verificación de paquetes para Carro AMEX o Agencias'
    },
    {
      id: 'INVENTARIO_ANAQUEL',
      label: '📦 Inventario de Anaqueles',
      desc: 'Auditoría y conteo físico en estantes (A1, A2, etc.)'
    }
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', border: '1px solid #cbd5e1', width: '100%', maxWidth: '540px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', background: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(96,165,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd' }}>
              <FileSpreadsheet style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 900, margin: 0 }}>Nueva Hoja de Cotejo</h2>
              <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>Crea una sesión de verificación colaborativa en tiempo real</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
              Título de la Hoja *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Cotejo Manifiesto Vuelo 402 - Lince"
              style={{ width: '100%', padding: '9px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#0f172a', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
              Tipo de Proceso Logístico
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {PROCESOS.map(p => {
                const isSelected = tipoProceso === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTipoProceso(p.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      background: isSelected ? '#eff6ff' : '#f8fafc',
                      color: isSelected ? '#1e40af' : '#334155',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 800 }}>{p.label}</span>
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
              Descripción / Notas Adicionales (Opcional)
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Sacas llegadas en turno de mañana, verificar con precintos..."
              style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
            />
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: '9px 18px', background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(5,150,105,0.25)' }}
            >
              <Plus style={{ width: '15px', height: '15px' }} />
              <span>{isSubmitting ? 'Creando...' : 'Crear Hoja de Cotejo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
