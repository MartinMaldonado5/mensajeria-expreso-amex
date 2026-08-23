'use client';

import React from 'react';

interface SidebarProps {
  activeTab: string;
  isSidebarCollapsed: boolean;
  collapsedGroups: Record<string, boolean>;
  onSelectTab: (tab: string) => void;
  onToggleGroup: (group: string) => void;
  onCloseSidebar?: () => void;
}

export default function Sidebar({
  activeTab,
  isSidebarCollapsed,
  collapsedGroups,
  onSelectTab,
  onToggleGroup,
  onCloseSidebar
}: SidebarProps) {
  const groupHeader = (group: string, icon: string, label: string) => (
    <div className="sap-module-header" onClick={() => onToggleGroup(group)}>
      <span><i className={icon}></i> {label}</span>
      <i className={`fa-solid fa-chevron-down arrow ${collapsedGroups[group] ? 'rotate--90' : ''}`}></i>
    </div>
  );

  const navItem = (tab: string, icon: string, label: string) => (
    <div
      className={`nav-item ${activeTab === tab ? 'active' : ''}`}
      onClick={() => onSelectTab(tab)}
      role="button"
      tabIndex={0}
    >
      <div className="nav-item-left"><i className={icon}></i> {label}</div>
    </div>
  );

  return (
    <nav className={`sap-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} aria-label="Menú principal de módulos">
      {/* Encabezado Móvil con Botón Cerrar */}
      <div className="sidebar-mobile-header">
        <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-layer-group" style={{ color: '#38bdf8' }}></i> Módulos del Sistema
        </span>
        <button
          onClick={onCloseSidebar}
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            border: 'none',
            color: '#f8fafc',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Cerrar panel de módulos"
        >
          ✕
        </button>
      </div>

      {/* 1.0 LAUNCHPAD */}
      <div className="sap-module-group">
        {groupHeader('dashboard', 'fa-solid fa-cubes', 'Panel Principal')}
        {!collapsedGroups.dashboard && (
          <div className="sap-sub-menu">
            {navItem('dashboard', 'fa-solid fa-chart-pie', 'Resumen & Métricas')}
          </div>
        )}
      </div>

      {/* 2.0 GESTIÓN DE CLIENTES */}
      <div className="sap-module-group">
        {groupHeader('clientes', 'fa-solid fa-users', 'Gestión de Clientes')}
        {!collapsedGroups.clientes && (
          <div className="sap-sub-menu">
            {navItem('sd-customers', 'fa-solid fa-address-book', 'Directorio de Casilleros')}
            {navItem('sd-dni', 'fa-solid fa-id-card', 'Expedientes DNI Digital')}
          </div>
        )}
      </div>

      {/* 3.0 OPERACIONES Y ALMACENES */}
      <div className="sap-module-group">
        {groupHeader('almacenes', 'fa-solid fa-warehouse', 'Operaciones y Almacenes')}
        {!collapsedGroups.almacenes && (
          <div className="sap-sub-menu">
            {navItem('mm-inventory', 'fa-solid fa-boxes-stacked', '📦 Inventario & Movimientos WMS')}
            {navItem('mm-miami', 'fa-solid fa-plane-departure', '1. Almacén Miami (USA)')}
            {navItem('mm-tingo', 'fa-solid fa-dolly', '2. Almacén Tingo María')}
            {navItem('mm-lince', 'fa-solid fa-store', '3. Almacén Sede Lince')}
            {navItem('mobile-scanner', 'fa-solid fa-barcode', '📱 Escáner de Códigos')}
          </div>
        )}
      </div>

      {/* 4.0 DESPACHO Y REPARTO */}
      <div className="sap-module-group">
        {groupHeader('despacho', 'fa-solid fa-truck-fast', 'Despacho y Reparto')}
        {!collapsedGroups.despacho && (
          <div className="sap-sub-menu">
            {navItem('shp-deliveries', 'fa-solid fa-car-side', 'Reparto Carro Amex & Entregas')}
          </div>
        )}
      </div>

      {/* 5.0 LIQUIDACIONES Y FINANZAS */}
      <div className="sap-module-group">
        {groupHeader('finanzas', 'fa-solid fa-file-invoice-dollar', 'Liquidaciones y Finanzas')}
        {!collapsedGroups.finanzas && (
          <div className="sap-sub-menu">
            {navItem('fico-liquidations', 'fa-solid fa-coins', 'Liquidaciones & Cobranzas')}
          </div>
        )}
      </div>
    </nav>
  );
}
