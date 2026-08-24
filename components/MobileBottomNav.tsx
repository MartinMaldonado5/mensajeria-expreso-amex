'use client';

import React from 'react';
import { Boxes, Barcode, Store, PlaneTakeoff, Menu } from 'lucide-react';

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
      {/* 1. Inventario WMS */}
      <button
        type="button"
        className={`mobile-nav-btn ${activeTab === 'mm-inventory' ? 'active' : ''}`}
        onClick={() => onSelectTab('mm-inventory')}
        aria-label="Ir a Inventario WMS"
      >
        <Boxes className="w-5 h-5" />
        <span>Inventario</span>
      </button>

      {/* 2. Sede Lince */}
      <button
        type="button"
        className={`mobile-nav-btn ${activeTab === 'mm-lince' ? 'active' : ''}`}
        onClick={() => onSelectTab('mm-lince')}
        aria-label="Ir a Almacén Central Lince"
      >
        <Store className="w-5 h-5" />
        <span>Lince</span>
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
