import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ScanLine,
  Camera,
  CameraOff,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  MapPin,
  FolderGit2,
  Building2,
  Tag,
  Edit2,
  SlidersHorizontal,
  ExternalLink,
  Plus,
  RefreshCw,
  X,
  Volume2,
  VolumeX,
  Keyboard,
  Barcode as BarcodeIcon,
  ShieldAlert,
} from 'lucide-react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Product, Project, Purchase, StockMovement } from '../types';
import { formatINR } from '../services/dbService';
import { downloadSingleLabelPng } from '../services/labelService';
import { CameraPermissionModal } from './CameraPermissionModal';

interface AlwaysReadyScannerProps {
  products: Product[];
  projects: Project[];
  purchases: Purchase[];
  stockMovements: StockMovement[];
  onViewItemDetails: (product: Product) => void;
  onEditItem: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
  onOpenAddItemWithSku: (sku: string) => void;
  onOpenLabelsForProduct: (product: Product) => void;
}

export const AlwaysReadyScanner: React.FC<AlwaysReadyScannerProps> = ({
  products,
  projects,
  purchases,
  stockMovements,
  onViewItemDetails,
  onEditItem,
  onAdjustStock,
  onOpenAddItemWithSku,
  onOpenLabelsForProduct,
}) => {
  // Scanner camera state
  const [isScanning, setIsScanning] = useState(false);
  const [scannerInitializing, setScannerInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Scan input & results
  const [manualInput, setManualInput] = useState('');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [lookupAttempted, setLookupAttempted] = useState(false);
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null);

  // References to manage streams & controls safely
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const isMountedRef = useRef(true);
  const isInitializingRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  // Helper: Play friendly scan beep
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5 note
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch {
      // Audio not supported in environment
    }
  };

  // Safe camera stream stopper
  const stopCameraStream = () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // Stop notice
      }
      controlsRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      } catch {
        // Track stop notice
      }
    }

    setIsScanning(false);
    setScannerInitializing(false);
  };

  // Safe camera stream starter
  const startCameraStream = async (deviceIdToUse?: string) => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setScannerInitializing(true);
    setCameraError(null);

    try {
      // 1. Guard against non-secure context or missing mediaDevices API
      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
        setCameraError('Camera access requires HTTPS.');
        setIsScanning(false);
        setScannerInitializing(false);
        isInitializingRef.current = false;
        return;
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          'Live camera feed is not supported in this browser or iframe. Manual SKU input and USB barcode scanners are active.'
        );
        setIsScanning(false);
        setScannerInitializing(false);
        isInitializingRef.current = false;
        return;
      }

      // 2. Direct request via getUserMedia is more reliable than permissions.query in iframes
      // Stop previous instance if active
      stopCameraStream();

      // Configure video constraints preferring rear/environment camera on phones
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
          audio: false 
        });
      } catch (firstErr: any) {
        // Fallback: If environment facing failed, try simple video: true
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (!stream) {
        throw new Error('Unable to obtain camera stream');
      }

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // Update available video devices
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (Array.isArray(devices) && devices.length > 0) {
          setCameras(devices);
          if (!selectedCameraId && !deviceIdToUse) {
            const backCam = devices.find((d) =>
              /back|rear|environment/i.test(d.label)
            );
            setSelectedCameraId(backCam ? backCam.deviceId : devices[0].deviceId);
          }
        }
      } catch {
        // Listing is optional
      }

      if (!videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error('Video element not yet mounted in DOM');
      }

      videoRef.current.srcObject = stream;

      const codeReader = new BrowserMultiFormatReader();
      const controls = await codeReader.decodeFromVideoElement(
        videoRef.current,
        (result, error) => {
          if (!isMountedRef.current) return;
          if (result) {
            const rawText = result.getText().trim();
            if (rawText) {
              const now = Date.now();
              // Prevent rapid duplicate fire within 2.5 seconds
              if (
                lastScannedCodeRef.current === rawText &&
                now - lastScannedTimeRef.current < 2500
              ) {
                return;
              }

              lastScannedCodeRef.current = rawText;
              lastScannedTimeRef.current = now;
              playBeep();
              performLookup(rawText);
            }
          }
        }
      );

      controlsRef.current = controls;
      setIsScanning(true);
    } catch (err: any) {
      const errName = err?.name || '';
      const errMsg = (err?.message || '').toLowerCase();

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.includes('permission') ||
        errMsg.includes('not allowed')
      ) {
        setShowPermissionModal(true);
        setCameraError(
          'Camera access was not granted. Please click the button below to try again.'
        );
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errMsg.includes('not found')
      ) {
        setCameraError(
          'No camera device detected on this system. Manual SKU lookup and USB scanners are ready.'
        );
      } else if (
        errName === 'NotReadableError' ||
        errName === 'TrackStartError' ||
        errMsg.includes('already in use')
      ) {
        setCameraError(
          'Camera is in use by another application. Please close it and click Retry Camera.'
        );
      } else {
        setCameraError(
          'Camera initialization failed. You can use manual SKU entry or click Retry Camera.'
        );
      }
      setIsScanning(false);
    } finally {
      setScannerInitializing(false);
      isInitializingRef.current = false;
    }
  };

  // Automatic camera initialization on mount
  useEffect(() => {
    isMountedRef.current = true;

    // Small delay to ensure DOM video element is attached
    const timer = setTimeout(() => {
      startCameraStream();
    }, 150);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      stopCameraStream();
    };
  }, []);

  // Handle camera device switch
  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    startCameraStream(newId);
  };

  // Core exact-match Firestore lookup logic
  const performLookup = (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return;

    setScannedCode(trimmed);
    setLookupAttempted(true);
    setScanTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    const upper = trimmed.toUpperCase();

    // Exact matching hierarchy:
    // 1. SKU exact match (case-insensitive)
    // 2. Barcode exact match
    // 3. Item Number formatting match (e.g. ITEM-001 or DDLC-0001 or raw numeric)
    const found = products.find((p) => {
      if (p.sku && p.sku.toUpperCase() === upper) return true;
      if (p.barcode && p.barcode.toUpperCase() === upper) return true;
      if (p.itemNumber && `ITEM-${String(p.itemNumber).padStart(3, '0')}`.toUpperCase() === upper) return true;
      if (p.itemNumber && `DDLC-${String(p.itemNumber).padStart(4, '0')}`.toUpperCase() === upper) return true;
      if (p.itemNumber && String(p.itemNumber) === trimmed) return true;
      return false;
    });

    setMatchedProduct(found || null);
    
    // Add haptic feedback (vibration) if supported by device
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  // USB Scanner & manual input handler
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      playBeep();
      performLookup(manualInput.trim());
      setManualInput('');
    }
  };

  // Reset scan result and resume
  const handleDismissResult = () => {
    setScannedCode(null);
    setMatchedProduct(null);
    setLookupAttempted(false);
    lastScannedCodeRef.current = null;
  };

  // Project map for quick lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((pr) => map.set(pr.id, pr.name));
    return map;
  }, [projects]);

  // Product movements & PO history for matched item
  const productMovements = matchedProduct
    ? stockMovements.filter((m) => m.productId === matchedProduct.id)
    : [];
  const productPurchases = matchedProduct
    ? purchases.filter((po) => po.productId === matchedProduct.id)
    : [];

  // Global USB Barcode Scanner hardware listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If user is actively typing in a form input, textarea or select, allow standard typing
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT');

      const currentTime = Date.now();

      if (e.key === 'Enter') {
        if (buffer.length >= 3 && currentTime - lastKeyTime < 300) {
          const scanned = buffer.trim();
          buffer = '';
          playBeep();
          performLookup(scanned);
        }
        buffer = '';
        return;
      }

      // Barcode scanners type single printable characters rapidly (< 75ms between strokes)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (isInput && activeEl !== manualInputRef.current) {
          // User is typing in another input, do not capture
          return;
        }

        if (currentTime - lastKeyTime > 150) {
          buffer = e.key;
        } else {
          buffer += e.key;
        }
        lastKeyTime = currentTime;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [products]);

  return (
    <div className="bg-gradient-to-br from-[#E9DFFF]/40 via-white to-[#B9F2D0]/35 border border-[#E6EDE7] rounded-3xl p-4 sm:p-5 shadow-xs space-y-4 relative">
      {/* Top Bar of the Scanner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E6EDE7]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center font-bold shadow-xs border border-[#CDE3D2]">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[#174D35] tracking-tight">
                Always-Ready Barcode Scanner
              </h2>
              {isScanning ? (
                <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#168653]/10 text-[#168653] border border-[#168653]/25 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-[#168653] animate-pulse" />
                  Scanner ready
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/90 text-[#77857C] border border-[#E6EDE7]">
                  <span className="w-2 h-2 rounded-full bg-[#77857C]" />
                  Manual & USB Ready
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#54655B] font-medium mt-0.5">
              Scan a label to discover its details. Live camera & USB scanner active.
            </p>
          </div>
        </div>

        {/* Controls: Audio mute, camera switch, pause/resume */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {cameras.length > 1 && isScanning && (
            <select
              value={selectedCameraId}
              onChange={handleCameraChange}
              className="px-2.5 py-1.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[11px] text-[#25352C] font-medium focus:outline-none focus:border-[#168653]"
            >
              {cameras.map((c, i) => (
                <option key={c.deviceId || i} value={c.deviceId}>
                  {c.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-[#E5F5E9] border-[#CDE3D2] text-[#168653]'
                : 'bg-[#F5F9F6] border-[#E6EDE7] text-[#77857C]'
            }`}
            title={soundEnabled ? 'Mute scan beep' : 'Enable scan beep'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {isScanning ? (
            <button
              onClick={stopCameraStream}
              className="px-3 py-1.5 rounded-xl bg-[#F5F9F6] hover:bg-[#E5F5E9] text-[#77857C] hover:text-[#174D35] border border-[#E6EDE7] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CameraOff className="w-3.5 h-3.5" />
              <span>Pause Camera</span>
            </button>
          ) : (
            <button
              onClick={() => startCameraStream()}
              disabled={scannerInitializing}
              className="px-3.5 py-1.5 rounded-xl bg-[#168653] hover:bg-[#126b42] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{scannerInitializing ? 'Starting...' : 'Start Camera'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scanner Section Grid: Viewport & USB Input */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Camera Viewport (4 or 5 columns on desktop, responsive) */}
        <div className={`${lookupAttempted ? 'lg:col-span-4' : 'lg:col-span-5'} space-y-2`}>
          <div className="relative aspect-video sm:aspect-4/3 max-h-56 w-full rounded-2xl bg-[#F5F9F6] border-2 border-dashed border-[#CDE3D2] overflow-hidden flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${isScanning ? 'block' : 'hidden'}`}
              playsInline
              muted
            />

            {/* Live Visual Scan Reticle Overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                <div className="relative w-48 sm:w-56 h-28 sm:h-32 rounded-xl border-2 border-[#168653] shadow-[0_0_15px_rgba(22,134,83,0.3)] bg-[#168653]/5 flex items-center justify-center">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#168653] shadow-md animate-bounce" />
                  <span className="text-[10px] font-bold text-[#174D35] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-xs border border-[#CDE3D2]">
                    Align Barcode in Box
                  </span>
                </div>
              </div>
            )}

            {/* Offline or Error Placeholder */}
            {!isScanning && (
              <div className="text-center p-4 space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center mx-auto border border-[#CDE3D2]">
                  <ScanLine className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#174D35]">
                    {scannerInitializing ? 'Initializing camera feed...' : 'Live camera paused'}
                  </p>
                  <p className="text-[11px] text-[#77857C] max-w-xs mx-auto mt-0.5">
                    {cameraError || 'Use USB handheld barcode reader or type SKU directly below.'}
                  </p>
                </div>
                {!scannerInitializing && (
                  <div className="flex items-center gap-2 justify-center flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError(null);
                        startCameraStream();
                      }}
                      className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Allow Camera from App</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick instructions under camera */}
          <div className="flex items-center justify-between text-[11px] text-[#77857C] px-1 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#168653]" />
              Continuous detection
            </span>
            <span>Laser reticle active</span>
          </div>
        </div>

        {/* Right Area: USB Scanner Bar + Immediate Result Display */}
        <div className={`${lookupAttempted ? 'lg:col-span-8' : 'lg:col-span-7'} space-y-3`}>
          {/* USB Scanner & Manual Input Form */}
          <form onSubmit={handleManualSubmit} className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#174D35] uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-[#168653]" />
                USB Barcode Scanner & Manual SKU Lookup
              </span>
              <span className="text-[10px] text-[#77857C] font-normal">
                Press Enter to look up
              </span>
            </label>

            <div className="relative flex items-center">
              <BarcodeIcon className="w-4 h-4 text-[#77857C] absolute left-3.5 pointer-events-none" />
              <input
                ref={manualInputRef}
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Scan barcode with handheld reader or type SKU (e.g. DDLC-0001)..."
                className="w-full pl-10 pr-24 py-2.5 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs sm:text-sm text-[#25352C] placeholder-[#77857C] font-mono focus:outline-none focus:border-[#168653] focus:bg-white transition-all shadow-2xs"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                {manualInput && (
                  <button
                    type="button"
                    onClick={() => setManualInput('')}
                    className="p-1 text-[#77857C] hover:text-[#25352C] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-[#168653] hover:bg-[#126b42] text-white text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  Look Up
                </button>
              </div>
            </div>
          </form>

          {/* Scanner stand-by message - only show if no active scan result */}
          {!lookupAttempted && (
            <div className="p-3.5 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#77857C] flex items-center gap-2.5">
              <ScanLine className="w-4 h-4 text-[#168653] shrink-0" />
              <span>
                Scanner is actively standing by. Hold any Code 128 barcode or QR code in front of the lens, or trigger your USB handheld barcode reader.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* CUTE POPUP CARD FOR SCAN RESULTS                          */}
      {/* ========================================================= */}
      {lookupAttempted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#174D35]/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
            {/* Top Decorative Header */}
            <div className="h-2 bg-gradient-to-r from-[#168653] via-[#4ADE80] to-[#168653]" />
            
            <div className="p-6 sm:p-8 space-y-6">
              {matchedProduct ? (
                /* MATCH FOUND */
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center shadow-inner shrink-0">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#168653] uppercase tracking-widest bg-[#168653]/10 px-2 py-0.5 rounded-full">
                            Found It!
                          </span>
                          {scanTimestamp && (
                            <span className="text-[11px] text-[#77857C] font-medium italic">
                              at {scanTimestamp}
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-[#174D35] leading-tight mt-1">
                          {matchedProduct.name}
                        </h3>
                        <p className="font-mono text-sm font-bold text-[#54655B] bg-[#F5F9F6] inline-block px-3 py-1 rounded-lg mt-2 border border-[#E6EDE7]">
                          {matchedProduct.sku}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleDismissResult}
                      className="w-10 h-10 rounded-full bg-[#F5F9F6] text-[#77857C] flex items-center justify-center hover:bg-[#E5F5E9] hover:text-[#174D35] transition-all cursor-pointer active:scale-90 shadow-xs"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Cute Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#F0F9F2] p-4 rounded-3xl border border-[#CDE3D2] relative overflow-hidden group">
                      <div className="absolute -right-2 -bottom-2 opacity-5 text-[#168653] group-hover:scale-110 transition-transform">
                        <Layers className="w-16 h-16" />
                      </div>
                      <span className="text-[10px] text-[#54655B] font-black uppercase tracking-wider block">
                        In Stock
                      </span>
                      <span className="text-2xl font-black text-[#174D35] mt-1 block">
                        {matchedProduct.quantity} <small className="text-sm font-bold">{matchedProduct.unit || 'pcs'}</small>
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={`w-2 h-2 rounded-full ${matchedProduct.quantity <= 5 ? 'bg-amber-500 animate-pulse' : 'bg-[#168653]'}`} />
                        <span className={`text-[10px] font-bold ${matchedProduct.quantity <= 5 ? 'text-amber-700' : 'text-[#168653]'}`}>
                          {matchedProduct.quantity <= 5 ? 'Time to reorder!' : 'Inventory Good'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#F5F9F6] p-4 rounded-3xl border border-[#E6EDE7] relative overflow-hidden group">
                      <div className="absolute -right-2 -bottom-2 opacity-5 text-[#174D35] group-hover:scale-110 transition-transform">
                        <Tag className="w-16 h-16" />
                      </div>
                      <span className="text-[10px] text-[#54655B] font-black uppercase tracking-wider block">
                        Value
                      </span>
                      <span className="text-2xl font-black text-[#174D35] mt-1 block">
                        {formatINR(matchedProduct.unitPrice)}
                      </span>
                      <span className="text-[10px] text-[#77857C] font-bold">Per unit cost</span>
                    </div>
                  </div>

                  {/* Details Sheet */}
                  <div className="bg-white p-5 rounded-3xl border-2 border-dashed border-[#CDE3D2] space-y-4">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
                      <div className="flex items-start gap-2.5">
                        <Building2 className="w-4 h-4 text-[#168653] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] text-[#77857C] font-black uppercase block">Location</span>
                          <span className="text-[#174D35] font-bold">{matchedProduct.storageLocation || 'Unassigned'}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <FolderGit2 className="w-4 h-4 text-[#168653] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] text-[#77857C] font-black uppercase block">Project</span>
                          <span className="text-[#174D35] font-bold truncate block max-w-[120px]">
                            {matchedProduct.projectId ? projectMap.get(matchedProduct.projectId) || 'Project' : 'General Lab'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {matchedProduct.description && (
                      <div className="pt-3 border-t border-[#F0F5F2]">
                        <span className="text-[10px] text-[#77857C] font-black uppercase block mb-1">Specifications</span>
                        <p className="text-xs text-[#25352C] leading-relaxed font-medium">
                          {matchedProduct.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => {
                        onViewItemDetails(matchedProduct);
                        handleDismissResult();
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#168653] text-white text-xs font-black hover:bg-[#126b42] transition-all shadow-md active:scale-95"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>OPEN DETAILS</span>
                    </button>
                    <button
                      onClick={() => {
                        onAdjustStock(matchedProduct);
                        handleDismissResult();
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-white border-2 border-[#E6EDE7] text-[#174D35] text-xs font-black hover:bg-[#F5F9F6] transition-all active:scale-95"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span>ADJUST STOCK</span>
                    </button>
                    <button
                      onClick={() => {
                        onEditItem(matchedProduct);
                        handleDismissResult();
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-white border-2 border-[#E6EDE7] text-[#174D35] text-xs font-black hover:bg-[#F5F9F6] transition-all active:scale-95"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>EDIT INFO</span>
                    </button>
                    <button
                      onClick={handleDismissResult}
                      className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#F5F9F6] text-[#77857C] text-xs font-black hover:bg-[#E5F5E9] hover:text-[#174D35] transition-all active:scale-95"
                    >
                      <ScanLine className="w-4 h-4" />
                      <span>NEXT SCAN</span>
                    </button>
                  </div>
                </>
              ) : (
                /* NOT FOUND */
                <div className="text-center py-6 space-y-6">
                  <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto shadow-inner border-2 border-white">
                    <ShieldAlert className="w-10 h-10" />
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-black text-amber-900 leading-tight">
                      Unknown Barcode
                    </h3>
                    <p className="text-[#54655B] text-sm font-medium mt-2 max-w-xs mx-auto">
                      We couldn't find any record matching <code className="font-black bg-amber-100 px-2 py-0.5 rounded-md text-amber-900 border border-amber-200">{scannedCode}</code>
                    </p>
                  </div>

                  <div className="space-y-3 pt-4">
                    <button
                      onClick={() => {
                        onOpenAddItemWithSku(scannedCode || '');
                        handleDismissResult();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-[#168653] text-white text-sm font-black hover:bg-[#126b42] transition-all shadow-lg active:scale-95"
                    >
                      <Plus className="w-5 h-5" />
                      <span>REGISTER AS NEW ITEM</span>
                    </button>
                    <button
                      onClick={handleDismissResult}
                      className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-white border-2 border-[#E6EDE7] text-[#174D35] text-sm font-black hover:bg-[#F5F9F6] transition-all active:scale-95"
                    >
                      <span>TRY ANOTHER SCAN</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera Permission Popup Modal */}
      <CameraPermissionModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onPermissionGranted={() => {
          setCameraError(null);
          startCameraStream();
        }}
        onUseManualInput={() => {
          manualInputRef.current?.focus();
          manualInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
        initialError={cameraError}
      />
    </div>
  );
};
