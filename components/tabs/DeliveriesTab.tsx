'use client';

import React, { useState, useMemo } from 'react';
import {
  Truck,
  MapPin,
  Phone,
  MessageCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  Navigation,
  ExternalLink,
  Store,
  RotateCcw,
  Check,
  User,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Package,
  Layers,
  X,
  FileText
} from 'lucide-react';
import { Paquete, Cliente, TipoEstadoEntrega } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { exportHojaDeRutaToExcel } from '@/lib/excelExport';
import { matchesFuzzySearch } from '@/lib/fuzzySearch';
import ThermalLabelModal from '@/components/modals/ThermalLabelModal';

interface DeliveriesTabProps {
  paquetes: Paquete[];
  clientes: Cliente[];
  onUpdatePackage?: (pkg: Paquete) => void;
  onViewPdf: (url: string) => void;
}

export default function DeliveriesTab({
  paquetes,
  clientes,
  onUpdatePackage,
  onViewPdf
}: DeliveriesTabProps) {
  // Pestañas operativas: 'rutas' | 'mostrador' | 'historial'
  const [activeSubTab, setActiveSubTab] = useState<'rutas' | 'mostrador' | 'historial'>('rutas');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selección múltiple para despacho masivo
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Datos de Hoja de Ruta
  const [driverName, setDriverName] = useState('Carlos Mendoza');
  const [vehiclePlate, setVehiclePlate] = useState('Toyota Hilux AMEX (ABC-123)');
  const [routeZone, setRouteZone] = useState('Ruta Lima Metropolitana (Centro - Sur)');

  // Modales
  const [selectedThermalPkg, setSelectedThermalPkg] = useState<Paquete | null>(null);
  const [isRouteManifestOpen, setIsRouteManifestOpen] = useState(false);
  const [confirmDeliveryPkg, setConfirmDeliveryPkg] = useState<(Paquete & { cliente?: Cliente }) | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState<{
    recibidoPor: string;
    dniReceptor: string;
    observaciones: string;
  }>({
    recibidoPor: '',
    dniReceptor: '',
    observaciones: 'Entregado conforme en dirección de destino'
  });

  // Mapa de Clientes por Código Casillero para enriquecer direcciones y teléfonos
  const clientMap = useMemo(() => {
    const map: Record<string, Cliente> = {};
    for (const c of clientes) {
      map[c.codigoCasillero] = c;
    }
    return map;
  }, [clientes]);

  // Lista de paquetes enriquecida con datos de cliente
  const enrichedPackages = useMemo(() => {
    return paquetes.map(p => {
      const cli = clientMap[p.codigoCasillero];
      return {
        ...p,
        cliente: cli
      };
    });
  }, [paquetes, clientMap]);

  // Paquetes clasificados por tipo de despacho
  const deliveryPackages = useMemo(() => {
    if (activeSubTab === 'rutas') {
      return enrichedPackages.filter(p =>
        p.metodoEntrega === 'CarroAmexDomicilio' &&
        (p.estadoEntrega === 'EnAlmacen' || p.estadoEntrega === 'EnRutaCarroAmex')
      );
    }
    if (activeSubTab === 'mostrador') {
      return enrichedPackages.filter(p =>
        (p.metodoEntrega === 'RecojoLince' || p.estadoEntrega === 'ListoParaRecojo') &&
        p.estadoEntrega !== 'Entregado'
      );
    }
    // 'historial'
    return enrichedPackages.filter(p => p.estadoEntrega === 'Entregado');
  }, [enrichedPackages, activeSubTab]);

  // Distritos únicos para el selector
  const availableDistricts = useMemo(() => {
    const set = new Set<string>();
    for (const p of deliveryPackages) {
      if (p.cliente?.distrito) {
        set.add(p.cliente.distrito.trim());
      }
    }
    return Array.from(set).sort();
  }, [deliveryPackages]);

  // Filtrado final con Motor Fuzzy Inteligente
  const filteredList = useMemo(() => {
    return deliveryPackages.filter(p => {
      const matchesSearch = matchesFuzzySearch(searchTerm, [
        p.numeroReciboBodega,
        p.codigoCasillero,
        p.nombreConsignatario,
        p.dniConsignatario,
        p.cliente?.nombre,
        p.cliente?.telefono,
        p.cliente?.direccionEntrega,
        p.cliente?.distrito,
        p.trackingUsa,
        p.posicionEstante
      ]);

      const matchesDistrict = districtFilter === 'ALL' ||
        (p.cliente?.distrito && p.cliente.distrito.trim() === districtFilter);

      const matchesStatus = statusFilter === 'ALL' || p.estadoEntrega === statusFilter;

      return matchesSearch && matchesDistrict && matchesStatus;
    });
  }, [deliveryPackages, searchTerm, districtFilter, statusFilter]);

  // Métricas globales
  const countInWarehouse = useMemo(() =>
    paquetes.filter(p => p.metodoEntrega === 'CarroAmexDomicilio' && p.estadoEntrega === 'EnAlmacen').length,
    [paquetes]
  );
  const countInRoute = useMemo(() =>
    paquetes.filter(p => p.estadoEntrega === 'EnRutaCarroAmex').length,
    [paquetes]
  );
  const countCounterPickup = useMemo(() =>
    paquetes.filter(p => p.metodoEntrega === 'RecojoLince' || p.estadoEntrega === 'ListoParaRecojo').length,
    [paquetes]
  );
  const countDelivered = useMemo(() =>
    paquetes.filter(p => p.estadoEntrega === 'Entregado').length,
    [paquetes]
  );

  // -------------------------------------------------------------
  // ACCIONES OPERATIVAS EN SUPABASE & KARDEX
  // -------------------------------------------------------------

  // 1. Cargar paquete a la camioneta de reparto
  const handleLoadToCar = async (pkg: Paquete) => {
    try {
      await supabase
        .from('paquetes')
        .update({ estado_entrega: 'EnRutaCarroAmex' })
        .eq('id', pkg.id);

      const updated: Paquete = { ...pkg, estadoEntrega: 'EnRutaCarroAmex' };
      if (onUpdatePackage) onUpdatePackage(updated);

      await supabase.from('movimientos_kardex').insert({
        paquete_id: pkg.id,
        codigo_paquete: pkg.numeroReciboBodega,
        consignatario: pkg.nombreConsignatario || pkg.codigoCasillero,
        origen_descripcion: `Almacén Lince (${pkg.posicionEstante || 'REC'})`,
        destino_descripcion: `En Camioneta AMEX (${driverName} - ${vehiclePlate})`,
        tipo_movimiento: 'SALIDA_REPARTO',
        motivo: `Cargado a hoja de ruta ${routeZone}`,
        usuario_operador: 'Operador Logístico AMEX'
      });
    } catch (err) {
      console.error('Error cargando al carro:', err);
    }
  };

  // 2. Cargar selección masiva a la camioneta
  const handleBatchLoadToCar = async () => {
    if (selectedIds.length === 0) return;
    try {
      await supabase
        .from('paquetes')
        .update({ estado_entrega: 'EnRutaCarroAmex' })
        .in('id', selectedIds);

      for (const id of selectedIds) {
        const pkg = paquetes.find(p => p.id === id);
        if (pkg) {
          const updated: Paquete = { ...pkg, estadoEntrega: 'EnRutaCarroAmex' };
          if (onUpdatePackage) onUpdatePackage(updated);

          await supabase.from('movimientos_kardex').insert({
            paquete_id: pkg.id,
            codigo_paquete: pkg.numeroReciboBodega,
            consignatario: pkg.nombreConsignatario || pkg.codigoCasillero,
            origen_descripcion: `Almacén Lince (${pkg.posicionEstante || 'REC'})`,
            destino_descripcion: `En Camioneta AMEX (${driverName})`,
            tipo_movimiento: 'SALIDA_REPARTO',
            motivo: `Carga en lote a ruta ${routeZone}`,
            usuario_operador: 'Operador Logístico AMEX'
          });
        }
      }
      setSelectedIds([]);
      alert(`✓ ¡Éxito! ${selectedIds.length} paquetes cargados a la camioneta de reparto.`);
    } catch (err) {
      console.error('Error en carga masiva:', err);
    }
  };

  // 3. Abrir modal para confirmar entrega individual
  const openConfirmDeliveryModal = (pkg: Paquete & { cliente?: Cliente }) => {
    setConfirmDeliveryPkg(pkg);
    setDeliveryNotes({
      recibidoPor: pkg.nombreConsignatario || pkg.cliente?.nombre || '',
      dniReceptor: pkg.dniConsignatario || pkg.cliente?.documentoIdentidad || '',
      observaciones: 'Entregado conforme en dirección del cliente'
    });
  };

  // 4. Ejecutar confirmación de entrega
  const handleExecuteConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmDeliveryPkg) return;

    try {
      await supabase
        .from('paquetes')
        .update({
          estado_entrega: 'Entregado',
          ubicacion_actual: 'Entregado'
        })
        .eq('id', confirmDeliveryPkg.id);

      const updated: Paquete = {
        ...confirmDeliveryPkg,
        estadoEntrega: 'Entregado',
        ubicacionActual: 'Entregado'
      };
      if (onUpdatePackage) onUpdatePackage(updated);

      await supabase.from('historial_trazabilidad').insert({
        paquete_id: confirmDeliveryPkg.id,
        ubicacion: 'Domicilio del Cliente / Entregado',
        descripcion_evento: `Entregado a ${deliveryNotes.recibidoPor} (DNI: ${deliveryNotes.dniReceptor || 'N/A'}). ${deliveryNotes.observaciones}`,
        usuario_operador: driverName || 'Operador Logístico AMEX'
      });

      await supabase.from('movimientos_kardex').insert({
        paquete_id: confirmDeliveryPkg.id,
        codigo_paquete: confirmDeliveryPkg.numeroReciboBodega,
        consignatario: confirmDeliveryPkg.nombreConsignatario || confirmDeliveryPkg.codigoCasillero,
        origen_descripcion: 'Camioneta AMEX Reparto',
        destino_descripcion: `Entregado a ${deliveryNotes.recibidoPor} (${deliveryNotes.dniReceptor || 'Titular'})`,
        tipo_movimiento: 'ENTREGA',
        motivo: deliveryNotes.observaciones,
        usuario_operador: driverName || 'Operador Logístico AMEX'
      });

      setConfirmDeliveryPkg(null);
      alert(`✓ ¡Paquete ${confirmDeliveryPkg.numeroReciboBodega} marcado como ENTREGADO con éxito!`);
    } catch (err) {
      console.error('Error confirmando entrega:', err);
    }
  };

  // 5. Reprogramar entrega (regresar a almacén custodia)
  const handleReprogramDelivery = async (pkg: Paquete) => {
    const motivo = prompt('Ingresa el motivo de no entrega / reprogramación:', 'Cliente ausente en domicilio');
    if (!motivo) return;

    try {
      await supabase
        .from('paquetes')
        .update({ estado_entrega: 'EnAlmacen' })
        .eq('id', pkg.id);

      const updated: Paquete = { ...pkg, estadoEntrega: 'EnAlmacen' };
      if (onUpdatePackage) onUpdatePackage(updated);

      await supabase.from('movimientos_kardex').insert({
        paquete_id: pkg.id,
        codigo_paquete: pkg.numeroReciboBodega,
        consignatario: pkg.nombreConsignatario || pkg.codigoCasillero,
        origen_descripcion: 'Camioneta AMEX Reparto',
        destino_descripcion: 'Almacén Lince (Custodia / Reprogramado)',
        tipo_movimiento: 'ESTADO_CAMBIO',
        motivo: `Reprogramado: ${motivo}`,
        usuario_operador: driverName || 'Operador Logístico AMEX'
      });

      alert(`✓ Paquete ${pkg.numeroReciboBodega} devuelto a almacén para reprogramación.`);
    } catch (err) {
      console.error('Error reprogramando entrega:', err);
    }
  };

  // 6. Enviar WhatsApp al cliente
  const handleOpenWhatsApp = (pkg: Paquete & { cliente?: Cliente }) => {
    const phone = pkg.cliente?.telefono?.replace(/\D/g, '') || '';
    if (!phone) {
      alert('El cliente no tiene registrado un número telefónico.');
      return;
    }
    const cleanPhone = phone.startsWith('51') ? phone : `51${phone}`;
    const clientName = pkg.nombreConsignatario || pkg.cliente?.nombre || 'Cliente AMEX';
    const address = pkg.cliente?.direccionEntrega || 'tu dirección';
    const msg = `Hola *${clientName}*, te saluda *AMEX Courier*. Tu paquete con Guía *${pkg.numeroReciboBodega}* está en camino a tu dirección: *${address}* en la camioneta de reparto. Nuestro conductor llegará pronto. Por favor ten a la mano tu DNI. ¡Muchas gracias!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // 7. Abrir Google Maps con la dirección
  const handleOpenMaps = (pkg: Paquete & { cliente?: Cliente }) => {
    const addr = pkg.cliente?.direccionEntrega;
    const dist = pkg.cliente?.distrito || 'Lima';
    if (!addr) {
      alert('Este paquete no cuenta con dirección de entrega registrada.');
      return;
    }
    const query = `${addr}, ${dist}, Lima, Peru`;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
  };

  // Toggle selección
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map(p => p.id));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Breadcrumb & Header */}
      <div className="sap-breadcrumb">
        <span>Operaciones y Almacenes</span> / <span>Despacho & Reparto a Domicilio (Carro AMEX)</span>
      </div>

      <div
        className="page-title-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Truck style={{ width: '28px', height: '28px', color: '#2563eb' }} />
            Despacho & Reparto Local (Carro AMEX)
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0' }}>
            Control de hojas de ruta, carga de camioneta, trazabilidad de entregas a domicilio y mostrador
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={() => exportHojaDeRutaToExcel(filteredList, `${driverName} (${vehiclePlate})`, routeZone)}
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800
            }}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Hoja de Ruta (.xlsx)
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setIsRouteManifestOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800
            }}
          >
            <Printer className="w-4 h-4" /> Imprimir Hoja de Ruta
          </button>
        </div>
      </div>

      {/* KPI RIBBON DE DESPACHO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div
          onClick={() => { setActiveSubTab('rutas'); setStatusFilter('EnAlmacen'); }}
          style={{
            background: activeSubTab === 'rutas' && statusFilter === 'EnAlmacen' ? '#eff6ff' : '#ffffff',
            border: activeSubTab === 'rutas' && statusFilter === 'EnAlmacen' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Package className="w-4 h-4 text-blue-600" /> Por Cargar / En Almacén
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e3a8a', marginTop: '4px' }}>
            {countInWarehouse} <span style={{ fontSize: '12px', fontWeight: 700 }}>paquetes</span>
          </div>
        </div>

        <div
          onClick={() => { setActiveSubTab('rutas'); setStatusFilter('EnRutaCarroAmex'); }}
          style={{
            background: activeSubTab === 'rutas' && statusFilter === 'EnRutaCarroAmex' ? '#fef3c7' : '#ffffff',
            border: activeSubTab === 'rutas' && statusFilter === 'EnRutaCarroAmex' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Truck className="w-4 h-4 text-amber-600" /> En Ruta (Carro AMEX)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#92400e', marginTop: '4px' }}>
            {countInRoute} <span style={{ fontSize: '12px', fontWeight: 700 }}>paquetes</span>
          </div>
        </div>

        <div
          onClick={() => { setActiveSubTab('mostrador'); setStatusFilter('ALL'); }}
          style={{
            background: activeSubTab === 'mostrador' ? '#f3e8ff' : '#ffffff',
            border: activeSubTab === 'mostrador' ? '2px solid #9333ea' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#7e22ce', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Store className="w-4 h-4 text-purple-600" /> Recojo en Tienda (Lince)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#581c87', marginTop: '4px' }}>
            {countCounterPickup} <span style={{ fontSize: '12px', fontWeight: 700 }}>listos</span>
          </div>
        </div>

        <div
          onClick={() => { setActiveSubTab('historial'); setStatusFilter('ALL'); }}
          style={{
            background: activeSubTab === 'historial' ? '#f0fdf4' : '#ffffff',
            border: activeSubTab === 'historial' ? '2px solid #16a34a' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Entregados
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#166534', marginTop: '4px' }}>
            {countDelivered} <span style={{ fontSize: '12px', fontWeight: 700 }}>completados</span>
          </div>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN SECUNDARIA */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px' }}>
        <button
          onClick={() => { setActiveSubTab('rutas'); setStatusFilter('ALL'); }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'rutas' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeSubTab === 'rutas' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Truck className="w-4 h-4" /> Rutas & Despacho Domicilio
        </button>

        <button
          onClick={() => { setActiveSubTab('mostrador'); setStatusFilter('ALL'); }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'mostrador' ? '3px solid #9333ea' : '3px solid transparent',
            color: activeSubTab === 'mostrador' ? '#9333ea' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Store className="w-4 h-4" /> Recojo en Tienda Lince
        </button>

        <button
          onClick={() => { setActiveSubTab('historial'); setStatusFilter('ALL'); }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 800,
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'historial' ? '3px solid #16a34a' : '3px solid transparent',
            color: activeSubTab === 'historial' ? '#16a34a' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 className="w-4 h-4" /> Historial de Entregados
        </button>
      </div>

      {/* PANEL DE ASIGNACIÓN DE CHOFER Y RUTA */}
      {activeSubTab === 'rutas' && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Chofer / Conductor Asignado
              </label>
              <input
                type="text"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                placeholder="Nombre del Chofer"
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  width: '190px',
                  background: '#f8fafc'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Vehículo / Placa
              </label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={e => setVehiclePlate(e.target.value)}
                placeholder="Vehículo y Placa"
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  width: '230px',
                  background: '#f8fafc'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Zona / Ruta de Reparto
              </label>
              <input
                type="text"
                value={routeZone}
                onChange={e => setRouteZone(e.target.value)}
                placeholder="Zona / Distritos de la Ruta"
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  width: '100%',
                  background: '#f8fafc'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <Search
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                color: '#94a3b8'
              }}
            />
            <input
              type="text"
              placeholder="Buscar por WR, Casillero, Consignatario, Teléfono o Dirección..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#f8fafc'
              }}
            />
          </div>

          {/* ACCIONES MASIVAS CUANDO HAY SELECCIÓN */}
          {selectedIds.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#eff6ff',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af' }}>
                {selectedIds.length} selec.
              </span>
              <button
                onClick={handleBatchLoadToCar}
                className="btn btn-primary"
                style={{ padding: '4px 10px', fontSize: '11.5px', height: '28px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Truck className="w-3.5 h-3.5" /> Cargar a Camioneta
              </button>
              <button
                onClick={() => setSelectedIds([])}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* SELECTORES DE FILTRO */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Distrito:</label>
            <select
              value={districtFilter}
              onChange={e => setDistrictFilter(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#f8fafc', fontWeight: 700 }}
            >
              <option value="ALL">Todos los Distritos</option>
              {availableDistricts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Estado:</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#f8fafc', fontWeight: 700 }}
            >
              <option value="ALL">Todos los Estados</option>
              <option value="EnAlmacen">En Almacén (Por Cargar)</option>
              <option value="EnRutaCarroAmex">En Ruta (Carro AMEX)</option>
              <option value="ListoParaRecojo">Listo para Recojo</option>
              <option value="Entregado">Entregado</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE DESPACHO */}
      <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.4px' }}>
                <th style={{ padding: '12px 14px', width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredList.length > 0 && selectedIds.length === filteredList.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Parada / WR</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Cliente / Casillero</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Dirección & Distrito</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Contacto Rápido</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Bulto</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Estado Despacho</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Acciones Operativas</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                    <Truck style={{ width: '42px', height: '42px', margin: '0 auto 8px auto', color: '#cbd5e1' }} />
                    <div style={{ fontWeight: 800, color: '#64748b', fontSize: '14px' }}>
                      No hay paquetes en esta vista con los filtros seleccionados
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((pkg, idx) => {
                  const isSelected = selectedIds.includes(pkg.id);
                  const isEnRuta = pkg.estadoEntrega === 'EnRutaCarroAmex';
                  const isDelivered = pkg.estadoEntrega === 'Entregado';
                  const phone = pkg.cliente?.telefono || '';

                  return (
                    <tr
                      key={pkg.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isSelected ? '#eff6ff' : isEnRuta ? '#fffbeb' : '#ffffff',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(pkg.id)}
                        />
                      </td>

                      {/* Parada & WR */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              background: '#2563eb',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 900
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a', fontSize: '13px' }}>
                              {pkg.numeroReciboBodega}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                              {pkg.trackingUsa || 'S/N Tracking'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cliente & Casillero */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 800, color: '#2563eb', fontSize: '12px' }}>
                          {pkg.codigoCasillero}
                        </div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {pkg.nombreConsignatario || pkg.cliente?.nombre || 'Cliente AMEX'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          DNI: {pkg.dniConsignatario || pkg.cliente?.documentoIdentidad || 'No registrado'}
                        </div>
                      </td>

                      {/* Dirección & Distrito */}
                      <td style={{ padding: '10px 14px', maxWidth: '240px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '12px', lineHeight: 1.3 }}>
                          {pkg.cliente?.direccionEntrega || 'Dirección de contacto en casillero'}
                        </div>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#f1f5f9',
                            color: '#475569',
                            display: 'inline-block',
                            marginTop: '3px'
                          }}
                        >
                          📍 {pkg.cliente?.distrito || 'Lima'}
                        </span>
                      </td>

                      {/* Contacto Rápido */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {phone && (
                            <button
                              onClick={() => handleOpenWhatsApp(pkg)}
                              title="Enviar WhatsApp con aviso de llegada"
                              style={{
                                background: '#dcfce7',
                                border: '1px solid #86efac',
                                color: '#15803d',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </button>
                          )}

                          {pkg.cliente?.direccionEntrega && (
                            <button
                              onClick={() => handleOpenMaps(pkg)}
                              title="Abrir ubicación en Google Maps"
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Navigation className="w-3.5 h-3.5" /> Mapa
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Bulto & Peso */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{pkg.pesoKg} Kg</div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>{pkg.tipoEmpaque}</div>
                      </td>

                      {/* Estado Despacho */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background:
                              pkg.estadoEntrega === 'Entregado'
                                ? '#dcfce7'
                                : isEnRuta
                                ? '#fef3c7'
                                : '#eff6ff',
                            color:
                              pkg.estadoEntrega === 'Entregado'
                                ? '#166534'
                                : isEnRuta
                                ? '#92400e'
                                : '#1e40af',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {pkg.estadoEntrega === 'Entregado' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {isEnRuta && <Truck className="w-3.5 h-3.5" />}
                          {pkg.estadoEntrega === 'EnAlmacen' && <Clock className="w-3.5 h-3.5" />}
                          {pkg.estadoEntrega === 'Entregado'
                            ? 'Entregado'
                            : isEnRuta
                            ? 'En Camioneta'
                            : 'En Almacén Lince'}
                        </span>
                      </td>

                      {/* Acciones Operativas */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                          {/* Botón Cargar a Camioneta */}
                          {pkg.estadoEntrega === 'EnAlmacen' && (
                            <button
                              onClick={() => handleLoadToCar(pkg)}
                              style={{
                                background: '#2563eb',
                                border: 'none',
                                color: '#ffffff',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Truck className="w-3.5 h-3.5" /> Cargar al Carro
                            </button>
                          )}

                          {/* Botón Confirmar Entrega */}
                          {isEnRuta && (
                            <>
                              <button
                                onClick={() => openConfirmDeliveryModal(pkg)}
                                style={{
                                  background: '#16a34a',
                                  border: 'none',
                                  color: '#ffffff',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '11.5px',
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Check className="w-3.5 h-3.5" /> Entregado
                              </button>

                              <button
                                onClick={() => handleReprogramDelivery(pkg)}
                                title="No entregado / Devolver a almacén para reprogramar"
                                style={{
                                  background: '#fee2e2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Reprogramar
                              </button>
                            </>
                          )}

                          {/* Botón Imprimir Rótulo Térmico */}
                          <button
                            title="Imprimir Rótulo Térmico 4x6"
                            onClick={() => setSelectedThermalPkg(pkg)}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Botón Factura PDF */}
                          {pkg.facturaPdfUrl && (
                            <button
                              title="Ver Factura PDF"
                              onClick={() => onViewPdf(pkg.facturaPdfUrl!)}
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE ENTREGA */}
      {confirmDeliveryPkg && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a' }}>
                <CheckCircle2 className="w-5 h-5" /> Confirmar Entrega de Paquete
              </span>
              <button
                onClick={() => setConfirmDeliveryPkg(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteConfirmDelivery} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                <div><strong>Guía WR:</strong> <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{confirmDeliveryPkg.numeroReciboBodega}</span></div>
                <div><strong>Casillero:</strong> {confirmDeliveryPkg.codigoCasillero}</div>
                <div><strong>Dirección:</strong> {confirmDeliveryPkg.cliente?.direccionEntrega || 'Dirección de entrega'} ({confirmDeliveryPkg.cliente?.distrito || 'Lima'})</div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Nombre de Quien Recibe</label>
                <input
                  type="text"
                  value={deliveryNotes.recibidoPor}
                  onChange={e => setDeliveryNotes({ ...deliveryNotes, recibidoPor: e.target.value })}
                  placeholder="Ej: Juan Pérez (Titular / Familiar)"
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>DNI / Documento del Receptor</label>
                <input
                  type="text"
                  value={deliveryNotes.dniReceptor}
                  onChange={e => setDeliveryNotes({ ...deliveryNotes, dniReceptor: e.target.value })}
                  placeholder="Ej: 72891234"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Observaciones de Entrega</label>
                <input
                  type="text"
                  value={deliveryNotes.observaciones}
                  onChange={e => setDeliveryNotes({ ...deliveryNotes, observaciones: e.target.value })}
                  placeholder="Ej: Entregado en recepción / Firma conforme"
                  className="form-control"
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setConfirmDeliveryPkg(null)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 800 }}>
                  ✓ Confirmar Entrega Exitosa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE HOJA DE RUTA IMPRIMIBLE */}
      {isRouteManifestOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
                <Printer className="w-5 h-5" /> Hoja de Ruta de Reparto AMEX Courier
              </span>
              <button
                onClick={() => setIsRouteManifestOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ border: '2px solid #0f172a', borderRadius: '10px', padding: '16px', background: '#ffffff' }}>
                {/* Cabecera de la Hoja de Ruta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      AMEX COURIER SAC - HOJA DE RUTA DE REPARTO
                    </h2>
                    <div style={{ fontSize: '11px', color: '#475569' }}>Sede Central Lince · Reparto Local a Domicilio</div>
                    <div style={{ fontSize: '11px', color: '#475569' }}>
                      Conductor: <strong>{driverName}</strong> | Vehículo: <strong>{vehiclePlate}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#2563eb' }}>
                      {routeZone}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                      Fecha: {new Date().toLocaleDateString('es-PE')}
                    </div>
                  </div>
                </div>

                {/* Tabla de Paradas */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#334155', fontWeight: 800 }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>#</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Guía WR</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Casillero / Cliente</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Dirección & Distrito</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Teléfono</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Peso (Kg)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', width: '120px' }}>Firma / DNI Receptor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((p, idx) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 800 }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 800 }}>{p.numeroReciboBodega}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ fontWeight: 700 }}>{p.nombreConsignatario || p.cliente?.nombre}</div>
                          <div style={{ fontSize: '10px', color: '#2563eb' }}>{p.codigoCasillero}</div>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <div>{p.cliente?.direccionEntrega || 'Dirección de contacto'}</div>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{p.cliente?.distrito || 'Lima'}</div>
                        </td>
                        <td style={{ padding: '6px 8px' }}>{p.cliente?.telefono || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{p.pesoKg} Kg</td>
                        <td style={{ padding: '6px 8px', borderLeft: '1px solid #e2e8f0', minHeight: '30px' }}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pie de firmas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '40px', paddingTop: '10px' }}>
                  <div style={{ borderTop: '1px dashed #64748b', textAlign: 'center', fontSize: '11px', color: '#475569' }}>
                    Despachado por: Supervisor Almacén Lince
                  </div>
                  <div style={{ borderTop: '1px dashed #64748b', textAlign: 'center', fontSize: '11px', color: '#475569' }}>
                    Conductor Responsable: {driverName}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsRouteManifestOpen(false)}
                className="btn btn-secondary"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary"
                style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer className="w-4 h-4" /> Imprimir Hoja de Ruta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RÓTULO TÉRMICO */}
      {selectedThermalPkg && (
        <ThermalLabelModal
          pkg={selectedThermalPkg}
          onClose={() => setSelectedThermalPkg(null)}
        />
      )}
    </div>
  );
}
