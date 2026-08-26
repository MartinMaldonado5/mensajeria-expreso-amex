'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  PackageCheck,
  Search,
  Camera,
  UploadCloud,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  Eye,
  Plus,
  ArrowRight,
  MapPin,
  Phone,
  Layers,
  X,
  AlertTriangle,
  RotateCcw,
  Check,
  Store,
  FileText,
  ExternalLink,
  ChevronRight,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Paquete, Cliente } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { exportEntregasToExcel } from '@/lib/excelExport';
import { matchesFuzzySearch } from '@/lib/fuzzySearch';

export interface OrdenEntrega {
  id: string;
  codigo_entrega: string;
  tipo_entrega: string;
  cliente_nombre: string;
  cliente_casillero?: string;
  cliente_documento?: string;
  receptor_nombre?: string;
  receptor_documento?: string;
  receptor_parentesco?: string;
  operador_asignado: string;
  estado: 'PENDIENTE_BUSQUEDA' | 'EN_BUSQUEDA' | 'LISTO_ENTREGA' | 'ENTREGADO';
  total_paquetes: number;
  paquetes_data: Array<{
    id?: string;
    numeroReciboBodega: string;
    descripcion?: string;
    pesoKg?: number;
    posicionEstante?: string;
    encontrado?: boolean;
  }>;
  fotos_evidencia: Array<{
    url: string;
    key?: string;
    fileName?: string;
    fecha?: string;
  }>;
  notas?: string;
  creado_por: string;
  creado_en: string;
  entregado_en?: string;
}

interface EntregasTabProps {
  paquetes: Paquete[];
  clientes: Cliente[];
  onUpdatePackage?: (pkg: Paquete) => void;
  onViewPdf?: (url: string) => void;
}

