'use client';

import React, { useState, useMemo } from 'react';
import { Paquete } from '@/types';
import { X, ClipboardPaste, CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Database } from 'lucide-react';
import { soundEffects } from '@/lib/audio/soundEffects';

interface ParsedItem {
  codigoWr: string;
  trackingUsa?: string;
  casillero?: string;
  consignatario?: string;
  pesoKg?: number;
  posicionEstante?: string;
  notas?: string;
  matchedInDb?: boolean;
}

interface PasteWrListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: ParsedItem[]) => Promise<void>;
  paquetes: Paquete[];
}

export default function PasteWrListModal({
  isOpen,
  onClose,
  onImport,
  paquetes = []
}: PasteWrListModalProps) {
  const [rawText, setRawText] = useState('');
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedResults = useMemo(() => {
    if (!rawText.trim()) return { items: [], totalLines: 0, duplicatesCount: 0 };

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const seenCodes = new Set<string>();
    const items: ParsedItem[] = [];
    let duplicates = 0;

    const dbMap = new Map<string, Paquete>();
    paquetes.forEach(p => {
      if (p.numeroReciboBodega) {
        dbMap.set(p.numeroReciboBodega.toUpperCase().trim(), p);
      }
    });

    for (const line of lines) {
      if (line.includes('\t')) {
        const cols = line.split('\t').map(c => c.trim());
        const rawCode = cols[0];
        if (!rawCode) continue;

        const codeUpper = rawCode.toUpperCase().replace(/\s+/g, '');
        if (seenCodes.has(codeUpper)) {
          duplicates++;
          continue;
        }
        seenCodes.add(codeUpper);

        const dbMatch = autoEnrich ? dbMap.get(codeUpper) : undefined;

        items.push({
          codigoWr: codeUpper,
          trackingUsa: cols[1] || dbMatch?.trackingUsa || '',
          casillero: cols[2] || dbMatch?.codigoCasillero || '',
          consignatario: cols[3] || dbMatch?.nombreConsignatario || '',
          pesoKg: Number(cols[4]) || dbMatch?.pesoKg || 0,
          posicionEstante: cols[5] || dbMatch?.posicionEstante || 'REC',
          notas: cols[6] || '',
          matchedInDb: !!dbMatch
        });
      } else {
        const codeMatch = line.match(/(?:WR[-\s]?)?\d{3,8}|[A-Z0-9_-]{5,25}/i);
        const code = codeMatch ? codeMatch[0].toUpperCase().replace(/\s+/g, '') : line.toUpperCase();

        if (!code) continue;
        const normalizedCode = /^\d{3,8}$/.test(code) ? `WR${code}` : code;

        if (seenCodes.has(normalizedCode)) {
          duplicates++;
          continue;
        }
        seenCodes.add(normalizedCode);

        const dbMatch = autoEnrich ? dbMap.get(normalizedCode) : undefined;

        items.push({
          codigoWr: normalizedCode,
          trackingUsa: dbMatch?.trackingUsa || '',
          casillero: dbMatch?.codigoCasillero || '',
          consignatario: dbMatch?.nombreConsignatario || '',
          pesoKg: dbMatch?.pesoKg || 0,
          posicionEstante: dbMatch?.posicionEstante || 'REC',
          notas: dbMatch?.descripcion || '',
          matchedInDb: !!dbMatch
        });
      }
    }

    return {
      items,
      totalLines: lines.length,
      duplicatesCount: duplicates
    };
  }, [rawText, autoEnrich, paquetes]);

  if (!isOpen) return null;

  const handleImportClick = async () => {
    if (parsedResults.items.length === 0) {
      setError('Por favor pega o ingresa al menos un código WR válido');
      return;
    }

    try {
      setIsImporting(true);
      setError(null);
      await onImport(parsedResults.items);
      soundEffects.playBulkLoaded();
      onClose();
      setRawText('');
    } catch (err: unknown) {
      console.error('Import error:', err);
      setError((err as Error)?.message || 'Error al importar los códigos');
    } finally {
      setIsImporting(false);
    }
  };

  const handlePasteSample = () => {
    if (paquetes.length > 0) {
      const sampleCodes = paquetes.slice(0, 15).map(p => p.numeroReciboBodega).join('\n');
      setRawText(sampleCodes);
    } else {
      setRawText(`WR000451\nWR000452\nWR000453\nWR000454\nWR000455\nWR000456\nWR000457\nWR000458\nWR000459\nWR000460`);
    }
  };

  const matchedCount = parsedResults.items.filter(i => i.matchedInDb).length;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', border: '1px solid #cbd5e1', width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', background: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6ee7b7' }}>
              <ClipboardPaste style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 900, margin: 0 }}>Pegar Lista de WRs (Excel / Sheets)</h2>
              <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>Importación masiva rápida para cotejo con pistola</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {error && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
              Pega aquí la columna de códigos WR de Excel:
            </label>
            <button
              type="button"
              onClick={handlePasteSample}
              style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Sparkles style={{ width: '13px', height: '13px', color: '#d97706' }} />
              Cargar ejemplo de prueba
            </button>
          </div>

          <textarea
            rows={7}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder="WR000451&#10;WR000452&#10;WR000453&#10;WR000454..."
            style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
          />

          {/* Auto Enrich Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              id="autoEnrich"
              checked={autoEnrich}
              onChange={e => setAutoEnrich(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="autoEnrich" style={{ fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database style={{ width: '14px', height: '14px', color: '#2563eb' }} />
              Auto-completar datos desde inventario principal (Consignatario, Casillero, Peso y Estante)
            </label>
          </div>

          {/* Preview Statistics */}
          {parsedResults.items.length > 0 && (
            <div style={{ padding: '10px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, color: '#047857' }}>
              <span>✓ {parsedResults.items.length} códigos detectados</span>
              {autoEnrich && <span>({matchedCount} encontrados en base de datos)</span>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleImportClick}
            disabled={isImporting || parsedResults.items.length === 0}
            style={{ padding: '9px 18px', background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: parsedResults.items.length === 0 ? 0.5 : 1 }}
          >
            <CheckCircle2 style={{ width: '15px', height: '15px' }} />
            <span>{isImporting ? 'Importando...' : `Importar ${parsedResults.items.length} WRs`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
