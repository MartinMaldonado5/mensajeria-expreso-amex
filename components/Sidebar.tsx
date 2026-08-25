'use client';

import React, { useState } from 'react';

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
  onSelectTab,
  onCloseSidebar
}: SidebarProps) {
  const [showOtherModules, setShowOtherModules] = useState(false);

  const navItem = (tab: string, icon: string, label: string) => (
    <div
      className={`nav-item ${activeTab === tab ? 'active' : ''}`}
      onClick={() => onSelectTab(tab)}
      role="button"
      tabIndex={0}
      style={{
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '13px',
        fontWeight: activeTab === tab ? 700 : 600
      }}
    >
      <div className="nav-item-left"><i className={icon}></i> {label}</div>
    </div>
  );

  return (
    <nav className={`sap-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} aria-label="Menú principal de módulos">
      {/* Encabezado Móvil con Botón Cerrar */}
      <div className="sidebar-mobile-header">
        <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-boxes-stacked" style={{ color: '#38bdf8' }}></i> Operaciones & Almacenes
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

      {/* ⭐️ SECCIÓN PRINCIPAL Y ÚNICA DESTACADA: OPERACIONES Y ALMACENES */}
      <div className="sap-module-group" style={{ marginBottom: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.28) 0%, rgba(30, 64, 175, 0.28) 100%)',
            border: '1.5px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '8px',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '12px',
            letterSpacing: '0.5px',
            marginBottom: '8px',
            textTransform: 'uppercase',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.15)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-warehouse" style={{ color: '#38bdf8' }}></i> Operaciones y Almacenes
          </span>
          <span style={{ fontSize: '9.5px', background: '#2563eb', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
            ACTIVO
          </span>
        </div>

        <div className="sap-sub-menu" style={{ paddingLeft: '2px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {navItem('mm-lince', 'fa-solid fa-store', '🏢 Almacén Central (Lince)')}
          {navItem('shp-deliveries', 'fa-solid fa-car-side', '🚚 Despacho & Reparto (Carro AMEX)')}
          {navItem('wms-picking', 'fa-solid fa-clipboard-list', '📋 Picking & Despacho (Shalom/Olva)')}
          {navItem('mobile-scanner', 'fa-solid fa-barcode', '📱 Escáner de Códigos')}
        </div>
      </div>

      {/* 📁 SECCIÓN ÚNICA COLAPSABLE: TODOS LOS DEMÁS MÓDULOS OCULTOS */}
      <div
        className="sap-module-group"
        style={{
          marginTop: 'auto',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div
          onClick={() => setShowOtherModules(!showOtherModules)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: showOtherModules ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            color: '#94a3b8',
            fontWeight: 700,
            fontSize: '11.5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            userSelect: 'none'
          }}
          title={showOtherModules ? 'Ocultar otros módulos' : 'Mostrar otros módulos del sistema'}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-folder-tree" style={{ color: '#94a3b8' }}></i> Otros Módulos ({showOtherModules ? 'Abierto' : 'Ocultos'})
          </span>
          <i className={`fa-solid fa-chevron-down arrow ${!showOtherModules ? 'rotate--90' : ''}`} style={{ fontSize: '11px', transition: 'transform 0.2s ease' }}></i>
        </div>

        {showOtherModules && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px',
              background: 'rgba(15, 23, 42, 0.75)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            {/* 0. Almacenes Externos */}
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, padding: '4px 6px 0 6px', textTransform: 'uppercase' }}>
              ✈️ Almacenes Externos
            </div>
            {navItem('mm-miami', 'fa-solid fa-plane-departure', 'Almacén Miami (USA)')}
            {navItem('mm-tingo', 'fa-solid fa-dolly', 'Almacén Tingo María')}

            {/* 1. Panel General */}
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, padding: '6px 6px 0 6px', textTransform: 'uppercase' }}>
              📊 Panel General
            </div>
            {navItem('dashboard', 'fa-solid fa-chart-pie', 'Resumen & Métricas')}

            {/* 2. Clientes */}
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, padding: '6px 6px 0 6px', textTransform: 'uppercase' }}>
              👥 Clientes
            </div>
            {navItem('sd-customers', 'fa-solid fa-address-book', 'Directorio de Casilleros')}
            {navItem('sd-dni', 'fa-solid fa-id-card', 'Expedientes DNI')}

            {/* 3. Finanzas */}
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, padding: '6px 6px 0 6px', textTransform: 'uppercase' }}>
              💵 Finanzas
            </div>
            {navItem('fico-liquidations', 'fa-solid fa-coins', 'Liquidaciones & Cobranzas')}
          </div>
        )}
      </div>
    </nav>
  );
}
