'use client';

import React from 'react';

interface SmoothScrollProviderProps {
  children: React.ReactNode;
}

/**
 * Proveedor de scroll nativo optimizado a 120Hz/60Hz sin bloqueo de touchpad o pantalla táctil
 */
export default function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  return <>{children}</>;
}
