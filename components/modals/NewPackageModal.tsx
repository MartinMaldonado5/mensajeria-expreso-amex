'use client';

import { Cliente } from '@/types';

export interface NewPkgFormData {
  codigoCasillero: string;
  numeroReciboBodega: string;
  trackingUsa: string;
  tipoEmpaque: string;
  numeroFactura: string;
  dniConsignatario: string;
  nombreConsignatario: string;
  descripcion: string;
  pesoKg: string;
  valorDeclaradoUsd: string;
  ubicacionActual: string;
  anaquel?: string;
  piso?: string;
  posicionEstante?: string;
  metodoEntrega: string;
  facturaPdfUrl: string;
}

interface NewPackageModalProps {
  form: NewPkgFormData;
  clientes: Cliente[];
  onChange: (form: NewPkgFormData) => void;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function NewPackageModal({ form, clientes, onChange, onSave, onClose }: NewPackageModalProps) {
  const set = (key: keyof NewPkgFormData, value: string) => onChange({ ...form, [key]: value });

  const previewPeso = Number(form.pesoKg) || 0;
  const previewValor = Number(form.valorDeclaradoUsd) || 0;
  const previewFlete = previewPeso * 12.0;
  const previewAdmin = 5.0;
  const previewTotalUsd = previewFlete + previewAdmin;
  const previewTotalPen = previewTotalUsd * 3.80;

  return (
    <div className="modal-overlay active">
      <div className="modal-content modal-content--pkg">
        <div className="pkg-header">
          <div className="pkg-header__icon"><i className="fa-solid fa-box-open"></i></div>
          <div>
            <div className="pkg-header__title">Registrar en Miami</div>
            <div className="pkg-header__sub">Ingesta de compra con guía WR#, empaque e invoice PDF</div>
          </div>
          <div className="pkg-header__hub">Hub Miami · USA</div>
          <button className="pkg-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <form onSubmit={onSave}>
          <div className="pkg-body">
            <div className="pkg-layout">
              <div className="pkg-fields">
                <section className="pkg-section">
                  <div className="pkg-section__title"><i className="fa-solid fa-barcode"></i> Identificación del paquete</div>
                  <div className="pkg-field">
                    <label className="pkg-label">Guía WR # (recibo de bodega)</label>
                    <input type="text" required className="pkg-input pkg-input--mono" value={form.numeroReciboBodega} onChange={e => set('numeroReciboBodega', e.target.value)} placeholder="WR000451" />
                  </div>
                  <div className="pkg-field">
                    <label className="pkg-label">Tracking USA</label>
                    <input type="text" className="pkg-input pkg-input--mono" value={form.trackingUsa} onChange={e => set('trackingUsa', e.target.value)} placeholder="1Z999AA9999999999" />
                    <div className="pkg-hint">Número de seguimiento del carrier en Estados Unidos.</div>
                  </div>
                  <div className="pkg-grid">
                    <div className="pkg-field">
                      <label className="pkg-label">Casillero</label>
                      <input list="casilleros-list" required className="pkg-input pkg-input--mono" value={form.codigoCasillero}
                        onChange={e => {
                          const val = e.target.value;
                          const found = clientes.find(c => c.codigoCasillero === val);
                          onChange({
                            ...form,
                            codigoCasillero: val,
                            nombreConsignatario: found ? found.nombre : form.nombreConsignatario,
                            dniConsignatario: found ? found.documentoIdentidad : form.dniConsignatario
                          });
                        }} placeholder="AMEX-PER-1001" />
                      <datalist id="casilleros-list">
                        {clientes.map(c => (
                          <option key={c.id} value={c.codigoCasillero}>{c.nombre}</option>
                        ))}
                      </datalist>
                      <div className="pkg-hint">Selecciona uno existente o escribe uno nuevo.</div>
                    </div>
                    <div className="pkg-field">
                      <label className="pkg-label">Tipo de empaque</label>
                      <select className="pkg-select" value={form.tipoEmpaque} onChange={e => set('tipoEmpaque', e.target.value)}>
                        <option value="CAJA">CAJA</option>
                        <option value="SOBRE">SOBRE</option>
                        <option value="SACA">SACA</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="pkg-section">
                  <div className="pkg-section__title"><i className="fa-solid fa-user"></i> Consignatario</div>
                  <div className="pkg-field">
                    <label className="pkg-label">Nombre completo</label>
                    <input type="text" className="pkg-input" value={form.nombreConsignatario} onChange={e => set('nombreConsignatario', e.target.value)} placeholder="María Torres Pérez" />
                  </div>
                  <div className="pkg-grid">
                    <div className="pkg-field">
                      <label className="pkg-label">DNI / RUC</label>
                      <input type="text" className="pkg-input pkg-input--mono" value={form.dniConsignatario} onChange={e => set('dniConsignatario', e.target.value)} placeholder="72819204" />
                    </div>
                    <div className="pkg-field">
                      <label className="pkg-label">N° factura proveedor</label>
                      <input type="text" className="pkg-input pkg-input--mono" value={form.numeroFactura} onChange={e => set('numeroFactura', e.target.value)} placeholder="INV-9001" />
                    </div>
                  </div>
                  <div className="pkg-field">
                    <label className="pkg-label">Descripción de la mercancía</label>
                    <input type="text" className="pkg-input" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Ropa y calzado deportivo Nike" />
                  </div>
                </section>

                <section className="pkg-section">
                  <div className="pkg-section__title"><i className="fa-solid fa-weight-hanging"></i> Carga, valoración y entrega</div>
                  <div className="pkg-grid">
                    <div className="pkg-field">
                      <label className="pkg-label">Peso (kg)</label>
                      <input type="number" step="0.1" min="0" required className="pkg-input pkg-input--mono" value={form.pesoKg} onChange={e => set('pesoKg', e.target.value)} placeholder="2.5" />
                    </div>
                    <div className="pkg-field">
                      <label className="pkg-label">Valor declarado (USD)</label>
                      <input type="number" step="0.01" min="0" required className="pkg-input pkg-input--mono" value={form.valorDeclaradoUsd} onChange={e => set('valorDeclaradoUsd', e.target.value)} placeholder="150.00" />
                    </div>
                  </div>
                  <div className="pkg-grid">
                    <div className="pkg-field">
                      <label className="pkg-label">Anaquel (Estante Físico)</label>
                      <select
                        className="pkg-select"
                        value={form.anaquel || 'A1'}
                        onChange={e => {
                          const ana = e.target.value;
                          const pis = form.piso || 'P1';
                          onChange({
                            ...form,
                            anaquel: ana,
                            piso: pis,
                            posicionEstante: `${ana}-${pis}`
                          });
                        }}
                      >
                        <option value="A1">Anaquel 1 (A1)</option>
                        <option value="A2">Anaquel 2 (A2)</option>
                        <option value="REC">Mesa Recepción (REC)</option>
                        <option value="DSP">Zona Despacho (DSP)</option>
                      </select>
                    </div>
                    <div className="pkg-field">
                      <label className="pkg-label">Piso / Nivel</label>
                      <select
                        className="pkg-select"
                        value={form.piso || 'P1'}
                        onChange={e => {
                          const pis = e.target.value;
                          const ana = form.anaquel || 'A1';
                          onChange({
                            ...form,
                            piso: pis,
                            anaquel: ana,
                            posicionEstante: `${ana}-${pis}`
                          });
                        }}
                      >
                        <option value="P1">Piso 1 (Inferior / Pesado)</option>
                        <option value="P2">Piso 2 (Medio / Estándar)</option>
                        <option value="P3">Piso 3 (Superior / Ligero)</option>
                      </select>
                    </div>
                  </div>
                  <div className="pkg-field">
                    <label className="pkg-label">Método de entrega en Perú</label>
                    <select className="pkg-select" value={form.metodoEntrega} onChange={e => set('metodoEntrega', e.target.value)}>
                      <option value="CarroAmexDomicilio">Carro AMEX — Reparto a domicilio</option>
                      <option value="AgenciaProvincia">Agencia provincia (Olva / Shalom)</option>
                      <option value="RecojoLince">Recojo en Lince</option>
                    </select>
                  </div>
                  <div className="pkg-field">
                    <label className="pkg-label">Invoice PDF (Cloudflare R2)</label>
                    <input type="text" className="pkg-input pkg-input--mono" value={form.facturaPdfUrl} onChange={e => set('facturaPdfUrl', e.target.value)} placeholder="https://...r2.dev/FOLDER AMEX/facturas/..." />
                  </div>
                </section>
              </div>

              <aside className="pkg-preview">
                <div className="pkg-preview__head"><i className="fa-solid fa-receipt"></i> Ficha de ingreso</div>
                <div className="pkg-receipt">
                  <div className="pkg-receipt__bar">
                    <span className="pkg-receipt__brand">AMEX COURIER PERÚ</span>
                    <span className="pkg-receipt__origin">MIA → LIM</span>
                  </div>
                  <div className="pkg-receipt__body">
                    <div className="pkg-receipt__wr">{form.numeroReciboBodega || 'WR······'}</div>
                    <div className="pkg-receipt__row">
                      <span className="pkg-receipt__k">Tracking</span>
                      <span className={`pkg-receipt__v ${form.trackingUsa ? '' : 'pkg-receipt__v--empty'}`}>{form.trackingUsa || 'Pendiente'}</span>
                    </div>
                    <div className="pkg-receipt__row">
                      <span className="pkg-receipt__k">Casillero</span>
                      <span className={`pkg-receipt__v pkg-receipt__v--accent ${form.codigoCasillero ? '' : 'pkg-receipt__v--empty'}`}>{form.codigoCasillero || 'AMEX-PER-····'}</span>
                    </div>
                    <div className="pkg-receipt__row">
                      <span className="pkg-receipt__k">Consignatario</span>
                      <span className={`pkg-receipt__v ${form.nombreConsignatario ? '' : 'pkg-receipt__v--empty'}`}>{form.nombreConsignatario || '—'}</span>
                    </div>
                    <div className="pkg-receipt__row">
                      <span className="pkg-receipt__k">Empaque</span>
                      <span className="pkg-receipt__v">{form.tipoEmpaque}</span>
                    </div>
                    <div className="pkg-receipt__row">
                      <span className="pkg-receipt__k">Estante / Piso</span>
                      <span className="pkg-receipt__v" style={{ fontWeight: 800, color: '#2563eb' }}>
                        {form.posicionEstante || `${form.anaquel || 'A1'}-${form.piso || 'P1'}`}
                      </span>
                    </div>
                    <div className="pkg-receipt__row">
                      <span className="pkg-receipt__k">Peso</span>
                      <span className="pkg-receipt__v">{previewPeso.toFixed(2)} kg</span>
                    </div>
                    <div className="pkg-receipt__row">
                      <span className="pkg-receipt__k">Valor FOB</span>
                      <span className="pkg-receipt__v">${previewValor.toFixed(2)} USD</span>
                    </div>
                  </div>
                </div>
                <div className="pkg-estimate">
                  <div className="pkg-estimate__row">
                    <span className="pkg-estimate__k">Flete ({previewPeso.toFixed(1)} kg × $12)</span>
                    <span className="pkg-estimate__v">${previewFlete.toFixed(2)}</span>
                  </div>
                  <div className="pkg-estimate__row">
                    <span className="pkg-estimate__k">Admin fee</span>
                    <span className="pkg-estimate__v">${previewAdmin.toFixed(2)}</span>
                  </div>
                  <div className="pkg-estimate__total">
                    <span>Total</span>
                    <span className="pkg-estimate__v">${previewTotalUsd.toFixed(2)} <span style={{ color: '#94a3b8', fontWeight: 700 }}>/ S/ {previewTotalPen.toFixed(2)}</span></span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
          <div className="pkg-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary pkg-submit"><i className="fa-solid fa-box-open"></i> Registrar paquete</button>
          </div>
        </form>
      </div>
    </div>
  );
}
