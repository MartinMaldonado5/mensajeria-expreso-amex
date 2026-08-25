'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Paquete, Cliente, TipoUbicacion, TipoMetodoEntrega, TipoEstadoEntrega, ScannedLog } from '@/types';
import { supabase } from '@/lib/supabase/client';
import HeaderBar from '@/components/HeaderBar';
import Sidebar from '@/components/Sidebar';
import DashboardTab from '@/components/tabs/DashboardTab';
import CustomersTab from '@/components/tabs/CustomersTab';
import DniTab from '@/components/tabs/DniTab';
import MiamiTab from '@/components/tabs/MiamiTab';
import LiquidationsTab from '@/components/tabs/LiquidationsTab';
import ScannerTab from '@/components/tabs/ScannerTab';
import InventoryTab from '@/components/tabs/InventoryTab';
import PickingTab from '@/components/tabs/PickingTab';
import DeliveriesTab from '@/components/tabs/DeliveriesTab';
import EntregasTab from '@/components/tabs/EntregasTab';
import NewClientModal, { NewClientFormData } from '@/components/modals/NewClientModal';
import NewPackageModal, { NewPkgFormData } from '@/components/modals/NewPackageModal';
import ThermalLabelModal from '@/components/modals/ThermalLabelModal';
import PdfViewerModal from '@/components/modals/PdfViewerModal';
import DniImageModal from '@/components/modals/DniImageModal';
import { PageSkeleton } from '@/components/ui/Skeleton';

const EMPTY_CLIENT_FORM: NewClientFormData = {
  nombre: '',
  documentoIdentidad: '',
  telefono: '',
  email: '',
  departamento: 'LIMA',
  provincia: 'LIMA',
  distrito: 'LINCE',
  direccionEntrega: '',
  transportistaPreferido: 'CARRO AMEX',
  agenciaDestino: 'REPARTO DOMICILIO LINCE'
};

const EMPTY_PKG_FORM: NewPkgFormData = {
  codigoCasillero: 'AMEX-PER-1001',
  numeroReciboBodega: 'WR-000000',
  trackingUsa: '',
  tipoEmpaque: 'CAJA',
  numeroFactura: '',
  dniConsignatario: '',
  nombreConsignatario: '',
  descripcion: '',
  pesoKg: '1.0',
  valorDeclaradoUsd: '50.0',
  ubicacionActual: 'TibCourierMiami',
  anaquel: 'A1',
  piso: 'P1',
  posicionEstante: 'A1-P1',
  metodoEntrega: 'CarroAmexDomicilio',
  facturaPdfUrl: ''
};

