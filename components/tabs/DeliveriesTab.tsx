'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  FileText,
  RefreshCw,
  Plus,
  Calendar,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  DollarSign
} from 'lucide-react';
import { Paquete, Cliente, HojaRuta, DestinoRuta, EstadoDestinoRuta } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { soundEffects } from '@/lib/audio/soundEffects';
import { generateDriverWhatsAppUrl, generateMapsUrl } from '@/lib/whatsappGenerator';
import NewRouteModal from '@/components/modals/NewRouteModal';

interface DeliveriesTabProps {
  paquetes?: Paquete[];
  clientes?: Cliente[];
  onUpdatePackage?: (pkg: Paquete) => void;
  onViewPdf?: (url: string) => void;
  onRefreshData?: () => Promise<void> | void;
  currentUser?: { nombre: string; rol: string } | null;
}

export default function DeliveriesTab({
  paquetes = [],
  clientes = [],
  onUpdatePackage,
  onViewPdf,
  onRefreshData,
  currentUser
}: DeliveriesTabProps) {
  const operatorName = currentUser?.nombre || 'Administración AMEX';

  // Sub-pestañas: 'rutas' | 'chofer' | 'historial' | 'mostrador'
  const [activeSubTab, setActiveSubTab] = useState<'rutas' | 'chofer' | 'historial' | 'mostrador'>('rutas');

  // Estado de Hojas de Ruta
  const [hojasRuta, setHojasRuta] = useState<HojaRuta[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);

  // Modales
  const [isNewRouteModalOpen, setIsNewRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<HojaRuta | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');

  // Acordeón de Historial (Año -> Mes -> Día)
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({ '2026': true });
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  // Cargar Hojas de Ruta desde Supabase / LocalStorage
  const fetchHojasRuta = useCallback(async () => {
    try {
      setIsLoadingRoutes(true);
      const { data, error } = await supabase
        .from('hojas_ruta')
        .select('*')
        .order('fecha_ruta', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: HojaRuta[] = data.map(r => ({
          id: r.id,
          codigoRuta: r.codigo_ruta,
          fechaRuta: r.fecha_ruta,
          choferNombre: r.chofer_nombre || 'Carlos Mendoza',
          choferTelefono: r.chofer_telefono || '987654321',
          vehiculoPlaca: r.vehiculo_placa || 'Toyota Hilux AMEX',
          zonaSector: r.zona_sector || 'Lima Metropolitana',
          estado: r.estado || 'PLANIFICADA',
          totalDestinos: Number(r.total_destinos || 0),
          totalPaquetes: Number(r.total_paquetes || 0),
          montoTotalCobrar: Number(r.monto_total_cobrar || 0),
          destinos: (r.destinos_data as DestinoRuta[]) || [],
          creadoPor: r.creado_por || 'AMEX',
          creadoEn: r.creado_en,
          actualizadoEn: r.actualizado_en
        }));
        setHojasRuta(mapped);
        if (!selectedRouteId && mapped.length > 0) {
          setSelectedRouteId(mapped[0].id);
        }
      } else {
        // Rutas de muestra iniciales si no existen
        const todayStr = new Date().toISOString().split('T')[0];
        const sampleRoute: HojaRuta = {
          id: 'route-sample-01',
          codigoRuta: `RUTA-${todayStr.replace(/-/g, '')}-01`,
          fechaRuta: todayStr,
          choferNombre: 'Carlos Mendoza (Chofer Principal)',
          choferTelefono: '987654321',
          vehiculoPlaca: 'Toyota Hilux AMEX (ABC-123)',
          zonaSector: 'Lima Metropolitana (Centro - Sur)',
          estado: 'EN_RUTA',
          totalDestinos: 3,
          totalPaquetes: 5,
          montoTotalCobrar: 45.0,
          creadoPor: operatorName,
          creadoEn: new Date().toISOString(),
          actualizadoEn: new Date().toISOString(),
          destinos: [
            {
              id: 'dest-01',
              hojaRutaId: 'route-sample-01',
              orden: 1,
              clienteNombre: 'María Torres Pérez',
              clienteCasillero: 'AMEX-PER-1045',
              telefono: '987654321',
              direccion: 'Av. Benavides 1450, Dpto 402',
              distrito: 'MIRAFLORES',
              referencia: 'Frente al parque Reducto',
              codigosWrs: ['WR000451', 'WR000452'],
              cantidadPaquetes: 2,
              pesoTotalKg: 3.5,
              montoCobrar: 25.0,
              monedaCobro: 'PEN',
              notasChofer: 'Tocar intercomunicador 402, conserje autorizado',
              estadoEntrega: 'PENDIENTE'
            },
            {
              id: 'dest-02',
              hojaRutaId: 'route-sample-01',
              orden: 2,
              clienteNombre: 'Juan Carlos Rodríguez',
              clienteCasillero: 'AMEX-PER-2030',
              telefono: '998877665',
              direccion: 'Calle Los Libertadores 320, Of. 601',
              distrito: 'SAN ISIDRO',
              referencia: 'Edificio empresarial Platinum',
              codigosWrs: ['WR000453'],
              cantidadPaquetes: 1,
              pesoTotalKg: 1.2,
              montoCobrar: 0,
              monedaCobro: 'PEN',
              notasChofer: 'Entregar en recepción piso 6',
              estadoEntrega: 'PENDIENTE'
            },
            {
              id: 'dest-03',
              hojaRutaId: 'route-sample-01',
              orden: 3,
              clienteNombre: 'Luciana Valdivia',
              clienteCasillero: 'AMEX-PER-3011',
              telefono: '912345678',
              direccion: 'Av. Primavera 650, Urb. Chacarilla',
              distrito: 'SURCO',
              referencia: 'Puerta blanca portón negro',
              codigosWrs: ['WR000454', 'WR000455'],
              cantidadPaquetes: 2,
              pesoTotalKg: 4.8,
              montoCobrar: 20.0,
              monedaCobro: 'PEN',
              notasChofer: 'Llamar al llegar para que baje a recibir',
              estadoEntrega: 'PENDIENTE'
            }
          ]
        };
        setHojasRuta([sampleRoute]);
        setSelectedRouteId(sampleRoute.id);
      }
    } catch (err) {
      console.error('Error fetching hojas_ruta:', err);
    } finally {
      setIsLoadingRoutes(false);
    }
  }, [selectedRouteId, operatorName]);

  useEffect(() => {
    fetchHojasRuta();
  }, [fetchHojasRuta]);

  // Guardar o actualizar Hoja de Ruta
  const handleSaveHojaRuta = async (route: HojaRuta) => {
    try {
      setHojasRuta(prev => {
        const idx = prev.findIndex(r => r.id === route.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = route;
          return updated;
        }
        return [route, ...prev];
      });
      setSelectedRouteId(route.id);

      // Persistir en Supabase
      await supabase.from('hojas_ruta').upsert({
        id: route.id,
        codigo_ruta: route.codigoRuta,
        fecha_ruta: route.fechaRuta,
        chofer_nombre: route.choferNombre,
        chofer_telefono: route.choferTelefono,
        vehiculo_placa: route.vehiculoPlaca,
        zona_sector: route.zonaSector,
        estado: route.estado,
        total_destinos: route.totalDestinos,
        total_paquetes: route.totalPaquetes,
        monto_total_cobrar: route.montoTotalCobrar,
        destinos_data: route.destinos,
        creado_por: route.creadoPor,
        actualizado_en: new Date().toISOString()
      });

      soundEffects.playSuccess();
    } catch (err) {
      console.error('Error saving route to DB:', err);
    }
  };

  // Actualizar estado de una parada específica (Chofer)
  const handleUpdateDestinoStatus = async (
    routeId: string,
    destinoId: string,
    nextStatus: EstadoDestinoRuta
  ) => {
    const route = hojasRuta.find(r => r.id === routeId);
    if (!route || !route.destinos) return;

    const nowIso = new Date().toISOString();
    const updatedDestinos = route.destinos.map(d =>
      d.id === destinoId
        ? {
            ...d,
            estadoEntrega: nextStatus,
            entregadoEn: nextStatus === 'ENTREGADO' ? nowIso : undefined
          }
        : d
    );

    const allDelivered = updatedDestinos.every(d => d.estadoEntrega === 'ENTREGADO');
    const newRouteStatus = allDelivered ? 'COMPLETADA' : 'EN_RUTA';

    const updatedRoute: HojaRuta = {
      ...route,
      estado: newRouteStatus,
      destinos: updatedDestinos
    };

    setHojasRuta(prev => prev.map(r => (r.id === routeId ? updatedRoute : r)));

    if (nextStatus === 'ENTREGADO') {
      soundEffects.playSuccess();
    }

    // Actualizar paquetes en inventario si se entregaron
    const dest = route.destinos.find(d => d.id === destinoId);
    if (dest && nextStatus === 'ENTREGADO' && dest.codigosWrs.length > 0) {
      for (const wr of dest.codigosWrs) {
        await supabase
          .from('paquetes')
          .update({
            estado_entrega: 'Entregado',
            ubicacion_actual: 'Entregado'
          })
          .eq('numero_recibo_bodega', wr);

        if (onUpdatePackage) {
          const match = paquetes.find(p => p.numeroReciboBodega === wr);
          if (match) {
            onUpdatePackage({
              ...match,
              estadoEntrega: 'Entregado',
              ubicacionActual: 'Entregado'
            });
          }
        }
      }
    }

    // Guardar en Supabase
    await supabase.from('hojas_ruta').upsert({
      id: updatedRoute.id,
      codigo_ruta: updatedRoute.codigoRuta,
      fecha_ruta: updatedRoute.fechaRuta,
      chofer_nombre: updatedRoute.choferNombre,
      chofer_telefono: updatedRoute.choferTelefono,
      vehiculo_placa: updatedRoute.vehiculoPlaca,
      zona_sector: updatedRoute.zonaSector,
      estado: updatedRoute.estado,
      total_destinos: updatedRoute.totalDestinos,
      total_paquetes: updatedRoute.totalPaquetes,
      monto_total_cobrar: updatedRoute.montoTotalCobrar,
      destinos_data: updatedRoute.destinos,
      actualizado_en: nowIso
    });
  };

  // Ruta seleccionada actualmente
  const activeRoute = hojasRuta.find(r => r.id === selectedRouteId) || hojasRuta[0];

  // Agrupación jerárquica para el Historial (Año -> Mes -> Día)
  const historyTree = useMemo(() => {
    const tree: Record<string, Record<string, Record<string, HojaRuta[]>>> = {};

    hojasRuta.forEach(route => {
      const dateParts = route.fechaRuta.split('-'); // [YYYY, MM, DD]
      const year = dateParts[0] || '2026';
      const monthNum = dateParts[1] || '01';
      const day = dateParts[2] || '01';

      const MONTH_NAMES: Record<string, string> = {
        '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
        '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
        '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
      };
      const monthName = MONTH_NAMES[monthNum] || `Mes ${monthNum}`;

      if (!tree[year]) tree[year] = {};
      if (!tree[year][monthName]) tree[year][monthName] = {};
      if (!tree[year][monthName][day]) tree[year][monthName][day] = [];

      tree[year][monthName][day].push(route);
    });

    return tree;
  }, [hojasRuta]);

  const toggleYear = (year: string) => {
    setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: '#f8fafc'
      }}
    >
      {/* ---------------- TOP BAR: HEADER & SUB-TABS ---------------- */}
      <div
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '10px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              flexShrink: 0
            }}
          >
            <Truck style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Despacho Carro AMEX & Hojas de Ruta
            </h1>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
              Gestión de entregas a domicilio, enlaces de WhatsApp para chofer y control histórico
            </p>
          </div>
        </div>

        {/* Sub-Tabs Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('rutas')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: activeSubTab === 'rutas' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'rutas' ? '#1d4ed8' : '#64748b',
              boxShadow: activeSubTab === 'rutas' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <Truck style={{ width: '14px', height: '14px' }} />
            <span>1. Rutas de Reparto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('chofer')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: activeSubTab === 'chofer' ? '#10b981' : 'transparent',
              color: activeSubTab === 'chofer' ? '#ffffff' : '#047857',
              boxShadow: activeSubTab === 'chofer' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <MessageCircle style={{ width: '14px', height: '14px' }} />
            <span>2. 📱 Vista Chofer (WhatsApp)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('historial')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: activeSubTab === 'historial' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'historial' ? '#0f172a' : '#64748b',
              boxShadow: activeSubTab === 'historial' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <Calendar style={{ width: '14px', height: '14px' }} />
            <span>3. 📅 Historial Año/Mes/Día</span>
          </button>
        </div>

        {/* Action Button: Nueva Ruta */}
        <button
          type="button"
          onClick={() => {
            setEditingRoute(null);
            setIsNewRouteModalOpen(true);
          }}
          style={{
            padding: '7px 14px',
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
          <Plus style={{ width: '15px', height: '15px', strokeWidth: 3 }} />
          <span>+ Generar Hoja de Ruta</span>
        </button>
      </div>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ==============================================================
            SUB-TAB 1: PANEL ADMINISTRATIVO DE RUTAS
            ============================================================== */}
        {activeSubTab === 'rutas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Hojas de Ruta</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{hojasRuta.length}</div>
                </div>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <FileText style={{ width: '18px', height: '18px' }} />
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Destinos / Paradas</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                    {hojasRuta.reduce((acc, r) => acc + (r.totalDestinos || 0), 0)}
                  </div>
                </div>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <MapPin style={{ width: '18px', height: '18px' }} />
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Bultos Asignados</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                    {hojasRuta.reduce((acc, r) => acc + (r.totalPaquetes || 0), 0)}
                  </div>
                </div>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7e22ce' }}>
                  <Package style={{ width: '18px', height: '18px' }} />
                </div>
              </div>
            </div>

            {/* Lista de Hojas de Ruta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Hojas de Ruta Registradas</span>
              </div>

              {hojasRuta.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#94a3b8' }}>
                  <Truck style={{ width: '36px', height: '36px', margin: '0 auto 8px', color: '#cbd5e1' }} />
                  <p style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>No hay hojas de ruta creadas</p>
                  <p style={{ fontSize: '11.5px', margin: '4px 0 0 0' }}>Haz clic en "+ Generar Hoja de Ruta" para armar los destinos del chofer.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                  {hojasRuta.map(r => (
                    <div
                      key={r.id}
                      style={{
                        background: '#ffffff',
                        border: selectedRouteId === r.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '13px', color: '#1e40af' }}>
                            {r.codigoRuta}
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '10.5px',
                              fontWeight: 900,
                              background: r.estado === 'COMPLETADA' ? '#ecfdf5' : '#eff6ff',
                              color: r.estado === 'COMPLETADA' ? '#047857' : '#1d4ed8',
                              border: r.estado === 'COMPLETADA' ? '1px solid #a7f3d0' : '1px solid #bfdbfe'
                            }}
                          >
                            {r.estado}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                          📅 Fecha: <b>{r.fechaRuta}</b>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                          👤 Chofer: <b>{r.choferNombre}</b> • 🚗 {r.vehiculoPlaca}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                          📍 Zona: {r.zonaSector}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', fontSize: '11.5px' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>📍 {r.totalDestinos} destinos</span>
                          <span>•</span>
                          <span style={{ fontWeight: 800, color: '#2563eb' }}>📦 {r.totalPaquetes} paquetes</span>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRouteId(r.id);
                            setActiveSubTab('chofer');
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <MessageCircle style={{ width: '13px', height: '13px' }} />
                          <span>Abrir Vista Chofer</span>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRoute(r);
                              setIsNewRouteModalOpen(true);
                            }}
                            style={{ padding: '6px', color: '#2563eb', background: '#eff6ff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                            title="Editar destinos"
                          >
                            <Edit2 style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
            SUB-TAB 2: VISTA CHOFER (CON BOTÓN WHATSAPP DIRECTO)
            ============================================================== */}
        {activeSubTab === 'chofer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Cabecera de la Ruta para el Chofer */}
            <div
              style={{
                background: '#0f172a',
                color: '#ffffff',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 900 }}>🚚 Hoja de Ruta: {activeRoute?.codigoRuta}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '10.5px', fontWeight: 800, background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                    {activeRoute?.estado}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                  Chofer: <b>{activeRoute?.choferNombre}</b> • Fecha: <b>{activeRoute?.fechaRuta}</b> • Vehículo: {activeRoute?.vehiculoPlaca}
                </div>
              </div>

              {/* Selector de Ruta activa */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={selectedRouteId || ''}
                  onChange={e => setSelectedRouteId(e.target.value)}
                  style={{ padding: '6px 10px', background: '#1e293b', color: '#ffffff', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                >
                  {hojasRuta.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.codigoRuta} ({r.fechaRuta})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lista de Destinos / Paradas del Chofer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>
                Destinos a Repartir ({activeRoute?.destinos?.length || 0} Paradas • {activeRoute?.totalPaquetes || 0} Bultos)
              </div>

              {(!activeRoute?.destinos || activeRoute.destinos.length === 0) ? (
                <div style={{ padding: '36px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#94a3b8' }}>
                  Esta hoja de ruta no tiene paradas registradas.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeRoute.destinos.map((dest, idx) => {
                    const isDelivered = dest.estadoEntrega === 'ENTREGADO';
                    const isFailed = dest.estadoEntrega === 'NO_ATENDIO';

                    // Generar link de WhatsApp con mensaje personalizado
                    const waLink = generateDriverWhatsAppUrl({
                      clienteNombre: dest.clienteNombre,
                      telefono: dest.telefono,
                      direccion: dest.direccion,
                      distrito: dest.distrito,
                      codigosWrs: dest.codigosWrs,
                      cantidadPaquetes: dest.cantidadPaquetes,
                      choferNombre: activeRoute.choferNombre,
                      montoCobrar: dest.montoCobrar,
                      monedaCobro: dest.monedaCobro
                    });

                    // Generar link de Google Maps
                    const mapsLink = generateMapsUrl(dest.direccion, dest.distrito);

                    return (
                      <div
                        key={dest.id}
                        style={{
                          background: isDelivered ? '#f0fdf4' : isFailed ? '#fef2f2' : '#ffffff',
                          border: isDelivered ? '1.5px solid #86efac' : isFailed ? '1.5px solid #fca5a5' : '1.5px solid #cbd5e1',
                          borderRadius: '14px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                        }}
                      >
                        {/* Cabecera de la Parada */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: isDelivered ? '#10b981' : '#2563eb',
                                color: '#ffffff',
                                fontSize: '13px',
                                fontWeight: 900,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#0f172a' }}>
                                {dest.clienteNombre}
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                                Casillero: {dest.clienteCasillero || 'AMEX'} • Tel: <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{dest.telefono}</span>
                              </div>
                            </div>
                          </div>

                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 900,
                              background: isDelivered ? '#dcfce7' : isFailed ? '#fee2e2' : '#f1f5f9',
                              color: isDelivered ? '#15803d' : isFailed ? '#b91c1c' : '#475569'
                            }}
                          >
                            {isDelivered ? '✓ ENTREGADO' : isFailed ? '⚠️ NO ATENDIÓ' : '⏳ PENDIENTE'}
                          </span>
                        </div>

                        {/* Dirección y WRs */}
                        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: 600 }}>
                            📍 <b>{dest.direccion}</b> ({dest.distrito})
                            {dest.referencia && <span style={{ color: '#64748b' }}> - Ref: {dest.referencia}</span>}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                              📦 {dest.cantidadPaquetes} {dest.cantidadPaquetes === 1 ? 'Paquete' : 'Paquetes'}
                            </span>
                            {dest.codigosWrs.map(wr => (
                              <span key={wr} style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '11px', background: '#ffffff', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', color: '#0f172a' }}>
                                {wr}
                              </span>
                            ))}

                            {dest.montoCobrar && dest.montoCobrar > 0 ? (
                              <span style={{ fontSize: '11.5px', fontWeight: 900, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                                💰 Cobrar: S/. {dest.montoCobrar.toFixed(2)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Botonera Rápida para el Chofer */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', paddingTop: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {/* 🟢 BOTÓN DIRECTO A WHATSAPP CON MENSAJE */}
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '8px 14px',
                                background: '#25d366',
                                color: '#ffffff',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 900,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 6px rgba(37,211,102,0.3)'
                              }}
                            >
                              <MessageCircle style={{ width: '16px', height: '16px' }} />
                              <span>WhatsApp al Cliente</span>
                            </a>

                            {/* 🗺️ BOTÓN GPS / GOOGLE MAPS */}
                            <a
                              href={mapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '8px 12px',
                                background: '#ffffff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 800,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Navigation style={{ width: '14px', height: '14px' }} />
                              <span>Ver en Maps</span>
                            </a>

                            {/* 📞 LLAMAR */}
                            <a
                              href={`tel:${dest.telefono}`}
                              style={{
                                padding: '8px 12px',
                                background: '#ffffff',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 800,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Phone style={{ width: '14px', height: '14px' }} />
                              <span>Llamar</span>
                            </a>
                          </div>

                          {/* Estados de Entrega (1-clic) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateDestinoStatus(activeRoute.id, dest.id, 'ENTREGADO')}
                              style={{
                                padding: '7px 12px',
                                background: isDelivered ? '#059669' : '#ffffff',
                                color: isDelivered ? '#ffffff' : '#059669',
                                border: '1px solid #059669',
                                borderRadius: '8px',
                                fontSize: '11.5px',
                                fontWeight: 900,
                                cursor: 'pointer'
                              }}
                            >
                              ✓ Entregado
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUpdateDestinoStatus(activeRoute.id, dest.id, 'NO_ATENDIO')}
                              style={{
                                padding: '7px 12px',
                                background: isFailed ? '#dc2626' : '#ffffff',
                                color: isFailed ? '#ffffff' : '#dc2626',
                                border: '1px solid #dc2626',
                                borderRadius: '8px',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              ⚠️ No Atendió
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
            SUB-TAB 3: HISTORIAL POR AÑO > MES > DÍA
            ============================================================== */}
        {activeSubTab === 'historial' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>
              Historial de Despachos Organizado por Año / Mes / Día
            </div>

            {Object.keys(historyTree).length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#94a3b8' }}>
                No hay historial de hojas de ruta aún.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(historyTree).map(([year, months]) => {
                  const isYearOpen = !!expandedYears[year];

                  return (
                    <div
                      key={year}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Cabecera de Año */}
                      <div
                        onClick={() => toggleYear(year)}
                        style={{
                          padding: '12px 16px',
                          background: '#0f172a',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '14px' }}>
                          <Calendar style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
                          <span>Año {year}</span>
                        </div>
                        {isYearOpen ? <ChevronDown style={{ width: '18px', height: '18px' }} /> : <ChevronRight style={{ width: '18px', height: '18px' }} />}
                      </div>

                      {/* Meses */}
                      {isYearOpen && (
                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {Object.entries(months).map(([monthName, days]) => {
                            const monthKey = `${year}-${monthName}`;
                            const isMonthOpen = !!expandedMonths[monthKey];

                            return (
                              <div
                                key={monthKey}
                                style={{
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '8px',
                                  overflow: 'hidden'
                                }}
                              >
                                <div
                                  onClick={() => toggleMonth(monthKey)}
                                  style={{
                                    padding: '10px 14px',
                                    background: '#f8fafc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    fontWeight: 800,
                                    fontSize: '13px',
                                    color: '#1e293b'
                                  }}
                                >
                                  <span>📅 {monthName} ({Object.values(days).flat().length} Hojas de Ruta)</span>
                                  {isMonthOpen ? <ChevronDown style={{ width: '16px', height: '16px' }} /> : <ChevronRight style={{ width: '16px', height: '16px' }} />}
                                </div>

                                {isMonthOpen && (
                                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {Object.entries(days).map(([day, routes]) => (
                                      <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#2563eb' }}>
                                          Día {day}:
                                        </div>

                                        {routes.map(r => (
                                          <div
                                            key={r.id}
                                            style={{
                                              padding: '8px 12px',
                                              background: '#ffffff',
                                              border: '1px solid #cbd5e1',
                                              borderRadius: '6px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              gap: '8px'
                                            }}
                                          >
                                            <div>
                                              <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '12px', color: '#0f172a' }}>
                                                {r.codigoRuta}
                                              </span>
                                              <span style={{ fontSize: '11.5px', color: '#64748b', marginLeft: '8px' }}>
                                                👤 {r.choferNombre} • 📍 {r.totalDestinos} destinos ({r.totalPaquetes} paquetes)
                                              </span>
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedRouteId(r.id);
                                                setActiveSubTab('chofer');
                                              }}
                                              style={{
                                                padding: '4px 10px',
                                                background: '#eff6ff',
                                                color: '#1d4ed8',
                                                border: '1px solid #bfdbfe',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 800,
                                                cursor: 'pointer'
                                              }}
                                            >
                                              Ver Ruta
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Creación / Edición de Ruta */}
      <NewRouteModal
        isOpen={isNewRouteModalOpen}
        onClose={() => setIsNewRouteModalOpen(false)}
        onSave={handleSaveHojaRuta}
        existingRoute={editingRoute}
        clientes={clientes}
        paquetes={paquetes}
        currentUser={currentUser}
      />
    </div>
  );
}
