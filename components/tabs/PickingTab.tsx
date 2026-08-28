'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Truck,
  Plus,
  Search,
  Barcode,
  Layers,
  MapPin,
  User,
  Phone,
  AlertTriangle,
  FileText,
  Printer,
  Camera,
  VideoOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Edit3,
  X,
  ExternalLink,
  ChevronRight,
  PackageCheck,
  FileSpreadsheet,
  Save
} from 'lucide-react';
import { Paquete, Cliente, OrdenPicking, ItemPicking, TipoEstadoPicking } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { exportPickingOrderToExcel } from '@/lib/excelExport';
import { matchesFuzzySearch } from '@/lib/fuzzySearch';

interface PickingTabProps {
  paquetes: Paquete[];
  clientes: Cliente[];
  onUpdatePackage?: (pkg: Paquete) => void;
}

export default function PickingTab({
  paquetes = [],
  clientes = [],
  onUpdatePackage
}: PickingTabProps) {
  const [ordenes, setOrdenes] = useState<OrdenPicking[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, ItemPicking[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [activeExecutionOrder, setActiveExecutionOrder] = useState<OrdenPicking | null>(null);
  const [manifestOrder, setManifestOrder] = useState<OrdenPicking | null>(null);

  // Modal de Edición de Orden de Picking
  const [editingOrder, setEditingOrder] = useState<OrdenPicking | null>(null);
  const [editOrderAgencia, setEditOrderAgencia] = useState('SHALOM');
  const [editOrderDestino, setEditOrderDestino] = useState('LIMA / PROVINCIAS');
  const [editOrderOperador, setEditOrderOperador] = useState('Operador Logístico AMEX');
  const [editOrderNotas, setEditOrderNotas] = useState('');
  const [editOrderNewWrs, setEditOrderNewWrs] = useState('');
  const [editOrderItems, setEditOrderItems] = useState<ItemPicking[]>([]);
  const [isSavingEditOrder, setIsSavingEditOrder] = useState(false);

  // Estado del formulario de nueva orden
  const [newOrderAgencia, setNewOrderAgencia] = useState('SHALOM');
  const [newOrderDestino, setNewOrderDestino] = useState('LIMA / PROVINCIAS');
  const [newOrderOperador, setNewOrderOperador] = useState('Operador Logístico AMEX');
  const [newOrderNotas, setNewOrderNotas] = useState('');
  const [newOrderInputMode, setNewOrderInputMode] = useState<'paste' | 'select'>('paste');
  const [rawPastedCodes, setRawPastedCodes] = useState('');
  const [selectedInventoryPkgIds, setSelectedInventoryPkgIds] = useState<string[]>([]);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // Escáner integrado para la ejecución de picking
  const [scanFeedbackMessage, setScanFeedbackMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [inModalScanInput, setInModalScanInput] = useState('');

  // Cargar órdenes e items desde Supabase
  const fetchPickingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: ordData } = await supabase
        .from('ordenes_picking')
        .select('*')
        .order('creado_en', { ascending: false });

      if (ordData) {
        const mappedOrders: OrdenPicking[] = ordData.map(o => ({
          id: o.id,
          codigoOrden: o.codigo_orden,
          transportistaAgencia: o.transportista_agencia,
          destinoCiudad: o.destino_ciudad || 'LIMA / PROVINCIAS',
          estado: o.estado as TipoEstadoPicking,
          operadorAsignado: o.operador_asignado || 'Operador AMEX',
          totalPaquetes: o.total_paquetes || 0,
          recolectadosPaquetes: o.recolectados_paquetes || 0,
          notas: o.notas || '',
          creadoPor: o.creado_por || 'Administración',
          creadoEn: o.creado_en,
          completadoEn: o.completado_en
        }));
        setOrdenes(mappedOrders);

        // Cargar todos los items
        const { data: itData } = await supabase
          .from('items_picking')
          .select('*')
          .order('ubicacion_anaquel', { ascending: true });

        if (itData) {
          const map: Record<string, ItemPicking[]> = {};
          itData.forEach(item => {
            const ordId = item.orden_picking_id;
            if (!map[ordId]) map[ordId] = [];
            map[ordId].push({
              id: item.id,
              ordenPickingId: item.orden_picking_id,
              paqueteId: item.paquete_id,
              codigoReciboBodega: item.codigo_recibo_bodega,
              trackingUsa: item.tracking_usa,
              consignatario: item.consignatario,
              dniConsignatario: item.dni_consignatario,
              telefonoConsignatario: item.telefono_consignatario,
              ciudadDestino: item.ciudad_destino,
              direccionDestino: item.direccion_destino,
              ubicacionAnaquel: item.ubicacion_anaquel || 'A1-P1',
              estadoItem: item.estado_item as 'PENDIENTE' | 'RECOLECTADO',
              recolectadoEn: item.recolectado_en,
              recolectadoPor: item.recolectado_por,
              pesoKg: Number(item.peso_kg || 1.0),
              creadoEn: item.creado_en
            });
          });
          setItemsMap(map);
        }
      }
    } catch (err) {
      console.warn('Error fetching picking data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPickingData();

    // Suscripción Realtime para órdenes e items
    const pickingChannel = supabase
      .channel('picking_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_picking' }, () => {
        fetchPickingData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items_picking' }, () => {
        fetchPickingData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(pickingChannel);
    };
  }, [fetchPickingData]);

  // Sonidos de validación y vibración
  const playSound = (success: boolean) => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 1320 : 440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Silent
    }
  };

  const triggerHaptic = (success: boolean) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(success ? [60, 40, 60] : [150, 60, 150]);
      } catch {
        // Silent
      }
    }
  };

  // KPI Computations
  const totalOrders = ordenes.length;
  const activeOrders = ordenes.filter(o => o.estado === 'PENDIENTE' || o.estado === 'EN_PROCESO').length;
  const completedOrders = ordenes.filter(o => o.estado === 'COMPLETADO' || o.estado === 'DESPACHADO').length;
  const totalPendingPackages = ordenes
    .filter(o => o.estado !== 'DESPACHADO')
    .reduce((acc, o) => acc + (o.totalPaquetes - o.recolectadosPaquetes), 0);

  // Filtrado de órdenes con Motor Fuzzy Inteligente
  const filteredOrders = useMemo(() => {
    return ordenes.filter(o => {
      const matchesSearch = matchesFuzzySearch(searchTerm, [
        o.codigoOrden,
        o.transportistaAgencia,
        o.operadorAsignado,
        o.destinoCiudad,
        o.notas
      ]);

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'PENDING'
          ? o.estado === 'PENDIENTE' || o.estado === 'EN_PROCESO'
          : o.estado === 'COMPLETADO' || o.estado === 'DESPACHADO';

      return matchesSearch && matchesStatus;
    });
  }, [ordenes, searchTerm, statusFilter]);

  // Paquetes en almacén Lince disponibles para picking
  const linceAvailablePackages = useMemo(() => {
    return paquetes.filter(p => p.ubicacionActual === 'AmexLince' || p.estadoEntrega === 'EnAlmacen');
  }, [paquetes]);

  // Previsualización al pegar códigos WR
  const pastedParsedItems = useMemo(() => {
    if (!rawPastedCodes.trim()) return [];

    const tokens = rawPastedCodes
      .split(/[\n,;\t ]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);

    const uniqueTokens = Array.from(new Set(tokens));

    return uniqueTokens.map(token => {
      const foundPkg = paquetes.find(
        p =>
          p.numeroReciboBodega.toUpperCase() === token ||
          p.trackingUsa.toUpperCase() === token ||
          p.codigoCasillero.toUpperCase() === token ||
          (token.length >= 5 && p.numeroReciboBodega.toUpperCase().includes(token))
      );

      const foundCli = clientes.find(
        c =>
          c.codigoCasillero.toUpperCase() === token ||
          (foundPkg && c.codigoCasillero.toUpperCase() === foundPkg.codigoCasillero.toUpperCase())
      );

      const anaquel = foundPkg?.posicionEstante || (foundPkg?.anaquel ? `${foundPkg.anaquel}-${foundPkg.piso || 'P1'}` : 'A1-P1');

      return {
        code: token,
        pkg: foundPkg,
        cli: foundCli,
        anaquel,
        isLocated: Boolean(foundPkg)
      };
    });
  }, [rawPastedCodes, paquetes, clientes]);

  // CREAR NUEVA ORDEN DE PICKING
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingOrder(true);

    try {
      const now = new Date();
      const codeSuffix = Math.floor(100 + Math.random() * 900);
      const codigoOrden = `PCK-${newOrderAgencia.replace(/\s+/g, '')}-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${codeSuffix}`;

      let itemsToInsert: {
        codigo_recibo_bodega: string;
        tracking_usa: string;
        consignatario: string;
        dni_consignatario: string;
        telefono_consignatario: string;
        ciudad_destino: string;
        direccion_destino: string;
        ubicacion_anaquel: string;
        paquete_id: string | null;
        peso_kg: number;
      }[] = [];

      if (newOrderInputMode === 'paste') {
        if (pastedParsedItems.length === 0) {
          alert('Por favor pega al menos un código WR o tracking.');
          setIsCreatingOrder(false);
          return;
        }

        itemsToInsert = pastedParsedItems.map(item => ({
          codigo_recibo_bodega: item.pkg ? item.pkg.numeroReciboBodega : item.code,
          tracking_usa: item.pkg ? item.pkg.trackingUsa : '',
          consignatario: item.cli ? item.cli.nombre : (item.pkg?.nombreConsignatario || 'Cliente'),
          dni_consignatario: item.cli ? item.cli.documentoIdentidad : (item.pkg?.dniConsignatario || ''),
          telefono_consignatario: item.cli ? item.cli.telefono || '' : '',
          ciudad_destino: item.cli ? item.cli.provincia || newOrderDestino : newOrderDestino,
          direccion_destino: item.cli ? item.cli.direccionEntrega || '' : '',
          ubicacion_anaquel: item.anaquel,
          paquete_id: item.pkg ? item.pkg.id : null,
          peso_kg: item.pkg ? item.pkg.pesoKg : 1.0
        }));
      } else {
        if (selectedInventoryPkgIds.length === 0) {
          alert('Por favor selecciona al menos un paquete del inventario.');
          setIsCreatingOrder(false);
          return;
        }

        const selectedPkgs = paquetes.filter(p => selectedInventoryPkgIds.includes(p.id));
        itemsToInsert = selectedPkgs.map(pkg => {
          const cli = clientes.find(c => c.codigoCasillero === pkg.codigoCasillero);
          return {
            codigo_recibo_bodega: pkg.numeroReciboBodega,
            tracking_usa: pkg.trackingUsa,
            consignatario: cli ? cli.nombre : (pkg.nombreConsignatario || 'Cliente'),
            dni_consignatario: cli ? cli.documentoIdentidad : (pkg.dniConsignatario || ''),
            telefono_consignatario: cli ? cli.telefono || '' : '',
            ciudad_destino: cli ? cli.provincia || newOrderDestino : newOrderDestino,
            direccion_destino: cli ? cli.direccionEntrega || '' : '',
            ubicacion_anaquel: pkg.posicionEstante || `${pkg.anaquel || 'A1'}-${pkg.piso || 'P1'}`,
            paquete_id: pkg.id,
            peso_kg: pkg.pesoKg
          };
        });
      }

      // 1. Insertar orden de picking
      const { data: orderData, error: orderError } = await supabase
        .from('ordenes_picking')
        .insert({
          codigo_orden: codigoOrden,
          transportista_agencia: newOrderAgencia,
          destino_ciudad: newOrderDestino,
          estado: 'PENDIENTE',
          operador_asignado: newOrderOperador,
          total_paquetes: itemsToInsert.length,
          recolectados_paquetes: 0,
          notas: newOrderNotas,
          creado_por: 'Administración AMEX'
        })
        .select()
        .single();

      if (orderError || !orderData) {
        throw new Error(orderError?.message || 'Error creando orden');
      }

      // 2. Insertar items de la orden
      const formattedItems = itemsToInsert.map(it => ({
        ...it,
        orden_picking_id: orderData.id,
        estado_item: 'PENDIENTE'
      }));

      await supabase.from('items_picking').insert(formattedItems);

      // Limpiar y cerrar
      setRawPastedCodes('');
      setSelectedInventoryPkgIds([]);
      setNewOrderNotas('');
      setIsNewOrderModalOpen(false);
      await fetchPickingData();

      alert(`✓ Orden de Picking ${codigoOrden} creada con éxito (${itemsToInsert.length} paquetes asignados a estanterías).`);
    } catch (err) {
      console.error('Error al crear orden de picking:', err);
      alert('Error al crear la orden de picking.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // MARCAR / DESMARCAR ITEM INDIVIDUAL EN PICKING CON PERSISTENCIA EN SUPABASE
  const handleToggleItemCollected = async (item: ItemPicking, order: OrdenPicking) => {
    const nextState = item.estadoItem === 'RECOLECTADO' ? 'PENDIENTE' : 'RECOLECTADO';
    const isCollected = nextState === 'RECOLECTADO';

    playSound(isCollected);
    triggerHaptic(isCollected);

    try {
      // 1. Actualizar item en Supabase
      await supabase
        .from('items_picking')
        .update({
          estado_item: nextState,
          recolectado_en: isCollected ? new Date().toISOString() : null,
          recolectado_por: isCollected ? 'Operador Logístico AMEX' : null
        })
        .eq('id', item.id);

      // 2. Calcular nuevo conteo de la orden
      const currentItems = itemsMap[order.id] || [];
      const updatedItems = currentItems.map(it => it.id === item.id ? { ...it, estadoItem: nextState as 'PENDIENTE' | 'RECOLECTADO' } : it);
      const newCollectedCount = updatedItems.filter(it => it.estadoItem === 'RECOLECTADO').length;
      const newOrderState: TipoEstadoPicking =
        newCollectedCount === order.totalPaquetes
          ? 'COMPLETADO'
          : newCollectedCount > 0
          ? 'EN_PROCESO'
          : 'PENDIENTE';

      await supabase
        .from('ordenes_picking')
        .update({
          recolectados_paquetes: newCollectedCount,
          estado: newOrderState,
          completado_en: newCollectedCount === order.totalPaquetes ? new Date().toISOString() : null
        })
        .eq('id', order.id);

      // Actualizar estado local inmediato
      setItemsMap(prev => ({
        ...prev,
        [order.id]: updatedItems
      }));

      setOrdenes(prev =>
        prev.map(o =>
          o.id === order.id
            ? { ...o, recolectadosPaquetes: newCollectedCount, estado: newOrderState }
            : o
        )
      );

      if (activeExecutionOrder?.id === order.id) {
        setActiveExecutionOrder(prev =>
          prev ? { ...prev, recolectadosPaquetes: newCollectedCount, estado: newOrderState } : null
        );
      }
    } catch (err) {
      console.error('Error toggling item:', err);
    }
  };

  // PROCESAR ESCANEO DESDE CÁMARA O ENTRADA MANUAL EN MODO PICKING
  const handleProcessBarcodeInPicking = (code: string) => {
    if (!activeExecutionOrder) return;
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    const currentItems = itemsMap[activeExecutionOrder.id] || [];

    const matchedItem = currentItems.find(
      it =>
        it.codigoReciboBodega.toUpperCase() === clean ||
        it.trackingUsa?.toUpperCase() === clean ||
        (clean.length >= 5 && it.codigoReciboBodega.toUpperCase().includes(clean))
    );

    if (matchedItem) {
      if (matchedItem.estadoItem === 'RECOLECTADO') {
        playSound(true);
        setScanFeedbackMessage({
          text: `ℹ️ El paquete ${matchedItem.codigoReciboBodega} ya estaba marcado como recolectado.`,
          isError: false
        });
      } else {
        handleToggleItemCollected(matchedItem, activeExecutionOrder);
        setScanFeedbackMessage({
          text: `✅ ¡Recolectado! ${matchedItem.codigoReciboBodega} (${matchedItem.ubicacionAnaquel})`,
          isError: false
        });
      }
    } else {
      playSound(false);
      triggerHaptic(false);
      setScanFeedbackMessage({
        text: `⚠️ El código "${clean}" NO PERTENECE a esta orden de ${activeExecutionOrder.transportistaAgencia}.`,
        isError: true
      });
    }

    setTimeout(() => {
      setScanFeedbackMessage(null);
    }, 3500);
  };

  // ✏️ ABRIR MODAL DE EDICIÓN DE ORDEN DE PICKING
  const handleOpenEditPicking = (order: OrdenPicking) => {
    setEditingOrder(order);
    setEditOrderAgencia(order.transportistaAgencia || 'SHALOM');
    setEditOrderDestino(order.destinoCiudad || 'LIMA / PROVINCIAS');
    setEditOrderOperador(order.operadorAsignado || 'Operador Logístico AMEX');
    setEditOrderNotas(order.notas || '');
    setEditOrderNewWrs('');
    setEditOrderItems(itemsMap[order.id] ? [...itemsMap[order.id]] : []);
  };

  // Remover item en edición
  const handleRemoveItemFromEdit = async (itemId: string) => {
    if (editOrderItems.length <= 1) {
      alert('La orden de picking debe tener al menos 1 paquete.');
      return;
    }
    setEditOrderItems(editOrderItems.filter(it => it.id !== itemId));
  };

  // GUARDAR EDICIÓN DE ORDEN DE PICKING
  const handleSaveEditedPickingOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    try {
      setIsSavingEditOrder(true);

      // 1. Procesar posibles nuevos códigos WR agregados
      let updatedItems = [...editOrderItems];
      if (editOrderNewWrs.trim()) {
        const tokens = editOrderNewWrs
          .split(/[\n,;\t ]+/)
          .map(t => t.trim().toUpperCase())
          .filter(t => t.length > 0);

        for (const token of tokens) {
          if (!updatedItems.some(it => it.codigoReciboBodega.toUpperCase() === token)) {
            const foundPkg = paquetes.find(p => p.numeroReciboBodega.toUpperCase() === token);
            const foundCli = clientes.find(c => c.codigoCasillero === foundPkg?.codigoCasillero);

            const newItem: ItemPicking = {
              id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              ordenPickingId: editingOrder.id,
              paqueteId: foundPkg?.id,
              codigoReciboBodega: token,
              trackingUsa: foundPkg?.trackingUsa || '',
              consignatario: foundCli?.nombre || foundPkg?.nombreConsignatario || 'Cliente',
              dniConsignatario: foundCli?.documentoIdentidad || foundPkg?.dniConsignatario || '',
              telefonoConsignatario: foundCli?.telefono || '',
              ciudadDestino: editOrderDestino,
              direccionDestino: foundCli?.direccionEntrega || '',
              ubicacionAnaquel: foundPkg?.posicionEstante || (foundPkg?.anaquel ? `${foundPkg.anaquel}-${foundPkg.piso || 'P1'}` : 'A1-P1'),
              estadoItem: 'PENDIENTE',
              pesoKg: foundPkg?.pesoKg || 1.0,
              creadoEn: new Date().toISOString()
            };

            // Insertar en Supabase `items_picking`
            await supabase.from('items_picking').insert({
              orden_picking_id: editingOrder.id,
              paquete_id: newItem.paqueteId,
              codigo_recibo_bodega: newItem.codigoReciboBodega,
              tracking_usa: newItem.trackingUsa,
              consignatario: newItem.consignatario,
              dni_consignatario: newItem.dniConsignatario,
              telefono_consignatario: newItem.telefonoConsignatario,
              ciudad_destino: newItem.ciudadDestino,
              direccion_destino: newItem.direccionDestino,
              ubicacion_anaquel: newItem.ubicacionAnaquel,
              estado_item: 'PENDIENTE',
              peso_kg: newItem.pesoKg
            });

            updatedItems.push(newItem);
          }
        }
      }

      // 2. Eliminar items que se hayan quitado en el modal
      const currentInDb = itemsMap[editingOrder.id] || [];
      const removedIds = currentInDb.filter(dbIt => !updatedItems.some(u => u.id === dbIt.id)).map(x => x.id);
      if (removedIds.length > 0) {
        await supabase.from('items_picking').delete().in('id', removedIds);
      }

      // 3. Actualizar cabecera de la orden
      const totalPkgs = updatedItems.length;
      const recolectadosCount = updatedItems.filter(it => it.estadoItem === 'RECOLECTADO').length;
      const nextState: TipoEstadoPicking =
        recolectadosCount === totalPkgs && totalPkgs > 0
          ? 'COMPLETADO'
          : recolectadosCount > 0
          ? 'EN_PROCESO'
          : 'PENDIENTE';

      await supabase
        .from('ordenes_picking')
        .update({
          transportista_agencia: editOrderAgencia,
          destino_ciudad: editOrderDestino,
          operador_asignado: editOrderOperador,
          notas: editOrderNotas,
          total_paquetes: totalPkgs,
          recolectados_paquetes: recolectadosCount,
          estado: nextState
        })
        .eq('id', editingOrder.id);

      alert(`✓ Orden de Picking ${editingOrder.codigoOrden} actualizada con éxito (${totalPkgs} paquetes).`);
      setEditingOrder(null);
      await fetchPickingData();
    } catch (err) {
      console.error('Error al editar orden de picking:', err);
      alert('Error al actualizar la orden de picking.');
    } finally {
      setIsSavingEditOrder(false);
    }
  };

  // DESPACHAR ORDEN CONSOLIDADA (SHALOM / OLVA)
  const handleDispatchOrder = async (order: OrdenPicking) => {
    const currentItems = itemsMap[order.id] || [];
    const pendingItems = currentItems.filter(it => it.estadoItem !== 'RECOLECTADO');

    if (pendingItems.length > 0) {
      if (!confirm(`Hay ${pendingItems.length} paquete(s) pendientes de recolectar. ¿Deseas despachar de todas formas?`)) {
        return;
      }
    }

    try {
      await supabase
        .from('ordenes_picking')
        .update({
          estado: 'DESPACHADO',
          completado_en: new Date().toISOString()
        })
        .eq('id', order.id);

      for (const item of currentItems) {
        if (item.paqueteId) {
          await supabase
            .from('paquetes')
            .update({
              estado_entrega: 'Entregado',
              ubicacion_actual: 'Entregado'
            })
            .eq('id', item.paqueteId);

          if (onUpdatePackage) {
            const match = paquetes.find(p => p.id === item.paqueteId);
            if (match) {
              onUpdatePackage({
                ...match,
                estadoEntrega: 'Entregado',
                ubicacionActual: 'Entregado'
              });
            }
          }

          await supabase.from('historial_trazabilidad').insert({
            paquete_id: item.paqueteId,
            ubicacion: `Despachado a Agencia ${order.transportistaAgencia}`,
            descripcion_evento: `Entregado al transportista ${order.transportistaAgencia} (Orden ${order.codigoOrden})`,
            usuario_operador: 'Operador Logístico AMEX'
          });
        }

        await supabase.from('movimientos_kardex').insert({
          paquete_id: item.paqueteId,
          codigo_paquete: item.codigoReciboBodega,
          consignatario: item.consignatario || 'Cliente',
          origen_descripcion: `AmexLince (${item.ubicacionAnaquel})`,
          destino_descripcion: `Agencia ${order.transportistaAgencia} (${item.ciudadDestino || 'Provincia'})`,
          tipo_movimiento: 'DESPACHO_AGENCIA',
          motivo: `Despacho consolidado en Orden ${order.codigoOrden}`,
          usuario_operador: 'Operador Logístico AMEX'
        });
      }

      await fetchPickingData();
      setActiveExecutionOrder(null);
      setManifestOrder(order);

      alert(`✓ ¡Éxito! Orden ${order.codigoOrden} despachada hacia ${order.transportistaAgencia}. Manifiesto generado.`);
    } catch (err) {
      console.error('Error despachando orden:', err);
      alert('Error al despachar la orden.');
    }
  };

  // Eliminar orden de picking
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta orden de picking?')) return;
    try {
      await supabase.from('ordenes_picking').delete().eq('id', orderId);
      await fetchPickingData();
    } catch (err) {
      console.error('Error eliminando orden:', err);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="sap-breadcrumb">
        <span>Operaciones y Almacenes</span> / <span>Listas de Picking, Búsqueda de WRs y Despacho a Agencias</span>
      </div>

      {/* KPI RIBBON DE ÓRDENES DE PICKING */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        <div
          onClick={() => setStatusFilter('ALL')}
          style={{
            background: statusFilter === 'ALL' ? '#eff6ff' : '#ffffff',
            border: statusFilter === 'ALL' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ClipboardList className="w-4 h-4 text-blue-600" /> Órdenes Totales
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#1e3a8a', marginTop: '4px' }}>
            {totalOrders} <span style={{ fontSize: '12px', fontWeight: 700 }}>listas</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('PENDING')}
          style={{
            background: statusFilter === 'PENDING' ? '#fef3c7' : '#ffffff',
            border: statusFilter === 'PENDING' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock className="w-4 h-4 text-amber-600" /> En Recolección (Activas)
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#92400e', marginTop: '4px' }}>
            {activeOrders} <span style={{ fontSize: '12px', fontWeight: 700 }}>órdenes</span>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers className="w-4 h-4 text-red-600" /> Paquetes por Buscar
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#991b1b', marginTop: '4px' }}>
            {totalPendingPackages} <span style={{ fontSize: '12px', fontWeight: 700 }}>en estantes</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('COMPLETED')}
          style={{
            background: statusFilter === 'COMPLETED' ? '#dcfce7' : '#ffffff',
            border: statusFilter === 'COMPLETED' ? '2px solid #16a34a' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Truck className="w-4 h-4 text-green-600" /> Despachadas a Agencias
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#166534', marginTop: '4px' }}>
            {completedOrders} <span style={{ fontSize: '12px', fontWeight: 700 }}>completadas</span>
          </div>
        </div>
      </div>

      {/* BANDEJA PRINCIPAL DE ÓRDENES */}
      <div className="card-panel">
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ClipboardList className="w-4 h-4 text-blue-600" /> Listas de Picking & Consolidación para Despacho
            </h3>
            <span className="panel-count">{filteredOrders.length}</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="btn btn-primary"
              style={{ height: '38px', padding: '0 14px', fontSize: '12.5px', borderRadius: '8px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2563eb' }}
            >
              <Plus className="w-4 h-4" /> ➕ Nueva Lista de Picking (Pegar WRs)
            </button>

            <button
              onClick={fetchPickingData}
              className="btn btn-secondary"
              style={{ height: '38px', padding: '0 10px', fontSize: '12px', borderRadius: '8px', fontWeight: 700 }}
              title="Actualizar datos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div style={{ padding: '0 16px 12px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por código de orden, agencia (Shalom, Olva) u operador..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                paddingLeft: '34px',
                paddingRight: '12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* LISTADO DE TARJETAS DE ÓRDENES */}
        <div style={{ padding: '0 16px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: '12px' }}>
          {filteredOrders.length > 0 ? (
            filteredOrders.map(order => {
              const items = itemsMap[order.id] || [];
              const progressPct = order.totalPaquetes > 0 ? Math.round((order.recolectadosPaquetes / order.totalPaquetes) * 100) : 0;
              const isShalom = order.transportistaAgencia.toUpperCase().includes('SHALOM');
              const isOlva = order.transportistaAgencia.toUpperCase().includes('OLVA');
              const isDone = order.estado === 'COMPLETADO' || order.estado === 'DESPACHADO';

              return (
                <div
                  key={order.id}
                  style={{
                    background: '#ffffff',
                    border: isDone ? '1.5px solid #86efac' : '1.5px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '14px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    {/* Header de la tarjeta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: isShalom ? '#fee2e2' : isOlva ? '#fef3c7' : '#eff6ff',
                            color: isShalom ? '#b91c1c' : isOlva ? '#92400e' : '#1e40af',
                            textTransform: 'uppercase'
                          }}
                        >
                          🚚 {order.transportistaAgencia}
                        </span>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                          {order.codigoOrden}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: order.estado === 'DESPACHADO' ? '#dcfce7' : order.estado === 'COMPLETADO' ? '#dbeafe' : '#fef3c7',
                          color: order.estado === 'DESPACHADO' ? '#166534' : order.estado === 'COMPLETADO' ? '#1e40af' : '#92400e'
                        }}
                      >
                        {order.estado === 'DESPACHADO' ? '🟢 Despachado' : order.estado === 'COMPLETADO' ? '🔵 100% Recolectado' : '🟡 En Recolección'}
                      </span>
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '8px' }}>
                      📍 Destino: <strong>{order.destinoCiudad}</strong> · 👤 Operador: <strong>{order.operadorAsignado}</strong>
                    </div>

                    {/* Barra de progreso de recolección */}
                    <div style={{ background: '#f1f5f9', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 800, marginBottom: '4px' }}>
                        <span style={{ color: '#334155' }}>Progreso de Recolección:</span>
                        <span style={{ color: progressPct === 100 ? '#16a34a' : '#2563eb' }}>
                          {order.recolectadosPaquetes} / {order.totalPaquetes} ({progressPct}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '7px', background: '#cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
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

                    {/* Desglose de anaqueles asignados */}
                    <div style={{ fontSize: '11px', color: '#475569', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {Array.from(new Set(items.map(it => it.ubicacionAnaquel.split('-')[0]))).map(shelf => (
                        <span key={shelf} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          📦 {shelf}: {items.filter(it => it.ubicacionAnaquel.startsWith(shelf)).length} bultos
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Acciones de la tarjeta (ADAPTADAS PARA MÓVIL Y PC) */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    <button
                      onClick={() => setActiveExecutionOrder(order)}
                      className="btn btn-primary"
                      style={{ flex: '1 1 120px', height: '38px', fontSize: '12px', fontWeight: 800, borderRadius: '8px', justifyContent: 'center', gap: '6px' }}
                    >
                      <Barcode className="w-4 h-4" />
                      {order.estado === 'DESPACHADO' ? 'Ver Recolección' : 'Buscar / Recolectar'}
                    </button>

                    <button
                      onClick={() => handleOpenEditPicking(order)}
                      className="btn btn-secondary"
                      style={{ flex: '1 1 100px', height: '38px', fontSize: '11.5px', fontWeight: 700, borderRadius: '8px', justifyContent: 'center', gap: '4px' }}
                      title="Editar orden o agregar más WRs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" /> Editar WRs
                    </button>

                    <button
                      onClick={() => setManifestOrder(order)}
                      className="btn btn-secondary"
                      style={{ flex: '1 1 90px', height: '38px', fontSize: '11.5px', fontWeight: 700, borderRadius: '8px', justifyContent: 'center', gap: '4px' }}
                      title="Ver Manifiesto de Despacho"
                    >
                      <FileText className="w-3.5 h-3.5" /> Manifiesto
                    </button>

                    <button
                      onClick={() => handleDeleteOrder(order.id)}
                      className="btn"
                      style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Eliminar orden de picking"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <ClipboardList className="w-12 h-12 text-slate-300" style={{ margin: '0 auto 10px auto' }} />
              <p style={{ fontWeight: 800, color: '#334155', fontSize: '14px', margin: 0 }}>No hay listas de picking creadas</p>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Presiona <strong>&quot;➕ Nueva Lista de Picking&quot;</strong> para pegar códigos WR y asignarle a los operarios la ruta de anaqueles.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ➕ MODAL DE CREACIÓN DE NUEVA ORDEN DE PICKING */}
      {isNewOrderModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
                <ClipboardList className="w-5 h-5" /> Nueva Lista de Picking para Agencias
              </span>
              <button
                onClick={() => setIsNewOrderModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="wms-modal-grid-2">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Agencia de Transporte / Destino</label>
                  <select
                    value={newOrderAgencia}
                    onChange={e => setNewOrderAgencia(e.target.value)}
                    className="form-control"
                    required
                  >
                    <option value="SHALOM">🔴 SHALOM (Agencia / Provincia)</option>
                    <option value="OLVA COURIER">🟡 OLVA COURIER (Nacional)</option>
                    <option value="MARVISUR">🔵 MARVISUR (Carga Pesada)</option>
                    <option value="CARRO AMEX LINCE">🟢 CARRO AMEX (Reparto Local Lima)</option>
                    <option value="AGENCIA PROVINCIA">🟣 OTRA AGENCIA PROVINCIA</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Ciudad Destino / Ruta</label>
                  <input
                    type="text"
                    value={newOrderDestino}
                    onChange={e => setNewOrderDestino(e.target.value)}
                    className="form-control"
                    placeholder="Ej: LIMA / TRUJILLO / AREQUIPA"
                    required
                  />
                </div>
              </div>

              <div className="wms-modal-grid-2">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Operador Responsable en Almacén</label>
                  <input
                    type="text"
                    value={newOrderOperador}
                    onChange={e => setNewOrderOperador(e.target.value)}
                    className="form-control"
                    placeholder="Nombre del operario"
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Notas de Despacho (Opcional)</label>
                  <input
                    type="text"
                    value={newOrderNotas}
                    onChange={e => setNewOrderNotas(e.target.value)}
                    className="form-control"
                    placeholder="Ej: Salida turno tarde 4:00 PM"
                  />
                </div>
              </div>

              {/* Selector de modo de carga: Pegar Códigos vs Selección */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '8px' }}>
                <button
                  type="button"
                  onClick={() => setNewOrderInputMode('paste')}
                  style={{
                    background: newOrderInputMode === 'paste' ? '#2563eb' : '#f1f5f9',
                    color: newOrderInputMode === 'paste' ? '#ffffff' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  📋 Pegar Lista de Códigos WR
                </button>
                <button
                  type="button"
                  onClick={() => setNewOrderInputMode('select')}
                  style={{
                    background: newOrderInputMode === 'select' ? '#2563eb' : '#f1f5f9',
                    color: newOrderInputMode === 'select' ? '#ffffff' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  📦 Seleccionar de Inventario ({linceAvailablePackages.length} en almacén)
                </button>
              </div>

              {newOrderInputMode === 'paste' ? (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Pega los códigos WR o Trackings (separados por líneas, comas o espacios):
                  </label>
                  <textarea
                    rows={4}
                    value={rawPastedCodes}
                    onChange={e => setRawPastedCodes(e.target.value)}
                    placeholder="WR000451&#10;WR000452&#10;WR000458"
                    className="form-control"
                    style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.4' }}
                    required
                  />

                  {/* Previsualización en vivo de Anaqueles detectados */}
                  {pastedParsedItems.length > 0 && (
                    <div style={{ marginTop: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', maxHeight: '160px', overflowY: 'auto' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                        🎯 {pastedParsedItems.length} Códigos Detectados y Ubicados en Almacén:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {pastedParsedItems.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '4px 6px',
                              background: '#ffffff',
                              borderRadius: '4px',
                              border: '1px solid #f1f5f9',
                              fontSize: '11.5px'
                            }}
                          >
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                              {item.code}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {item.pkg?.nombreConsignatario || 'Cliente'}
                            </span>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 900,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: item.isLocated ? '#dbeafe' : '#fef3c7',
                                color: item.isLocated ? '#1e40af' : '#92400e'
                              }}
                            >
                              📍 {item.anaquel}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px' }}>
                  {linceAvailablePackages.map(pkg => {
                    const isChecked = selectedInventoryPkgIds.includes(pkg.id);
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => {
                          setSelectedInventoryPkgIds(prev =>
                            isChecked ? prev.filter(x => x !== pkg.id) : [...prev, pkg.id]
                          );
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          background: isChecked ? '#eff6ff' : 'transparent',
                          fontSize: '12px'
                        }}
                      >
                        <input type="checkbox" checked={isChecked} readOnly />
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                          {pkg.numeroReciboBodega}
                        </span>
                        <span style={{ color: '#64748b', flex: 1 }}>{pkg.nombreConsignatario}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#2563eb' }}>
                          📍 {pkg.posicionEstante || `${pkg.anaquel || 'A1'}-${pkg.piso || 'P1'}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '8px' }}>
                <button type="button" onClick={() => setIsNewOrderModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={isCreatingOrder} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {isCreatingOrder ? 'Creando Orden...' : '✓ Crear y Asignar Orden de Picking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ MODAL DE EDICIÓN DE ORDEN DE PICKING */}
      {editingOrder && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '600px', maxHeight: '92vh' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
                <Edit3 className="w-5 h-5" /> Editar Lista de Picking ({editingOrder.codigoOrden})
              </span>
              <button
                onClick={() => setEditingOrder(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedPickingOrder} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="wms-modal-grid-2">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Agencia</label>
                  <select
                    value={editOrderAgencia}
                    onChange={e => setEditOrderAgencia(e.target.value)}
                    className="form-control"
                  >
                    <option value="SHALOM">🔴 SHALOM (Agencia / Provincia)</option>
                    <option value="OLVA COURIER">🟡 OLVA COURIER (Nacional)</option>
                    <option value="MARVISUR">🔵 MARVISUR (Carga Pesada)</option>
                    <option value="CARRO AMEX LINCE">🟢 CARRO AMEX</option>
                    <option value="AGENCIA PROVINCIA">🟣 OTRA AGENCIA</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Ciudad Destino</label>
                  <input
                    type="text"
                    value={editOrderDestino}
                    onChange={e => setEditOrderDestino(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="wms-modal-grid-2">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Operador Responsable</label>
                  <input
                    type="text"
                    value={editOrderOperador}
                    onChange={e => setEditOrderOperador(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Notas</label>
                  <input
                    type="text"
                    value={editOrderNotas}
                    onChange={e => setEditOrderNotas(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              {/* LISTA ACTUAL DE ITEMS DE PICKING */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  📦 Paquetes en esta Lista ({editOrderItems.length}):
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px' }}>
                  {editOrderItems.map(item => (
                    <div
                      key={item.id}
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
                          {item.codigoReciboBodega}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          📍 {item.ubicacionAnaquel}
                        </span>
                        <span style={{ fontSize: '11px', color: '#475569' }}>
                          {item.consignatario}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItemFromEdit(item.id)}
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
                  value={editOrderNewWrs}
                  onChange={e => setEditOrderNewWrs(e.target.value)}
                  placeholder="WR000455, WR000456"
                  className="form-control"
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>

              <div className="modal-footer" style={{ marginTop: '8px' }}>
                <button type="button" onClick={() => setEditingOrder(null)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={isSavingEditOrder} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {isSavingEditOrder ? 'Guardando...' : '✓ Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📱 MODAL DE EJECUCIÓN MÓVIL DE RECOLECCIÓN (OPERARIOS CON CELULAR O PISTOLA) */}
      {activeExecutionOrder && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '640px', maxHeight: '94vh' }}>
            <div className="modal-header" style={{ background: '#0f172a', color: '#ffffff' }}>
              <div>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase' }}>
                  Lista de Recolección en Almacén
                </span>
                <div style={{ fontSize: '16px', fontWeight: 900, fontFamily: 'monospace' }}>
                  {activeExecutionOrder.codigoOrden} · 🚚 {activeExecutionOrder.transportistaAgencia}
                </div>
              </div>
              <button
                onClick={() => setActiveExecutionOrder(null)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Barra de progreso destacada */}
              <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                    🎯 Progreso: {activeExecutionOrder.recolectadosPaquetes} / {activeExecutionOrder.totalPaquetes} recolectados
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: activeExecutionOrder.recolectadosPaquetes === activeExecutionOrder.totalPaquetes ? '#16a34a' : '#2563eb' }}>
                    {Math.round((activeExecutionOrder.recolectadosPaquetes / (activeExecutionOrder.totalPaquetes || 1)) * 100)}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '9px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: activeExecutionOrder.recolectadosPaquetes === activeExecutionOrder.totalPaquetes ? '#16a34a' : '#2563eb',
                      width: `${(activeExecutionOrder.recolectadosPaquetes / (activeExecutionOrder.totalPaquetes || 1)) * 100}%`,
                      transition: 'width 0.2s ease'
                    }}
                  />
                </div>
              </div>

              {/* Mensaje de feedback de escaneo */}
              {scanFeedbackMessage && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: scanFeedbackMessage.isError ? '#fef2f2' : '#dcfce7',
                    border: scanFeedbackMessage.isError ? '1px solid #fecaca' : '1px solid #86efac',
                    color: scanFeedbackMessage.isError ? '#dc2626' : '#166534'
                  }}
                >
                  {scanFeedbackMessage.isError ? <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                  <span>{scanFeedbackMessage.text}</span>
                </div>
              )}

              {/* Entrada de escaneo rápido / pistola */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Barcode className="w-4 h-4 text-blue-600" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Pistolea o escribe código WR para marcar..."
                    value={inModalScanInput}
                    onChange={e => setInModalScanInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleProcessBarcodeInPicking(inModalScanInput);
                        setInModalScanInput('');
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '38px',
                      paddingLeft: '34px',
                      paddingRight: '10px',
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
                  type="button"
                  onClick={() => {
                    handleProcessBarcodeInPicking(inModalScanInput);
                    setInModalScanInput('');
                  }}
                  className="btn btn-primary"
                  style={{ height: '38px', padding: '0 12px', fontSize: '12px', fontWeight: 800, borderRadius: '8px' }}
                >
                  ✓ Marcar
                </button>
              </div>

              {/* LISTA ORDENADA INTELIGENTEMENTE POR ANAQUELES (DESPLAZAMIENTO FLUIDO) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(
                  (itemsMap[activeExecutionOrder.id] || []).reduce((acc, item) => {
                    const shelf = item.ubicacionAnaquel.split('-')[0] || 'A1';
                    if (!acc[shelf]) acc[shelf] = [];
                    acc[shelf].push(item);
                    return acc;
                  }, {} as Record<string, ItemPicking[]>)
                ).map(([shelf, items]) => (
                  <div key={shelf} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        background: shelf === 'A1' ? '#dbeafe' : shelf === 'A2' ? '#dcfce7' : '#fef3c7',
                        color: shelf === 'A1' ? '#1e40af' : shelf === 'A2' ? '#166534' : '#92400e',
                        padding: '8px 12px',
                        fontWeight: 900,
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>📦 {shelf === 'A1' ? 'Anaquel 1 (A1)' : shelf === 'A2' ? 'Anaquel 2 (A2)' : 'Mesa Recepción (REC)'}</span>
                      <span style={{ fontSize: '11px', fontWeight: 800 }}>
                        {items.filter(x => x.estadoItem === 'RECOLECTADO').length} / {items.length} recolectados
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {items.map(item => {
                        const isCollected = item.estadoItem === 'RECOLECTADO';
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              borderBottom: '1px solid #f1f5f9',
                              background: isCollected ? '#f0fdf4' : '#ffffff',
                              gap: '8px'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: '13px',
                                    fontWeight: 900,
                                    color: isCollected ? '#166534' : '#0f172a',
                                    textDecoration: isCollected ? 'line-through' : 'none'
                                  }}
                                >
                                  {item.codigoReciboBodega}
                                </span>

                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: 900,
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: isCollected ? '#86efac' : '#2563eb',
                                    color: '#ffffff',
                                    fontFamily: 'monospace'
                                  }}
                                >
                                  📍 {item.ubicacionAnaquel}
                                </span>
                              </div>

                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                {item.consignatario} {item.telefonoConsignatario ? `· 📞 ${item.telefonoConsignatario}` : ''} · {item.ciudadDestino || 'Lima'}
                              </div>
                            </div>

                            <button
                              onClick={() => handleToggleItemCollected(item, activeExecutionOrder)}
                              style={{
                                background: isCollected ? '#16a34a' : '#f1f5f9',
                                color: isCollected ? '#ffffff' : '#334155',
                                border: isCollected ? '1px solid #15803d' : '1px solid #cbd5e1',
                                borderRadius: '8px',
                                padding: '6px 10px',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {isCollected ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4" /> Recolectado
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" /> Recolectar
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveExecutionOrder(null);
                  alert('✓ Avance de recolección guardado exitosamente.');
                }}
                className="btn btn-secondary"
                style={{ fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Save className="w-4 h-4 text-blue-600" /> Guardar y Salir
              </button>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setManifestOrder(activeExecutionOrder)}
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', fontWeight: 700 }}
                >
                  <FileText className="w-4 h-4" /> Ver Manifiesto
                </button>

                <button
                  type="button"
                  onClick={() => handleDispatchOrder(activeExecutionOrder)}
                  className="btn btn-primary"
                  style={{
                    background: activeExecutionOrder.recolectadosPaquetes === activeExecutionOrder.totalPaquetes ? '#16a34a' : '#2563eb',
                    fontSize: '12.5px',
                    fontWeight: 900
                  }}
                >
                  🚚 Despachar a {activeExecutionOrder.transportistaAgencia}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📄 MODAL DE MANIFIESTO DE DESPACHO PARA AGENCIA (SHALOM / OLVA) */}
      {manifestOrder && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '680px', maxHeight: '94vh' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                <FileText className="w-5 h-5 text-blue-600" /> Manifiesto de Despacho y Entrega a Agencia
              </span>
              <button
                onClick={() => setManifestOrder(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ border: '2px solid #0f172a', borderRadius: '10px', padding: '14px', background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '8px', marginBottom: '10px' }}>
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      AMEX COURIER SAC
                    </h2>
                    <div style={{ fontSize: '11px', color: '#475569' }}>RUC: 20608912345 · Sede Central Lince, Lima</div>
                    <div style={{ fontSize: '11px', color: '#475569' }}>Transportista Encargado: <strong>{manifestOrder.transportistaAgencia}</strong></div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#2563eb', fontFamily: 'monospace' }}>
                      {manifestOrder.codigoOrden}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                      Fecha: {new Date(manifestOrder.creadoEn).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px', marginBottom: '10px', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                  <div>
                    <span>Total Bultos:</span> <strong>{manifestOrder.totalPaquetes} paquetes</strong>
                  </div>
                  <div>
                    <span>Ruta / Destino:</span> <strong>{manifestOrder.destinoCiudad}</strong>
                  </div>
                </div>

                {/* Tabla de bultos */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#334155', fontWeight: 800 }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Guía WR</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Destinatario</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>DNI / Tel</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Ciudad</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(itemsMap[manifestOrder.id] || []).map((it, idx) => (
                        <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 8px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 800 }}>{it.codigoReciboBodega}</td>
                          <td style={{ padding: '6px 8px' }}>{it.consignatario}</td>
                          <td style={{ padding: '6px 8px', color: '#475569' }}>{it.dniConsignatario || it.telefonoConsignatario || '-'}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 700 }}>{it.ciudadDestino || 'Lima'}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{ color: it.estadoItem === 'RECOLECTADO' ? '#16a34a' : '#92400e', fontWeight: 800 }}>
                              {it.estadoItem === 'RECOLECTADO' ? '✓ Listo' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Firma de Recepción de la Agencia */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '28px', paddingTop: '10px' }}>
                  <div style={{ borderTop: '1px dashed #64748b', textAlign: 'center', fontSize: '11px', color: '#475569' }}>
                    Entregado por: Operador AMEX
                  </div>
                  <div style={{ borderTop: '1px dashed #64748b', textAlign: 'center', fontSize: '11px', color: '#475569' }}>
                    Recibido por: Conductor {manifestOrder.transportistaAgencia} (Firma y Sello)
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setManifestOrder(null)}
                className="btn btn-secondary"
                style={{ fontSize: '12px' }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => exportPickingOrderToExcel(manifestOrder, itemsMap[manifestOrder.id] || [])}
                className="btn"
                style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '12px' }}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Manifiesto Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary"
                style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <Printer className="w-4 h-4" /> Imprimir Manifiesto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
