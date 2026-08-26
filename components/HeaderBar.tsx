'use client';

import React from 'react';

interface HeaderBarProps {
  currentUser: { nombre: string; rol: string } | null;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export default function HeaderBar({ currentUser, isSidebarCollapsed, onToggleSidebar, onLogout }: HeaderBarProps) {
  return (
    <header className="sap-header">
      <div className="sap-brand">
        <button
          className="header-sidebar-toggle"
          onClick={onToggleSidebar}
          style={{
            background: isSidebarCollapsed ? 'rgba(255,255,255,0.08)' : 'rgba(37, 99, 235, 0.4)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '6px',
            transition: 'all 0.15s ease'
          }}
          aria-label={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          title={isSidebarCollapsed ? 'Abrir menú lateral' : 'Cerrar menú lateral'}
        >
          <i className={`fa-solid ${isSidebarCollapsed ? 'fa-bars' : 'fa-xmark'}`}></i>
        </button>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 900, fontSize: '15.5px', letterSpacing: '0.3px', color: '#ffffff' }}>
          AMEX Courier <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '13px' }}>| Operaciones & Almacenes</span>
        </span>
      </div>

      {/* Sección derecha limpia */}
    </header>
  );
}
