'use client';

import { Paquete } from '@/types';

interface ThermalLabelModalProps {
  pkg: Paquete;
  onClose: () => void;
}

export default function ThermalLabelModal({ pkg, onClose }: ThermalLabelModalProps) {
  return (
    <div className="modal-overlay active">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '15px', fontWeight: 800 }}><i className="fa-solid fa-print"></i> Vista Previa de Rótulo Térmico</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
        <div className="modal-body printable-area">
          <div className="shipping-label-card">
            <div className="label-header">
              <span style={{ fontWeight: 800, fontSize: '18px' }}>AMEX COURIER PERÚ</span>
              <span style={{ background: '#000', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontWeight: 800 }}>{pkg.codigoCasillero}</span>
            </div>
            <div className="label-agency-box">
              {pkg.metodoEntrega === 'CarroAmexDomicilio' ? 'REPARTO DOMICILIO LINCE' : 'AGENCIA SHALOM / OLVA'}
            </div>
            <div className="label-section">
              <div className="label-title">Consignatario:</div>
              <div style={{ fontWeight: 800, fontSize: '15px' }}>{pkg.nombreConsignatario || 'María Torres Pérez'}</div>
              <div>DNI: {pkg.dniConsignatario || '72819204'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderTop: '1px solid #ccc', paddingTop: '8px' }}>
              <div>
                <strong>WR RECIBO:</strong>
                <div className="cell-mono" style={{ fontWeight: 800, fontSize: '14px' }}>{pkg.numeroReciboBodega}</div>
              </div>
              <div>
                <strong>UBICACIÓN:</strong>
                <div style={{ fontWeight: 900, fontSize: '14px', color: '#000', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', textAlign: 'center' }}>
                  {pkg.posicionEstante || (pkg.anaquel ? `${pkg.anaquel}-${pkg.piso || 'P1'}` : 'A1-P1')}
                </div>
              </div>
              <div>
                <strong>PESO:</strong>
                <div style={{ fontWeight: 800, fontSize: '14px' }}>{pkg.pesoKg} Kg</div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print"></i> Imprimir Ticket</button>
        </div>
      </div>
    </div>
  );
}
