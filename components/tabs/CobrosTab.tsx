'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Receipt,
  Search,
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
  Phone,
  X,
  AlertTriangle,
  RotateCcw,
  Check,
  FileText,
  ExternalLink,
  Trash2,
  RefreshCw,
  Sparkles,
  DollarSign,
  CreditCard,
  Smartphone,
  Building,
  Image as ImageIcon,
  Camera,
  Copy,
  FolderDown,
  RotateCw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Paquete, Cliente } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { exportCobrosToExcel } from '@/lib/excelExport';
import { matchesFuzzySearch } from '@/lib/fuzzySearch';
import { getR2ViewUrl } from '@/lib/r2/client';

export interface CobroVoucher {
  id: string;
  codigo_cobro: string;
  cliente_nombre: string;
  cliente_casillero?: string;
  cliente_telefono?: string;
  monto: number;
  moneda: 'PEN' | 'USD';
  metodo_pago: 'YAPE' | 'PLIN' | 'BCP' | 'INTERBANK' | 'BBVA' | 'EFECTIVO' | 'OTRO';
  numero_operacion?: string;
  fecha_operacion?: string;
  voucher_url: string;
  voucher_key?: string;
  paquetes_wrs: Array<{
    id?: string;
    numeroReciboBodega: string;
    pesoKg?: number;
    descripcion?: string;
  }>;
  estado: 'PENDIENTE' | 'VALIDADO' | 'RECHAZADO';
  registrado_por: string;
  validado_por?: string;
  notas?: string;
  creado_en: string;
  validado_en?: string;
}

interface CobrosTabProps {
  paquetes: Paquete[];
  clientes: Cliente[];
  onUpdatePackage?: (pkg: Paquete) => void;
}

