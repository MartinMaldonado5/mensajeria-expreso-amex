'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  Plus,
  Trash2,
  MapPin,
  Phone,
  User,
  Package,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  FileText,
  Sparkles
} from 'lucide-react';
import { HojaRuta, DestinoRuta, Cliente, Paquete } from '@/types';
import { sanitizePeruvianPhoneNumber } from '@/lib/whatsappGenerator';

interface NewRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (route: HojaRuta) => Promise<void>;
  existingRoute?: HojaRuta | null;
  clientes?: Cliente[];
  paquetes?: Paquete[];
  currentUser?: { nombre: string; rol: string } | null;
}

interface DraftDestino {
  id: string;
  clienteNombre: string;
  clienteCasillero: string;
  telefono: string;
  direccion: string;
  distrito: string;
  referencia: string;
  codigosWrsStr: string;
  cantidadPaquetes: number;
  montoCobrar: number;
  monedaCobro: 'PEN' | 'USD';
  notasChofer: string;
}

export default function NewRouteModal({
  isOpen,
  onClose,
  onSave,
  existingRoute,
  clientes = [],
  paquetes = [],
  currentUser
}: NewRouteModalProps) {
  const operatorName = currentUser?.nombre || 'Administración AMEX';

  const todayStr = new Date().toISOString().split('T')[0];

  // Cabecera de la hoja de ruta
  const [codigoRuta, setCodigoRuta] = useState('');
  const [fechaRuta, setFechaRuta] = useState(todayStr);
  const [choferNombre, setChoferNombre] = useState('Carlos Mendoza (Chofer Principal)');
  const [choferTelefono, setChoferTelefono] = useState('987654321');
  const [vehiculoPlaca, setVehiculoPlaca] = useState('Toyota Hilux AMEX (ABC-123)');
  const [zonaSector, setZonaSector] = useState('Lima Metropolitana (Centro - Sur)');

  // Lista de destinos
  const [destinos, setDestinos] = useState<DraftDestino[]>([]);

  // Destino actual en edición/formulario rápido
  const [currentClientQuery, setCurrentClientQuery] = useState('');
  const [currentClienteNombre, setCurrentClienteNombre] = useState('');
  const [currentClienteCasillero, setCurrentClienteCasillero] = useState('');
  const [currentTelefono, setCurrentTelefono] = useState('');
  const [currentDireccion, setCurrentDireccion] = useState('');
  const [currentDistrito, setCurrentDistrito] = useState('LIMA');
  const [currentReferencia, setCurrentReferencia] = useState('');
  const [currentWrs, setCurrentWrs] = useState('');
  const [currentCantidad, setCurrentCantidad] = useState(1);
  const [currentMonto, setCurrentMonto] = useState(0);
  const [currentMoneda, setCurrentMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [currentNotas, setCurrentNotas] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicializar si se está editando una ruta existente
  useEffect(() => {
    if (existingRoute) {
      setCodigoRuta(existingRoute.codigoRuta);
      setFechaRuta(existingRoute.fechaRuta);
      setChoferNombre(existingRoute.choferNombre);
      setChoferTelefono(existingRoute.choferTelefono || '');
      setVehiculoPlaca(existingRoute.vehiculoPlaca);
      setZonaSector(existingRoute.zonaSector);
      if (existingRoute.destinos) {
        setDestinos(
          existingRoute.destinos.map(d => ({
            id: d.id,
            clienteNombre: d.clienteNombre,
            clienteCasillero: d.clienteCasillero || '',
            telefono: d.telefono,
            direccion: d.direccion,
            distrito: d.distrito,
            referencia: d.referencia || '',
            codigosWrsStr: d.codigosWrs.join(', '),
            cantidadPaquetes: d.cantidadPaquetes,
            montoCobrar: d.montoCobrar || 0,
            monedaCobro: d.monedaCobro || 'PEN',
            notasChofer: d.notasChofer || ''
          }))
        );
      }
    } else {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setCodigoRuta(`RUTA-${todayStr.replace(/-/g, '')}-${randomSuffix}`);
      setFechaRuta(todayStr);
      setDestinos([]);
    }
  }, [existingRoute, todayStr]);

  if (!isOpen) return null;

  // Autocompletar cuando selecciona un cliente existente
  const handleSelectClient = (cli: Cliente) => {
    setCurrentClienteNombre(cli.nombre);
    setCurrentClienteCasillero(cli.codigoCasillero);
    setCurrentTelefono(cli.telefono || '');
    setCurrentDireccion(cli.direccionEntrega || '');
    setCurrentDistrito(cli.distrito || 'LIMA');

    // Buscar paquetes en Lince asociados a este casillero
    const matchingPkgs = paquetes.filter(
      p => p.codigoCasillero === cli.codigoCasillero && p.estadoEntrega !== 'Entregado'
    );

    if (matchingPkgs.length > 0) {
      const wrList = matchingPkgs.map(p => p.numeroReciboBodega).join(', ');
      setCurrentWrs(wrList);
      setCurrentCantidad(matchingPkgs.length);
    }
    setCurrentClientQuery('');
  };

  // Agregar parada a la lista
  const handleAddDestino = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClienteNombre.trim()) {
      setError('Ingresa el nombre del cliente para este destino');
      return;
    }
    if (!currentDireccion.trim()) {
      setError('Ingresa la dirección de entrega');
      return;
    }

    const wrArray = currentWrs
      .split(/[,;\s]+/)
      .map(w => w.trim().toUpperCase())
      .filter(w => w.length > 0);

    const calculatedCount = wrArray.length > 0 ? wrArray.length : Math.max(1, currentCantidad);

    const newDestino: DraftDestino = {
      id: `dest-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      clienteNombre: currentClienteNombre.trim(),
      clienteCasillero: currentClienteCasillero.trim(),
      telefono: sanitizePeruvianPhoneNumber(currentTelefono),
      direccion: currentDireccion.trim(),
      distrito: currentDistrito.trim(),
      referencia: currentReferencia.trim(),
      codigosWrsStr: wrArray.length > 0 ? wrArray.join(', ') : currentWrs.trim(),
      cantidadPaquetes: calculatedCount,
      montoCobrar: Number(currentMonto) || 0,
      monedaCobro: currentMoneda,
      notasChofer: currentNotas.trim()
    };

    setDestinos(prev => [...prev, newDestino]);

    // Limpiar formulario de parada
    setCurrentClienteNombre('');
    setCurrentClienteCasillero('');
    setCurrentTelefono('');
    setCurrentDireccion('');
    setCurrentReferencia('');
    setCurrentWrs('');
    setCurrentCantidad(1);
    setCurrentMonto(0);
    setCurrentNotas('');
    setError(null);
  };

  const handleRemoveDestino = (id: string) => {
    setDestinos(prev => prev.filter(d => d.id !== id));
  };

  // Guardar toda la hoja de ruta
  const handleSaveRoute = async () => {
    if (destinos.length === 0) {
      setError('Debes agregar al menos un destino a la hoja de ruta');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const mappedDestinos: DestinoRuta[] = destinos.map((d, index) => {
        const wrs = d.codigosWrsStr
          .split(/[,;\s]+/)
          .map(w => w.trim().toUpperCase())
          .filter(w => w.length > 0);

        return {
          id: d.id,
          hojaRutaId: existingRoute?.id || `route-${Date.now()}`,
          orden: index + 1,
          clienteNombre: d.clienteNombre,
          clienteCasillero: d.clienteCasillero,
          telefono: d.telefono,
          direccion: d.direccion,
          distrito: d.distrito,
          referencia: d.referencia,
          codigosWrs: wrs,
          cantidadPaquetes: d.cantidadPaquetes,
          montoCobrar: d.montoCobrar,
          monedaCobro: d.monedaCobro,
          notasChofer: d.notasChofer,
          estadoEntrega: 'PENDIENTE'
        };
      });

      const totalPkgs = mappedDestinos.reduce((acc, d) => acc + d.cantidadPaquetes, 0);
      const totalAmount = mappedDestinos.reduce((acc, d) => acc + (d.montoCobrar || 0), 0);

      const routeToSave: HojaRuta = {
        id: existingRoute?.id || `route-${Date.now()}`,
        codigoRuta: codigoRuta.trim() || `RUTA-${Date.now()}`,
        fechaRuta,
        choferNombre: choferNombre.trim(),
        choferTelefono: choferTelefono.trim(),
        vehiculoPlaca: vehiculoPlaca.trim(),
        zonaSector: zonaSector.trim(),
        estado: existingRoute?.estado || 'PLANIFICADA',
        totalDestinos: mappedDestinos.length,
        totalPaquetes: totalPkgs,
        montoTotalCobrar: totalAmount,
        destinos: mappedDestinos,
        creadoPor: existingRoute?.creadoPor || operatorName,
        creadoEn: existingRoute?.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
      };

      await onSave(routeToSave);
      onClose();
    } catch (err: unknown) {
      console.error('Error saving route:', err);
      setError((err as Error)?.message || 'Error al guardar la hoja de ruta');
    } finally {
      setIsSaving(false);
    }
  };

  const DISTRITOS_LIMA = [
    'LIMA', 'MIRAFLORES', 'SAN ISIDRO', 'SURCO', 'SAN BORJA', 'LA MOLINA',
    'JESUS MARIA', 'LINCE', 'MAGDALENA', 'PUEBLO LIBRE', 'SAN MIGUEL',
    'SURQUILLO', 'BARRANCO', 'CHORRILLOS', 'CALLAO', 'LOS OLIVOS',
    'SAN MARTIN DE PORRES', 'COMAS', 'SAN JUAN DE LURIGANCHO', 'ATE', 'SANTA ANITA'
  ];

  const totalPaquetesDraft = destinos.reduce((acc, d) => acc + d.cantidadPaquetes, 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          border: '1px solid #cbd5e1',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            background: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #334155',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(37,99,235,0.25)',
                border: '1px solid rgba(96,165,250,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#93c5fd'
              }}
            >
              <Truck style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 900, margin: 0 }}>
                {existingRoute ? `Editar Hoja de Ruta ${existingRoute.codigoRuta}` : 'Generador de Hoja de Ruta Diaria para Chofer'}
              </h2>
              <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Administra los destinos, paquetes WR y enlaces de WhatsApp para el reparto
              </p>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div
              style={{
                padding: '10px 12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <AlertTriangle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Datos Generales de la Ruta */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar style={{ width: '14px', height: '14px', color: '#2563eb' }} />
              <span>1. Configuración de la Ruta</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Código de Ruta
                </label>
                <input
                  type="text"
                  value={codigoRuta}
                  onChange={e => setCodigoRuta(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 800, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Fecha de Reparto
                </label>
                <input
                  type="date"
                  value={fechaRuta}
                  onChange={e => setFechaRuta(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Chofer Asignado
                </label>
                <input
                  type="text"
                  value={choferNombre}
                  onChange={e => setChoferNombre(e.target.value)}
                  placeholder="Ej: Carlos Mendoza"
                  style={{ width: '100%', padding: '6px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 600, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Vehículo / Placa
                </label>
                <input
                  type="text"
                  value={vehiculoPlaca}
                  onChange={e => setVehiculoPlaca(e.target.value)}
                  placeholder="Ej: Hilux AMEX (ABC-123)"
                  style={{ width: '100%', padding: '6px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* 2. Constructor Fila por Fila de Destinos */}
          <div
            style={{
              background: '#ffffff',
              border: '1.5px solid #bfdbfe',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 2px 8px rgba(37,99,235,0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#1e40af', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin style={{ width: '15px', height: '15px', color: '#2563eb' }} />
                <span>2. Agregar Parada / Destino al Chofer</span>
              </div>

              {/* Buscador de clientes para auto-completar */}
              <div style={{ position: 'relative', width: '240px' }}>
                <input
                  type="text"
                  value={currentClientQuery}
                  onChange={e => setCurrentClientQuery(e.target.value)}
                  placeholder="🔍 Buscar cliente existente..."
                  style={{ width: '100%', padding: '4px 8px', fontSize: '11.5px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', outline: 'none' }}
                />
                {currentClientQuery.trim() && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      zIndex: 20,
                      maxHeight: '160px',
                      overflowY: 'auto'
                    }}
                  >
                    {clientes
                      .filter(c =>
                        c.nombre.toLowerCase().includes(currentClientQuery.toLowerCase()) ||
                        c.codigoCasillero.toLowerCase().includes(currentClientQuery.toLowerCase())
                      )
                      .slice(0, 5)
                      .map(c => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectClient(c)}
                          style={{ padding: '6px 10px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                        >
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{c.nombre}</div>
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>{c.codigoCasillero} • {c.direccionEntrega || 'Sin dir'}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '3px' }}>
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  value={currentClienteNombre}
                  onChange={e => setCurrentClienteNombre(e.target.value)}
                  placeholder="Ej: Luciana Valdivia"
                  style={{ width: '100%', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '3px' }}>
                  WhatsApp / Celular *
                </label>
                <input
                  type="tel"
                  value={currentTelefono}
                  onChange={e => setCurrentTelefono(e.target.value)}
                  placeholder="Ej: 987654321"
                  style={{ width: '100%', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '3px' }}>
                  Distrito
                </label>
                <select
                  value={currentDistrito}
                  onChange={e => setCurrentDistrito(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 600, outline: 'none' }}
                >
                  {DISTRITOS_LIMA.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '3px' }}>
                Dirección Completa de Entrega *
              </label>
              <input
                type="text"
                value={currentDireccion}
                onChange={e => setCurrentDireccion(e.target.value)}
                placeholder="Ej: Av. Benavides 1230, Dpto 502 (Frente al parque)"
                style={{ width: '100%', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '3px' }}>
                  Códigos WRs (Separados por coma)
                </label>
                <input
                  type="text"
                  value={currentWrs}
                  onChange={e => setCurrentWrs(e.target.value)}
                  placeholder="Ej: WR000451, WR000452"
                  style={{ width: '100%', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '3px' }}>
                  Cantidad Bultos
                </label>
                <input
                  type="number"
                  min={1}
                  value={currentCantidad}
                  onChange={e => setCurrentCantidad(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '3px' }}>
                  Cobrar al Entregar (S/.)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentMonto}
                  onChange={e => setCurrentMonto(Number(e.target.value))}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleAddDestino}
                style={{
                  padding: '8px 16px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
                }}
              >
                <Plus style={{ width: '14px', height: '14px', strokeWidth: 3 }} />
                <span>+ Agregar Parada a la Ruta</span>
              </button>
            </div>
          </div>

          {/* 3. Lista de Destinos Agregados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                Destinos Agregados ({destinos.length} paradas • {totalPaquetesDraft} paquetes totales)
              </div>
            </div>

            {destinos.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', color: '#94a3b8', fontSize: '12px' }}>
                No hay destinos agregados aún. Usa el formulario superior para añadir las paradas del chofer.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                {destinos.map((dest, idx) => (
                  <div
                    key={dest.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#2563eb', color: '#ffffff', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {idx + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>
                          {dest.clienteNombre} <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>({dest.telefono})</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#475569' }}>
                          📍 {dest.direccion} • <b>{dest.distrito}</b>
                        </div>
                        <div style={{ fontSize: '11px', color: '#2563eb', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                          📦 {dest.cantidadPaquetes} paq. {dest.codigosWrsStr ? `(${dest.codigosWrsStr})` : ''}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveDestino(dest.id)}
                      style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      title="Eliminar parada"
                    >
                      <Trash2 style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSaveRoute}
            disabled={isSaving || destinos.length === 0}
            style={{
              padding: '9px 20px',
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
              opacity: destinos.length === 0 ? 0.5 : 1
            }}
          >
            <CheckCircle2 style={{ width: '15px', height: '15px' }} />
            <span>{isSaving ? 'Guardando...' : `Guardar Hoja de Ruta (${destinos.length} Destinos)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
