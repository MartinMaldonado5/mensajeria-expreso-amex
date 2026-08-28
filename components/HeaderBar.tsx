'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

interface HeaderBarProps {
  currentUser: { nombre: string; rol: string } | null;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onGlobalRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function HeaderBar({
  currentUser,
  isSidebarCollapsed,
  onToggleSidebar,
  onLogout,
  onGlobalRefresh,
  isRefreshing
}: HeaderBarProps) {
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

      {/* Sección derecha con estado de sincronización en tiempo real y botón de recarga */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', paddingRight: '8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            padding: '3px 8px',
            borderRadius: '12px',
            color: '#4ade80',
            fontSize: '11px',
            fontWeight: 800
          }}
          className="hide-mobile"
        >
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
          <span>Realtime Supabase</span>
        </div>

        {onGlobalRefresh && (
          <button
            type="button"
            onClick={onGlobalRefresh}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '8px',
              height: '32px',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
            title="Sincronizar todos los módulos con Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hide-mobile">{isRefreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        )}
      </div>
    </header>
  );
}
