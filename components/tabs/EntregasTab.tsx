'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Sparkles,
  Edit3,
  Barcode,
  Save
} from 'lucide-react';
import { Paquete, Cliente } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { exportEntregasToExcel } from '@/lib/excelExport';
import { matchesFuzzySearch } from '@/lib/fuzzySearch';
import { getR2ViewUrl } from '@/lib/r2/client';
import PhotoViewerModal from '@/components/modals/PhotoViewerModal';

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
  const [scannerInputCode, setScannerInputCode] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSavingAvance, setIsSavingAvance] = useState(false);

  // Modal de Edición de Orden
  const [editingOrden, setEditingOrden] = useState<OrdenEntrega | null>(null);
  const [editForm, setEditForm] = useState({
    clienteNombre: '',
    clienteCasillero: '',
    clienteDocumento: '',
    operadorAsignado: '',
    tipoEntrega: 'RECOJO_TIENDA_LINCE',
    notas: '',
    newWrInput: ''
  });
  const [editPaquetesList, setEditPaquetesList] = useState<OrdenEntrega['paquetes_data']>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  // Efectos de sonido y vibración haptic para el operario
  const playBeep = (success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 1200 : 400, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Ignorar si el navegador bloquea audio sin interacción previa
    }
  };

  const triggerVibrate = (success: boolean) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(success ? [60, 40, 60] : [150, 60, 150]);
      } catch {
        // Silent
      }
    }
  };

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Cargar Órdenes desde Supabase
  const fetchOrdenes = useCallback(async () => {
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
  }, []);

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
  }, [fetchOrdenes]);

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
        posicionEstante: p.posicionEstante || (p.anaquel && p.piso ? `${p.anaquel}-${p.piso}` : 'ALMACEN LINCE'),
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
            posicionEstante: matchPkg?.posicionEstante || (matchPkg?.anaquel && matchPkg?.piso ? `${matchPkg.anaquel}-${matchPkg.piso}` : 'ALMACEN LINCE'),
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
        checks[p.numeroReciboBodega] = Boolean(p.encontrado);
      });
    }
    setPickingChecks(checks);
    setUploadedPhotos(Array.isArray(orden.fotos_evidencia) ? orden.fotos_evidencia : []);
    setReceptorForm({
      nombre: orden.receptor_nombre || orden.cliente_nombre || '',
      documento: orden.receptor_documento || orden.cliente_documento || '',
      parentesco: orden.receptor_parentesco || 'Titular'
    });
    setScannerInputCode('');
  };

  // 5. GUARDAR AVANCE EN TIEMPO REAL (Persistencia en Supabase)
  const handleSaveAvance = async (overrideChecks?: Record<string, boolean>, silent = false) => {
    if (!activePickingOrden) return;

    const currentChecks = overrideChecks || pickingChecks;
    const currentPaquetes = Array.isArray(activePickingOrden.paquetes_data) ? activePickingOrden.paquetes_data : [];

    const updatedPaquetesData = currentPaquetes.map(p => ({
      ...p,
      encontrado: Boolean(currentChecks[p.numeroReciboBodega])
    }));

    const foundCount = updatedPaquetesData.filter(p => p.encontrado).length;
    const totalCount = updatedPaquetesData.length;

    let nextStatus: OrdenEntrega['estado'] = activePickingOrden.estado;
    if (activePickingOrden.estado !== 'ENTREGADO') {
      if (foundCount === totalCount && totalCount > 0) {
        nextStatus = 'LISTO_ENTREGA';
      } else if (foundCount > 0) {
        nextStatus = 'EN_BUSQUEDA';
      } else {
        nextStatus = 'PENDIENTE_BUSQUEDA';
      }
    }

    try {
      setIsSavingAvance(true);
      const { error } = await supabase
        .from('entregas_ordenes')
        .update({
          paquetes_data: updatedPaquetesData,
          estado: nextStatus,
          receptor_nombre: receptorForm.nombre,
          receptor_documento: receptorForm.documento,
          receptor_parentesco: receptorForm.parentesco
        })
        .eq('id', activePickingOrden.id);

      if (error) throw error;

      // Actualizar estado local
      const updatedOrder: OrdenEntrega = {
        ...activePickingOrden,
        paquetes_data: updatedPaquetesData,
        estado: nextStatus,
        receptor_nombre: receptorForm.nombre,
        receptor_documento: receptorForm.documento,
        receptor_parentesco: receptorForm.parentesco
      };

      setActivePickingOrden(updatedOrder);
      setOrdenes(prev => prev.map(o => o.id === activePickingOrden.id ? updatedOrder : o));

      if (!silent) {
        showToast(`💾 Avance guardado: ${foundCount} de ${totalCount} paquetes encontrados.`);
      }
    } catch (err: any) {
      console.error('Error al guardar avance:', err);
      if (!silent) {
        showToast('Error al guardar avance en Supabase: ' + (err.message || ''), true);
      }
    } finally {
      setIsSavingAvance(false);
    }
  };

  // 6. Toggle de paquete encontrado con Auto-Guardado y Feedback
  const handleToggleCheck = async (wr: string) => {
    const nextVal = !pickingChecks[wr];
    const newChecks = {
      ...pickingChecks,
      [wr]: nextVal
    };
    setPickingChecks(newChecks);

    playBeep(nextVal);
    triggerVibrate(nextVal);

    // Auto-guardar cambio en Supabase de forma transparente
    await handleSaveAvance(newChecks, true);
  };

  // 7. Procesar escaneo / pistoleo rápido dentro del modal
  const handleScanInputSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activePickingOrden || !scannerInputCode.trim()) return;

    const raw = scannerInputCode.trim().toUpperCase();
    const currentPaquetes = activePickingOrden.paquetes_data || [];

    // Buscar si el código coincide con algún paquete de la orden
    const matched = currentPaquetes.find(
      p =>
        p.numeroReciboBodega.toUpperCase() === raw ||
        (raw.length >= 5 && p.numeroReciboBodega.toUpperCase().includes(raw))
    );

    if (matched) {
      const wr = matched.numeroReciboBodega;
      const newChecks = { ...pickingChecks, [wr]: true };
      setPickingChecks(newChecks);
      playBeep(true);
      triggerVibrate(true);
      showToast(`✅ ¡Encontrado! ${wr} (${matched.posicionEstante || 'Lince'})`);
      handleSaveAvance(newChecks, true);
      setScannerInputCode('');
    } else {
      playBeep(false);
      triggerVibrate(false);
      showToast(`⚠️ El código "${raw}" no está en esta orden de entrega.`, true);
    }
  };

  // 8. ABRIR MODAL DE EDICIÓN DE ORDEN
  const handleOpenEditOrden = (orden: OrdenEntrega) => {
    setEditingOrden(orden);
    setEditForm({
      clienteNombre: orden.cliente_nombre || '',
      clienteCasillero: orden.cliente_casillero || '',
      clienteDocumento: orden.cliente_documento || '',
      operadorAsignado: orden.operador_asignado || 'Carlos Mendoza (Almacén Lince)',
      tipoEntrega: orden.tipo_entrega || 'RECOJO_TIENDA_LINCE',
      notas: orden.notas || '',
      newWrInput: ''
    });
    setEditPaquetesList(Array.isArray(orden.paquetes_data) ? [...orden.paquetes_data] : []);
  };

  // 9. Agregar WR a la lista en edición
  const handleAddWrToEditList = (pkgOrCode: Paquete | string) => {
    let newEntry: OrdenEntrega['paquetes_data'][0];

    if (typeof pkgOrCode === 'string') {
      const cleanWr = pkgOrCode.trim().toUpperCase();
      if (!cleanWr) return;
      if (editPaquetesList.some(p => p.numeroReciboBodega.toUpperCase() === cleanWr)) {
        alert(`El paquete ${cleanWr} ya está en la lista.`);
        return;
      }
      const matchPkg = paquetes.find(p => p.numeroReciboBodega.toUpperCase() === cleanWr);
      newEntry = {
        id: matchPkg?.id,
        numeroReciboBodega: cleanWr,
        descripcion: matchPkg?.descripcion || 'Paquete agregado en almacén',
        pesoKg: matchPkg?.pesoKg || 1,
        posicionEstante: matchPkg?.posicionEstante || (matchPkg?.anaquel && matchPkg?.piso ? `${matchPkg.anaquel}-${matchPkg.piso}` : 'ALMACEN LINCE'),
        encontrado: false
      };
    } else {
      if (editPaquetesList.some(p => p.numeroReciboBodega === pkgOrCode.numeroReciboBodega)) {
        alert(`El paquete ${pkgOrCode.numeroReciboBodega} ya está en la lista.`);
        return;
      }
      newEntry = {
        id: pkgOrCode.id,
        numeroReciboBodega: pkgOrCode.numeroReciboBodega,
        descripcion: pkgOrCode.descripcion,
        pesoKg: pkgOrCode.pesoKg,
        posicionEstante: pkgOrCode.posicionEstante || (pkgOrCode.anaquel && pkgOrCode.piso ? `${pkgOrCode.anaquel}-${pkgOrCode.piso}` : 'ALMACEN LINCE'),
        encontrado: false
      };
    }

    setEditPaquetesList([...editPaquetesList, newEntry]);
  };

  // 10. Remover WR de la lista en edición
  const handleRemoveWrFromEditList = (wrToRemove: string) => {
    if (editPaquetesList.length <= 1) {
      alert('La orden debe tener al menos 1 paquete WR.');
      return;
    }
    setEditPaquetesList(editPaquetesList.filter(p => p.numeroReciboBodega !== wrToRemove));
  };

  // 11. GUARDAR CAMBIOS DE EDICIÓN EN SUPABASE
  const handleSaveEditedOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrden) return;

    if (editPaquetesList.length === 0) {
      alert('Debes mantener al menos 1 paquete WR en la lista.');
      return;
    }

    // Agregar posibles WRs pegados en el textarea
    let finalPaquetes = [...editPaquetesList];
    if (editForm.newWrInput.trim()) {
      const extraWrs = editForm.newWrInput
        .split(/[\n,;]+/)
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length > 0);

      extraWrs.forEach(wr => {
        if (!finalPaquetes.some(p => p.numeroReciboBodega.toUpperCase() === wr)) {
          const matchPkg = paquetes.find(p => p.numeroReciboBodega.toUpperCase() === wr);
          finalPaquetes.push({
            id: matchPkg?.id,
            numeroReciboBodega: wr,
            descripcion: matchPkg?.descripcion || 'Paquete agregado en almacén',
            pesoKg: matchPkg?.pesoKg || 1,
            posicionEstante: matchPkg?.posicionEstante || (matchPkg?.anaquel && matchPkg?.piso ? `${matchPkg.anaquel}-${matchPkg.piso}` : 'ALMACEN LINCE'),
            encontrado: false
          });
        }
      });
    }

    try {
      setIsSavingEdit(true);
      const foundCount = finalPaquetes.filter(p => p.encontrado).length;
      let nextStatus: OrdenEntrega['estado'] = editingOrden.estado;
      if (editingOrden.estado !== 'ENTREGADO') {
        if (foundCount === finalPaquetes.length && finalPaquetes.length > 0) {
          nextStatus = 'LISTO_ENTREGA';
        } else if (foundCount > 0) {
          nextStatus = 'EN_BUSQUEDA';
        } else {
          nextStatus = 'PENDIENTE_BUSQUEDA';
        }
      }

      const { error } = await supabase
        .from('entregas_ordenes')
        .update({
          cliente_nombre: editForm.clienteNombre,
          cliente_casillero: editForm.clienteCasillero,
          cliente_documento: editForm.clienteDocumento,
          operador_asignado: editForm.operadorAsignado,
          tipo_entrega: editForm.tipoEntrega,
          notas: editForm.notas,
          total_paquetes: finalPaquetes.length,
          paquetes_data: finalPaquetes,
          estado: nextStatus
        })
        .eq('id', editingOrden.id);

      if (error) throw error;

      alert(`✓ Orden ${editingOrden.codigo_entrega} actualizada correctamente (${finalPaquetes.length} paquetes).`);
      setEditingOrden(null);
      await fetchOrdenes();
    } catch (err: any) {
      console.error('Error al guardar edición de orden:', err);
      alert('Error al guardar cambios: ' + (err.message || ''));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 12. Eliminar Orden de Búsqueda
  const handleDeleteOrden = async (ordenId: string, codigo: string) => {
    if (!confirm(`¿Estás seguro de eliminar la orden de entrega ${codigo}?`)) return;

    try {
      const { error } = await supabase.from('entregas_ordenes').delete().eq('id', ordenId);
      if (error) throw error;
      setOrdenes(prev => prev.filter(o => o.id !== ordenId));
      alert(`✓ Orden ${codigo} eliminada.`);
    } catch (err: any) {
      console.error('Error al eliminar orden:', err);
      alert('Error al eliminar la orden.');
    }
  };

  // 13. Subir Múltiples Fotos de Evidencia a Cloudflare R2
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

      showToast(`📸 ¡${newPhotos.length} foto(s) de evidencia subida(s) con éxito a R2!`);
    } catch (err: any) {
      console.error('Error subiendo fotos:', err);
      showToast('Error al subir fotos: ' + (err.message || 'Error desconocido'), true);
    } finally {
      setIsUploadingPhoto(false);
      setUploadProgress('');
      if (e.target) e.target.value = '';
    }
  };

  // 14. Eliminar Foto de la lista
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

  // 15. Confirmar y Cerrar Entrega Final
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
        const matchPkg = paquetes.find(p => p.numeroReciboBodega === wr);
        if (matchPkg) {
          await supabase
            .from('paquetes')
            .update({
              estado_entrega: 'Entregado',
              ubicacion_actual: 'Entregado'
            })
            .eq('id', matchPkg.id);

          if (onUpdatePackage) {
            onUpdatePackage({
              ...matchPkg,
              estadoEntrega: 'Entregado',
              ubicacionActual: 'Entregado'
            });
          }

          // Registrar movimiento en Kardex
          await supabase.from('movimientos_kardex').insert([
            {
              paquete_id: matchPkg.id,
              codigo_paquete: wr,
              consignatario: matchPkg.nombreConsignatario || activePickingOrden.cliente_nombre,
              origen_descripcion: matchPkg.posicionEstante || 'Almacén Central Lince',
              destino_descripcion: `Entregado en Mostrador a: ${receptorForm.nombre} (${receptorForm.parentesco}) - Orden: ${activePickingOrden.codigo_entrega}`,
              tipo_movimiento: 'ENTREGA',
              motivo: `Entrega en Mostrador Lince (${activePickingOrden.tipo_entrega})`,
              usuario_operador: activePickingOrden.operador_asignado || 'Carlos Mendoza'
            }
          ]);
        }
      }

      alert(`🎉 ¡Entrega ${activePickingOrden.codigo_entrega} completada y registrada exitosamente!`);
      setActivePickingOrden(null);
      fetchOrdenes();
    } catch (err: any) {
      console.error('Error al finalizar entrega:', err);
      alert('Error al cerrar entrega: ' + (err.message || ''));
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="sap-breadcrumb">
        <span>Operaciones y Almacenes</span> / <span>Búsqueda de WRs, Entregas en Mostrador y Evidencias</span>
      </div>

      {/* CABECERA CON BOTONES ADAPTADOS PARA MÓVIL Y DESKTOP */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          background: '#ffffff',
          padding: '14px 16px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}
      >
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <PackageCheck className="w-5 h-5 text-blue-600" /> Búsqueda de WRs & Entregas en Mostrador
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
            Listas de paquetes solicitados, recolección en estantes y registro de fotos en Cloudflare R2
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', width: 'auto' }}>
          <button
            className="btn btn-secondary"
            onClick={fetchOrdenes}
            disabled={refreshing}
            style={{
              height: '38px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Recargar órdenes"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
          </button>

          <button
            className="btn"
            onClick={() => exportEntregasToExcel(ordenes)}
            style={{
              height: '38px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 800,
              borderRadius: '8px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Excel
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setSubtab('nueva')}
            style={{
              height: '38px',
              padding: '0 14px',
              fontSize: '12.5px',
              fontWeight: 800,
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus className="w-4 h-4" /> ➕ Nueva Lista de Búsqueda
          </button>
        </div>
      </div>

      {/* METRIC CARDS RESPONSIVE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        <div
          onClick={() => {
            setSubtab('activas');
            setStatusFilter('ALL');
          }}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            borderLeft: '4px solid #3b82f6',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Órdenes Activas
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#1e3a8a', marginTop: '2px' }}>
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
            padding: '12px 14px',
            cursor: 'pointer',
            borderLeft: '4px solid #f59e0b'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
            Por Buscar en Almacén
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#92400e', marginTop: '2px' }}>
            {metrics.pendientes}
          </div>
          <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>Pendientes de inicio</div>
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
            padding: '12px 14px',
            cursor: 'pointer',
            borderLeft: '4px solid #22c55e'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
            Listos en Mostrador
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#166534', marginTop: '2px' }}>
            {metrics.listos}
          </div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>100% encontrados</div>
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
            padding: '12px 14px',
            cursor: 'pointer',
            borderLeft: '4px solid #64748b'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
            Total Entregados
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
            {metrics.entregados}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Con fotos en R2</div>
        </div>
      </div>

      {/* PESTAÑAS SECUNDARIAS (SCROLL HORIZONTAL EN MÓVIL) */}
      <div className="wms-subtab-container">
        <button
          onClick={() => setSubtab('activas')}
          style={{
            padding: '8px 16px',
            fontSize: '12.5px',
            fontWeight: 800,
            borderRadius: '8px',
            border: 'none',
            background: subtab === 'activas' ? '#2563eb' : '#f1f5f9',
            color: subtab === 'activas' ? '#ffffff' : '#475569',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Clock className="w-4 h-4" /> Búsquedas Activas ({metrics.pendientes + metrics.enBusqueda + metrics.listos})
        </button>

        <button
          onClick={() => setSubtab('nueva')}
          style={{
            padding: '8px 16px',
            fontSize: '12.5px',
            fontWeight: 800,
            borderRadius: '8px',
            border: 'none',
            background: subtab === 'nueva' ? '#2563eb' : '#f1f5f9',
            color: subtab === 'nueva' ? '#ffffff' : '#475569',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Plus className="w-4 h-4" /> ➕ Crear Orden
        </button>

        <button
          onClick={() => setSubtab('historial')}
          style={{
            padding: '8px 16px',
            fontSize: '12.5px',
            fontWeight: 800,
            borderRadius: '8px',
            border: 'none',
            background: subtab === 'historial' ? '#2563eb' : '#f1f5f9',
            color: subtab === 'historial' ? '#ffffff' : '#475569',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <CheckCircle2 className="w-4 h-4" /> Historial Entregas ({metrics.entregados})
        </button>
      </div>

      {/* SUBTAB 1: ÓRDENES ACTIVAS & HISTORIAL */}
      {(subtab === 'activas' || subtab === 'historial') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* BARRA DE BÚSQUEDA Y FILTRO */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <Search
                className="w-4 h-4 text-slate-400"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Buscar por código ENT-, guía WR, cliente o estante..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="form-control"
                style={{ paddingLeft: '34px', height: '38px', fontSize: '12.5px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Estado:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="form-control"
                style={{ height: '38px', fontSize: '12.5px', width: 'auto' }}
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PENDIENTE_BUSQUEDA">⏳ Pendiente Búsqueda</option>
                <option value="EN_BUSQUEDA">🏃 En Búsqueda</option>
                <option value="LISTO_ENTREGA">📦 Listo en Mostrador</option>
                <option value="ENTREGADO">✅ Entregado</option>
              </select>
            </div>
          </div>

          {/* LISTA / TARJETAS DE ÓRDENES */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 700 }}>Cargando órdenes de entrega...</div>
            </div>
          ) : filteredOrdenes.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1'
              }}
            >
              <PackageCheck className="w-12 h-12 text-slate-300" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#334155', margin: 0 }}>
                No se encontraron órdenes de entrega
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                {subtab === 'activas'
                  ? 'No hay listas de búsqueda pendientes. ¡Crea una nueva orden para que los operarios inicien!'
                  : 'Aún no se registran entregas finalizadas.'}
              </p>
              {subtab === 'activas' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setSubtab('nueva')}
                  style={{ marginTop: '14px', height: '38px', fontSize: '12.5px', fontWeight: 800 }}
                >
                  <Plus className="w-4 h-4" /> Crear Primera Orden
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredOrdenes.map(orden => {
                const totalWrs = Array.isArray(orden.paquetes_data) ? orden.paquetes_data.length : 0;
                const foundWrs = Array.isArray(orden.paquetes_data) ? orden.paquetes_data.filter(p => p.encontrado).length : 0;
                const progressPct = totalWrs > 0 ? Math.round((foundWrs / totalWrs) * 100) : 0;
                const totalFotos = Array.isArray(orden.fotos_evidencia) ? orden.fotos_evidencia.length : 0;

                return (
                  <div
                    key={orden.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      border: orden.estado === 'ENTREGADO' ? '1px solid #86efac' : orden.estado === 'LISTO_ENTREGA' ? '1.5px solid #22c55e' : '1px solid #cbd5e1',
                      padding: '14px 16px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    {/* FILA SUPERIOR: CÓDIGO + BADGES */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 900, color: '#1e40af', fontFamily: 'monospace' }}>
                          {orden.codigo_entrega}
                        </span>

                        {/* BADGE DE ESTADO */}
                        {orden.estado === 'PENDIENTE_BUSQUEDA' && (
                          <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                            ⏳ Pendiente Búsqueda
                          </span>
                        )}
                        {orden.estado === 'EN_BUSQUEDA' && (
                          <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                            🏃 Operario en Almacén ({foundWrs}/{totalWrs})
                          </span>
                        )}
                        {orden.estado === 'LISTO_ENTREGA' && (
                          <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                            📦 Listo en Mostrador (100%)
                          </span>
                        )}
                        {orden.estado === 'ENTREGADO' && (
                          <span style={{ background: '#ecfdf5', color: '#065f46', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ENTREGADO
                          </span>
                        )}

                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                          {orden.tipo_entrega.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* PROGRESO DE BÚSQUEDA WMS */}
                      {orden.estado !== 'ENTREGADO' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 800, color: progressPct === 100 ? '#16a34a' : '#2563eb' }}>
                            {foundWrs} / {totalWrs} WRs ({progressPct}%)
                          </span>
                          <div style={{ width: '70px', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                background: progressPct === 100 ? '#16a34a' : '#2563eb',
                                width: `${progressPct}%`,
                                transition: 'width 0.2s ease'
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* DATOS DEL CLIENTE Y OPERARIO */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '8px',
                        background: '#f8fafc',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '12.5px'
                      }}
                    >
                      <div>
                        <span style={{ color: '#64748b', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase' }}>
                          Cliente / Consignatario:
                        </span>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>
                          {orden.cliente_nombre} {orden.cliente_casillero && `(${orden.cliente_casillero})`}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: '#64748b', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase' }}>
                          Operario Responsable:
                        </span>
                        <div style={{ fontWeight: 700, color: '#334155' }}>
                          👷 {orden.operador_asignado}
                        </div>
                      </div>

                      {orden.receptor_nombre && (
                        <div>
                          <span style={{ color: '#64748b', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase' }}>
                            Retirado por:
                          </span>
                          <div style={{ fontWeight: 800, color: '#065f46' }}>
                            👤 {orden.receptor_nombre} ({orden.receptor_parentesco || 'Titular'})
                          </div>
                        </div>
                      )}

                      <div>
                        <span style={{ color: '#64748b', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase' }}>
                          Fecha:
                        </span>
                        <div style={{ color: '#475569' }}>
                          {orden.entregado_en
                            ? `Entregado: ${new Date(orden.entregado_en).toLocaleString('es-PE')}`
                            : `Creado: ${new Date(orden.creado_en).toLocaleString('es-PE')}`}
                        </div>
                      </div>
                    </div>

                    {/* LISTA DE PAQUETES WRS CON UBICACIONES */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Paquetes en esta Lista ({totalWrs}):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Array.isArray(orden.paquetes_data) &&
                          orden.paquetes_data.map((p, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: p.encontrado ? '#ecfdf5' : '#ffffff',
                                border: p.encontrado ? '1.5px solid #22c55e' : '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11.5px'
                              }}
                            >
                              <span style={{ fontWeight: 900, color: p.encontrado ? '#166534' : '#1e3a8a', fontFamily: 'monospace' }}>
                                {p.numeroReciboBodega}
                              </span>
                              {p.posicionEstante && (
                                <span style={{ background: '#eff6ff', color: '#1e40af', padding: '1px 5px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800, fontFamily: 'monospace' }}>
                                  📍 {p.posicionEstante}
                                </span>
                              )}
                              {p.encontrado ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                              )}
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* BOTONES DE ACCIÓN ADAPTADOS PARA CELULAR Y PC */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      {orden.estado !== 'ENTREGADO' ? (
                        <>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleOpenPicking(orden)}
                            style={{
                              flex: '1 1 160px',
                              height: '40px',
                              background: '#2563eb',
                              color: '#ffffff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              fontSize: '12.5px',
                              fontWeight: 800,
                              borderRadius: '8px'
                            }}
                          >
                            <Barcode className="w-4 h-4" /> Buscar / Subir Fotos
                          </button>

                          <button
                            className="btn btn-secondary"
                            onClick={() => handleOpenEditOrden(orden)}
                            style={{
                              flex: '1 1 120px',
                              height: '40px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              borderRadius: '8px'
                            }}
                            title="Editar lista o agregar más paquetes WR"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600" /> Editar Lista WR
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn"
                          onClick={() => handleOpenPicking(orden)}
                          style={{
                            flex: '1 1 160px',
                            height: '40px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '8px'
                          }}
                        >
                          <Eye className="w-4 h-4 text-slate-600" /> Ver Expediente Final
                        </button>
                      )}

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
                            flex: '1 1 130px',
                            height: '40px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            color: '#166534',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: 800,
                            borderRadius: '8px'
                          }}
                        >
                          <ImageIcon className="w-4 h-4 text-emerald-600" /> {totalFotos} Fotos R2
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteOrden(orden.id, orden.codigo_entrega)}
                        className="btn"
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Eliminar orden"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
            padding: '20px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Plus className="w-6 h-6 text-blue-600" />
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Emitir Lista de Búsqueda de WRs para Operario
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Selecciona los paquetes en almacén o escribe la lista de WRs para que el operario los ubique y entregue
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* GRID DE DATOS BÁSICOS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
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
                  placeholder="Ej: AMEX-PER-1001"
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
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#0f172a' }}>
                  📦 Seleccionar Paquetes desde Inventario de Almacén Lince
                </span>
                <div style={{ position: 'relative', width: '240px' }}>
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
              <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }}>
                {paquetesDisponibles.length === 0 ? (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: isSelected ? '#eff6ff' : '#f8fafc',
                            border: isSelected ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            fontSize: '11.5px'
                          }}
                        >
                          <input type="checkbox" checked={isSelected} readOnly />
                          <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 900, color: '#1e3a8a', fontFamily: 'monospace' }}>{pkg.numeroReciboBodega}</span>
                            <span style={{ color: '#64748b', marginLeft: '6px' }}>{pkg.nombreConsignatario}</span>
                          </div>
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800, fontFamily: 'monospace' }}>
                            📍 {pkg.posicionEstante || (pkg.anaquel && pkg.piso ? `${pkg.anaquel}-${pkg.piso}` : 'REC')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* O PEGAR CÓDIGOS DIRECTAMENTE */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                O pega códigos WR adicionales (separados por coma, espacio o salto de línea):
              </label>
              <textarea
                rows={2}
                placeholder="WR000451, WR000452, WR000453"
                value={newOrderForm.wrInput}
                onChange={e => setNewOrderForm({ ...newOrderForm, wrInput: e.target.value })}
                className="form-control"
                style={{ fontFamily: 'monospace', fontSize: '12.5px' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                Notas / Instrucciones para el Operario (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Cliente esperando en mostrador, entregar con DNI"
                value={newOrderForm.notas}
                onChange={e => setNewOrderForm({ ...newOrderForm, notas: e.target.value })}
                className="form-control"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSubtab('activas')}
                style={{ height: '40px', padding: '0 16px', fontSize: '13px', fontWeight: 700 }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: '40px', padding: '0 20px', fontSize: '13px', fontWeight: 900, background: '#2563eb' }}
              >
                ✓ Generar Lista de Búsqueda
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 📱 MODAL 1: ATENCIÓN DE OPERARIO / BÚSQUEDA EN ALMACÉN / SUBIDA DE FOTOS */}
      {activePickingOrden && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '640px', maxHeight: '94vh' }}>
            <div className="modal-header" style={{ background: '#0f172a', color: '#ffffff' }}>
              <div>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase' }}>
                  Búsqueda y Entrega en Almacén
                </span>
                <div style={{ fontSize: '16px', fontWeight: 900, fontFamily: 'monospace' }}>
                  {activePickingOrden.codigo_entrega} · {activePickingOrden.cliente_nombre}
                </div>
              </div>
              <button
                onClick={() => setActivePickingOrden(null)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* TOAST / NOTIFICACIÓN RÁPIDA */}
              {toastMessage && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    background: toastMessage.isError ? '#fef2f2' : '#dcfce7',
                    border: toastMessage.isError ? '1px solid #fecaca' : '1px solid #86efac',
                    color: toastMessage.isError ? '#dc2626' : '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {toastMessage.isError ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{toastMessage.text}</span>
                </div>
              )}

              {/* BARRA DE PROGRESO DE BÚSQUEDA */}
              <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#0f172a' }}>
                    🎯 Progreso: {Object.values(pickingChecks).filter(Boolean).length} / {(activePickingOrden.paquetes_data || []).length} encontrados
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: Object.values(pickingChecks).filter(Boolean).length === (activePickingOrden.paquetes_data || []).length ? '#16a34a' : '#2563eb' }}>
                    {Math.round((Object.values(pickingChecks).filter(Boolean).length / ((activePickingOrden.paquetes_data || []).length || 1)) * 100)}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: Object.values(pickingChecks).filter(Boolean).length === (activePickingOrden.paquetes_data || []).length ? '#16a34a' : '#2563eb',
                      width: `${(Object.values(pickingChecks).filter(Boolean).length / ((activePickingOrden.paquetes_data || []).length || 1)) * 100}%`,
                      transition: 'width 0.2s ease'
                    }}
                  />
                </div>
              </div>

              {/* ENTRADA DE ESCANEO RÁPIDO / PISTOLEO */}
              <form onSubmit={handleScanInputSubmit} style={{ display: 'flex', gap: '6px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Barcode className="w-4 h-4 text-blue-600" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Pistolea o escribe código WR para marcar..."
                    value={scannerInputCode}
                    onChange={e => setScannerInputCode(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      paddingLeft: '34px',
                      paddingRight: '8px',
                      borderRadius: '8px',
                      border: '1.5px solid #3b82f6',
                      fontSize: '12.5px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 800,
                      outline: 'none'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: '38px', padding: '0 12px', fontSize: '12px', fontWeight: 800, borderRadius: '8px' }}
                >
                  ✓ Marcar
                </button>
              </form>

              {/* PASO 1: CHECKLIST DE PAQUETES EN ESTANTES (DESPLAZAMIENTO FLUIDO Y COMPLETO) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.isArray(activePickingOrden.paquetes_data) &&
                  activePickingOrden.paquetes_data.map((p, idx) => {
                    const isFound = Boolean(pickingChecks[p.numeroReciboBodega]);
                    return (
                      <div
                        key={idx}
                        onClick={() => handleToggleCheck(p.numeroReciboBodega)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: isFound ? '#f0fdf4' : '#ffffff',
                          border: isFound ? '1.5px solid #22c55e' : '1.5px solid #cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, color: isFound ? '#15803d' : '#0f172a', fontSize: '13.5px', fontFamily: 'monospace', textDecoration: isFound ? 'line-through' : 'none' }}>
                            {p.numeroReciboBodega}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {p.descripcion || 'Paquete'} · {p.pesoKg || 0} Kg
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ background: isFound ? '#dcfce7' : '#eff6ff', color: isFound ? '#15803d' : '#1e40af', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, fontFamily: 'monospace' }}>
                            📍 {p.posicionEstante || 'LINCE'}
                          </span>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              background: isFound ? '#22c55e' : '#f1f5f9',
                              border: isFound ? '1px solid #16a34a' : '1px solid #cbd5e1',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px'
                            }}
                          >
                            {isFound && <Check className="w-4 h-4 text-white" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* PASO 2: FOTOS DE EVIDENCIA EN CLOUDFLARE R2 */}
              <div style={{ background: '#f0fdf4', border: '1.5px dashed #86efac', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#14532d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera className="w-4 h-4 text-emerald-600" />
                    📸 Evidencias de Entrega (R2):
                  </span>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 800 }}>
                    {uploadedPhotos.length} fotos guardadas
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '10px',
                      background: '#16a34a',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: isUploadingPhoto ? 'not-allowed' : 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <Camera className="w-4 h-4" /> Tomar Foto
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      style={{ display: 'none' }}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '10px',
                      background: '#2563eb',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: isUploadingPhoto ? 'not-allowed' : 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <ImageIcon className="w-4 h-4" /> Galería
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {isUploadingPhoto && (
                  <div style={{ padding: '8px', background: '#ecfdf5', borderRadius: '6px', color: '#065f46', fontSize: '11.5px', fontWeight: 800, textAlign: 'center' }}>
                    ⏳ {uploadProgress || 'Subiendo foto a Cloudflare R2...'}
                  </div>
                )}

                {/* MINIATURAS MEJORADAS CON PREVIEW Y CLICK PARA VER GRANDE */}
                {uploadedPhotos.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#334155', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🖼️ Fotos Registradas ({uploadedPhotos.length}):</span>
                      <span style={{ fontSize: '10.5px', color: '#2563eb', fontWeight: 700 }}>🔍 Click en cualquier foto para ver grande</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '8px' }}>
                      {uploadedPhotos.map((photo, idx) => (
                        <div
                          key={idx}
                          onClick={() =>
                            setPhotoViewerData({
                              codigo: activePickingOrden.codigo_entrega,
                              cliente: activePickingOrden.cliente_nombre,
                              fotos: uploadedPhotos,
                              currentIndex: idx
                            })
                          }
                          style={{
                            position: 'relative',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            height: '84px',
                            border: '2px solid #cbd5e1',
                            background: '#0f172a',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease'
                          }}
                        >
                          <img
                            src={getR2ViewUrl(photo.url)}
                            alt="Evidencia"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          
                          {/* Badge de número de foto */}
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '3px',
                              left: '3px',
                              background: 'rgba(0,0,0,0.75)',
                              color: '#ffffff',
                              fontSize: '9.5px',
                              fontWeight: 900,
                              padding: '1px 5px',
                              borderRadius: '4px'
                            }}
                          >
                            #{idx + 1}
                          </span>

                          {/* Botón de lupa */}
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '3px',
                              right: '3px',
                              background: 'rgba(37, 99, 235, 0.9)',
                              color: '#ffffff',
                              borderRadius: '4px',
                              padding: '1px 4px',
                              fontSize: '9px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            🔍 Ver
                          </span>

                          {/* Botón de eliminar */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePhoto(idx);
                            }}
                            style={{
                              position: 'absolute',
                              top: '3px',
                              right: '3px',
                              background: 'rgba(239, 68, 68, 0.92)',
                              border: 'none',
                              color: '#ffffff',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 900,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}
                            title="Eliminar esta foto"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* PASO 3: DATOS DE QUIEN RECIBE */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}>
                  👤 Datos de Quien Retira los Paquetes:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Nombre Completo Receptor *"
                    value={receptorForm.nombre}
                    onChange={e => setReceptorForm({ ...receptorForm, nombre: e.target.value })}
                    className="form-control"
                    style={{ height: '36px', fontSize: '12px' }}
                  />
                  <input
                    type="text"
                    placeholder="DNI / Documento Receptor"
                    value={receptorForm.documento}
                    onChange={e => setReceptorForm({ ...receptorForm, documento: e.target.value })}
                    className="form-control"
                    style={{ height: '36px', fontSize: '12px' }}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn"
                onClick={() => handleSaveAvance(undefined, false)}
                disabled={isSavingAvance}
                style={{
                  background: '#f1f5f9',
                  border: '1.5px solid #cbd5e1',
                  color: '#1e293b',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Save className="w-4 h-4 text-blue-600" />
                {isSavingAvance ? 'Guardando...' : '💾 Guardar Avance'}
              </button>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActivePickingOrden(null)}
                  style={{ fontSize: '12px', fontWeight: 700 }}
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleFinalizarEntrega}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '12.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirmar & Cerrar Entrega
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ MODAL 2: EDITAR LISTA DE WRs / ORDEN DE ENTREGA */}
      {editingOrden && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '600px', maxHeight: '92vh' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
                <Edit3 className="w-5 h-5" /> Editar Lista de Búsqueda ({editingOrden.codigo_entrega})
              </span>
              <button
                onClick={() => setEditingOrden(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedOrden} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="wms-modal-grid-2">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Cliente / Consignatario</label>
                  <input
                    type="text"
                    value={editForm.clienteNombre}
                    onChange={e => setEditForm({ ...editForm, clienteNombre: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Casillero</label>
                  <input
                    type="text"
                    value={editForm.clienteCasillero}
                    onChange={e => setEditForm({ ...editForm, clienteCasillero: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="wms-modal-grid-2">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Operario Asignado</label>
                  <select
                    value={editForm.operadorAsignado}
                    onChange={e => setEditForm({ ...editForm, operadorAsignado: e.target.value })}
                    className="form-control"
                  >
                    <option value="Carlos Mendoza (Almacén Lince)">Carlos Mendoza (Almacén Lince)</option>
                    <option value="Rosa Quispe (Almacén Central)">Rosa Quispe (Almacén Central)</option>
                    <option value="Operario de Turno (Lince)">Operario de Turno (Lince)</option>
                    <option value="Mostrador Central">Mostrador Central</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Tipo de Entrega</label>
                  <select
                    value={editForm.tipoEntrega}
                    onChange={e => setEditForm({ ...editForm, tipoEntrega: e.target.value })}
                    className="form-control"
                  >
                    <option value="RECOJO_TIENDA_LINCE">Recojo en Tienda (Sede Central Lince)</option>
                    <option value="AGENCIA_SHALOM">Despacho para Agencia (Shalom / Marvisur)</option>
                    <option value="CARRO_AMEX">Despacho en Carro AMEX a Domicilio</option>
                  </select>
                </div>
              </div>

              {/* LISTA ACTUAL DE WRS CON BOTÓN PARA REMOVER */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  📦 Paquetes en esta Lista ({editPaquetesList.length}):
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px' }}>
                  {editPaquetesList.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 900, color: '#1e3a8a', fontFamily: 'monospace', fontSize: '13px' }}>
                          {p.numeroReciboBodega}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          📍 {p.posicionEstante || 'Lince'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveWrFromEditList(p.numeroReciboBodega)}
                        style={{
                          background: '#fee2e2',
                          border: 'none',
                          color: '#dc2626',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        ✕ Quitar
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* AGREGAR MÁS WRS A LA LISTA */}
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                  ➕ Agregar más WRs (Pega códigos separados por coma o espacio):
                </label>
                <textarea
                  rows={2}
                  value={editForm.newWrInput}
                  onChange={e => setEditForm({ ...editForm, newWrInput: e.target.value })}
                  placeholder="WR000455, WR000456"
                  className="form-control"
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Notas</label>
                <input
                  type="text"
                  value={editForm.notas}
                  onChange={e => setEditForm({ ...editForm, notas: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="modal-footer" style={{ marginTop: '8px' }}>
                <button type="button" onClick={() => setEditingOrden(null)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={isSavingEdit} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {isSavingEdit ? 'Guardando...' : '✓ Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🖼️ MODAL 3: VISOR DE GALERÍA FOTOGRÁFICA EN ALTA RESOLUCIÓN CON ZOOM Y ROTACIÓN */}
      {photoViewerData && (
        <PhotoViewerModal
          title={`📸 Evidencias de Entrega - ${photoViewerData.codigo}`}
          subtitle={`Cliente: ${photoViewerData.cliente}`}
          photos={photoViewerData.fotos}
          initialIndex={photoViewerData.currentIndex}
          onClose={() => setPhotoViewerData(null)}
          onDeletePhoto={activePickingOrden ? handleDeletePhoto : undefined}
        />
      )}
    </div>
  );
}
