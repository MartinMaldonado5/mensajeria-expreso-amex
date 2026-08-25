'use client';

import { Cliente } from '@/types';
import { FileSpreadsheet } from 'lucide-react';
import { exportClientesToExcel } from '@/lib/excelExport';

interface CustomersTabProps {
  clientes: Cliente[];
  onNewClient: () => void;
  onViewDni: (cli: Cliente) => void;
}

export default function CustomersTab({ clientes, onNewClient, onViewDni }: CustomersTabProps) {
  return (
    <div>
      <div className="sap-breadcrumb">
        <span>Gestión de Clientes</span> / <span>Directorio de Casilleros</span>
      </div>
      <div className="page-title-bar">
        <div>
          <h1 className="page-title">Directorio de Casilleros e Importadores</h1>
          <p className="page-subtitle">Base de datos de casilleros `AMEX-PER-XXXX` con datos fiscales y de despacho</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={() => exportClientesToExcel(clientes)}
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
          <button className="btn btn-primary" onClick={onNewClient}>
            <i className="fa-solid fa-user-plus"></i> Crear Nuevo Casillero
          </button>
        </div>
      </div>

      <div className="card-panel">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Código Casillero</th>
                <th>Importador / Cliente</th>
                <th>DNI / RUC</th>
                <th>WhatsApp</th>
                <th>Ubigeo Destino</th>
                <th>Agencia Destino</th>
                <th>Expediente DNI</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(cli => (
                <tr key={cli.id}>
                  <td className="cell-casillero-blue">{cli.codigoCasillero}</td>
                  <td className="cell-bold">{cli.nombre}</td>
                  <td className="cell-mono">{cli.documentoIdentidad}</td>
                  <td>{cli.telefono}</td>
                  <td>{cli.departamento} / {cli.provincia} / {cli.distrito}</td>
                  <td><span className="badge badge-type">{cli.transportistaPreferido}</span></td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => onViewDni(cli)}>
                      <i className="fa-solid fa-id-card"></i> Ver DNI
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
