'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  Camera,
  Flashlight,
  Volume2,
  VolumeX,
  Vibrate,
  Sparkles,
  Upload,
  Keyboard,
  AlertCircle,
  VideoOff,
  Plus,
  Layers,
  Search,
  Truck,
  MessageCircle,
  Package,
  User,
  MapPin
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Paquete, Cliente } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface BarcodeBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MobileScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (decodedText: string, format: string, extra?: { mode: string; location?: string }) => void;
  isInline?: boolean;
  paquetes?: Paquete[];
  clientes?: Cliente[];
  onSlotPackage?: (code: string, location: string) => void;
}

interface CameraDeviceOption {
  id: string;
  label: string;
  isPrimary?: boolean;
}

export default function MobileScannerModal({
  isOpen,
  onClose,
  onConfirm,
  isInline = false,
  paquetes = [],
  clientes = [],
  onSlotPackage
}: MobileScannerModalProps) {
  // Estado general
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<CameraDeviceOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scanMode, setScanMode] = useState<'burst' | 'manual'>('burst');

  // 🎯 Flujo de Trabajo Logístico (Workflows de Operación)
  const [workflowMode, setWorkflowMode] = useState<'slotting' | 'lookup' | 'delivery' | 'general'>('slotting');

  // 📍 Selector Fijo de Anaqueles (2 Anaqueles × 3 Pisos)
  const [selectedAnaquel, setSelectedAnaquel] = useState<'A1' | 'A2' | 'REC' | 'DSP'>('A1');
  const [selectedPiso, setSelectedPiso] = useState<'P1' | 'P2' | 'P3'>('P1');

  // Refs de Estado en Tiempo Real (Resuelven el Stale Closure en el bucle de cámara)
  const selectedAnaquelRef = useRef(selectedAnaquel);
  selectedAnaquelRef.current = selectedAnaquel;

  const selectedPisoRef = useRef(selectedPiso);
  selectedPisoRef.current = selectedPiso;

  const workflowModeRef = useRef(workflowMode);
  workflowModeRef.current = workflowMode;

  const onSlotPackageRef = useRef(onSlotPackage);
  onSlotPackageRef.current = onSlotPackage;

  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const paquetesRef = useRef(paquetes);
  paquetesRef.current = paquetes;

  const clientesRef = useRef(clientes);
  clientesRef.current = clientes;

  const scanModeRef = useRef(scanMode);
  scanModeRef.current = scanMode;

  // 📋 Estructura de Datos para la Confirmación de Escaneo
  interface PendingConfirmationData {
    code: string;
    format: string;
    workflow: 'slotting' | 'lookup' | 'delivery' | 'general';
    location: string;
    anaquel: 'A1' | 'A2' | 'REC' | 'DSP';
    piso: 'P1' | 'P2' | 'P3';
    pkg?: Paquete;
    cli?: Cliente;
    detectedAt: number;
  }

  // Estado de confirmación pendiente (Requiere aprobación del usuario antes de guardar)
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmationData | null>(null);
  const pendingConfirmationRef = useRef<PendingConfirmationData | null>(null);
  pendingConfirmationRef.current = pendingConfirmation;

  // Ficha 360° para Modo Consulta / Localización
  const [lookupResult, setLookupResult] = useState<{ pkg?: Paquete; cli?: Cliente; rawCode: string } | null>(null);

  const [lastScannedCode, setLastScannedCode] = useState<{ code: string; location?: string; time: number } | null>(null);
  const [detectedBox, setDetectedBox] = useState<BarcodeBoundingBox | null>(null);
  const [recentFlash, setRecentFlash] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSecureContextState, setIsSecureContextState] = useState<boolean>(true);

  // Capacidades de hardware
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // Entrada Manual y Subida de Foto
  const [manualInputType, setManualInputType] = useState<'wr_preset' | 'free_code'>('wr_preset');
  const [manualPrefix, setManualPrefix] = useState<'WR000' | 'WR-000'>('WR000');
  const [manualDigits, setManualDigits] = useState('');
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Motor detector activo
  const [activeEngine, setActiveEngine] = useState<'native_gpu' | 'html5_qrcode'>('native_gpu');
  const [fpsCounter, setFpsCounter] = useState<number>(30);

  // Refs de hardware y bucle
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const scanLoopActiveRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const nativeDetectorRef = useRef<unknown>(null);
  const html5QrFallbackRef = useRef<Html5Qrcode | null>(null);
  const lastCodeTimeRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });
  const isMountedRef = useRef(true);

  const currentShelfLocation = `${selectedAnaquel}-${selectedPiso}`;

  useEffect(() => {
    isMountedRef.current = true;
    if (typeof window !== 'undefined') {
      const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      setIsSecureContextState(isSecure);
    }
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reproducción de sonido
  const playScanBeep = useCallback((isHighPitch = true) => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isHighPitch ? 1450 : 880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Silent
    }
  }, [soundEnabled]);

  // Vibración háptica
  const triggerHaptic = useCallback(() => {
    if (!vibrationEnabled) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([60, 30, 60]);
      } catch {
        // Silent
      }
    }
  }, [vibrationEnabled]);

  // Búsqueda 360° en tiempo real (instantánea y no invasiva)
  const performLookup = useCallback((cleanCode: string) => {
    const upper = cleanCode.trim().toUpperCase();
    const currentPackages = paquetesRef.current;
    const currentClients = clientesRef.current;

    const foundPkg = currentPackages.find(p =>
      p.numeroReciboBodega.toUpperCase() === upper ||
      p.trackingUsa.toUpperCase() === upper ||
      p.codigoCasillero.toUpperCase() === upper ||
      p.dniConsignatario?.toUpperCase() === upper ||
      (upper.length >= 4 && p.numeroReciboBodega.toUpperCase().includes(upper)) ||
      (upper.length >= 6 && p.trackingUsa.toUpperCase().includes(upper))
    );

    const foundCli = currentClients.find(c =>
      c.codigoCasillero.toUpperCase() === upper ||
      c.documentoIdentidad === upper ||
      (foundPkg && c.codigoCasillero.toUpperCase() === foundPkg.codigoCasillero.toUpperCase())
    );

    setLookupResult({
      pkg: foundPkg,
      cli: foundCli,
      rawCode: cleanCode
    });
  }, []);

  // 🔔 Procesamiento de código detectado: Emite Beep + Haptic y Solicita Confirmación al Usuario
  const handleBarcodeFound = useCallback((code: string, format: string, boundingBox?: BarcodeBoundingBox) => {
    const now = Date.now();
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Si ya existe una confirmación en pantalla, evitar superposición
    if (pendingConfirmationRef.current) {
      return;
    }

    // Debounce de 1.8s para el mismo código consecutivo
    if (lastCodeTimeRef.current.code === cleanCode && now - lastCodeTimeRef.current.timestamp < 1800) {
      return;
    }

    lastCodeTimeRef.current = { code: cleanCode, timestamp: now };
    setRecentFlash(true);
    setTimeout(() => {
      if (isMountedRef.current) setRecentFlash(false);
    }, 450);

    if (boundingBox) {
      setDetectedBox(boundingBox);
      setTimeout(() => {
        if (isMountedRef.current) setDetectedBox(null);
      }, 800);
    }

    // 🔊 Sonido Beep y Vibración Inmediatos
    playScanBeep();
    triggerHaptic();

    // ⚡ LECTURA DINÁMICA DE VALORES ACTUALIZADOS EN VIVO
    const activeWorkflow = workflowModeRef.current;
    const activeAnaquel = selectedAnaquelRef.current;
    const activePiso = selectedPisoRef.current;
    const activeLocation = `${activeAnaquel}-${activePiso}`;

    // Buscar paquete y cliente en el sistema para enriquecer la confirmación
    const upper = cleanCode.toUpperCase();
    const currentPackages = paquetesRef.current;
    const currentClients = clientesRef.current;

    const foundPkg = currentPackages.find(p =>
      p.numeroReciboBodega.toUpperCase() === upper ||
      p.trackingUsa.toUpperCase() === upper ||
      p.codigoCasillero.toUpperCase() === upper
    );

    const foundCli = currentClients.find(c =>
      c.codigoCasillero.toUpperCase() === upper ||
      c.documentoIdentidad === upper ||
      (foundPkg && c.codigoCasillero.toUpperCase() === foundPkg.codigoCasillero.toUpperCase())
    );

    // 🔍 SI EL MODO ES 'lookup' (Localizar 360°):
    // DIRECTO E INSTANTÁNEO: Abrir Ficha 360° de inmediato sin pedir confirmación de guardado ni anaqueles.
    if (activeWorkflow === 'lookup') {
      performLookup(cleanCode);
      setLastScannedCode({ code: cleanCode, time: now });
      return;
    }

    // 🛑 Para modo 'slotting' o 'delivery': Presentar diálogo interactivo de confirmación antes de añadir a la cola local
    setPendingConfirmation({
      code: cleanCode,
      format,
      workflow: activeWorkflow,
      location: activeLocation,
      anaquel: activeAnaquel,
      piso: activePiso,
      pkg: foundPkg,
      cli: foundCli,
      detectedAt: now
    });
  }, [playScanBeep, triggerHaptic, performLookup]);

  // ✅ Acción: Usuario Confirma el Código Escaneado (Persistencia en Memoria y Supabase)
  const handleConfirmScan = async (confirmedData: PendingConfirmationData) => {
    const { code, format, workflow, anaquel, piso, pkg, cli } = confirmedData;
    const now = Date.now();
    const targetLocation = `${anaquel}-${piso}`;

    if (workflow === 'slotting') {
      setLastScannedCode({ code, location: targetLocation, time: now });
      if (onSlotPackageRef.current) {
        onSlotPackageRef.current(code, targetLocation);
      }
      if (onConfirmRef.current) {
        onConfirmRef.current(code, format, {
          mode: 'slotting',
          location: targetLocation,
          anaquel,
          piso,
          pkg,
          cli
        } as unknown as { mode: string; location?: string });
      }
    } else if (workflow === 'lookup') {
      setLastScannedCode({ code, time: now });
      performLookup(code);
      if (onConfirmRef.current) {
        onConfirmRef.current(code, format, { mode: 'lookup', pkg, cli } as unknown as { mode: string; location?: string });
      }
    } else {
      setLastScannedCode({ code, location: targetLocation, time: now });
      if (onConfirmRef.current) {
        onConfirmRef.current(code, format, {
          mode: workflow,
          location: targetLocation,
          anaquel,
          piso,
          pkg,
          cli
        } as unknown as { mode: string; location?: string });
      }
    }

    setPendingConfirmation(null);
  };

  // ❌ Acción: Usuario Descarta el Escaneo
  const handleCancelScan = () => {
    setPendingConfirmation(null);
  };

  // Mantener un ref siempre actualizado a handleBarcodeFound para que ningún closure quede desactualizado
  const handleBarcodeFoundRef = useRef(handleBarcodeFound);
  handleBarcodeFoundRef.current = handleBarcodeFound;

  // Inspeccionar capacidades de la cámara
  const inspectTrackCapabilities = (track: MediaStreamTrack) => {
    try {
      trackRef.current = track;
      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as {
        torch?: boolean;
        zoom?: { min: number; max: number; step: number };
      };

      setHasTorch(Boolean(caps.torch));
      if (caps.zoom) {
        setZoomCapabilities(caps.zoom);
        setCurrentZoom(1);
      } else {
        setZoomCapabilities(null);
      }
    } catch {
      setHasTorch(false);
      setZoomCapabilities(null);
    }
  };

  // Alternar Linterna
  const toggleTorch = async () => {
    if (!trackRef.current || !hasTorch) return;
    try {
      const nextState = !isTorchOn;
      await (trackRef.current as MediaStreamTrack & { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('No se pudo activar la linterna:', err);
    }
  };

  // Ajustar Zoom
  const setZoom = async (zoomValue: number) => {
    if (!trackRef.current || !zoomCapabilities) return;
    try {
      const clamped = Math.min(Math.max(zoomValue, zoomCapabilities.min), zoomCapabilities.max);
      await (trackRef.current as MediaStreamTrack & { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
        advanced: [{ zoom: clamped }]
      });
      setCurrentZoom(clamped);
    } catch (err) {
      console.warn('No se pudo ajustar el zoom:', err);
    }
  };

  // Listar cámaras
  const discoverCameras = async (): Promise<CameraDeviceOption[]> => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      const rearDevices = videoDevices.filter(d => {
        const lbl = d.label.toLowerCase();
        return !lbl.includes('front') && !lbl.includes('user') && !lbl.includes('selfie') && !lbl.includes('delantera');
      });

      const candidateList = rearDevices.length > 0 ? rearDevices : videoDevices;

      const formatted: CameraDeviceOption[] = candidateList.map((dev, index) => {
        const lbl = dev.label.toLowerCase();
        let displayLabel = dev.label || `Cámara ${index + 1}`;
        let isPrimary = false;

        if (lbl.includes('0') || lbl.includes('main') || lbl.includes('wide') || lbl.includes('principal') || index === 0) {
          isPrimary = true;
          displayLabel = `⭐ Principal (${dev.label || `Lente ${index + 1}`})`;
        } else if (lbl.includes('macro')) {
          displayLabel = `🔍 Macro (${dev.label})`;
        } else if (lbl.includes('ultra') || lbl.includes('0.5x')) {
          displayLabel = `🌐 Gran Angular (${dev.label})`;
        } else {
          displayLabel = `📷 Cámara ${index + 1}`;
        }

        return {
          id: dev.deviceId,
          label: displayLabel,
          isPrimary
        };
      });

      formatted.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
      setCameras(formatted);
      return formatted;
    } catch {
      return [];
    }
  };

  // Bucle de escaneo nativo GPU (Llama a handleBarcodeFoundRef.current para garantizar datos en vivo)
  const startNativeDetectionLoop = useCallback(() => {
    if (!scanLoopActiveRef.current) return;

    // Si hay una confirmación pendiente, pausar las lecturas hasta que el usuario decida
    if (pendingConfirmationRef.current) {
      setTimeout(() => {
        if (scanLoopActiveRef.current) {
          requestAnimationFrame(startNativeDetectionLoop);
        }
      }, 150);
      return;
    }

    const video = videoRef.current;
    const detector = nativeDetectorRef.current as {
      detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue: string; format: string; boundingBox?: DOMRectReadOnly }>>;
    } | null;

    if (!video || !detector || video.readyState < 2) {
      if (scanLoopActiveRef.current) {
        requestAnimationFrame(startNativeDetectionLoop);
      }
      return;
    }

    detector
      .detect(video)
      .then(barcodes => {
        if (barcodes && barcodes.length > 0) {
          const b = barcodes[0];
          let box: BarcodeBoundingBox | undefined;
          if (b.boundingBox && video.videoWidth > 0 && video.videoHeight > 0) {
            box = {
              x: (b.boundingBox.x / video.videoWidth) * 100,
              y: (b.boundingBox.y / video.videoHeight) * 100,
              width: (b.boundingBox.width / video.videoWidth) * 100,
              height: (b.boundingBox.height / video.videoHeight) * 100
            };
          }
          // Llamada dinámica a través del ref
          handleBarcodeFoundRef.current(b.rawValue, b.format.toUpperCase(), box);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (scanLoopActiveRef.current) {
          setTimeout(() => {
            if (scanLoopActiveRef.current) {
              requestAnimationFrame(startNativeDetectionLoop);
            }
          }, 33);
        }
      });
  }, []);

  // Detener cámara
  const stopCameraStream = useCallback(async () => {
    scanLoopActiveRef.current = false;

    if (html5QrFallbackRef.current) {
      try {
        if (html5QrFallbackRef.current.isScanning) {
          await html5QrFallbackRef.current.stop();
        }
        await html5QrFallbackRef.current.clear();
      } catch {
        // Silent
      }
      html5QrFallbackRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // Silent
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // Silent
      }
      videoRef.current.srcObject = null;
    }

    trackRef.current = null;
    if (isMountedRef.current) {
      setIsScanning(false);
      setIsTorchOn(false);
    }
  }, []);

  // Iniciar cámara principal
  const startCameraStream = useCallback(async (cameraId?: string) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setCameraError(null);

    try {
      await stopCameraStream();

      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('El acceso a la cámara no está disponible en este navegador o requiere conexión segura (HTTPS).');
        isStartingRef.current = false;
        return;
      }

      const isNativeSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;
      let nativeDetectorInstance: unknown = null;

      if (isNativeSupported) {
        try {
          const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => unknown }).BarcodeDetector;
          nativeDetectorInstance = new BarcodeDetectorClass({
            formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8', 'upc_a', 'pdf417']
          });
          nativeDetectorRef.current = nativeDetectorInstance;
          setActiveEngine('native_gpu');
        } catch {
          nativeDetectorRef.current = null;
          setActiveEngine('html5_qrcode');
        }
      } else {
        setActiveEngine('html5_qrcode');
      }

      if (nativeDetectorInstance) {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: cameraId
            ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          inspectTrackCapabilities(videoTrack);
        }

        if (videoRef.current && isMountedRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.muted = true;

          try {
            await videoRef.current.play();
          } catch (playErr: unknown) {
            if (playErr instanceof Error && playErr.name === 'AbortError') {
              isStartingRef.current = false;
              return;
            }
            throw playErr;
          }

          setIsScanning(true);
          scanLoopActiveRef.current = true;
          setFpsCounter(30);
          requestAnimationFrame(startNativeDetectionLoop);
        }
      } else {
        setActiveEngine('html5_qrcode');
        const fallbackContainer = document.getElementById('qr-reader-fallback-viewport');
        if (fallbackContainer) {
          fallbackContainer.innerHTML = '';
        }

        const scanner = new Html5Qrcode('qr-reader-fallback-viewport', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.PDF_417
          ],
          verbose: false
        });
        html5QrFallbackRef.current = scanner;

        const cameraConfig = cameraId
          ? { deviceId: { exact: cameraId } }
          : { facingMode: 'environment' };

        await scanner.start(
          cameraConfig,
          {
            fps: 20,
            qrbox: (vfWidth: number, vfHeight: number) => ({
              width: Math.max(80, Math.floor((vfWidth || 320) * 0.85)),
              height: Math.max(60, Math.floor((vfHeight || 240) * 0.5))
            }),
            aspectRatio: 1.777778
          },
          (decodedText, result) => {
            const formatName = result?.result?.format?.formatName || 'CODE_128';
            // ⚡ Llamada dinámica al ref en tiempo real
            handleBarcodeFoundRef.current(decodedText, formatName);
          },
          () => {}
        );

        if (isMountedRef.current) {
          setIsScanning(true);
          scanLoopActiveRef.current = true;
          setFpsCounter(20);
        }
      }

      const camList = await discoverCameras();
      if (camList.length > 0 && !cameraId && isMountedRef.current) {
        const primary = camList.find(c => c.isPrimary) || camList[0];
        setSelectedCameraId(primary.id);
      } else if (cameraId && isMountedRef.current) {
        setSelectedCameraId(cameraId);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        isStartingRef.current = false;
        return;
      }
      console.warn('Aviso de cámara:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Permission') || errMsg.includes('NotAllowedError')) {
        setCameraError('Permiso de cámara denegado. Habilita el permiso en tu navegador.');
      } else if (errMsg.includes('NotFound') || errMsg.includes('DevicesNotFoundError')) {
        setCameraError('No se encontró ninguna cámara.');
      } else {
        setCameraError('No se pudo acceder a la cámara en vivo. Puedes tomar foto o ingresar manualmente abajo.');
      }
      if (isMountedRef.current) {
        setIsScanning(false);
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [discoverCameras, startNativeDetectionLoop, stopCameraStream]);

  const startCameraRef = useRef(startCameraStream);
  startCameraRef.current = startCameraStream;
  const stopCameraRef = useRef(stopCameraStream);
  stopCameraRef.current = stopCameraStream;

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startCameraRef.current();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopCameraRef.current();
      };
    } else {
      stopCameraRef.current();
    }
  }, [isOpen]);

  // Subida de foto
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    setIsProcessingImage(true);

    try {
      const tempScanner = new Html5Qrcode('qr-reader-temp-file', false);
      const decodedResult = await tempScanner.scanFile(file, true);
      await tempScanner.clear();

      if (decodedResult) {
        handleBarcodeFoundRef.current(decodedResult, 'IMAGE_SCAN');
      }
    } catch {
      try {
        if ('BarcodeDetector' in window) {
          const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => { detect: (bitmap: ImageBitmap) => Promise<Array<{ rawValue: string; format: string }>> } }).BarcodeDetector;
          const detector = new BarcodeDetectorClass();
          const bitmap = await createImageBitmap(file);
          const barcodes = await detector.detect(bitmap);
          if (barcodes && barcodes.length > 0) {
            handleBarcodeFoundRef.current(barcodes[0].rawValue, barcodes[0].format.toUpperCase());
            setIsProcessingImage(false);
            return;
          }
        }
      } catch {
        // Silent
      }
      setImageError('No se detectó código de barras en la foto. Intenta con mejor iluminación o ingresa el código abajo.');
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Entrada manual optimizada con prefijo WR000 fijo + 6 dígitos
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInputType === 'wr_preset') {
      const cleanDigits = manualDigits.trim();
      if (!cleanDigits) return;
      let fullCode = '';
      if (cleanDigits.toUpperCase().startsWith('WR')) {
        fullCode = cleanDigits.toUpperCase();
      } else {
        fullCode = `${manualPrefix}${cleanDigits}`;
      }
      handleBarcodeFoundRef.current(fullCode, 'MANUAL_ENTRY');
      setManualDigits('');
    } else {
      const clean = manualCodeInput.trim().toUpperCase();
      if (!clean) return;
      handleBarcodeFoundRef.current(clean, 'MANUAL_ENTRY');
      setManualCodeInput('');
    }
  };

  if (!isOpen) return null;

  const scannerBody = (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
      }}
    >
      {/* Header & Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-barcode" style={{ color: '#2563eb' }}></i> Escáner Logístico AMEX
            </h3>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '12px',
                background: activeEngine === 'native_gpu' ? '#dcfce7' : '#fef3c7',
                color: activeEngine === 'native_gpu' ? '#166534' : '#92400e',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Sparkles className="w-3 h-3" />
              {activeEngine === 'native_gpu' ? 'GPU Ultra-Rápido' : 'ZXing Engine'}
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: '#64748b', margin: '4px 0 0 0' }}>
            Lee Guías WR#, Trackings USA, Casilleros AMEX y códigos DNI PDF417.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Silenciar Beep' : 'Activar Beep'}
            style={{
              background: soundEnabled ? '#f1f5f9' : '#fee2e2',
              border: '1px solid #cbd5e1',
              color: soundEnabled ? '#334155' : '#dc2626',
              borderRadius: '8px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setVibrationEnabled(!vibrationEnabled)}
            title={vibrationEnabled ? 'Desactivar Vibración' : 'Activar Vibración'}
            style={{
              background: vibrationEnabled ? '#f1f5f9' : '#fee2e2',
              border: '1px solid #cbd5e1',
              color: vibrationEnabled ? '#334155' : '#dc2626',
              borderRadius: '8px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Vibrate className="w-4 h-4" />
          </button>

          {!isInline && (
            <button
              onClick={() => {
                stopCameraStream();
                onClose();
              }}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                width: '34px',
                height: '34px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 700,
                color: '#64748b'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 🎯 SELECTOR DE MODO OPERATIVO (WORKFLOWS) */}
      <div className="scanner-workflow-selector">
        <button
          onClick={() => setWorkflowMode('slotting')}
          className="scanner-workflow-btn"
          style={{
            background: workflowMode === 'slotting' ? '#2563eb' : '#ffffff',
            color: workflowMode === 'slotting' ? '#ffffff' : '#334155',
            border: workflowMode === 'slotting' ? '1.5px solid #1d4ed8' : '1px solid #cbd5e1',
            boxShadow: workflowMode === 'slotting' ? '0 2px 8px rgba(37,99,235,0.35)' : 'none'
          }}
        >
          <Layers className="w-4 h-4" /> 📦 Asignar Anaquel
        </button>

        <button
          onClick={() => setWorkflowMode('lookup')}
          className="scanner-workflow-btn"
          style={{
            background: workflowMode === 'lookup' ? '#16a34a' : '#ffffff',
            color: workflowMode === 'lookup' ? '#ffffff' : '#334155',
            border: workflowMode === 'lookup' ? '1.5px solid #15803d' : '1px solid #cbd5e1',
            boxShadow: workflowMode === 'lookup' ? '0 2px 8px rgba(22,163,74,0.35)' : 'none'
          }}
        >
          <Search className="w-4 h-4" /> 🔍 Localizar 360°
        </button>

        <button
          onClick={() => setWorkflowMode('delivery')}
          className="scanner-workflow-btn"
          style={{
            background: workflowMode === 'delivery' ? '#9333ea' : '#ffffff',
            color: workflowMode === 'delivery' ? '#ffffff' : '#334155',
            border: workflowMode === 'delivery' ? '1.5px solid #7e22ce' : '1px solid #cbd5e1',
            boxShadow: workflowMode === 'delivery' ? '0 2px 8px rgba(147,51,234,0.35)' : 'none'
          }}
        >
          <Truck className="w-4 h-4" /> 🚚 Despachar
        </button>
      </div>

      {/* 🔹 MÉTODO 1: PANEL SELECTOR FIJO DE ANAQUEL Y PISO (2 ANAQUELES × 3 PISOS EN TIEMPO REAL) */}
      {workflowMode === 'slotting' && (
        <div
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1.5px solid #93c5fd',
            borderRadius: '12px',
            padding: '10px 12px',
            marginBottom: '12px',
            boxShadow: '0 2px 8px rgba(37,99,235,0.08)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '5px', textTransform: 'uppercase' }}>
              <Layers className="w-3.5 h-3.5" /> Ubicación Destino Activa:
            </div>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '14px',
                fontWeight: 900,
                background: '#1e40af',
                color: '#ffffff',
                padding: '3px 12px',
                borderRadius: '6px',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 6px rgba(30,64,175,0.35)'
              }}
            >
              {currentShelfLocation}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: '2px' }}>
                Anaquel / Estante:
              </label>
              <select
                value={selectedAnaquel}
                onChange={e => {
                  const val = e.target.value as 'A1' | 'A2' | 'REC' | 'DSP';
                  setSelectedAnaquel(val);
                  selectedAnaquelRef.current = val;
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: '1.5px solid #93c5fd',
                  background: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  color: '#1e3a8a',
                  padding: '0 8px',
                  outline: 'none'
                }}
              >
                <option value="A1">🟦 Anaquel 1 (A1)</option>
                <option value="A2">🟩 Anaquel 2 (A2)</option>
                <option value="REC">🟨 Mesa Recepción (REC)</option>
                <option value="DSP">🟪 Zona Despacho (DSP)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: '2px' }}>
                Piso (3 Niveles):
              </label>
              <select
                value={selectedPiso}
                onChange={e => {
                  const val = e.target.value as 'P1' | 'P2' | 'P3';
                  setSelectedPiso(val);
                  selectedPisoRef.current = val;
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: '1.5px solid #93c5fd',
                  background: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  color: '#1e3a8a',
                  padding: '0 8px',
                  outline: 'none'
                }}
              >
                <option value="P1">⬇️ Piso 1 (Inferior)</option>
                <option value="P2">↔️ Piso 2 (Medio)</option>
                <option value="P3">⬆️ Piso 3 (Superior)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 BANNER INFORMATIVO MODO LOCALIZAR 360° */}
      {workflowMode === 'lookup' && (
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1.5px solid #86efac',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '12px',
            boxShadow: '0 2px 8px rgba(22,163,74,0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803d', fontWeight: 800, fontSize: '12.5px' }}>
            <Search className="w-4 h-4 text-green-600" /> Modo Consulta 360° Instantánea
          </div>
          <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px', lineHeight: '1.4' }}>
            Apunta a cualquier código o escríbelo para <strong>ver al instante en qué anaquel se encuentra</strong>, los datos del cliente y su estado, sin alterar su ubicación ni pedir confirmaciones de guardado.
          </div>
        </div>
      )}

      {/* 🚚 BANNER INFORMATIVO MODO DESPACHO */}
      {workflowMode === 'delivery' && (
        <div
          style={{
            background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
            border: '1.5px solid #d8b4fe',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '12px',
            boxShadow: '0 2px 8px rgba(147,51,234,0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7e22ce', fontWeight: 800, fontSize: '12.5px' }}>
            <Truck className="w-4 h-4 text-purple-600" /> Modo Despacho y Reparto
          </div>
          <div style={{ fontSize: '11px', color: '#6b21a8', marginTop: '2px', lineHeight: '1.4' }}>
            Escanea paquetes para registrar salida a reparto local en Carro Amex o traslado a agencias (Olva/Shalom).
          </div>
        </div>
      )}

      {/* Alerta de contexto seguro para móviles */}
      {!isSecureContextState && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '10px 12px',
            marginBottom: '12px',
            fontSize: '11.5px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}
        >
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" style={{ marginTop: '2px' }} />
          <div>
            <strong>Aviso de Conexión Segura:</strong> Para encender la cámara en vivo en tu celular, accede por <strong>HTTPS</strong> (`https://192.168.1.126:3000`) o usa la opción <strong>&quot;📸 Tomar Foto&quot;</strong> abajo.
          </div>
        </div>
      )}

      {/* VIEWPORT DE LA CÁMARA */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          backgroundColor: '#020617',
          borderRadius: '14px',
          overflow: 'hidden',
          minHeight: '260px',
          maxHeight: '48vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: recentFlash ? '3px solid #22c55e' : '2px solid #3b82f6',
          boxShadow: recentFlash ? '0 0 25px rgba(34,197,94,0.5)' : '0 6px 24px rgba(37, 99, 235, 0.18)',
          transition: 'border-color 0.2s, box-shadow 0.2s'
        }}
      >
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isScanning && activeEngine === 'native_gpu' ? 'block' : 'none'
          }}
        />

        <div
          id="qr-reader-fallback-viewport"
          style={{
            width: '100%',
            display: isScanning && activeEngine === 'html5_qrcode' ? 'block' : 'none'
          }}
        />

        <div id="qr-reader-temp-file" style={{ display: 'none' }} />

        {/* OVERLAY DEL VISOR Y GUÍA LÁSER */}
        {isScanning && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {recentFlash && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(34, 197, 94, 0.25)',
                  zIndex: 25,
                  animation: 'pulse 0.4s'
                }}
              />
            )}

            {detectedBox && (
              <div
                style={{
                  position: 'absolute',
                  left: `${detectedBox.x}%`,
                  top: `${detectedBox.y}%`,
                  width: `${detectedBox.width}%`,
                  height: `${detectedBox.height}%`,
                  border: '2px solid #22c55e',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  boxShadow: '0 0 12px #22c55e',
                  zIndex: 20
                }}
              />
            )}

            {/* Línea Láser Centrada */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '6%',
                right: '6%',
                height: '3px',
                transform: 'translateY(-50%)',
                background: 'linear-gradient(to right, transparent, #ef4444, #ffffff, #ef4444, transparent)',
                boxShadow: '0 0 14px #ef4444, 0 0 4px #ffffff, 0 0 22px rgba(239,68,68,0.85)',
                zIndex: 10
              }}
            />

            {/* Cuadro de Encuadre */}
            <div
              style={{
                position: 'absolute',
                top: '18%',
                left: '8%',
                right: '8%',
                bottom: '18%',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '12px'
              }}
            >
              <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '20px', height: '20px', borderTop: '3.5px solid #38bdf8', borderLeft: '3.5px solid #38bdf8', borderRadius: '6px 0 0 0' }} />
              <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', borderTop: '3.5px solid #38bdf8', borderRight: '3.5px solid #38bdf8', borderRadius: '0 6px 0 0' }} />
              <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '20px', height: '20px', borderBottom: '3.5px solid #38bdf8', borderLeft: '3.5px solid #38bdf8', borderRadius: '0 0 0 6px' }} />
              <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px', borderBottom: '3.5px solid #38bdf8', borderRight: '3.5px solid #38bdf8', borderRadius: '0 0 6px 0' }} />
            </div>

            {/* Badge de estado en vivo */}
            <div
              style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 30,
                fontSize: '10.5px',
                fontWeight: 800,
                color: '#ffffff',
                background: 'rgba(2, 6, 23, 0.85)',
                padding: '3px 8px',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              {workflowMode === 'slotting' ? `ASIGNANDO ➔ ${currentShelfLocation}` : workflowMode.toUpperCase()}
            </div>

            {/* Controles Flotantes */}
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 30,
                display: 'flex',
                gap: '6px',
                pointerEvents: 'auto'
              }}
            >
              {hasTorch && (
                <button
                  onClick={toggleTorch}
                  style={{
                    background: isTorchOn ? '#eab308' : 'rgba(2, 6, 23, 0.85)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: isTorchOn ? '#0f172a' : '#ffffff',
                    padding: '5px 8px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Flashlight className="w-3 h-3" />
                  {isTorchOn ? 'Luz ON' : 'Luz OFF'}
                </button>
              )}

              {zoomCapabilities && (
                <div
                  style={{
                    background: 'rgba(2, 6, 23, 0.85)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '20px',
                    padding: '2px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  {[1, 1.5, 2].map(z => (
                    <button
                      key={z}
                      onClick={() => setZoom(z)}
                      style={{
                        background: currentZoom === z ? '#2563eb' : 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      {z}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Banner inferior de último código procesado */}
            {lastScannedCode && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  zIndex: 30,
                  background: 'rgba(2, 6, 23, 0.94)',
                  border: '1.5px solid #22c55e',
                  borderRadius: '24px',
                  padding: '5px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
                }}
              >
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 800, color: '#4ade80' }}>
                  {lastScannedCode.code}
                </span>
                {lastScannedCode.location && (
                  <span style={{ background: '#2563eb', color: '#ffffff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px' }}>
                    ➔ {lastScannedCode.location}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* 📋 DIÁLOGO INTERACTIVO DE CONFIRMACIÓN DE ESCANEO */}
        {pendingConfirmation && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 50,
              backgroundColor: 'rgba(2, 6, 23, 0.92)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '400px',
                maxHeight: '92vh',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                background: '#ffffff',
                borderRadius: '16px',
                padding: '18px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                border: '2.5px solid #22c55e',
                textAlign: 'left'
              }}
            >
              {/* Encabezado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(34,197,94,0.3)' }}>
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Confirmar Código Escaneado
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Código detectado · Confirma para registrar
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleCancelScan}
                  title="Descartar lectura"
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b',
                    fontWeight: 800,
                    fontSize: '13px'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Visor del Código Escaneado */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '12px',
                  border: '1.5px solid #334155',
                  color: '#ffffff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Código de Barras / QR:
                  </span>
                  <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#3b82f6', color: '#ffffff' }}>
                    {pendingConfirmation.format}
                  </span>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '18px', fontWeight: 900, color: '#4ade80', wordBreak: 'break-all', letterSpacing: '0.5px' }}>
                  {pendingConfirmation.code}
                </div>
              </div>

              {/* Información del Paquete si existe en BD */}
              {pendingConfirmation.pkg ? (
                <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px', fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#1e3a8a', fontWeight: 800 }}>
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>{pendingConfirmation.pkg.nombreConsignatario || pendingConfirmation.cli?.nombre || 'Cliente'}</span>
                    </div>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px' }}>
                      {pendingConfirmation.pkg.codigoCasillero}
                    </span>
                  </div>

                  {pendingConfirmation.pkg.descripcion && (
                    <div style={{ color: '#334155', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
                      📦 {pendingConfirmation.pkg.descripcion}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10.5px', background: '#ffffff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Peso:</span> <strong>{pendingConfirmation.pkg.pesoKg} Kg</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Estado:</span> <strong style={{ color: '#16a34a' }}>{pendingConfirmation.pkg.estadoEntrega}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#64748b' }}>Ubicación Actual:</span> <strong>{pendingConfirmation.pkg.posicionEstante || pendingConfirmation.pkg.ubicacionActual || 'Recepción'}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '9px 12px', marginBottom: '12px', fontSize: '11.5px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Código detectado. Listo para registrar en la base de datos.</span>
                </div>
              )}

              {/* Selector de Destino en Modo Asignar Anaquel (Slotting) */}
              {pendingConfirmation.workflow === 'slotting' && (
                <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers className="w-3.5 h-3.5 text-green-600" /> Asignar a Anaquel y Piso:
                    </label>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: 900, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                      {pendingConfirmation.anaquel}-{pendingConfirmation.piso}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                    <select
                      value={pendingConfirmation.anaquel}
                      onChange={e => {
                        const val = e.target.value as 'A1' | 'A2' | 'REC' | 'DSP';
                        setPendingConfirmation(prev => prev ? { ...prev, anaquel: val, location: `${val}-${prev.piso}` } : null);
                      }}
                      style={{
                        height: '36px',
                        borderRadius: '6px',
                        border: '1.5px solid #86efac',
                        background: '#ffffff',
                        fontWeight: 800,
                        fontSize: '12px',
                        color: '#14532d',
                        padding: '0 6px',
                        outline: 'none'
                      }}
                    >
                      <option value="A1">🟦 Anaquel 1 (A1)</option>
                      <option value="A2">🟩 Anaquel 2 (A2)</option>
                      <option value="REC">🟨 Recepción (REC)</option>
                      <option value="DSP">🟪 Despacho (DSP)</option>
                    </select>

                    <select
                      value={pendingConfirmation.piso}
                      onChange={e => {
                        const val = e.target.value as 'P1' | 'P2' | 'P3';
                        setPendingConfirmation(prev => prev ? { ...prev, piso: val, location: `${prev.anaquel}-${val}` } : null);
                      }}
                      style={{
                        height: '36px',
                        borderRadius: '6px',
                        border: '1.5px solid #86efac',
                        background: '#ffffff',
                        fontWeight: 800,
                        fontSize: '12px',
                        color: '#14532d',
                        padding: '0 6px',
                        outline: 'none'
                      }}
                    >
                      <option value="P1">⬇️ Piso 1</option>
                      <option value="P2">↔️ Piso 2</option>
                      <option value="P3">⬆️ Piso 3</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Botones de Confirmación y Cancelación */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleConfirmScan(pendingConfirmation)}
                  className="btn btn-primary"
                  style={{
                    flex: 1.5,
                    height: '42px',
                    background: '#16a34a',
                    borderColor: '#15803d',
                    fontSize: '13px',
                    fontWeight: 800,
                    borderRadius: '8px',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)'
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirmar y Guardar
                </button>

                <button
                  onClick={handleCancelScan}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    height: '42px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    justifyContent: 'center'
                  }}
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🔍 MODAL FLOTANTE DE CONSULTA 360° */}
        {lookupResult && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 45,
              backgroundColor: 'rgba(2, 6, 23, 0.94)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '380px',
                maxHeight: '92vh',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                background: '#ffffff',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                border: '2px solid #2563eb',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Search className="w-4 h-4 text-blue-600" />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Ficha 360° de Localización</span>
                </div>
                <button
                  onClick={() => setLookupResult(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>

              {lookupResult.pkg ? (
                <div>
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                      color: '#ffffff',
                      borderRadius: '10px',
                      padding: '12px',
                      marginBottom: '12px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📍 Ubicación Física en Almacén
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
                      {lookupResult.pkg.posicionEstante || (lookupResult.pkg.anaquel ? `${lookupResult.pkg.anaquel}-${lookupResult.pkg.piso || 'P1'}` : 'MESA RECEPCIÓN')}
                    </div>
                    <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '2px' }}>
                      {lookupResult.pkg.posicionEstante?.startsWith('A1') ? 'Anaquel 1 (Izquierdo)' : lookupResult.pkg.posicionEstante?.startsWith('A2') ? 'Anaquel 2 (Derecho)' : 'Recepción Central'}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px', marginBottom: '10px' }}>
                    <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Guía WR:</span>
                      <strong style={{ fontFamily: 'JetBrains Mono', color: '#0f172a' }}>{lookupResult.pkg.numeroReciboBodega}</strong>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Peso / Estado:</span>
                      <strong>{lookupResult.pkg.pesoKg} Kg</strong> · <span style={{ color: '#16a34a' }}>{lookupResult.pkg.estadoEntrega}</span>
                    </div>
                  </div>

                  {lookupResult.cli && (
                    <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '11.5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <strong>{lookupResult.cli.nombre}</strong> ({lookupResult.cli.codigoCasillero})
                      </div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>
                        <MapPin className="w-3 h-3 inline mr-1 text-slate-400" />
                        {lookupResult.cli.distrito || 'Lima'} · {lookupResult.cli.direccionEntrega || 'Sede Central'}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {lookupResult.cli?.telefono && (
                      <a
                        href={`https://wa.me/51${lookupResult.cli.telefono.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(lookupResult.cli.nombre)},%20te%20saludamos%20de%20AMEX%20Courier.%20Tu%20paquete%20${encodeURIComponent(lookupResult.pkg.numeroReciboBodega)}%20ya%20se%20encuentra%20listo%20en%20nuestro%20almac%C3%A9n%20(${encodeURIComponent(lookupResult.pkg.posicionEstante || 'A1-P1')}).`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          minWidth: '110px',
                          height: '38px',
                          background: '#16a34a',
                          fontSize: '12px',
                          fontWeight: 800,
                          borderRadius: '8px',
                          justifyContent: 'center',
                          gap: '6px',
                          textDecoration: 'none'
                        }}
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>
                    )}
                    <button
                      onClick={() => {
                        const code = lookupResult.pkg?.numeroReciboBodega || lookupResult.rawCode;
                        setLookupResult(null);
                        setWorkflowMode('slotting');
                        setPendingConfirmation({
                          code,
                          format: 'CODE_128',
                          workflow: 'slotting',
                          location: `${selectedAnaquel}-${selectedPiso}`,
                          anaquel: selectedAnaquel,
                          piso: selectedPiso,
                          pkg: lookupResult.pkg,
                          cli: lookupResult.cli,
                          detectedAt: Date.now()
                        });
                      }}
                      className="btn"
                      style={{
                        flex: 1,
                        minWidth: '110px',
                        height: '38px',
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1.5px solid #bfdbfe',
                        fontSize: '12px',
                        fontWeight: 800,
                        borderRadius: '8px',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <Layers className="w-4 h-4" /> Reubicar
                    </button>
                    <button
                      onClick={() => setLookupResult(null)}
                      className="btn btn-secondary"
                      style={{ height: '38px', minWidth: '70px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', justifyContent: 'center' }}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                  <Package className="w-10 h-10 text-slate-300" style={{ margin: '0 auto 8px auto' }} />
                  <p style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px', margin: 0 }}>Paquete no registrado en almacén</p>
                  <p style={{ fontSize: '11.5px', color: '#64748b', margin: '4px 0 14px 0' }}>
                    El código <code style={{ color: '#2563eb', fontWeight: 700 }}>{lookupResult.rawCode}</code> no se encuentra en el inventario activo.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      onClick={() => {
                        const raw = lookupResult.rawCode;
                        setLookupResult(null);
                        setWorkflowMode('slotting');
                        setPendingConfirmation({
                          code: raw,
                          format: 'CODE_128',
                          workflow: 'slotting',
                          location: `${selectedAnaquel}-${selectedPiso}`,
                          anaquel: selectedAnaquel,
                          piso: selectedPiso,
                          detectedAt: Date.now()
                        });
                      }}
                      className="btn btn-primary"
                      style={{ height: '38px', fontSize: '12px', borderRadius: '8px', fontWeight: 800, justifyContent: 'center', gap: '6px' }}
                    >
                      <Plus className="w-4 h-4" /> Registrar en Anaquel {selectedAnaquel}-{selectedPiso}
                    </button>
                    <button
                      onClick={() => setLookupResult(null)}
                      className="btn btn-secondary"
                      style={{ height: '36px', fontSize: '12px', borderRadius: '8px', justifyContent: 'center' }}
                    >
                      Entendido / Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Estado cámara apagada */}
        {!isScanning && !pendingConfirmation && (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: '#94a3b8' }}>
            {cameraError ? (
              <>
                <VideoOff style={{ width: '36px', height: '36px', color: '#f87171', margin: '0 auto 8px auto' }} />
                <p style={{ fontWeight: 800, color: '#fca5a5', fontSize: '13px', margin: 0 }}>Cámara no iniciada</p>
                <p style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '6px', maxWidth: '320px', margin: '6px auto 0 auto' }}>
                  {cameraError}
                </p>
              </>
            ) : (
              <>
                <Camera style={{ width: '36px', height: '36px', color: '#3b82f6', margin: '0 auto 8px auto' }} />
                <p style={{ fontWeight: 800, color: '#f8fafc', fontSize: '13.5px', margin: 0 }}>Cámara en Espera</p>
                <p style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                  Presiona el botón para encender el visor o usa la foto/ingreso manual
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* BARRA DE CONTROLES DE CÁMARA */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={isScanning ? stopCameraStream : () => startCameraStream(selectedCameraId)}
          className={isScanning ? 'btn btn-secondary' : 'btn btn-primary'}
          style={{
            flex: 1,
            height: '42px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '12.5px',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          {isScanning ? (
            <>
              <VideoOff className="w-4 h-4 text-red-500" /> Detener Cámara
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" /> Encender Cámara
            </>
          )}
        </button>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handlePhotoUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessingImage}
          className="btn btn-secondary"
          style={{
            height: '42px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '12px',
            gap: '6px',
            padding: '0 12px'
          }}
          title="Tomar foto con la cámara nativa del celular o subir imagen"
        >
          <Upload className="w-4 h-4 text-blue-600" />
          {isProcessingImage ? 'Leyendo Foto...' : '📸 Tomar Foto'}
        </button>

        {cameras.length > 1 && (
          <select
            value={selectedCameraId}
            onChange={e => {
              const newId = e.target.value;
              setSelectedCameraId(newId);
              if (isScanning) {
                startCameraStream(newId);
              }
            }}
            style={{
              maxWidth: '160px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '11.5px',
              borderRadius: '8px',
              padding: '0 6px',
              height: '42px',
              fontWeight: 700
            }}
          >
            {cameras.map(cam => (
              <option key={cam.id} value={cam.id}>
                {cam.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {imageError && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '8px 12px',
            marginTop: '10px',
            fontSize: '11.5px',
            color: '#b91c1c'
          }}
        >
          {imageError}
        </div>
      )}

      {/* ENTRADA MANUAL DE CÓDIGOS OPTIMIZADA */}
      <div
        style={{
          marginTop: '14px',
          paddingTop: '12px',
          borderTop: '1px solid #e2e8f0'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Keyboard className="w-3.5 h-3.5 text-blue-600" /> Ingreso Manual Rápido:
          </span>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
            <button
              type="button"
              onClick={() => setManualInputType('wr_preset')}
              style={{
                border: 'none',
                background: manualInputType === 'wr_preset' ? '#2563eb' : 'transparent',
                color: manualInputType === 'wr_preset' ? '#ffffff' : '#64748b',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🏷️ Guía WR000
            </button>
            <button
              type="button"
              onClick={() => setManualInputType('free_code')}
              style={{
                border: 'none',
                background: manualInputType === 'free_code' ? '#2563eb' : 'transparent',
                color: manualInputType === 'free_code' ? '#ffffff' : '#64748b',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔤 Libre / Tracking
            </button>
          </div>
        </div>

        <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {manualInputType === 'wr_preset' ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  borderRadius: '10px',
                  border: '2px solid #3b82f6',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.12)',
                  background: '#ffffff'
                }}
              >
                {/* Prefijo Fijo WR000 */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                    color: '#ffffff',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 900,
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 12px',
                    letterSpacing: '1px',
                    borderRight: '1.5px solid #1d4ed8',
                    userSelect: 'none'
                  }}
                  title="Prefijo fijo por defecto de Guías AMEX"
                >
                  {manualPrefix}
                </div>

                {/* Campo de 6 dígitos numéricos */}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Escribe 6 dígitos (ej: 000451)"
                  value={manualDigits}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                    setManualDigits(val);
                  }}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    height: '42px',
                    padding: '0 12px',
                    border: 'none',
                    fontSize: '15px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 800,
                    color: '#0f172a',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                />

                {/* Contador de dígitos */}
                {manualDigits && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: manualDigits.length === 6 ? '#16a34a' : '#64748b',
                      background: '#f8fafc'
                    }}
                  >
                    {manualDigits.length}/6
                  </div>
                )}

                {/* Botón Procesar Dinámico según Modo */}
                <button
                  type="submit"
                  disabled={!manualDigits.trim()}
                  className="btn btn-primary"
                  style={{
                    height: '42px',
                    padding: '0 16px',
                    fontSize: '12.5px',
                    borderRadius: '0',
                    fontWeight: 800,
                    gap: '4px',
                    background: !manualDigits.trim() ? '#94a3b8' : workflowMode === 'lookup' ? '#2563eb' : workflowMode === 'delivery' ? '#9333ea' : '#16a34a',
                    borderColor: !manualDigits.trim() ? '#94a3b8' : workflowMode === 'lookup' ? '#1d4ed8' : workflowMode === 'delivery' ? '#7e22ce' : '#15803d',
                    cursor: manualDigits.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  {workflowMode === 'lookup' ? (
                    <>
                      <Search className="w-4 h-4" /> Consultar
                    </>
                  ) : workflowMode === 'delivery' ? (
                    <>
                      <Truck className="w-4 h-4" /> Despachar
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Asignar
                    </>
                  )}
                </button>
              </div>

              {/* Vista previa en tiempo real de la guía completa */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', padding: '0 4px', fontSize: '11px', color: '#64748b' }}>
                <span>
                  Guía resultante: <strong style={{ color: '#2563eb', fontFamily: 'JetBrains Mono' }}>{manualPrefix}{manualDigits || '______'}</strong>
                </span>
                {manualDigits && (
                  <button
                    type="button"
                    onClick={() => setManualDigits('')}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Keyboard className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '10px', top: '12px' }} />
                <input
                  type="text"
                  placeholder="Ingreso libre: 1Z99999999, 94001000..., AMEX-PER-1001..."
                  value={manualCodeInput}
                  onChange={e => setManualCodeInput(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    paddingLeft: '32px',
                    paddingRight: '10px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!manualCodeInput.trim()}
                className="btn btn-primary"
                style={{
                  height: '42px',
                  padding: '0 14px',
                  fontSize: '12.5px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  gap: '4px',
                  background: !manualCodeInput.trim() ? '#94a3b8' : workflowMode === 'lookup' ? '#2563eb' : workflowMode === 'delivery' ? '#9333ea' : '#16a34a',
                  borderColor: !manualCodeInput.trim() ? '#94a3b8' : workflowMode === 'lookup' ? '#1d4ed8' : workflowMode === 'delivery' ? '#7e22ce' : '#15803d',
                  opacity: manualCodeInput.trim() ? 1 : 0.6
                }}
              >
                {workflowMode === 'lookup' ? (
                  <>
                    <Search className="w-3.5 h-3.5" /> Consultar
                  </>
                ) : workflowMode === 'delivery' ? (
                  <>
                    <Truck className="w-3.5 h-3.5" /> Despachar
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Asignar
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>

    </div>
  );

  if (isInline) {
    return scannerBody;
  }

  return (
    <div className="modal-overlay active">
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        {scannerBody}
      </div>
    </div>
  );
}