'use client';

import { Paquete } from '@/types';
import { FileSpreadsheet } from 'lucide-react';
import { exportLiquidacionesToExcel } from '@/lib/excelExport';

interface LiquidationsTabProps {
  paquetes: Paquete[];
}

export default function LiquidationsTab({ paquetes }: LiquidationsTabProps) {
  return (
    <div>
      <div className="sap-breadcrumb">
        <span>Liquidaciones y Finanzas</span> / <span>Liquidaciones & Cobranzas</span>
      </div>
      <div className="page-title-bar">
        <div>
          <h1 className="page-title">Liquidaciones Financieras y Cobranzas</h1>
          <p className="page-subtitle">Desglose de fletes en USD y Soles (PEN) con comprobantes de pago Yape/BCP</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={() => exportLiquidacionesToExcel(paquetes)}
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800
            }}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="card-panel">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Casillero</th>
                <th>Cliente Importador</th>
                <th>Guía WR #</th>
                <th>Flete ($)</th>
                <th>Admin Fee ($)</th>
                <th>Total USD ($)</th>
                <th>Total Soles (S/)</th>
                <th>Estado Pago</th>
              </tr>
            </thead>
            <tbody>
              {paquetes.map(pkg => {
                const flete = pkg.pesoKg * 12.0;
                const admin = 5.0;
                const totalUsd = flete + admin;
                const totalPen = totalUsd * 3.80;
                return (
                  <tr key={pkg.id}>
                    <td className="cell-casillero">{pkg.codigoCasillero}</td>
                    <td className="cell-bold">{pkg.nombreConsignatario || 'María Torres'}</td>
                    <td className="badge-wr">{pkg.numeroReciboBodega}</td>
                    <td>${flete.toFixed(2)}</td>
                    <td>${admin.toFixed(2)}</td>
                    <td className="cell-bold">${totalUsd.toFixed(2)} USD</td>
                    <td style={{ fontWeight: 800, color: '#059669' }}>S/ {totalPen.toFixed(2)}</td>
                    <td><span className="badge badge-paid-pen">PAGADO YAPE/BCP</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
