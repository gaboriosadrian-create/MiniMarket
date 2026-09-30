import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan?: (barcode: string) => void;
  onDetected?: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  onDetected
}) => {
  const handleScanDetected = (code: string) => {
    if (onScan) onScan(code);
    if (onDetected) onDetected(code);
  };
  const [scannerState, setScannerState] = useState<'initializing' | 'scanning' | 'detected' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isDetectedRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  // Element ID for html5-qrcode
  const readerElementId = 'barcode-camera-viewport';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      const instance = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
        instance.clear();
      } catch (err) {
        console.warn('[BarcodeScanner] Error stopping scanner:', err);
      }
    }
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannerState('initializing');
      setErrorMessage(null);
      setDetectedCode(null);
      isDetectedRef.current = false;
      return;
    }

    isDetectedRef.current = false;
    setScannerState('initializing');
    setErrorMessage(null);

    let isCancelled = false;

    const startScanner = async () => {
      // Delay slightly to ensure modal DOM element `#barcode-camera-viewport` is rendered
      await new Promise((res) => setTimeout(res, 200));

      if (isCancelled || !mountedRef.current) return;

      const element = document.getElementById(readerElementId);
      if (!element) {
        if (mountedRef.current) {
          setErrorMessage('No se encontró el contenedor de cámara.');
          setScannerState('error');
        }
        return;
      }

      // Check for HTTPS / secure context & mediaDevices support
      const isSecure = window.isSecureContext ?? (
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      );
      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

      if (!isSecure || !hasMediaDevices) {
        console.warn('[BarcodeScanner] Camera blocked due to insecure context or missing mediaDevices:', {
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          isSecureContext: window.isSecureContext,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        });

        if (mountedRef.current) {
          setErrorMessage('El acceso a la cámara requiere una conexión segura (HTTPS).');
          setScannerState('error');
        }
        return;
      }

      try {
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];

        const qrCodeScanner = new Html5Qrcode(readerElementId, {
          formatsToSupport,
          verbose: false,
        });

        html5QrCodeRef.current = qrCodeScanner;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.floor(viewfinderWidth * 0.85);
            const height = Math.floor(Math.min(viewfinderHeight * 0.5, 180));
            return { width: Math.max(width, 200), height: Math.max(height, 120) };
          },
          aspectRatio: 1.0,
        };

        const onScanSuccess = async (decodedText: string) => {
          if (isDetectedRef.current) return;
          isDetectedRef.current = true;

          const cleanText = decodedText ? decodedText.trim() : '';
          if (!cleanText) return;

          // Haptic feedback if supported
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(100);
            } catch (e) {
              // Ignore vibration errors
            }
          }

          if (mountedRef.current) {
            setDetectedCode(cleanText);
            setScannerState('detected');
          }

          // Stop scanner stream immediately
          await stopScanner();

          // Short delay to show visual feedback before closing modal
          setTimeout(() => {
            if (mountedRef.current) {
              handleScanDetected(cleanText);
              onClose();
            }
          }, 300);
        };

        const onScanFailure = () => {
          // Normal frame parse failures are silently ignored
        };

        // Attempt 1: Start with { facingMode: 'environment' }
        let started = false;
        try {
          await qrCodeScanner.start(
            { facingMode: 'environment' },
            config,
            onScanSuccess,
            onScanFailure
          );
          started = true;
        } catch (firstErr) {
          console.warn('[BarcodeScanner] facingMode: "environment" failed, trying fallback camera selection...', firstErr);
          
          // Attempt 2: Fallback to getCameras() list if facingMode direct constraint fails
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            // Find back/rear camera or default to first/last available
            const backCamera = devices.find((d) => {
              const label = (d.label || '').toLowerCase();
              return label.includes('back') || label.includes('rear') || label.includes('trasera') || label.includes('environment');
            }) || devices[devices.length - 1];

            await qrCodeScanner.start(
              backCamera.id,
              config,
              onScanSuccess,
              onScanFailure
            );
            started = true;
          } else {
            throw firstErr;
          }
        }

        // If cancelled while starting, immediately stop & clean up
        if (isCancelled || !mountedRef.current) {
          if (started) {
            try {
              if (qrCodeScanner.isScanning) {
                await qrCodeScanner.stop();
              }
              qrCodeScanner.clear();
            } catch (e) {
              // Cleanup ignore
            }
          }
          return;
        }

        if (mountedRef.current) {
          setScannerState('scanning');
        }
      } catch (err: any) {
        // Detailed Diagnostic Logging for Development
        console.error('[BarcodeScanner] Diagnostic Camera Error:', {
          error: err,
          errorName: err?.name || (typeof err === 'object' ? err?.constructor?.name : typeof err),
          errorMessage: err?.message || String(err),
          protocol: window.location.protocol,
          isSecureContext: window.isSecureContext,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        });

        if (mountedRef.current && !isCancelled) {
          const errStr = String(err?.message || err || '').toLowerCase();
          const errName = String(err?.name || '').toLowerCase();

          if (
            errStr.includes('permission') ||
            errStr.includes('denied') ||
            errName.includes('notallowederror')
          ) {
            setErrorMessage('No podemos acceder a la cámara. Verificá los permisos del navegador.');
          } else if (
            errStr.includes('notfounderror') ||
            errStr.includes('devices not found') ||
            errName.includes('notfounderror')
          ) {
            setErrorMessage('No se encontró ninguna cámara disponible en el dispositivo.');
          } else if (!window.isSecureContext || !navigator.mediaDevices) {
            setErrorMessage('El acceso a la cámara requiere una conexión segura (HTTPS).');
          } else {
            setErrorMessage('El escaneo con cámara no está disponible en este navegador.');
          }
          setScannerState('error');
        }
      }
    };

    startScanner();

    return () => {
      isCancelled = true;
      stopScanner();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="bg-stone-900 text-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-800 space-y-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-stone-900 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight leading-none">
                Escanear producto
              </h3>
              <p className="text-[10px] text-stone-400 mt-0.5">
                Utiliza la cámara para escanear el código
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition-colors"
            title="Cerrar escáner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div className="relative bg-black min-h-[280px] sm:min-h-[320px] flex items-center justify-center overflow-hidden">
          
          {/* HTML5 QR Code Video Anchor */}
          <div 
            id={readerElementId} 
            className="w-full h-full text-white [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          />

          {/* Loading State Overlay */}
          {scannerState === 'initializing' && (
            <div className="absolute inset-0 bg-stone-900/90 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-xs font-bold text-stone-300">Iniciando cámara...</p>
              <p className="text-[10px] text-stone-500">Aceptá el permiso si el navegador te lo solicita.</p>
            </div>
          )}

          {/* Detected State Overlay */}
          {scannerState === 'detected' && (
            <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-6 text-center space-y-2 z-20 animate-in zoom-in-95 duration-100">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <p className="text-sm font-black text-white">¡Código Detectado!</p>
              {detectedCode && (
                <p className="text-xs font-mono font-bold text-emerald-300 bg-emerald-900/60 px-3 py-1 rounded-lg border border-emerald-700/60">
                  {detectedCode}
                </p>
              )}
            </div>
          )}

          {/* Error State Overlay */}
          {scannerState === 'error' && (
            <div className="absolute inset-0 bg-stone-900/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="text-xs font-bold text-white">Acceso a Cámara</p>
                <p className="text-[11px] text-stone-400 leading-normal">
                  {errorMessage || 'El escaneo con cámara no está disponible en este navegador.'}
                </p>
              </div>
            </div>
          )}

          {/* Viewfinder Target Framing Guide (visible when scanning) */}
          {scannerState === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
              <div className="w-[82%] max-w-[280px] h-[140px] sm:h-[160px] border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {/* Animated Laser Scan Line */}
                <div className="w-full h-0.5 bg-red-500/90 shadow-[0_0_8px_rgba(239,68,68,0.8)] absolute top-1/2 -translate-y-1/2 animate-pulse" />
              </div>

              <p className="text-[11px] font-bold text-stone-300 mt-4 bg-stone-900/80 px-3 py-1 rounded-full border border-stone-700/80 backdrop-blur-xs">
                Apuntá la cámara al código de barras
              </p>
            </div>
          )}
        </div>

        {/* Footer / Cancel Button */}
        <div className="p-3.5 bg-stone-900 border-t border-stone-800">
          <button
            onClick={handleClose}
            className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-xs transition-colors border border-stone-700"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
