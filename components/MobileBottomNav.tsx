'use client';

import React from 'react';
import { LayoutDashboard, Users, Barcode, PlaneTakeoff, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  isSidebarOpen?: boolean;
  onSelectTab: (tab: string) => void;
  onToggleSidebar: () => void;
}

export default function MobileBottomNav({
  activeTab,
  isSidebarOpen = false,
  onSelectTab,
  onToggleSidebar
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegación inferior móvil">
      {/* 1. Dashboard */}
      <button
        type="button"
        className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onSelectTab('dashboard')}
        aria-label="Ir a Inicio"
      >
        <LayoutDashboard className="w-5 h-5" />
        <span>Inicio</span>
      </button>

      {/* 2. Clientes */}
      <button
        type="button"
        className={`mobile-nav-btn ${activeTab === 'sd-customers' ? 'active' : ''}`}
        onClick={() => onSelectTab('sd-customers')}
        aria-label="Ir a Clientes"
      >
        <Users className="w-5 h-5" />
        <span>Clientes</span>
      </button>

      {/* 3. Escáner Principal (Botón Central Destacado) */}
      <button
        type="button"
        className={`mobile-nav-scanner-btn ${activeTab === 'mobile-scanner' ? 'active' : ''}`}
        onClick={() => onSelectTab('mobile-scanner')}
        aria-label="Abrir Escáner de Códigos"
      >
        <div className="scanner-circle">
          <Barcode className="w-6 h-6" />
        </div>
        <span>Escáner</span>
      </button>

      {/* 4. Miami Hub */}
      <button
        type="button"
        className={`mobile-nav-btn ${activeTab === 'mm-miami' ? 'active' : ''}`}
        onClick={() => onSelectTab('mm-miami')}
        aria-label="Ir a Bodega Miami"
      >
        <PlaneTakeoff className="w-5 h-5" />
        <span>Miami</span>
      </button>

      {/* 5. Menú Completo Drawer */}
      <button
        type="button"
        className={`mobile-nav-btn ${isSidebarOpen ? 'active' : ''}`}
        onClick={onToggleSidebar}
        aria-label={isSidebarOpen ? 'Cerrar Menú de Módulos' : 'Abrir Menú de Módulos'}
      >
        <Menu className="w-5 h-5" />
        <span>{isSidebarOpen ? 'Cerrar' : 'Módulos'}</span>
      </button>
    </nav>
  );
}
