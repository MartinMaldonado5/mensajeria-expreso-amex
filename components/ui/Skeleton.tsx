'use client';

import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  variant?: 'rectangular' | 'circular' | 'rounded';
}

/**
 * Componente base de Skeleton con efecto Shimmer ultra-fluido
 */
export function Skeleton({
  className = '',
  width,
  height,
  borderRadius,
  variant = 'rounded',
  style,
  ...props
}: SkeletonProps) {
  const defaultRadius =
    variant === 'circular' ? '9999px' : variant === 'rounded' ? '8px' : '0px';

  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? '1rem',
        borderRadius: borderRadius ?? defaultRadius,
        ...style
      }}
      {...props}
    />
  );
}

/**
 * Skeleton para las tarjetas KPI de métricas superiores
 */
export function KpiCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width="90px" height="12px" borderRadius="4px" />
            <Skeleton width="22px" height="22px" variant="circular" />
          </div>
          <Skeleton width="110px" height="24px" borderRadius="6px" />
          <Skeleton width="130px" height="11px" borderRadius="4px" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton para tablas de datos (Existencias, Clientes, Despacho, Kardex)
 */
export function TableSkeleton({
  rows = 5,
  columns = 8,
  showHeader = true
}: {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}
    >
      {showHeader && (
        <div
          style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '12px 16px',
            display: 'flex',
            gap: '16px',
            alignItems: 'center'
          }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              height="14px"
              width={i === 0 ? '30px' : i === 1 ? '110px' : i === 2 ? '130px' : '90px'}
              borderRadius="4px"
            />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={rIdx}
            style={{
              padding: '12px 16px',
              borderBottom: rIdx < rows - 1 ? '1px solid #f1f5f9' : 'none',
              display: 'flex',
              gap: '16px',
              alignItems: 'center'
            }}
          >
            {Array.from({ length: columns }).map((_, cIdx) => (
              <Skeleton
                key={cIdx}
                height="16px"
                width={
                  cIdx === 0
                    ? '24px'
                    : cIdx === 1
                    ? '95px'
                    : cIdx === 2
                    ? '120px'
                    : cIdx === 3
                    ? '140px'
                    : '80px'
                }
                borderRadius="6px"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton para la Matriz Visual de Anaqueles WMS
 */
export function MatrixSkeleton({ shelvesCount = 2 }: { shelvesCount?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
      {Array.from({ length: shelvesCount }).map((_, sIdx) => (
        <div
          key={sIdx}
          style={{
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '10px'
            }}
          >
            <Skeleton width="140px" height="18px" borderRadius="6px" />
            <Skeleton width="80px" height="20px" borderRadius="6px" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Array.from({ length: 3 }).map((_, fIdx) => (
              <div
                key={fIdx}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton width="120px" height="14px" />
                  <Skeleton width="45px" height="14px" />
                </div>
                <Skeleton width="100%" height="8px" borderRadius="999px" />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Skeleton width="60px" height="16px" borderRadius="4px" />
                  <Skeleton width="60px" height="16px" borderRadius="4px" />
                  <Skeleton width="60px" height="16px" borderRadius="4px" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton de Página Completa durante la carga inicial
 */
export function PageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '6px 0' }}>
      {/* Breadcrumb & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width="220px" height="12px" />
          <Skeleton width="320px" height="26px" borderRadius="8px" />
          <Skeleton width="420px" height="14px" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width="110px" height="36px" borderRadius="8px" />
          <Skeleton width="130px" height="36px" borderRadius="8px" />
        </div>
      </div>

      {/* KPI Cards */}
      <KpiCardsSkeleton count={4} />

      {/* Search & Filter Bar */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}
      >
        <Skeleton width="300px" height="34px" borderRadius="8px" />
        <Skeleton width="130px" height="34px" borderRadius="8px" />
        <Skeleton width="130px" height="34px" borderRadius="8px" />
      </div>

      {/* Table */}
      <TableSkeleton rows={6} columns={8} />
    </div>
  );
}
