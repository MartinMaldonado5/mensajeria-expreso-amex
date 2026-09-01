'use client';

import React from 'react';
import { UserPlus, X, User, Phone, MapPin, Building2, Check, Sparkles, CreditCard } from 'lucide-react';

export interface NewClientFormData {
  nombre: string;
  documentoIdentidad: string;
  telefono: string;
  email: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccionEntrega: string;
  transportistaPreferido: string;
  agenciaDestino: string;
}

interface NewClientModalProps {
  form: NewClientFormData;
  onChange: (form: NewClientFormData) => void;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function NewClientModal({ form, onChange, onSave, onClose }: NewClientModalProps) {
  const set = (key: keyof NewClientFormData, value: string) => onChange({ ...form, [key]: value });

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const suggestedCasillero = `AMEX-PER-${randomSuffix}`;

  const DEPARTAMENTOS = ['LIMA', 'CALLAO', 'AREQUIPA', 'LA LIBERTAD', 'PIURA', 'CUSCO', 'LAMBAYEQUE', 'JUNIN', 'HUANUCO', 'SAN MARTIN'];
  const TRANSPORTISTAS = ['CARRO AMEX', 'SHALOM EMPRESARIAL', 'OLVA COURIER', 'MARVISUR', 'RECOJO EN LINCE'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', border: '1px solid #cbd5e1', width: '100%', maxWidth: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', background: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(96,165,250,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd' }}>
              <UserPlus style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 900, margin: 0 }}>Crear Nuevo Casillero AMEX</h2>
                <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 900, background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(110,231,183,0.3)' }}>
                  {suggestedCasillero}
                </span>
              </div>
              <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>Registra cliente para asignación directa de paquetes y despachos</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSave} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                <User style={{ width: '14px', height: '14px', color: '#2563eb' }} />
                Nombre Completo del Cliente / Razón Social *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
                placeholder="Ej: María Torres Pérez"
                style={{ width: '100%', padding: '9px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#0f172a', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                  <CreditCard style={{ width: '14px', height: '14px', color: '#64748b' }} />
                  DNI / RUC Fiscal *
                </label>
                <input
                  type="text"
                  required
                  value={form.documentoIdentidad}
                  onChange={e => set('documentoIdentidad', e.target.value)}
                  placeholder="DNI de 8 dígitos o RUC"
                  style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 800, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                  <Phone style={{ width: '14px', height: '14px', color: '#64748b' }} />
                  Teléfono / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={form.telefono}
                  onChange={e => set('telefono', e.target.value)}
                  placeholder="Ej: +51 987 654 321"
                  style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                  Región / Departamento
                </label>
                <select
                  value={form.departamento}
                  onChange={e => set('departamento', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                >
                  {DEPARTAMENTOS.map(dep => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                  Transportista Preferido
                </label>
                <select
                  value={form.transportistaPreferido}
                  onChange={e => set('transportistaPreferido', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                >
                  {TRANSPORTISTAS.map(trans => (
                    <option key={trans} value={trans}>{trans}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                <MapPin style={{ width: '14px', height: '14px', color: '#64748b' }} />
                Dirección de Entrega en Perú (Opcional)
              </label>
              <input
                type="text"
                value={form.direccionEntrega}
                onChange={e => set('direccionEntrega', e.target.value)}
                placeholder="Av. Principal 123, Dpto 401, Miraflores"
                style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              style={{ padding: '9px 18px', fontSize: '12px', fontWeight: 900, color: '#ffffff', background: '#2563eb', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}
            >
              <Check style={{ width: '15px', height: '15px', strokeWidth: 3 }} />
              <span>Registrar Cliente</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