export default function CobrosTab({
  paquetes,
  clientes,
  onUpdatePackage
}: CobrosTabProps) {
  // Pestañas internas
  const [subtab, setSubtab] = useState<'todos' | 'nuevo' | 'pendientes' | 'validados'>('todos');

  // Lista de Cobros desde Supabase
  const [cobros, setCobros] = useState<CobroVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  // Estado del Formulario de Nuevo Voucher
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherPreviewUrl, setVoucherPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formValues, setFormValues] = useState({
    clienteNombre: '',
    clienteCasillero: '',
    clienteTelefono: '',
    monto: '',
    moneda: 'PEN' as 'PEN' | 'USD',
    metodoPago: 'YAPE' as CobroVoucher['metodo_pago'],
    numeroOperacion: '',
    fechaOperacion: new Date().toISOString().slice(0, 10),
    wrInput: '',
    notas: ''
  });

  const [selectedWrs, setSelectedWrs] = useState<Paquete[]>([]);
  const [wrSearchQuery, setWrSearchQuery] = useState('');

  // Modal de Visor de Voucher con Zoom & Rotación
  const [viewingVoucher, setViewingVoucher] = useState<CobroVoucher | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotationAngle, setRotationAngle] = useState(0);

  // 1. Cargar Cobros desde Supabase
  const fetchCobros = async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from('cobros_vouchers')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) {
        console.error('Error fetching cobros_vouchers:', error);
      } else if (data) {
        setCobros(data as CobroVoucher[]);
      }
    } catch (err) {
      console.error('Error en fetchCobros:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCobros();

    const channel = supabase
      .channel('realtime_cobros_vouchers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cobros_vouchers' },
        () => {
          fetchCobros();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. CAPTURA GLOBAL DE PORTAPAPELES (PASTE - CTRL + V DESDE WHATSAPP)
  const processImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('El archivo pegado o arrastrado debe ser una imagen (JPG, PNG, WEBP).');
      return;
    }
    setVoucherFile(file);
    const preview = URL.createObjectURL(file);
    setVoucherPreviewUrl(preview);
    setSubtab('nuevo');
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            processImageFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [processImageFile]);

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  // 3. Filtrado de Cobros
  const filteredCobros = useMemo(() => {
    return cobros.filter(c => {
      const wrsString = Array.isArray(c.paquetes_wrs)
        ? c.paquetes_wrs.map(w => w.numeroReciboBodega).join(' ')
        : '';

      const matchesSearch = matchesFuzzySearch(searchTerm, [
        c.codigo_cobro,
        c.cliente_nombre,
        c.cliente_casillero,
        c.cliente_telefono,
        c.numero_operacion,
        c.metodo_pago,
        c.monto,
        c.notas,
        wrsString
      ]);

      if (!matchesSearch) return false;

      if (methodFilter !== 'ALL' && c.metodo_pago !== methodFilter) {
        return false;
      }

      if (subtab === 'pendientes') {
        return c.estado === 'PENDIENTE';
      } else if (subtab === 'validados') {
        return c.estado === 'VALIDADO';
      }
      return true;
    });
  }, [cobros, searchTerm, methodFilter, subtab]);

  // Métricas Financieras
  const metrics = useMemo(() => {
    let totalSoles = 0;
    let totalDolares = 0;
    let countYape = 0;
    let countBcp = 0;
    let countPlin = 0;
    let countPendientes = 0;
    let countValidados = 0;

    cobros.forEach(c => {
      const amount = Number(c.monto || 0);
      if (c.moneda === 'PEN') {
        totalSoles += amount;
      } else {
        totalDolares += amount;
      }

      if (c.metodo_pago === 'YAPE') countYape++;
      if (c.metodo_pago === 'BCP') countBcp++;
      if (c.metodo_pago === 'PLIN') countPlin++;

      if (c.estado === 'PENDIENTE') countPendientes++;
      if (c.estado === 'VALIDADO') countValidados++;
    });

    return {
      totalSoles,
      totalDolares,
      countYape,
      countBcp,
      countPlin,
      countPendientes,
      countValidados,
      totalVouchers: cobros.length
    };
  }, [cobros]);

  // Paquetes para asociar al pago
  const paquetesDisponibles = useMemo(() => {
    return paquetes.filter(p => {
      const matchWR = matchesFuzzySearch(wrSearchQuery, [
        p.numeroReciboBodega,
        p.codigoCasillero,
        p.nombreConsignatario,
        p.dniConsignatario,
        p.posicionEstante
      ]);
      return matchWR;
    });
  }, [paquetes, wrSearchQuery]);

  // 4. Guardar Nuevo Voucher y Subir a Cloudflare R2
  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!voucherFile && !voucherPreviewUrl) {
      alert('Debes adjuntar, pegar con Ctrl+V o arrastrar la imagen del voucher.');
      return;
    }

    if (!formValues.clienteNombre.trim()) {
      alert('Por favor ingresa el nombre del cliente o consignatario.');
      return;
    }

    const montoNum = parseFloat(formValues.monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    setIsSubmitting(true);

    try {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSeq = Math.floor(100 + Math.random() * 900);
      const codigoCobro = `VOU-${todayStr}-${randomSeq}`;

      let finalVoucherUrl = '';
      let finalVoucherKey = '';

      // Subir archivo a Cloudflare R2
      if (voucherFile) {
        const formData = new FormData();
        formData.append('file', voucherFile);
        formData.append('folder', 'vouchers');
        formData.append('codigoCobro', codigoCobro);
        formData.append('clienteNombre', formValues.clienteNombre);
        formData.append('metodoPago', formValues.metodoPago);

        const uploadRes = await fetch('/api/storage/upload', {
          method: 'POST',
          body: formData
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al subir el voucher a Cloudflare R2');
        }

        const uploadData = await uploadRes.json();
        finalVoucherUrl = uploadData.url;
        finalVoucherKey = uploadData.key;
      }

      // Construir lista de WRs pagados
      const wrList: Array<{
        id?: string;
        numeroReciboBodega: string;
        pesoKg?: number;
        descripcion?: string;
      }> = [
        ...selectedWrs.map(p => ({
          id: p.id,
          numeroReciboBodega: p.numeroReciboBodega,
          pesoKg: p.pesoKg,
          descripcion: p.descripcion
        }))
      ];

      if (formValues.wrInput.trim()) {
        const manualWrs = formValues.wrInput
          .split(/[\n,;]+/)
          .map(w => w.trim().toUpperCase())
          .filter(w => w.length > 0);

        manualWrs.forEach(wr => {
          if (!wrList.some(p => p.numeroReciboBodega === wr)) {
            wrList.push({
              numeroReciboBodega: wr,
              pesoKg: 1,
              descripcion: 'Paquete liquidado por WhatsApp'
            });
          }
        });
      }

      const payload = {
        codigo_cobro: codigoCobro,
        cliente_nombre: formValues.clienteNombre,
        cliente_casillero: formValues.clienteCasillero,
        cliente_telefono: formValues.clienteTelefono,
        monto: montoNum,
        moneda: formValues.moneda,
        metodo_pago: formValues.metodoPago,
        numero_operacion: formValues.numeroOperacion || `OP-${Date.now().toString().slice(-6)}`,
        fecha_operacion: formValues.fechaOperacion,
        voucher_url: finalVoucherUrl,
        voucher_key: finalVoucherKey,
        paquetes_wrs: wrList,
        estado: 'VALIDADO',
        registrado_por: 'Caja / WhatsApp AMEX',
        validado_por: 'Sistema Automático',
        notas: formValues.notas,
        creado_en: new Date().toISOString(),
        validado_en: new Date().toISOString()
      };

      const { error } = await supabase.from('cobros_vouchers').insert([payload]);
      if (error) throw error;

      alert(
        `✅ ¡VOUCHER GUARDADO EXITOSAMENTE!\n\nCódigo: ${codigoCobro}\nCliente: ${formValues.clienteNombre}\nMonto: ${formValues.moneda === 'PEN' ? 'S/' : '$'} ${montoNum.toFixed(2)} (${formValues.metodoPago})\nAlmacenado en Cloudflare R2.`
      );

      // Limpiar formulario
      setVoucherFile(null);
      setVoucherPreviewUrl(null);
      setSelectedWrs([]);
      setFormValues({
        clienteNombre: '',
        clienteCasillero: '',
        clienteTelefono: '',
        monto: '',
        moneda: 'PEN',
        metodoPago: 'YAPE',
        numeroOperacion: '',
        fechaOperacion: new Date().toISOString().slice(0, 10),
        wrInput: '',
        notas: ''
      });
      setSubtab('todos');
      fetchCobros();
    } catch (err: any) {
      console.error('Error al guardar voucher:', err);
      alert('Error al registrar el cobro: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Validar o Rechazar Cobro existente
  const handleUpdateStatus = async (id: string, newStatus: 'VALIDADO' | 'RECHAZADO') => {
    try {
      const { error } = await supabase
        .from('cobros_vouchers')
        .update({
          estado: newStatus,
          validado_por: 'Administración AMEX',
          validado_en: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      fetchCobros();
      if (viewingVoucher && viewingVoucher.id === id) {
        setViewingVoucher({ ...viewingVoucher, estado: newStatus });
      }
    } catch (err: any) {
      console.error('Error al actualizar estado:', err);
      alert('Error: ' + err.message);
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
            <Receipt className="w-7 h-7 text-emerald-600" /> Cobros & Vouchers de WhatsApp
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
            Pega con <strong style={{ color: '#0f172a' }}>Ctrl + V</strong> o arrastra comprobantes de Yape, Plin y BCP desde WhatsApp Web directamente a Cloudflare R2
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn"
            onClick={fetchCobros}
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
            onClick={() => exportCobrosToExcel(cobros)}
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
            onClick={() => setSubtab('nuevo')}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800
            }}
          >
            <Plus className="w-4 h-4" /> Registrar Voucher (Ctrl+V)
          </button>
        </div>
      </div>

      {/* METRIC CARDS RESUMEN FINANCIERO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px',
            borderLeft: '4px solid #10b981',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Total Cobrado (Soles)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#065f46', marginTop: '4px' }}>
            S/ {metrics.totalSoles.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px', fontWeight: 700 }}>
            {metrics.countYape} Yape · {metrics.countPlin} Plin · {metrics.countBcp} BCP
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px',
            borderLeft: '4px solid #3b82f6',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Total Cobrado (Dólares)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e40af', marginTop: '4px' }}>
            $ {metrics.totalDolares.toFixed(2)} USD
          </div>
          <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px', fontWeight: 700 }}>
            Transferencias y pagos internacionales
          </div>
        </div>

        <div
          onClick={() => {
            setSubtab('validados');
            setMethodFilter('ALL');
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
            Vouchers Validados
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#166534', marginTop: '4px' }}>
            {metrics.countValidados}
          </div>
          <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>Conciliados con éxito</div>
        </div>

        <div
          onClick={() => {
            setSubtab('pendientes');
            setMethodFilter('ALL');
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
            Por Validar
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#92400e', marginTop: '4px' }}>
            {metrics.countPendientes}
          </div>
          <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>Pendientes de cotejo</div>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN */}
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
          onClick={() => setSubtab('todos')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: subtab === 'todos' ? '#059669' : '#64748b',
            borderBottom: subtab === 'todos' ? '3px solid #059669' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Receipt className="w-4 h-4" /> Todos los Vouchers ({metrics.totalVouchers})
        </button>

        <button
          onClick={() => setSubtab('nuevo')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: subtab === 'nuevo' ? '#059669' : '#64748b',
            borderBottom: subtab === 'nuevo' ? '3px solid #059669' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Plus className="w-4 h-4" /> 📋 Pegar Voucher WhatsApp (Ctrl + V)
        </button>

        <button
          onClick={() => setSubtab('pendientes')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: subtab === 'pendientes' ? '#059669' : '#64748b',
            borderBottom: subtab === 'pendientes' ? '3px solid #059669' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Clock className="w-4 h-4" /> Pendientes ({metrics.countPendientes})
        </button>

        <button
          onClick={() => setSubtab('validados')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: subtab === 'validados' ? '#059669' : '#64748b',
            borderBottom: subtab === 'validados' ? '3px solid #059669' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Validados ({metrics.countValidados})
        </button>
      </div>

      {/* SUBTAB 2: REGISTRAR / PEGAR VOUCHER */}
      {subtab === 'nuevo' && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <Smartphone className="w-6 h-6 text-emerald-600" />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                Registro Rápido de Voucher de Pago (WhatsApp)
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                Copia la imagen en WhatsApp con <strong style={{ color: '#0f172a' }}>Ctrl + C</strong> y presiona <strong style={{ color: '#0f172a' }}>Ctrl + V</strong> en esta pantalla, o arrástrala al recuadro
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveVoucher} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* DROPZONE / ZONA DE PEGA */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragging ? '2px dashed #10b981' : voucherPreviewUrl ? '1.5px solid #10b981' : '2px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '20px',
                background: isDragging ? '#ecfdf5' : voucherPreviewUrl ? '#f0fdf4' : '#f8fafc',
                textAlign: 'center',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              {voucherPreviewUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={voucherPreviewUrl}
                      alt="Voucher Preview"
                      style={{
                        maxHeight: '260px',
                        maxWidth: '100%',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        objectFit: 'contain'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setVoucherFile(null);
                        setVoucherPreviewUrl(null);
                      }}
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        background: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '26px',
                        height: '26px',
                        cursor: 'pointer',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#15803d' }}>
                    ✓ Imagen cargada y lista para subir a Cloudflare R2 ({voucherFile?.name || 'Comprobante pegado'})
                  </span>
                </div>
              ) : (
                <div style={{ padding: '24px 10px' }}>
                  <UploadCloud className="w-12 h-12 text-slate-400" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                    Arrastra aquí el comprobante o presiona <span style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + V</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Soporta capturas de pantalla, archivos JPG, PNG y fotos directas de WhatsApp Web
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      gap: '10px',
                      marginTop: '14px'
                    }}
                  >
                    {/* OPCIÓN 1: TOMAR FOTO CON CÁMARA */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        background: '#16a34a',
                        color: '#ffffff',
                        border: '1px solid #15803d',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      <Camera className="w-4 h-4" />
                      📸 Tomar Foto con Celular
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={e => {
                          if (e.target.files && e.target.files.length > 0) {
                            processImageFile(e.target.files[0]);
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>

                    {/* OPCIÓN 2: SELECCIONAR DESDE GALERÍA / ARCHIVOS */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 800,
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      🖼️ Elegir desde Galería / Archivos
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          if (e.target.files && e.target.files.length > 0) {
                            processImageFile(e.target.files[0]);
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* CAMPOS DEL FORMULARIO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                  Cliente / Consignatario *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez García"
                  value={formValues.clienteNombre}
                  onChange={e => setFormValues({ ...formValues, clienteNombre: e.target.value })}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Código Casillero</label>
                <input
                  type="text"
                  placeholder="Ej: CAS-4021"
                  value={formValues.clienteCasillero}
                  onChange={e => setFormValues({ ...formValues, clienteCasillero: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Teléfono / WhatsApp</label>
                <input
                  type="text"
                  placeholder="Ej: +51 987 654 321"
                  value={formValues.clienteTelefono}
                  onChange={e => setFormValues({ ...formValues, clienteTelefono: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Método de Pago *</label>
                <select
                  value={formValues.metodoPago}
                  onChange={e => setFormValues({ ...formValues, metodoPago: e.target.value as any })}
                  className="form-control"
                  required
                >
                  <option value="YAPE">💜 Yape (BCP)</option>
                  <option value="PLIN">💙 Plin (Interbank / BBVA / Scotiabank)</option>
                  <option value="BCP">🏦 BCP Transferencia / Depósito</option>
                  <option value="INTERBANK">💚 Interbank</option>
                  <option value="BBVA">💙 BBVA</option>
                  <option value="EFECTIVO">💵 Efectivo en Tienda Lince</option>
                  <option value="OTRO">🌐 Otro / Transferencia Exterior</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Monto Pagado *</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    value={formValues.moneda}
                    onChange={e => setFormValues({ ...formValues, moneda: e.target.value as any })}
                    className="form-control"
                    style={{ width: '90px' }}
                  >
                    <option value="PEN">S/ Soles</option>
                    <option value="USD">$ USD</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formValues.monto}
                    onChange={e => setFormValues({ ...formValues, monto: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                  N° de Operación Bancaria
                </label>
                <input
                  type="text"
                  placeholder="Ej: 4839201 (Opcional)"
                  value={formValues.numeroOperacion}
                  onChange={e => setFormValues({ ...formValues, numeroOperacion: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Fecha del Pago</label>
                <input
                  type="date"
                  value={formValues.fechaOperacion}
                  onChange={e => setFormValues({ ...formValues, fechaOperacion: e.target.value })}
                  className="form-control"
                />
              </div>
            </div>

            {/* ASOCIAR PAQUETES WRS AL PAGO */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                background: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                  📦 Paquetes / WRs Cubiertos por este Pago
                </span>
                <div style={{ position: 'relative', width: '250px' }}>
                  <Search className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Buscar WR o Casillero..."
                    value={wrSearchQuery}
                    onChange={e => setWrSearchQuery(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: '32px', height: '32px', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div
                style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px'
                }}
              >
                {paquetesDisponibles.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    No hay paquetes coincidentes.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
                    {paquetesDisponibles.slice(0, 20).map(pkg => {
                      const isSelected = selectedWrs.some(p => p.id === pkg.id);
                      return (
                        <div
                          key={pkg.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedWrs(selectedWrs.filter(p => p.id !== pkg.id));
                            } else {
                              setSelectedWrs([...selectedWrs, pkg]);
                              if (!formValues.clienteNombre && pkg.nombreConsignatario) {
                                setFormValues(prev => ({
                                  ...prev,
                                  clienteNombre: pkg.nombreConsignatario || '',
                                  clienteCasillero: pkg.codigoCasillero || ''
                                }));
                              }
                            }
                          }}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: isSelected ? '#ecfdf5' : '#ffffff',
                            border: isSelected ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11.5px'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 800, color: '#1e3a8a' }}>{pkg.numeroReciboBodega}</span>
                            <span style={{ color: '#64748b', marginLeft: '4px' }}>({pkg.pesoKg || 0} Kg)</span>
                          </div>
                          <input type="checkbox" checked={isSelected} readOnly />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedWrs.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedWrs.map(p => (
                    <span
                      key={p.id}
                      style={{
                        background: '#dcfce7',
                        border: '1px solid #86efac',
                        color: '#14532d',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {p.numeroReciboBodega}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => setSelectedWrs(selectedWrs.filter(x => x.id !== p.id))}
                      />
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                O escribe los WRs manualmente:
              </label>
              <input
                type="text"
                placeholder="Ej: WR10452, WR10453"
                value={formValues.wrInput}
                onChange={e => setFormValues({ ...formValues, wrInput: e.target.value })}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Notas / Observaciones</label>
              <input
                type="text"
                placeholder="Ej: Pago adelantado para recojo el viernes por la tarde"
                value={formValues.notas}
                onChange={e => setFormValues({ ...formValues, notas: e.target.value })}
                className="form-control"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setSubtab('todos')}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontWeight: 700 }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{
                  background: '#16a34a',
                  padding: '12px 24px',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckCircle2 className="w-5 h-5" />
                {isSubmitting ? 'Guardando en Cloudflare R2...' : 'Guardar Voucher & Confirmar Cobro'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUBTAB 1, 3, 4: LISTA / GRILLA DE VOUCHERS */}
      {subtab !== 'nuevo' && (
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
                placeholder="Buscar por Código VOU-, Cliente, N° Operación, WR o Teléfono..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="form-control"
                style={{ paddingLeft: '36px', height: '40px', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Método:</span>
              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="form-control"
                style={{ height: '40px', fontSize: '13px', width: 'auto' }}
              >
                <option value="ALL">Todos los Métodos</option>
                <option value="YAPE">Yape</option>
                <option value="PLIN">Plin</option>
                <option value="BCP">BCP</option>
                <option value="INTERBANK">Interbank</option>
                <option value="BBVA">BBVA</option>
                <option value="EFECTIVO">Efectivo</option>
              </select>
            </div>
          </div>

          {/* LISTADO DE VOUCHERS */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 700 }}>Cargando vouchers de pago...</div>
            </div>
          ) : filteredCobros.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '50px 20px',
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1'
              }}
            >
              <Receipt className="w-12 h-12 text-slate-300" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#334155' }}>
                No se encontraron comprobantes de cobro
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Pega cualquier imagen de WhatsApp con <strong>Ctrl + V</strong> para registrar el primer voucher.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setSubtab('nuevo')}
                style={{ marginTop: '16px', background: '#16a34a' }}
              >
                <Plus className="w-4 h-4" /> Registrar Primer Voucher
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px'
              }}
            >
              {filteredCobros.map(cobro => {
                const isVal = cobro.estado === 'VALIDADO';
                const isYape = cobro.metodo_pago === 'YAPE';
                const isPlin = cobro.metodo_pago === 'PLIN';
                const isBcp = cobro.metodo_pago === 'BCP';

                return (
                  <div
                    key={cobro.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* CABECERA DE LA TARJETA */}
                    <div
                      style={{
                        padding: '12px 14px',
                        background: isYape ? '#fdf4ff' : isPlin ? '#eff6ff' : isBcp ? '#fff7ed' : '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            background: isYape ? '#701a75' : isPlin ? '#1e40af' : isBcp ? '#c2410c' : '#334155',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 900
                          }}
                        >
                          {cobro.metodo_pago}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                          {cobro.codigo_cobro}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          background: isVal ? '#dcfce7' : '#fef3c7',
                          color: isVal ? '#15803d' : '#b45309'
                        }}
                      >
                        {isVal ? '✓ VALIDADO' : '⏳ PENDIENTE'}
                      </span>
                    </div>

                    {/* CUERPO CON MINIATURA DEL VOUCHER Y DETALLES */}
                    <div style={{ padding: '14px', display: 'flex', gap: '12px', flex: '1 1 auto' }}>
                      {/* MINIATURA CLICKEABLE */}
                      <div
                        onClick={() => {
                          setViewingVoucher(cobro);
                          setZoomLevel(1);
                          setRotationAngle(0);
                        }}
                        style={{
                          width: '100px',
                          height: '120px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: '#0f172a',
                          cursor: 'pointer',
                          position: 'relative',
                          flexShrink: 0,
                          border: '1px solid #cbd5e1'
                        }}
                      >
                        <img
                          src={getR2ViewUrl(cobro.voucher_url)}
                          alt="Voucher"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '0',
                            insetInline: '0',
                            background: 'rgba(0,0,0,0.6)',
                            color: '#ffffff',
                            fontSize: '9.5px',
                            textAlign: 'center',
                            padding: '2px 0',
                            fontWeight: 700
                          }}
                        >
                          🔍 Ver Voucher
                        </div>
                      </div>

                      {/* DETALLES FINANCIEROS */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 auto' }}>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#065f46' }}>
                          {cobro.moneda === 'PEN' ? 'S/' : '$'} {Number(cobro.monto || 0).toFixed(2)}
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                          {cobro.cliente_nombre}
                        </div>

                        {cobro.cliente_casillero && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Casillero: <strong>{cobro.cliente_casillero}</strong>
                          </div>
                        )}

                        {cobro.numero_operacion && (
                          <div style={{ fontSize: '11px', color: '#475569' }}>
                            Op: <code style={{ fontWeight: 800, color: '#1e3a8a' }}>{cobro.numero_operacion}</code>
                          </div>
                        )}

                        <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: 'auto' }}>
                          {new Date(cobro.creado_en).toLocaleString('es-PE')}
                        </div>
                      </div>
                    </div>

                    {/* WRS ASOCIADOS */}
                    {Array.isArray(cobro.paquetes_wrs) && cobro.paquetes_wrs.length > 0 && (
                      <div
                        style={{
                          padding: '8px 14px',
                          background: '#f8fafc',
                          borderTop: '1px solid #f1f5f9',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b' }}>WRs:</span>
                        {cobro.paquetes_wrs.map((w, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              color: '#1e40af'
                            }}
                          >
                            {w.numeroReciboBodega}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* FOOTER CON BOTONES DE VALIDACIÓN */}
                    <div
                      style={{
                        padding: '10px 14px',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#ffffff'
                      }}
                    >
                      <button
                        className="btn"
                        onClick={() => {
                          setViewingVoucher(cobro);
                          setZoomLevel(1);
                          setRotationAngle(0);
                        }}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#334155',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '4px 10px'
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" /> Abrir
                      </button>

                      {cobro.estado === 'PENDIENTE' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn"
                            onClick={() => handleUpdateStatus(cobro.id, 'RECHAZADO')}
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#b91c1c',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              padding: '4px 8px'
                            }}
                          >
                            Rechazar
                          </button>

                          <button
                            className="btn btn-primary"
                            onClick={() => handleUpdateStatus(cobro.id, 'VALIDADO')}
                            style={{
                              background: '#16a34a',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              padding: '4px 10px'
                            }}
                          >
                            ✓ Validar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE VISOR DE VOUCHER CON ZOOM Y ROTACIÓN */}
      {viewingVoucher && (
        <div className="modal-backdrop" onClick={() => setViewingVoucher(null)}>
          <div
            className="modal-dialog"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '750px',
              width: '95%',
              background: '#0f172a',
              color: '#ffffff',
              border: '1px solid #334155'
            }}
          >
            <div className="modal-header" style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
              <div>
                <span className="modal-title" style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  Voucher: {viewingVoucher.codigo_cobro} ({viewingVoucher.metodo_pago})
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Cliente: {viewingVoucher.cliente_nombre} · Monto: {viewingVoucher.moneda === 'PEN' ? 'S/' : '$'} {Number(viewingVoucher.monto).toFixed(2)}
                </span>
              </div>

              {/* CONTROLES DE ZOOM Y ROTACIÓN */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn"
                  onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.25))}
                  title="Alejar"
                  style={{ background: '#1e293b', color: '#ffffff', border: '1px solid #475569', padding: '6px 8px' }}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  className="btn"
                  onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                  title="Acercar"
                  style={{ background: '#1e293b', color: '#ffffff', border: '1px solid #475569', padding: '6px 8px' }}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  className="btn"
                  onClick={() => setRotationAngle(prev => (prev + 90) % 360)}
                  title="Girar 90°"
                  style={{ background: '#1e293b', color: '#ffffff', border: '1px solid #475569', padding: '6px 8px' }}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewingVoucher(null)}
                  style={{ background: 'none', border: 'none', fontSize: '22px', color: '#ffffff', cursor: 'pointer', marginLeft: '6px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div
              className="modal-body"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#020617',
                minHeight: '420px',
                overflow: 'hidden',
                padding: '16px'
              }}
            >
              <img
                src={getR2ViewUrl(viewingVoucher.voucher_url)}
                alt="Comprobante"
                style={{
                  maxHeight: '60vh',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  transform: `scale(${zoomLevel}) rotate(${rotationAngle}deg)`,
                  transition: 'transform 0.15s ease'
                }}
              />
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
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                N° Operación: <strong style={{ color: '#ffffff' }}>{viewingVoucher.numero_operacion || 'S/N'}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={`${getR2ViewUrl(viewingVoucher.voucher_url)}${getR2ViewUrl(viewingVoucher.voucher_url).includes('?') ? '&' : '?'}download=true`}
                  download={`voucher_${viewingVoucher.codigo_cobro || 'pago'}.jpg`}
                  style={{
                    color: '#10b981',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                    marginRight: '6px'
                  }}
                >
                  <FolderDown className="w-4 h-4" /> Descargar
                </a>

                <a
                  href={getR2ViewUrl(viewingVoucher.voucher_url)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: '#38bdf8',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                    marginRight: '8px'
                  }}
                >
                  <ExternalLink className="w-4 h-4" /> Abrir Imagen
                </a>

                {viewingVoucher.estado === 'PENDIENTE' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleUpdateStatus(viewingVoucher.id, 'VALIDADO')}
                    style={{ background: '#16a34a', fontWeight: 800 }}
                  >
                    ✓ Validar y Conciliar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
