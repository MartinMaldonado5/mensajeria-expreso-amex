'use client';

import React from 'react';

interface SidebarProps {
  activeTab: string;
  isSidebarCollapsed: boolean;
  onSelectTab: (tab: string) => void;
  onCloseSidebar?: () => void;
}

export default function Sidebar({
  activeTab,
  isSidebarCollapsed,
  onSelectTab,
  onCloseSidebar
}: SidebarProps) {
  const navItem = (tab: string, icon: string, label: string, badge?: string, badgeColor = '#2563eb') => {
    const isActive = activeTab === tab;
    return (
      <div
        className={`nav-item ${isActive ? 'active' : ''}`}
        onClick={() => onSelectTab(tab)}
        role="button"
        tabIndex={0}
        style={{
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '13px',
          fontWeight: isActive ? 800 : 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          background: isActive ? 'linear-gradient(90deg, rgba(37, 99, 235, 0.25) 0%, rgba(37, 99, 235, 0.1) 100%)' : 'transparent',
          borderLeft: isActive ? '3.5px solid #38bdf8' : '3.5px solid transparent',
          color: isActive ? '#ffffff' : '#cbd5e1'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className={icon} style={{ width: '16px', textAlign: 'center', color: isActive ? '#38bdf8' : '#94a3b8' }}></i>
          <span>{label}</span>
        </div>
        {badge && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              background: badgeColor,
              color: '#ffffff',
              padding: '1px 6px',
              borderRadius: '9999px'
            }}
          >
            {badge}
          </span>
        )}
      </div>
    );
  };

  return (
    <nav className={`sap-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} aria-label="Menú principal de Operaciones y Almacenes">
      {/* Encabezado Móvil con Botón Cerrar */}
      <div className="sidebar-mobile-header" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <span style={{ fontSize: '13px', fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-warehouse" style={{ color: '#38bdf8' }}></i> Operaciones y Almacenes
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

      {/* SECCIÓN ÚNICA EXCLUSIVA: OPERACIONES Y ALMACENES */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
            fontWeight: 900,
            fontSize: '11.5px',
            letterSpacing: '0.5px',
            marginBottom: '10px',
            textTransform: 'uppercase',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.15)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-warehouse" style={{ color: '#38bdf8' }}></i> Operaciones y Almacenes
          </span>
          <span style={{ fontSize: '9px', background: '#2563eb', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>
            EN VIVO
          </span>
        </div>

        {/* 7 SUBMÓDULOS EN ORDEN OPERATIVO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {navItem('dashboard', 'fa-solid fa-chart-pie', '1. Panel Operativo', 'KPIs', '#2563eb')}
          {navItem('mm-lince', 'fa-solid fa-store', '2. Almacén Central (Lince)', 'Stock', '#0284c7')}
          {navItem('shp-entregas', 'fa-solid fa-box-open', '3. Entregas & Búsqueda WR', 'Mostrador', '#d97706')}
          {navItem('fico-cobros', 'fa-solid fa-receipt', '4. Cobros & Vouchers', 'WhatsApp', '#16a34a')}
          {navItem('shp-deliveries', 'fa-solid fa-car-side', '5. Despacho Carro AMEX', 'Rutas', '#7c3aed')}
          {navItem('wms-picking', 'fa-solid fa-clipboard-list', '6. Picking Shalom/Olva', 'Agencias', '#e11d48')}
          {navItem('mobile-scanner', 'fa-solid fa-barcode', '7. Escáner de Códigos', 'Móvil', '#0d9488')}
        </div>
      </div>

      {/* FOOTER DEL SIDEBAR: ESTADO OPERATIVO */}
      <div
        style={{
          marginTop: 'auto',
          padding: '14px 12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.5)',
          fontSize: '11px',
          color: '#94a3b8'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4ade80', fontWeight: 800, marginBottom: '2px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
          Sincronización R2 & Supabase
        </div>
        <div style={{ fontSize: '10px', color: '#64748b' }}>
          Plataforma Logística Perú (v2.5)
        </div>
      </div>
    </nav>
  );
}
