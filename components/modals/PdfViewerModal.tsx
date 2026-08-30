'use client';

import React from 'react';
import { getR2ViewUrl } from '@/lib/r2/client';
import { ExternalLink, Download, FileText, X } from 'lucide-react';

interface PdfViewerModalProps {
  url: string;
  onClose: () => void;
}

export default function PdfViewerModal({ url, onClose }: PdfViewerModalProps) {
  const resolvedUrl = getR2ViewUrl(url);
  const downloadUrl = resolvedUrl
    ? `${resolvedUrl}${resolvedUrl.includes('?') ? '&' : '?'}download=true`
    : '';

  return (
    <div className="modal-overlay active" style={{ zIndex: 9999 }} onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '960px',
          height: '88vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '14px',
          overflow: 'hidden',
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="modal-header"
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Visor de Factura / Documento (Cloudflare R2)
              </h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Acceso seguro y protegido
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download="factura_documento.pdf"
                className="btn"
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none'
                }}
              >
                <Download className="w-4 h-4" />
                <span>Descargar</span>
              </a>
            )}
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{
                background: '#2563eb',
                color: '#ffffff',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none'
              }}
            >
              <ExternalLink className="w-4 h-4" />
              <span>Nueva Pestaña</span>
            </a>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                color: '#ffffff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px'
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0, flex: 1, position: 'relative', background: '#1e293b' }}>
          <iframe
            src={resolvedUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Visor PDF R2"
          />
        </div>
      </div>
    </div>
  );
}