export default function EntregasTab({
  paquetes,
  clientes,
  onUpdatePackage,
  onViewPdf
}: EntregasTabProps) {
  // Pestaña activa
  const [subtab, setSubtab] = useState<'activas' | 'nueva' | 'historial'>('activas');

  // Estado de órdenes desde Supabase
  const [ordenes, setOrdenes] = useState<OrdenEntrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal de Operario / Picking en Almacén
  const [activePickingOrden, setActivePickingOrden] = useState<OrdenEntrega | null>(null);
  const [pickingChecks, setPickingChecks] = useState<Record<string, boolean>>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ url: string; key?: string; fileName?: string }>>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Datos de receptor al cerrar entrega
  const [receptorForm, setReceptorForm] = useState({
    nombre: '',
    documento: '',
    parentesco: 'Titular'
  });

  // Modal de Visor de Galería Fotográfica
  const [photoViewerData, setPhotoViewerData] = useState<{
    codigo: string;
    cliente: string;
    fotos: Array<{ url: string; fileName?: string }>;
    currentIndex: number;
  } | null>(null);

  // Estado para Crear Nueva Orden
  const [newOrderForm, setNewOrderForm] = useState({
    tipoEntrega: 'RECOJO_TIENDA_LINCE',
    clienteNombre: '',
    clienteCasillero: '',
    clienteDocumento: '',
    operadorAsignado: 'Carlos Mendoza (Almacén Lince)',
    notas: '',
    wrInput: ''
  });
  const [selectedWrsForNewOrder, setSelectedWrsForNewOrder] = useState<Paquete[]>([]);
  const [wrSearchQuery, setWrSearchQuery] = useState('');

  // 1. Cargar Órdenes desde Supabase
  const fetchOrdenes = async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from('entregas_ordenes')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) {
        console.error('Error fetching entregas_ordenes:', error);
      } else if (data) {
        setOrdenes(data as OrdenEntrega[]);
      }
    } catch (err) {
      console.error('Error en fetchOrdenes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrdenes();

    // Suscripción en Tiempo Real
    const channel = supabase
      .channel('realtime_entregas_ordenes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entregas_ordenes' },
        () => {
          fetchOrdenes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. Filtrado de órdenes con Motor Fuzzy Inteligente
  const filteredOrdenes = useMemo(() => {
    return ordenes.filter(o => {
      const wrsString = Array.isArray(o.paquetes_data)
        ? o.paquetes_data.map(p => p.numeroReciboBodega).join(' ')
        : '';
      const estantesString = Array.isArray(o.paquetes_data)
        ? o.paquetes_data.map(p => p.posicionEstante || '').join(' ')
        : '';

      const matchSearch = matchesFuzzySearch(searchTerm, [
        o.codigo_entrega,
        o.cliente_nombre,
        o.cliente_casillero,
        o.cliente_documento,
        o.receptor_nombre,
        o.receptor_documento,
        o.receptor_parentesco,
        o.operador_asignado,
        o.tipo_entrega,
        o.notas,
        wrsString,
        estantesString
      ]);

      if (!matchSearch) return false;

      if (statusFilter !== 'ALL' && o.estado !== statusFilter) {
        return false;
      }

      if (subtab === 'activas') {
        return o.estado !== 'ENTREGADO';
      } else if (subtab === 'historial') {
        return o.estado === 'ENTREGADO';
      }
      return true;
    });
  }, [ordenes, searchTerm, subtab, statusFilter]);

  // Contadores de estados
  const metrics = useMemo(() => {
    const pendientes = ordenes.filter(o => o.estado === 'PENDIENTE_BUSQUEDA').length;
    const enBusqueda = ordenes.filter(o => o.estado === 'EN_BUSQUEDA').length;
    const listos = ordenes.filter(o => o.estado === 'LISTO_ENTREGA').length;
    const entregados = ordenes.filter(o => o.estado === 'ENTREGADO').length;
    return { pendientes, enBusqueda, listos, entregados, total: ordenes.length };
  }, [ordenes]);

  // Paquetes en almacén central Lince disponibles para entregar con Motor Fuzzy
  const paquetesDisponibles = useMemo(() => {
    return paquetes.filter(p => {
      const matchWR = matchesFuzzySearch(wrSearchQuery, [
        p.numeroReciboBodega,
        p.codigoCasillero,
        p.nombreConsignatario,
        p.dniConsignatario,
        p.posicionEstante,
        p.anaquel,
        p.piso,
        p.trackingUsa
      ]);

      return matchWR && p.estadoEntrega !== 'Entregado';
    });
  }, [paquetes, wrSearchQuery]);

  // 3. Crear Nueva Orden de Búsqueda / Entrega
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedWrsForNewOrder.length === 0 && !newOrderForm.wrInput.trim()) {
      alert('Debes agregar al menos 1 paquete WR a la lista de búsqueda.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSeq = Math.floor(100 + Math.random() * 900);
    const codigoEntrega = `ENT-${todayStr}-${randomSeq}`;

    // Construir paquetes data
    const paquetesList: OrdenEntrega['paquetes_data'] = [
      ...selectedWrsForNewOrder.map(p => ({
        id: p.id,
        numeroReciboBodega: p.numeroReciboBodega,
        descripcion: p.descripcion,
        pesoKg: p.pesoKg,
        posicionEstante: p.posicionEstante || 'A1-P1',
        encontrado: false
      }))
    ];

    // Si escribió WRs manuales separados por coma
    if (newOrderForm.wrInput.trim()) {
      const manualWrs = newOrderForm.wrInput
        .split(/[\n,;]+/)
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length > 0);

      manualWrs.forEach(wr => {
        if (!paquetesList.some(p => p.numeroReciboBodega === wr)) {
          const matchPkg = paquetes.find(p => p.numeroReciboBodega.toUpperCase() === wr);
          paquetesList.push({
            id: matchPkg?.id,
            numeroReciboBodega: wr,
            descripcion: matchPkg?.descripcion || 'Carga general en mostrador',
            pesoKg: matchPkg?.pesoKg || 1,
            posicionEstante: matchPkg?.posicionEstante || 'ALMACEN LINCE',
            encontrado: false
          });
        }
      });
    }

    const payload = {
      codigo_entrega: codigoEntrega,
      tipo_entrega: newOrderForm.tipoEntrega,
      cliente_nombre: newOrderForm.clienteNombre || 'Cliente Mostrador',
      cliente_casillero: newOrderForm.clienteCasillero || '',
      cliente_documento: newOrderForm.clienteDocumento || '',
      operador_asignado: newOrderForm.operadorAsignado,
      estado: 'PENDIENTE_BUSQUEDA',
      total_paquetes: paquetesList.length,
      paquetes_data: paquetesList,
      fotos_evidencia: [],
      notas: newOrderForm.notas,
      creado_por: 'Administración AMEX',
      creado_en: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('entregas_ordenes').insert([payload]);
      if (error) throw error;

      alert(`✅ Lista de Búsqueda ${codigoEntrega} creada y asignada a ${newOrderForm.operadorAsignado}.`);
      setNewOrderForm({
        tipoEntrega: 'RECOJO_TIENDA_LINCE',
        clienteNombre: '',
        clienteCasillero: '',
        clienteDocumento: '',
        operadorAsignado: 'Carlos Mendoza (Almacén Lince)',
        notas: '',
        wrInput: ''
      });
      setSelectedWrsForNewOrder([]);
      setSubtab('activas');
      fetchOrdenes();
    } catch (err: any) {
      console.error('Error al crear orden de entrega:', err);
      alert('Error al crear la orden: ' + (err.message || 'Error desconocido'));
    }
  };

  // 4. Abrir Orden en Modo Operario / Picking
  const handleOpenPicking = (orden: OrdenEntrega) => {
    setActivePickingOrden(orden);
    const checks: Record<string, boolean> = {};
    if (Array.isArray(orden.paquetes_data)) {
      orden.paquetes_data.forEach(p => {
        checks[p.numeroReciboBodega] = p.encontrado || false;
      });
    }
    setPickingChecks(checks);
    setUploadedPhotos(Array.isArray(orden.fotos_evidencia) ? orden.fotos_evidencia : []);
    setReceptorForm({
      nombre: orden.receptor_nombre || orden.cliente_nombre || '',
      documento: orden.receptor_documento || orden.cliente_documento || '',
      parentesco: orden.receptor_parentesco || 'Titular'
    });
  };

  // 5. Toggle de paquete encontrado
  const handleToggleCheck = (wr: string) => {
    setPickingChecks(prev => ({
      ...prev,
      [wr]: !prev[wr]
    }));
  };

  // 6. Subir Múltiples Fotos de Evidencia a Cloudflare R2
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activePickingOrden) return;

    setIsUploadingPhoto(true);
    setUploadProgress(`Subiendo 0 de ${files.length} fotos a Cloudflare R2...`);

    const newPhotos: Array<{ url: string; key?: string; fileName?: string; fecha?: string }> = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Subiendo foto ${i + 1} de ${files.length} (${file.name})...`);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'entregas');
        formData.append('codigoEntrega', activePickingOrden.codigo_entrega);
        formData.append('clienteNombre', activePickingOrden.cliente_nombre);
        formData.append('receptorNombre', receptorForm.nombre || activePickingOrden.cliente_nombre);

        const res = await fetch('/api/storage/upload', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Fallo al subir foto ${file.name}`);
        }

        const data = await res.json();
        newPhotos.push({
          url: data.url,
          key: data.key,
          fileName: file.name,
          fecha: new Date().toISOString()
        });
      }

      const updatedList = [...uploadedPhotos, ...newPhotos];
      setUploadedPhotos(updatedList);

      // Guardar fotos en tiempo real en la orden de Supabase
      await supabase
        .from('entregas_ordenes')
        .update({ fotos_evidencia: updatedList })
        .eq('id', activePickingOrden.id);

      alert(`📸 ¡${newPhotos.length} foto(s) de evidencia subida(s) con éxito a Cloudflare R2!`);
    } catch (err: any) {
      console.error('Error subiendo fotos:', err);
      alert('Error al subir fotos de evidencia: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsUploadingPhoto(false);
      setUploadProgress('');
      if (e.target) e.target.value = '';
    }
  };

  // 7. Eliminar Foto de la lista
  const handleDeletePhoto = async (indexToDelete: number) => {
    if (!confirm('¿Deseas quitar esta foto de evidencia de la entrega?')) return;
    const updated = uploadedPhotos.filter((_, idx) => idx !== indexToDelete);
    setUploadedPhotos(updated);

    if (activePickingOrden) {
      await supabase
        .from('entregas_ordenes')
        .update({ fotos_evidencia: updated })
        .eq('id', activePickingOrden.id);
    }
  };

  // 8. Confirmar y Cerrar Entrega Final
  const handleFinalizarEntrega = async () => {
    if (!activePickingOrden) return;

    if (!receptorForm.nombre.trim()) {
      alert('Por favor ingresa el nombre de la persona que retira los paquetes.');
      return;
    }

    if (uploadedPhotos.length === 0) {
      const proceedWithoutPhotos = confirm(
        '⚠️ No has subido ninguna foto de evidencia. ¿Deseas cerrar la entrega sin fotos?'
      );
      if (!proceedWithoutPhotos) return;
    }

    // Actualizar paquetes_data con status de encontrados
    const updatedPaquetesData = activePickingOrden.paquetes_data.map(p => ({
      ...p,
      encontrado: pickingChecks[p.numeroReciboBodega] !== false
    }));

    try {
      // 1. Actualizar orden en Supabase
      const { error: ordenErr } = await supabase
        .from('entregas_ordenes')
        .update({
          estado: 'ENTREGADO',
          receptor_nombre: receptorForm.nombre,
          receptor_documento: receptorForm.documento,
          receptor_parentesco: receptorForm.parentesco,
          paquetes_data: updatedPaquetesData,
          fotos_evidencia: uploadedPhotos,
          entregado_en: new Date().toISOString()
        })
        .eq('id', activePickingOrden.id);

      if (ordenErr) throw ordenErr;

      // 2. Actualizar estado de paquetes en tabla `paquetes` y Kardex
      const wrList = activePickingOrden.paquetes_data.map(p => p.numeroReciboBodega);
      for (const wr of wrList) {
        // Actualizar paquete a 'Entregado'
        const matchPkg = paquetes.find(p => p.numeroReciboBodega === wr);
        if (matchPkg) {
          await supabase
            .from('paquetes')
            .update({
              estado_entrega: 'Entregado',
              actualizado_en: new Date().toISOString()
            })
            .eq('id', matchPkg.id);

          if (onUpdatePackage) {
            onUpdatePackage({
              ...matchPkg,
              estadoEntrega: 'Entregado'
            });
          }

          // Registrar movimiento en Kardex
          await supabase.from('movimientos_kardex').insert([
            {
              paquete_id: matchPkg.id,
              numero_recibo_bodega: wr,
              codigo_casillero: matchPkg.codigoCasillero,
              tipo_movimiento: 'ENTREGA',
              estado_anterior: matchPkg.estadoEntrega || 'EnAlmacenLince',
              estado_nuevo: 'Entregado',
              origen: matchPkg.posicionEstante || 'Almacén Central Lince',
              destino: `Entregado en Mostrador a: ${receptorForm.nombre} (${receptorForm.parentesco}) - Orden: ${activePickingOrden.codigo_entrega}`,
              operador: activePickingOrden.operador_asignado || 'Carlos Mendoza',
              fecha_movimiento: new Date().toISOString()
            }
          ]);
        }
      }

      alert(
        `🎉 ¡ENTREGA COMPLETADA EXITOSAMENTE!\n\nOrden: ${activePickingOrden.codigo_entrega}\nReceptor: ${receptorForm.nombre}\nTotal Paquetes: ${wrList.length}\nEvidencias en Cloudflare R2: ${uploadedPhotos.length} fotos guardadas.`
      );

      setActivePickingOrden(null);
      fetchOrdenes();
      setSubtab('historial');
    } catch (err: any) {
      console.error('Error al finalizar entrega:', err);
      alert('Error al finalizar la entrega: ' + (err.message || 'Error desconocido'));
    }
  };

  return (
    <div className="tab-container" style={{ padding: '16px 20px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* CABECERA PRINCIPAL */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '16px'
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 900,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <PackageCheck className="w-7 h-7 text-blue-600" /> Control de Entregas & Búsqueda de WRs
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
            Asignación de picking en almacén, recojo en mostrador y evidencias fotográficas automáticas en Cloudflare R2
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn"
            onClick={fetchOrdenes}
            disabled={refreshing}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700
            }}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
          </button>

          <button
            className="btn"
            onClick={() => exportEntregasToExcel(ordenes)}
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700
            }}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Excel (.xlsx)
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setSubtab('nueva')}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800
            }}
          >
            <Plus className="w-4 h-4" /> Nueva Orden de Búsqueda
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        <div
          onClick={() => {
            setSubtab('activas');
            setStatusFilter('ALL');
          }}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px',
            cursor: 'pointer',
            borderLeft: '4px solid #3b82f6',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Órdenes Activas
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e3a8a', marginTop: '4px' }}>
            {metrics.pendientes + metrics.enBusqueda + metrics.listos}
          </div>
          <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '2px', fontWeight: 700 }}>
            {metrics.pendientes} pendientes · {metrics.enBusqueda} en búsqueda
          </div>
        </div>

        <div
          onClick={() => {
            setSubtab('activas');
            setStatusFilter('PENDIENTE_BUSQUEDA');
          }}
          style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: '12px',
            padding: '14px 16px',
            cursor: 'pointer',
            borderLeft: '4px solid #f59e0b'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
            Pendientes de Picking
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#92400e', marginTop: '4px' }}>
            {metrics.pendientes}
          </div>
          <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>Por buscar en almacén</div>
        </div>

        <div
          onClick={() => {
            setSubtab('activas');
            setStatusFilter('LISTO_ENTREGA');
          }}
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '14px 16px',
            cursor: 'pointer',
            borderLeft: '4px solid #22c55e'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
            Listos en Mostrador
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#166534', marginTop: '4px' }}>
            {metrics.listos}
          </div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>Esperando retiro / fotos</div>
        </div>

        <div
          onClick={() => {
            setSubtab('historial');
            setStatusFilter('ALL');
          }}
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px',
            cursor: 'pointer',
            borderLeft: '4px solid #64748b'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
            Total Entregados
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            {metrics.entregados}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Con evidencias en R2</div>
        </div>
      </div>

      {/* PESTAÑAS SECUNDARIAS */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '2px'
        }}
      >
        <button
          onClick={() => setSubtab('activas')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: subtab === 'activas' ? '#2563eb' : '#64748b',
            borderBottom: subtab === 'activas' ? '3px solid #2563eb' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Clock className="w-4 h-4" /> Órdenes de Búsqueda Activas ({metrics.pendientes + metrics.enBusqueda + metrics.listos})
        </button>

        <button
          onClick={() => setSubtab('nueva')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: subtab === 'nueva' ? '#2563eb' : '#64748b',
            borderBottom: subtab === 'nueva' ? '3px solid #2563eb' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Plus className="w-4 h-4" /> ➕ Crear Orden de Búsqueda
        </button>

        <button
          onClick={() => setSubtab('historial')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: subtab === 'historial' ? '#2563eb' : '#64748b',
            borderBottom: subtab === 'historial' ? '3px solid #2563eb' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Historial de Entregas & Evidencias ({metrics.entregados})
        </button>
      </div>

      {/* SUBTAB 1: ÓRDENES ACTIVAS & HISTORIAL */}
      {(subtab === 'activas' || subtab === 'historial') && (
        <div>
          {/* BARRA DE BÚSQUEDA Y FILTRO */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              background: '#ffffff',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 300px' }}>
              <Search
                className="w-4 h-4 text-slate-400"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Buscar por Código ENT-, Guía WR, Cliente o DNI..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="form-control"
                style={{ paddingLeft: '36px', height: '40px', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Estado:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="form-control"
                style={{ height: '40px', fontSize: '13px', width: 'auto' }}
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PENDIENTE_BUSQUEDA">Pendiente de Búsqueda</option>
                <option value="EN_BUSQUEDA">En Búsqueda en Almacén</option>
                <option value="LISTO_ENTREGA">Listo en Mostrador</option>
                <option value="ENTREGADO">Entregado</option>
              </select>
            </div>
          </div>

          {/* LISTA / TABLA DE ÓRDENES */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 700 }}>Cargando órdenes de entrega...</div>
            </div>
          ) : filteredOrdenes.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '50px 20px',
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1'
              }}
            >
              <PackageCheck className="w-12 h-12 text-slate-300" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#334155' }}>
                No se encontraron órdenes de entrega
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                {subtab === 'activas'
                  ? 'No hay listas de búsqueda pendientes. ¡Crea una nueva orden para que los operarios inicien!'
                  : 'Aún no se registran entregas finalizadas.'}
              </p>
              {subtab === 'activas' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setSubtab('nueva')}
                  style={{ marginTop: '16px' }}
                >
                  <Plus className="w-4 h-4" /> Crear Primera Orden
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredOrdenes.map(orden => {
                const totalWrs = Array.isArray(orden.paquetes_data) ? orden.paquetes_data.length : 0;
                const totalFotos = Array.isArray(orden.fotos_evidencia) ? orden.fotos_evidencia.length : 0;

                return (
                  <div
                    key={orden.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      padding: '16px 20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* FILA SUPERIOR */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontSize: '15px',
                            fontWeight: 900,
                            color: '#1e40af',
                            letterSpacing: '-0.2px'
                          }}
                        >
                          {orden.codigo_entrega}
                        </span>

                        {/* BADGE DE ESTADO */}
                        {orden.estado === 'PENDIENTE_BUSQUEDA' && (
                          <span
                            style={{
                              background: '#fef3c7',
                              color: '#b45309',
                              padding: '4px 10px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 800
                            }}
                          >
                            ⏳ Pendiente Búsqueda
                          </span>
                        )}
                        {orden.estado === 'EN_BUSQUEDA' && (
                          <span
                            style={{
                              background: '#e0e7ff',
                              color: '#4338ca',
                              padding: '4px 10px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 800
                            }}
                          >
                            🏃 Operario en Almacén
                          </span>
                        )}
                        {orden.estado === 'LISTO_ENTREGA' && (
                          <span
                            style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '4px 10px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 800
                            }}
                          >
                            📦 Listo en Mostrador
                          </span>
                        )}
                        {orden.estado === 'ENTREGADO' && (
                          <span
                            style={{
                              background: '#ecfdf5',
                              color: '#065f46',
                              padding: '4px 10px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ENTREGADO
                          </span>
                        )}

                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                        >
                          {orden.tipo_entrega.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* ACCIONES */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {totalFotos > 0 && (
                          <button
                            className="btn"
                            onClick={() =>
                              setPhotoViewerData({
                                codigo: orden.codigo_entrega,
                                cliente: orden.cliente_nombre,
                                fotos: orden.fotos_evidencia,
                                currentIndex: 0
                              })
                            }
                            style={{
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              color: '#166534',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '12px',
                              fontWeight: 800
                            }}
                          >
                            <ImageIcon className="w-4 h-4 text-emerald-600" /> Ver {totalFotos} Fotos R2
                          </button>
                        )}

                        {orden.estado !== 'ENTREGADO' ? (
                          <button
                            className="btn btn-primary"
                            onClick={() => handleOpenPicking(orden)}
                            style={{
                              background: '#2563eb',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '13px',
                              fontWeight: 800
                            }}
                          >
                            <Camera className="w-4 h-4" /> Atender & Subir Fotos
                          </button>
                        ) : (
                          <button
                            className="btn"
                            onClick={() => handleOpenPicking(orden)}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '12px',
                              fontWeight: 700
                            }}
                          >
                            <Eye className="w-4 h-4 text-slate-600" /> Ver Expediente
                          </button>
                        )}
                      </div>
                    </div>

                    {/* DATOS DEL CLIENTE Y OPERARIO */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '10px',
                        background: '#f8fafc',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <div>
                        <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                          Cliente Consignatario:
                        </span>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>
                          {orden.cliente_nombre} {orden.cliente_casillero && `(${orden.cliente_casillero})`}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                          Operario Asignado:
                        </span>
                        <div style={{ fontWeight: 700, color: '#334155' }}>
                          👷 {orden.operador_asignado}
                        </div>
                      </div>

                      {orden.receptor_nombre && (
                        <div>
                          <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                            Retirado por:
                          </span>
                          <div style={{ fontWeight: 800, color: '#065f46' }}>
                            👤 {orden.receptor_nombre} ({orden.receptor_parentesco || 'Titular'})
                          </div>
                        </div>
                      )}

                      <div>
                        <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                          Fecha y Hora:
                        </span>
                        <div style={{ color: '#475569' }}>
                          {orden.entregado_en
                            ? `Entregado: ${new Date(orden.entregado_en).toLocaleString('es-PE')}`
                            : `Creado: ${new Date(orden.creado_en).toLocaleString('es-PE')}`}
                        </div>
                      </div>
                    </div>

                    {/* LISTA DE PAQUETES WRS DE LA ORDEN */}
                    <div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#475569',
                          marginBottom: '6px',
                          textTransform: 'uppercase'
                        }}
                      >
                        Paquetes Asignados ({totalWrs}):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {Array.isArray(orden.paquetes_data) &&
                          orden.paquetes_data.map((p, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: p.encontrado ? '#ecfdf5' : '#ffffff',
                                border: p.encontrado ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px'
                              }}
                            >
                              <span style={{ fontWeight: 900, color: '#1e3a8a' }}>{p.numeroReciboBodega}</span>
                              {p.posicionEstante && (
                                <span
                                  style={{
                                    background: '#eff6ff',
                                    color: '#1e40af',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 800
                                  }}
                                >
                                  📍 {p.posicionEstante}
                                </span>
                              )}
                              {p.encontrado && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: CREAR NUEVA ORDEN DE BÚSQUEDA */}
      {subtab === 'nueva' && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <Plus className="w-6 h-6 text-blue-600" />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                Emitir Lista de Búsqueda de WRs para Operario
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                Selecciona los paquetes en almacén o escribe la lista de WRs para que el operario los ubique y entregue
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* GRID DE DATOS BÁSICOS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                  Nombre del Cliente / Consignatario *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez García"
                  value={newOrderForm.clienteNombre}
                  onChange={e => setNewOrderForm({ ...newOrderForm, clienteNombre: e.target.value })}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                  Código de Casillero
                </label>
                <input
                  type="text"
                  placeholder="Ej: CAS-4021"
                  value={newOrderForm.clienteCasillero}
                  onChange={e => setNewOrderForm({ ...newOrderForm, clienteCasillero: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                  Operario Asignado en Almacén *
                </label>
                <select
                  value={newOrderForm.operadorAsignado}
                  onChange={e => setNewOrderForm({ ...newOrderForm, operadorAsignado: e.target.value })}
                  className="form-control"
                  required
                >
                  <option value="Carlos Mendoza (Almacén Lince)">Carlos Mendoza (Almacén Lince)</option>
                  <option value="Rosa Quispe (Almacén Central)">Rosa Quispe (Almacén Central)</option>
                  <option value="Operario de Turno (Lince)">Operario de Turno (Lince)</option>
                  <option value="Mostrador Central">Mostrador Central</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                  Tipo de Entrega
                </label>
                <select
                  value={newOrderForm.tipoEntrega}
                  onChange={e => setNewOrderForm({ ...newOrderForm, tipoEntrega: e.target.value })}
                  className="form-control"
                >
                  <option value="RECOJO_TIENDA_LINCE">Recojo en Tienda (Sede Central Lince)</option>
                  <option value="AGENCIA_SHALOM">Despacho para Agencia (Shalom / Marvisur)</option>
                  <option value="CARRO_AMEX">Despacho en Carro AMEX a Domicilio</option>
                </select>
              </div>
            </div>

            {/* SELECCIONADOR DE WRS DESDE EL INVENTARIO DISPONIBLE */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                background: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                  📦 Seleccionar Paquetes desde Inventario de Almacén Lince
                </span>
                <div style={{ position: 'relative', width: '260px' }}>
                  <Search className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Filtrar por WR o Casillero..."
                    value={wrSearchQuery}
                    onChange={e => setWrSearchQuery(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: '32px', height: '34px', fontSize: '12px' }}
                  />
                </div>
              </div>

              {/* LISTA RÁPIDA DE WRS */}
              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px'
                }}
              >
                {paquetesDisponibles.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    No hay paquetes coincidentes en el inventario actual.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px' }}>
                    {paquetesDisponibles.slice(0, 30).map(pkg => {
                      const isSelected = selectedWrsForNewOrder.some(p => p.id === pkg.id);
                      return (
                        <div
                          key={pkg.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedWrsForNewOrder(selectedWrsForNewOrder.filter(p => p.id !== pkg.id));
                            } else {
                              setSelectedWrsForNewOrder([...selectedWrsForNewOrder, pkg]);
                              if (!newOrderForm.clienteNombre && pkg.nombreConsignatario) {
                                setNewOrderForm(prev => ({
                                  ...prev,
                                  clienteNombre: pkg.nombreConsignatario || '',
                                  clienteCasillero: pkg.codigoCasillero || ''
                                }));
                              }
                            }
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            border: isSelected ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '12px'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, color: '#1e3a8a' }}>{pkg.numeroReciboBodega}</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>
                              {pkg.posicionEstante ? `📍 ${pkg.posicionEstante}` : 'Sin anaquel'} · {pkg.pesoKg || 0} Kg
                            </div>
                          </div>
                          <input type="checkbox" checked={isSelected} readOnly />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* WRS SELECCIONADOS */}
              {selectedWrsForNewOrder.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534' }}>
                    Seleccionados ({selectedWrsForNewOrder.length}):
                  </span>
                  {selectedWrsForNewOrder.map(p => (
                    <span
                      key={p.id}
                      style={{
                        background: '#dcfce7',
                        border: '1px solid #86efac',
                        color: '#14532d',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {p.numeroReciboBodega}
                      <X
                        className="w-3 h-3 cursor-pointer text-emerald-800"
                        onClick={() => setSelectedWrsForNewOrder(selectedWrsForNewOrder.filter(x => x.id !== p.id))}
                      />
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* O ENTRADA MANUAL DE WRS */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                O escribe los WRs directamente (separados por coma o salto de línea):
              </label>
              <textarea
                rows={2}
                placeholder="Ej: WR-10452, WR-10453, WR-10454"
                value={newOrderForm.wrInput}
                onChange={e => setNewOrderForm({ ...newOrderForm, wrInput: e.target.value })}
                className="form-control"
                style={{ fontSize: '13px' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Notas / Instrucciones</label>
              <input
                type="text"
                placeholder="Ej: Cliente viene en moto a las 3:00 PM, tener en mostrador"
                value={newOrderForm.notas}
                onChange={e => setNewOrderForm({ ...newOrderForm, notas: e.target.value })}
                className="form-control"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setSubtab('activas')}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontWeight: 700 }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  background: '#2563eb',
                  padding: '12px 24px',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Plus className="w-5 h-5" /> Emitir Lista y Notificar a Operario
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL FLOTANTE DE OPERARIO: PICKING + EVIDENCIAS FOTOGRÁFICAS EN CLOUDFLARE R2 */}
      {activePickingOrden && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '720px', width: '100%', maxHeight: '92vh' }}>
            <div className="modal-header" style={{ background: '#1e293b', color: '#ffffff' }}>
              <div>
                <span className="modal-title" style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PackageCheck className="w-5 h-5 text-blue-400" />
                  Atención de Entrega: {activePickingOrden.codigo_entrega}
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Cliente: {activePickingOrden.cliente_nombre} {activePickingOrden.cliente_casillero && `(${activePickingOrden.cliente_casillero})`}
                </span>
              </div>
              <button
                onClick={() => setActivePickingOrden(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#ffffff', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* PASO 1: CHECKLIST DE WRS EN ALMACÉN */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                    1️⃣ Checklist de Paquetes en Anaqueles:
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                    Toca para marcar como encontrado
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Array.isArray(activePickingOrden.paquetes_data) &&
                    activePickingOrden.paquetes_data.map((p, idx) => {
                      const isFound = pickingChecks[p.numeroReciboBodega] !== false;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleToggleCheck(p.numeroReciboBodega)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: isFound ? '#ecfdf5' : '#ffffff',
                            border: isFound ? '1.5px solid #22c55e' : '1.5px solid #cbd5e1',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 900, color: isFound ? '#15803d' : '#0f172a', fontSize: '14px' }}>
                              {p.numeroReciboBodega}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {p.descripcion || 'Paquete'} · {p.pesoKg || 0} Kg
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              style={{
                                background: '#eff6ff',
                                color: '#1e40af',
                                border: '1px solid #bfdbfe',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 800
                              }}
                            >
                              📍 Ubicación: {p.posicionEstante || 'ALMACEN LINCE'}
                            </span>
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: isFound ? '#22c55e' : '#e2e8f0',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px'
                              }}
                            >
                              {isFound && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* PASO 2: CAPTURA DE MÚLTIPLES FOTOS DE EVIDENCIA EN CLOUDFLARE R2 */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1.5px dashed #86efac',
                  borderRadius: '10px',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: '#14532d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera className="w-4 h-4 text-emerald-600" />
                    2️⃣ Evidencias Fotográficas (Cloudflare R2):
                  </span>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 800 }}>
                    {uploadedPhotos.length} fotos listas
                  </span>
                </div>

                <p style={{ fontSize: '11px', color: '#166534', marginBottom: '10px' }}>
                  Toma fotos de los paquetes entregados, DNI de quien recoge o cliente recibiendo. Se guardan automáticamente en:
                  <br />
                  <code style={{ fontSize: '10px', color: '#065f46', background: '#dcfce7', padding: '2px 4px', borderRadius: '4px' }}>
                    FOLDER AMEX/entregas/YYYY/MM/DD/{activePickingOrden.codigo_entrega}_{activePickingOrden.cliente_nombre}/
                  </code>
                </p>

                {/* BOTÓN DE CAPTURA / CÁMARA */}
                <div style={{ marginBottom: '12px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      background: '#16a34a',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontWeight: 800,
                      cursor: isUploadingPhoto ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    <Camera className="w-5 h-5" />
                    {isUploadingPhoto ? uploadProgress || 'Subiendo fotos a Cloudflare R2...' : '📸 Tomar Foto con Celular / Adjuntar Fotos'}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {/* MINIATURAS DE FOTOS SUBIDAS */}
                {uploadedPhotos.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                      gap: '8px'
                    }}
                  >
                    {uploadedPhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid #cbd5e1',
                          height: '90px',
                          background: '#000000'
                        }}
                      >
                        <img
                          src={photo.url}
                          alt={`Evidencia ${idx + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() =>
                            setPhotoViewerData({
                              codigo: activePickingOrden.codigo_entrega,
                              cliente: activePickingOrden.cliente_nombre,
                              fotos: uploadedPhotos,
                              currentIndex: idx
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(idx)}
                          style={{
                            position: 'absolute',
                            top: '3px',
                            right: '3px',
                            background: 'rgba(239, 68, 68, 0.9)',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PASO 3: DATOS DE QUIEN RECIBE */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginBottom: '10px' }}>
                  3️⃣ Datos de Quien Retira los Paquetes:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>
                      Nombre Completo Receptor *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Juan Pérez"
                      value={receptorForm.nombre}
                      onChange={e => setReceptorForm({ ...receptorForm, nombre: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>
                      DNI / Documento Receptor
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 74839201"
                      value={receptorForm.documento}
                      onChange={e => setReceptorForm({ ...receptorForm, documento: e.target.value })}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>
                      Parentesco / Relación
                    </label>
                    <select
                      value={receptorForm.parentesco}
                      onChange={e => setReceptorForm({ ...receptorForm, parentesco: e.target.value })}
                      className="form-control"
                    >
                      <option value="Titular">Titular del Casillero</option>
                      <option value="Familiar">Familiar Autorizado</option>
                      <option value="Mensajero / Courier">Mensajero / Courier Tercero</option>
                      <option value="Empresa de Envíos (Shalom/Marvisur)">Empresa de Envíos</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setActivePickingOrden(null)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontWeight: 700 }}
              >
                Guardar Progreso y Salir
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleFinalizarEntrega}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  padding: '10px 20px',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckCircle2 className="w-5 h-5" /> Confirmar & Cerrar Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISOR DE GALERÍA FOTOGRÁFICA EN ALTA RESOLUCIÓN */}
      {photoViewerData && (
        <div className="modal-backdrop" onClick={() => setPhotoViewerData(null)}>
          <div
            className="modal-dialog"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '850px',
              width: '95%',
              background: '#0f172a',
              color: '#ffffff',
              border: '1px solid #334155'
            }}
          >
            <div className="modal-header" style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
              <div>
                <span className="modal-title" style={{ color: '#ffffff' }}>
                  📸 Evidencias de Entrega - {photoViewerData.codigo}
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>
                  Cliente: {photoViewerData.cliente} (Foto {photoViewerData.currentIndex + 1} de {photoViewerData.fotos.length})
                </span>
              </div>
              <button
                onClick={() => setPhotoViewerData(null)}
                style={{ background: 'none', border: 'none', fontSize: '22px', color: '#ffffff', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div
              className="modal-body"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#020617',
                minHeight: '400px',
                padding: '10px'
              }}
            >
              {photoViewerData.fotos[photoViewerData.currentIndex] ? (
                <img
                  src={photoViewerData.fotos[photoViewerData.currentIndex].url}
                  alt="Foto evidencia"
                  style={{
                    maxHeight: '65vh',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }}
                />
              ) : (
                <div style={{ color: '#64748b' }}>No se pudo cargar la imagen</div>
              )}
            </div>

            <div
              className="modal-footer"
              style={{
                background: '#0f172a',
                borderTop: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <button
                className="btn"
                disabled={photoViewerData.currentIndex === 0}
                onClick={() =>
                  setPhotoViewerData({
                    ...photoViewerData,
                    currentIndex: photoViewerData.currentIndex - 1
                  })
                }
                style={{
                  background: '#1e293b',
                  color: '#ffffff',
                  border: '1px solid #475569',
                  opacity: photoViewerData.currentIndex === 0 ? 0.4 : 1
                }}
              >
                ◀ Anterior
              </button>

              <a
                href={photoViewerData.fotos[photoViewerData.currentIndex]?.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none'
                }}
              >
                <ExternalLink className="w-4 h-4" /> Abrir en Cloudflare R2
              </a>

              <button
                className="btn"
                disabled={photoViewerData.currentIndex === photoViewerData.fotos.length - 1}
                onClick={() =>
                  setPhotoViewerData({
                    ...photoViewerData,
                    currentIndex: photoViewerData.currentIndex + 1
                  })
                }
                style={{
                  background: '#1e293b',
                  color: '#ffffff',
                  border: '1px solid #475569',
                  opacity: photoViewerData.currentIndex === photoViewerData.fotos.length - 1 ? 0.4 : 1
                }}
              >
                Siguiente ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
