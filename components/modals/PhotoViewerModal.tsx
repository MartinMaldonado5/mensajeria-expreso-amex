'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  Download,
  Trash2,
  Maximize2,
  Camera,
  Image as ImageIcon
} from 'lucide-react';

export interface PhotoItem {
  url: string;
  key?: string;
  fileName?: string;
  fecha?: string;
}

interface PhotoViewerModalProps {
  title?: string;
  subtitle?: string;
  photos: PhotoItem[];
  initialIndex?: number;
  onClose: () => void;
  onDeletePhoto?: (index: number) => void;
}

export default function PhotoViewerModal({
  title = 'Visualizador de Evidencias y Fotos',
  subtitle = '',
  photos = [],
  initialIndex = 0,
  onClose,
  onDeletePhoto
}: PhotoViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, photos.length - 1))
  );
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentPhoto = photos[currentIndex];

  // Reset zoom & rotation when changing photos
  useEffect(() => {
    setZoomLevel(1);
    setRotation(0);
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, photos.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Soporte de teclado: Esc, flechas izq/der, +, -
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel(z => Math.min(z + 0.25, 3));
      } else if (e.key === '-') {
        setZoomLevel(z => Math.max(z - 0.25, 0.5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleNext, handlePrev]);

  if (!photos || photos.length === 0 || !currentPhoto) {
    return null;
  }

  const handleZoomIn = () => setZoomLevel(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(z => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleReset = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const handleDeleteCurrent = () => {
    if (!onDeletePhoto) return;
    if (confirm(`¿Estás seguro de eliminar la foto #${currentIndex + 1}?`)) {
      onDeletePhoto(currentIndex);
      if (photos.length <= 1) {
        onClose();
      } else if (currentIndex >= photos.length - 1) {
        setCurrentIndex(photos.length - 2);
      }
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        background: 'rgba(5, 10, 20, 0.94)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px'
      }}
      onClick={onClose}
    >
      {/* 1. HEADER DEL VISOR */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          padding: '10px 16px',
          color: '#ffffff',
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff' }}>
              {title}
            </div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
              {subtitle || 'Evidencias en alta resolución en Cloudflare R2'} ·{' '}
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                Foto {currentIndex + 1} de {photos.length}
              </span>
            </div>
          </div>
        </div>

        {/* Botones de Control Superior */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="btn"
            style={{
              background: '#1e293b',
              border: '1px solid #475569',
              color: '#ffffff',
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: '8px',
              fontWeight: 700
            }}
            title="Aumentar Zoom (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="btn"
            style={{
              background: '#1e293b',
              border: '1px solid #475569',
              color: '#ffffff',
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: '8px',
              fontWeight: 700
            }}
            title="Reducir Zoom (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Rotar */}
          <button
            type="button"
            onClick={handleRotate}
            className="btn"
            style={{
              background: '#1e293b',
              border: '1px solid #475569',
              color: '#ffffff',
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: '8px',
              fontWeight: 700
            }}
            title="Rotar 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Abrir enlace original R2 */}
          <a
            href={currentPhoto.url}
            target="_blank"
            rel="noreferrer"
            className="btn"
            style={{
              background: '#0284c7',
              border: 'none',
              color: '#ffffff',
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '8px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none'
            }}
            title="Abrir imagen original de Cloudflare R2"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hide-mobile">Abrir R2</span>
          </a>

          {/* Eliminar Foto */}
          {onDeletePhoto && (
            <button
              type="button"
              onClick={handleDeleteCurrent}
              className="btn"
              style={{
                background: '#dc2626',
                border: 'none',
                color: '#ffffff',
                padding: '6px 10px',
                fontSize: '12px',
                borderRadius: '8px',
                fontWeight: 800
              }}
              title="Eliminar esta foto"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Cerrar Modal */}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 900,
              marginLeft: '4px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* 2. ÁREA PRINCIPAL DE LA IMAGEN EN ALTA RESOLUCIÓN */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '1200px',
          margin: '10px auto',
          userSelect: 'none'
        }}
      >
        {/* Flecha Anterior */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === 0 ? 0.3 : 1,
              zIndex: 10,
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Imagen en Grande */}
        <div
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s ease',
            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
          }}
        >
          <img
            src={currentPhoto.url}
            alt={currentPhoto.fileName || `Foto ${currentIndex + 1}`}
            style={{
              maxWidth: '90vw',
              maxHeight: '68vh',
              objectFit: 'contain',
              borderRadius: '10px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          />
        </div>

        {/* Flecha Siguiente */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex === photos.length - 1}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentIndex === photos.length - 1 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === photos.length - 1 ? 0.3 : 1,
              zIndex: 10,
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* 3. TIRA INFERIOR DE MINIATURAS (CAROUSEL) */}
      {photos.length > 1 && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            justifyContent: 'center',
            padding: '8px 12px',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            maxWidth: '1200px',
            width: '100%',
            margin: '0 auto',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
          }}
        >
          {photos.map((photo, idx) => {
            const isSelected = idx === currentIndex;
            return (
              <div
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isSelected ? '2.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.2)',
                  opacity: isSelected ? 1 : 0.6,
                  transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  position: 'relative'
                }}
              >
                <img
                  src={photo.url}
                  alt={`Miniatura ${idx + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 900,
                    padding: '1px 4px',
                    borderRadius: '4px'
                  }}
                >
                  #{idx + 1}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