export default function DashboardPage() {
  const [activeTab, setActiveTabState] = useState<string>('mm-lince');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSidebarCollapsed(window.innerWidth <= 768);
    }
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setIsSidebarCollapsed(true);
    }
  }, []);

  const handleUpdatePackage = useCallback((updated: Paquete) => {
    setPaquetes(prev => prev.map(p => (p.id === updated.id ? updated : p)));
  }, []);

  const handleDeletePackage = useCallback((id: string) => {
    setPaquetes(prev => prev.filter(p => p.id !== id));
  }, []);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    clientes: false,
    almacenes: false,
    despacho: false,
    finanzas: false,
    configuracion: false
  });

  // Estado de usuario activo directo
  const [currentUser, setCurrentUser] = useState<{ nombre: string; rol: string } | null>({
    nombre: 'Operador Logístico AMEX',
    rol: 'admin'
  });

  const handleLogout = () => {
    setCurrentUser({ nombre: 'Operador Logístico AMEX', rol: 'admin' });
  };

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [scannedLogs, setScannedLogs] = useState<ScannedLog[]>([]);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedDniImage, setSelectedDniImage] = useState<{ url: string; titulo: string; subtitulo: string } | null>(null);
  const [selectedThermalPkg, setSelectedThermalPkg] = useState<Paquete | null>(null);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isNewPkgModalOpen, setIsNewPkgModalOpen] = useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);

  const [newClientForm, setNewClientForm] = useState<NewClientFormData>(EMPTY_CLIENT_FORM);
  const [newPkgForm, setNewPkgForm] = useState<NewPkgFormData>(EMPTY_PKG_FORM);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('amex_scanner_staging_queue_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setScannedLogs(parsed);
          }
        }
      } catch (err) {
        console.warn('Error loading staging queue from localStorage:', err);
      }
    }
  }, []);

  useEffect(() => {
    async function fetchSupabaseData() {
      try {
        const [clientesRes, paquetesRes] = await Promise.all([
          supabase.from('clientes').select('*').order('creado_en', { ascending: false }),
          supabase.from('paquetes').select('*').order('creado_en', { ascending: false }),
        ]);

        const dbClientes = clientesRes.data || [];
        setClientes(dbClientes.map(c => ({
          id: c.id,
          codigoCasillero: c.codigo_casillero,
          nombre: c.nombre,
          documentoIdentidad: c.documento_identidad,
          telefono: c.telefono || '',
          email: c.email || '',
          departamento: c.departamento || 'LIMA',
          provincia: c.provincia || 'LIMA',
          distrito: c.distrito || 'LINCE',
          direccionEntrega: c.direccion_entrega || '',
          transportistaPreferido: c.transportista_preferido || 'CARRO AMEX',
          agenciaDestino: c.agencia_destino || '',
          dniFrontalUrl: c.dni_frontal_url || '',
          dniReversoUrl: c.dni_reverso_url || '',
          creadoEn: c.creado_en || ''
        })));

        const dbPaquetes = paquetesRes.data || [];
        setPaquetes(dbPaquetes.map(p => {
          const pos = p.posicion_estante || (p.anaquel && p.piso ? `${p.anaquel}-${p.piso}` : 'REC');
          const [ana, pis] = pos.includes('-') ? pos.split('-') : [pos, 'P1'];
          return {
            id: p.id,
            codigoCasillero: p.codigo_casillero,
            numeroReciboBodega: p.numero_recibo_bodega,
            trackingUsa: p.tracking_usa,
            tipoEmpaque: p.tipo_empaque || 'CAJA',
            numeroFactura: p.numero_factura || '',
            dniConsignatario: p.dni_consignatario || '',
            nombreConsignatario: p.nombre_consignatario || '',
            descripcion: p.descripcion || '',
            pesoKg: Number(p.peso_kg || 0),
            valorDeclaradoUsd: Number(p.valor_declarado_usd || 0),
            ubicacionActual: (p.ubicacion_actual as TipoUbicacion) || 'TibCourierMiami',
            anaquel: p.anaquel || ana,
            piso: p.piso || pis,
            posicionEstante: pos,
            metodoEntrega: (p.metodo_entrega as TipoMetodoEntrega) || 'CarroAmexDomicilio',
            estadoEntrega: (p.estado_entrega as TipoEstadoEntrega) || 'EnAlmacen',
            facturaPdfUrl: p.factura_pdf_url || '',
            creadoEn: p.creado_en || ''
          };
        }));
      } catch (err) {
        console.warn('Supabase initial fetch sync:', err);
      } finally {
        setIsLoadingInitialData(false);
      }
    }

    fetchSupabaseData();

    // ⚡ CANALES REALTIME WEBSOCKET (Supabase Realtime)
    const realtimeChannel = supabase
      .channel('amex-erp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paquetes' }, payload => {
        if (payload.eventType === 'INSERT') {
          const p = payload.new as Record<string, unknown>;
          const pos = (p.posicion_estante as string) || (p.anaquel && p.piso ? `${p.anaquel}-${p.piso}` : 'REC');
          const [ana, pis] = pos.includes('-') ? pos.split('-') : [pos, 'P1'];
          setPaquetes(prev => {
            if (prev.some(x => x.id === p.id || x.numeroReciboBodega === p.numero_recibo_bodega)) return prev;
            return [{
              id: String(p.id),
              codigoCasillero: String(p.codigo_casillero),
              numeroReciboBodega: String(p.numero_recibo_bodega),
              trackingUsa: String(p.tracking_usa || ''),
              tipoEmpaque: String(p.tipo_empaque || 'CAJA'),
              numeroFactura: String(p.numero_factura || ''),
              dniConsignatario: String(p.dni_consignatario || ''),
              nombreConsignatario: String(p.nombre_consignatario || ''),
              descripcion: String(p.descripcion || ''),
              pesoKg: Number(p.peso_kg || 0),
              valorDeclaradoUsd: Number(p.valor_declarado_usd || 0),
              ubicacionActual: (p.ubicacion_actual as TipoUbicacion) || 'TibCourierMiami',
              anaquel: (p.anaquel as string) || ana,
              piso: (p.piso as string) || pis,
              posicionEstante: pos,
              metodoEntrega: (p.metodo_entrega as TipoMetodoEntrega) || 'CarroAmexDomicilio',
              estadoEntrega: (p.estado_entrega as TipoEstadoEntrega) || 'EnAlmacen',
              facturaPdfUrl: String(p.factura_pdf_url || ''),
              creadoEn: String(p.creado_en || '')
            }, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          const p = payload.new as Record<string, unknown>;
          const pos = (p.posicion_estante as string) || (p.anaquel && p.piso ? `${p.anaquel}-${p.piso}` : 'REC');
          const [ana, pis] = pos.includes('-') ? pos.split('-') : [pos, 'P1'];
          setPaquetes(prev => prev.map(item => item.id === p.id || item.numeroReciboBodega === p.numero_recibo_bodega ? {
            ...item,
            codigoCasillero: String(p.codigo_casillero || item.codigoCasillero),
            numeroReciboBodega: String(p.numero_recibo_bodega || item.numeroReciboBodega),
            trackingUsa: String(p.tracking_usa || item.trackingUsa),
            tipoEmpaque: String(p.tipo_empaque || item.tipoEmpaque),
            descripcion: String(p.descripcion || item.descripcion),
            pesoKg: Number(p.peso_kg !== undefined ? p.peso_kg : item.pesoKg),
            valorDeclaradoUsd: Number(p.valor_declarado_usd !== undefined ? p.valor_declarado_usd : item.valorDeclaradoUsd),
            ubicacionActual: (p.ubicacion_actual as TipoUbicacion) || item.ubicacionActual,
            anaquel: (p.anaquel as string) || ana,
            piso: (p.piso as string) || pis,
            posicionEstante: pos,
            metodoEntrega: (p.metodo_entrega as TipoMetodoEntrega) || item.metodoEntrega,
            estadoEntrega: (p.estado_entrega as TipoEstadoEntrega) || item.estadoEntrega,
            facturaPdfUrl: String(p.factura_pdf_url || item.facturaPdfUrl)
          } : item));
        } else if (payload.eventType === 'DELETE') {
          const oldRecord = payload.old as Record<string, unknown>;
          setPaquetes(prev => prev.filter(item => item.id !== oldRecord.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, payload => {
        if (payload.eventType === 'INSERT') {
          const c = payload.new as Record<string, unknown>;
          setClientes(prev => {
            if (prev.some(x => x.id === c.id || x.codigoCasillero === c.codigo_casillero)) return prev;
            return [{
              id: String(c.id),
              codigoCasillero: String(c.codigo_casillero),
              nombre: String(c.nombre),
              documentoIdentidad: String(c.documento_identidad),
              telefono: String(c.telefono || ''),
              email: String(c.email || ''),
              departamento: String(c.departamento || 'LIMA'),
              provincia: String(c.provincia || 'LIMA'),
              distrito: String(c.distrito || 'LINCE'),
              direccionEntrega: String(c.direccion_entrega || ''),
              transportistaPreferido: String(c.transportista_preferido || 'CARRO AMEX'),
              agenciaDestino: String(c.agencia_destino || ''),
              dniFrontalUrl: String(c.dni_frontal_url || ''),
              dniReversoUrl: String(c.dni_reverso_url || ''),
              creadoEn: String(c.creado_en || '')
            }, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          const c = payload.new as Record<string, unknown>;
          setClientes(prev => prev.map(item => item.id === c.id || item.codigoCasillero === c.codigo_casillero ? {
            ...item,
            nombre: String(c.nombre || item.nombre),
            documentoIdentidad: String(c.documento_identidad || item.documentoIdentidad),
            telefono: String(c.telefono || item.telefono),
            email: String(c.email || item.email),
            departamento: String(c.departamento || item.departamento),
            provincia: String(c.provincia || item.provincia),
            distrito: String(c.distrito || item.distrito),
            direccionEntrega: String(c.direccion_entrega || item.direccionEntrega),
            transportistaPreferido: String(c.transportista_preferido || item.transportistaPreferido),
            agenciaDestino: String(c.agencia_destino || item.agenciaDestino),
            dniFrontalUrl: String(c.dni_frontal_url || item.dniFrontalUrl),
            dniReversoUrl: String(c.dni_reverso_url || item.dniReversoUrl)
          } : item));
        } else if (payload.eventType === 'DELETE') {
          const oldRecord = payload.old as Record<string, unknown>;
          setClientes(prev => prev.filter(item => item.id !== oldRecord.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  const toggleModuleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // 📍 Asignación de Ubicación Física a Paquete (Slotting WMS Persistente)
  const handleAssignPackageLocation = useCallback(async (code: string, location: string) => {
    const upper = code.trim().toUpperCase();
    const [ana, pis] = location.includes('-') ? location.split('-') : [location, 'P1'];

    setPaquetes(prev =>
      prev.map(p => {
        if (
          p.numeroReciboBodega.toUpperCase() === upper ||
          p.trackingUsa.toUpperCase() === upper ||
          p.codigoCasillero.toUpperCase() === upper
        ) {
          return {
            ...p,
            anaquel: ana,
            piso: pis,
            posicionEstante: location
          };
        }
        return p;
      })
    );

    try {
      await supabase
        .from('paquetes')
        .update({
          anaquel: ana,
          piso: pis,
          posicion_estante: location
        })
        .or(`numero_recibo_bodega.eq.${upper},tracking_usa.eq.${upper},codigo_casillero.eq.${upper}`);
    } catch (err) {
      console.warn('Error syncing package location to Supabase:', err);
    }
  }, []);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const newLockerCode = `AMEX-PER-${1000 + clientes.length + 1}`;
    const newClient: Cliente = {
      id: `c-${Date.now()}`,
      codigoCasillero: newLockerCode,
      ...newClientForm,
      creadoEn: new Date().toISOString()
    };
    setClientes([newClient, ...clientes]);
    setIsNewClientModalOpen(false);

    try {
      await supabase.from('clientes').insert({
        codigo_casillero: newLockerCode,
        nombre: newClientForm.nombre,
        documento_identidad: newClientForm.documentoIdentidad,
        telefono: newClientForm.telefono,
        email: newClientForm.email,
        departamento: newClientForm.departamento,
        provincia: newClientForm.provincia,
        distrito: newClientForm.distrito,
        direccion_entrega: newClientForm.direccionEntrega,
        transportista_preferido: newClientForm.transportistaPreferido,
        agencia_destino: newClientForm.agenciaDestino
      });
    } catch (err) {
      console.error('Error insert cliente:', err);
    }
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const pos = newPkgForm.posicionEstante || `${newPkgForm.anaquel || 'A1'}-${newPkgForm.piso || 'P1'}`;
    const [ana, pis] = pos.includes('-') ? pos.split('-') : [pos, 'P1'];

    const newPkg: Paquete = {
      id: `p-${Date.now()}`,
      codigoCasillero: newPkgForm.codigoCasillero,
      numeroReciboBodega: newPkgForm.numeroReciboBodega,
      trackingUsa: newPkgForm.trackingUsa || '940010000000000000',
      tipoEmpaque: newPkgForm.tipoEmpaque,
      numeroFactura: newPkgForm.numeroFactura,
      dniConsignatario: newPkgForm.dniConsignatario,
      nombreConsignatario: newPkgForm.nombreConsignatario,
      descripcion: newPkgForm.descripcion,
      pesoKg: Number(newPkgForm.pesoKg),
      valorDeclaradoUsd: Number(newPkgForm.valorDeclaradoUsd),
      ubicacionActual: newPkgForm.ubicacionActual as TipoUbicacion,
      anaquel: ana,
      piso: pis,
      posicionEstante: pos,
      metodoEntrega: newPkgForm.metodoEntrega as TipoMetodoEntrega,
      estadoEntrega: 'EnAlmacen' as TipoEstadoEntrega,
      facturaPdfUrl: newPkgForm.facturaPdfUrl,
      creadoEn: new Date().toISOString()
    };
    setPaquetes([newPkg, ...paquetes]);
    setIsNewPkgModalOpen(false);

    try {
      await supabase.from('paquetes').insert({
        codigo_casillero: newPkgForm.codigoCasillero,
        numero_recibo_bodega: newPkgForm.numeroReciboBodega,
        tracking_usa: newPkgForm.trackingUsa,
        tipo_empaque: newPkgForm.tipoEmpaque,
        numero_factura: newPkgForm.numeroFactura,
        dni_consignatario: newPkgForm.dniConsignatario,
        nombre_consignatario: newPkgForm.nombreConsignatario,
        descripcion: newPkgForm.descripcion,
        peso_kg: newPkgForm.pesoKg,
        valor_declarado_usd: newPkgForm.valorDeclaradoUsd,
        ubicacion_actual: newPkgForm.ubicacionActual,
        anaquel: ana,
        piso: pis,
        posicion_estante: pos,
        metodo_entrega: newPkgForm.metodoEntrega,
        factura_pdf_url: newPkgForm.facturaPdfUrl
      });
    } catch (err) {
      console.error('Error insert paquete:', err);
    }
  };

  const openNewPkgModal = () => {
    setNewPkgForm({
      ...EMPTY_PKG_FORM,
      numeroReciboBodega: `WR-${Math.floor(100000 + Math.random() * 900000)}`
    });
    setIsNewPkgModalOpen(true);
  };

  const handleScanCode = (
    code: string,
    format: string,
    extra?: {
      mode?: string;
      location?: string;
      anaquel?: string;
      piso?: string;
      pkg?: Paquete;
      cli?: Cliente;
    }
  ) => {
    const newLog: ScannedLog = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      code: code.trim().toUpperCase(),
      format,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now(),
      location: extra?.location,
      anaquel: extra?.anaquel,
      piso: extra?.piso,
      workflow: (extra?.mode as 'slotting' | 'lookup' | 'delivery' | 'general') || 'slotting',
      nombreConsignatario: extra?.pkg?.nombreConsignatario || extra?.cli?.nombre,
      codigoCasillero: extra?.pkg?.codigoCasillero || extra?.cli?.codigoCasillero,
      synced: false
    };

    setScannedLogs(prev => {
      const updated = [newLog, ...prev];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('amex_scanner_staging_queue_v2', JSON.stringify(updated));
        } catch (e) {
          console.warn('localStorage save staging queue error:', e);
        }
      }
      return updated;
    });

    if (extra?.location) {
      handleAssignPackageLocation(code, extra.location);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <HeaderBar
        currentUser={currentUser}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onLogout={handleLogout}
      />

      <div className="app-container">
        <Sidebar
          activeTab={activeTab}
          isSidebarCollapsed={isSidebarCollapsed}
          collapsedGroups={collapsedGroups}
          onSelectTab={setActiveTab}
          onToggleGroup={toggleModuleGroup}
          onCloseSidebar={() => setIsSidebarCollapsed(true)}
        />

        <main className="main-content">
          {isLoadingInitialData ? (
            <PageSkeleton />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardTab
                  clientes={clientes}
                  paquetes={paquetes}
                  filteredPaquetes={paquetes}
                  onNewClient={() => setIsNewClientModalOpen(true)}
                  onNewPackage={openNewPkgModal}
                  onPrintLabel={setSelectedThermalPkg}
                  onViewPdf={setSelectedPdfUrl}
                />
              )}

          {activeTab === 'sd-customers' && (
            <CustomersTab
              clientes={clientes}
              onNewClient={() => setIsNewClientModalOpen(true)}
              onViewDni={cli => {
                if (cli.dniFrontalUrl) {
                  setSelectedDniImage({ url: cli.dniFrontalUrl, titulo: 'DNI FRENTE', subtitulo: `${cli.codigoCasillero} - ${cli.nombre}` });
                }
              }}
            />
          )}

          {activeTab === 'sd-dni' && (
            <DniTab clientes={clientes} onViewDniImage={setSelectedDniImage} />
          )}

          {(activeTab === 'mm-lince' || activeTab === 'mm-inventory') && (
            <InventoryTab
              paquetes={paquetes}
              clientes={clientes}
              onNewPackage={openNewPkgModal}
              onViewPdf={setSelectedPdfUrl}
              onUpdatePackage={handleUpdatePackage}
              onDeletePackage={handleDeletePackage}
            />
          )}

          {activeTab === 'mm-miami' && (
            <MiamiTab
              paquetes={paquetes}
              location="TibCourierMiami"
              title="1. Almacén Tib Courier (Miami, USA)"
              subtitle="Ingesta de compras con Guía WR#, Tipo Empaque e Invoices PDF en Cloudflare R2"
              breadcrumb="Almacén Miami (USA)"
              onNewPackage={openNewPkgModal}
              onViewPdf={setSelectedPdfUrl}
            />
          )}

          {activeTab === 'mm-tingo' && (
            <MiamiTab
              paquetes={paquetes}
              location="TibTingoMaria"
              title="2. Almacén Regional (Tingo María)"
              subtitle="Control de sacas y paquetes en tránsito regional Tingo María"
              breadcrumb="Almacén Tingo María"
              onNewPackage={openNewPkgModal}
              onViewPdf={setSelectedPdfUrl}
            />
          )}

          {activeTab === 'shp-entregas' && (
            <EntregasTab
              paquetes={paquetes}
              clientes={clientes}
              onUpdatePackage={handleUpdatePackage}
              onViewPdf={setSelectedPdfUrl}
            />
          )}

          {activeTab === 'shp-deliveries' && (
            <DeliveriesTab
              paquetes={paquetes}
              clientes={clientes}
              onUpdatePackage={handleUpdatePackage}
              onViewPdf={setSelectedPdfUrl}
            />
          )}

          {activeTab === 'fico-liquidations' && (
            <LiquidationsTab paquetes={paquetes} />
          )}

          {activeTab === 'mobile-scanner' && (
            <ScannerTab
              scannedLogs={scannedLogs}
              paquetes={paquetes}
              clientes={clientes}
              onConfirm={handleScanCode}
              onSlotPackage={handleAssignPackageLocation}
              onUpdateLogs={setScannedLogs}
            />
          )}

          {activeTab === 'wms-picking' && (
            <PickingTab
              paquetes={paquetes}
              clientes={clientes}
            />
          )}
            </>
          )}
        </main>
      </div>

      {/* Backdrop para cerrar el menú lateral en móviles */}
      {!isSidebarCollapsed && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}


      {isNewClientModalOpen && (
        <NewClientModal
          form={newClientForm}
          onChange={setNewClientForm}
          onSave={handleSaveClient}
          onClose={() => setIsNewClientModalOpen(false)}
        />
      )}

      {isNewPkgModalOpen && (
        <NewPackageModal
          form={newPkgForm}
          clientes={clientes}
          onChange={setNewPkgForm}
          onSave={handleSavePackage}
          onClose={() => setIsNewPkgModalOpen(false)}
        />
      )}

      {selectedThermalPkg && (
        <ThermalLabelModal pkg={selectedThermalPkg} onClose={() => setSelectedThermalPkg(null)} />
      )}

      {selectedPdfUrl && (
        <PdfViewerModal url={selectedPdfUrl} onClose={() => setSelectedPdfUrl(null)} />
      )}

      {selectedDniImage && (
        <DniImageModal image={selectedDniImage} onClose={() => setSelectedDniImage(null)} />
      )}
    </div>
  );
}
