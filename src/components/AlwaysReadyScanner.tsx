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
} from 'lucide-react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Product, Project, Purchase, StockMovement } from '../types';
import { formatINR } from '../services/dbService';
import { downloadSingleLabelPng } from '../services/labelService';

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
      // Check browser environment support
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

      // Stop previous instance if active
      stopCameraStream();

      // Configure video constraints preferring rear/environment camera on phones
      const constraints: MediaStreamConstraints = {
        video: deviceIdToUse
          ? { deviceId: { exact: deviceIdToUse } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

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
        setCameraError(
          'Camera access was denied. You can allow camera in browser site settings, or immediately scan via USB barcode reader / manual SKU below.'
        );
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errMsg.includes('not found')
      ) {
        setCameraError(
          'No camera device detected. USB barcode scanners and manual SKU lookup are ready.'
        );
      } else {
        setCameraError(
          'Camera initialization paused. You can use the manual SKU / USB scanner below or click Retry Camera.'
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

  return (
    <div className="bg-white border border-[#E6EDE7] rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
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
                <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#CDE3D2]">
                  <span className="w-2 h-2 rounded-full bg-[#168653] animate-pulse" />
                  Live Detection
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F5F9F6] text-[#77857C] border border-[#E6EDE7]">
                  <span className="w-2 h-2 rounded-full bg-[#77857C]" />
                  USB & Manual Mode
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#77857C] font-medium mt-0.5">
              Code 128 • EAN-13 • QR • Automatic USB Barcode Reader & Live Camera
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
                  <button
                    onClick={() => startCameraStream()}
                    className="px-3 py-1.5 rounded-xl bg-[#E5F5E9] hover:bg-[#d8eedd] text-[#168653] text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry Camera Feed</span>
                  </button>
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

          {/* ========================================================= */}
          {/* SCAN RESULT PANEL                                        */}
          {/* ========================================================= */}
          {lookupAttempted && (
            <div className="animate-in fade-in zoom-in-98 duration-150">
              {matchedProduct ? (
                /* MATCH FOUND IN FIRESTORE */
                <div className="bg-[#F0F9F2] border-2 border-[#168653] rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
                  {/* Result Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#CDE3D2]">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#168653] text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#168653]">
                            Exact Match Found
                          </span>
                          {scanTimestamp && (
                            <span className="text-[10px] text-[#77857C]">
                              at {scanTimestamp}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base sm:text-lg font-extrabold text-[#174D35] leading-tight">
                          {matchedProduct.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-white text-[#174D35] border border-[#CDE3D2] shadow-2xs">
                        {matchedProduct.sku}
                      </span>
                      <button
                        onClick={handleDismissResult}
                        className="p-1 rounded-lg text-[#77857C] hover:text-[#25352C] hover:bg-white"
                        title="Dismiss result"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Comprehensive Specifications Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="bg-white p-2.5 rounded-2xl border border-[#E6EDE7]">
                      <span className="text-[10px] text-[#77857C] font-semibold block uppercase">
                        Current Stock
                      </span>
                      <span className="text-sm font-bold text-[#174D35] mt-0.5 block">
                        {matchedProduct.quantity} {matchedProduct.unit || 'pcs'}
                      </span>
                      <span className="text-[10px] text-[#168653] font-medium">
                        {matchedProduct.quantity <= 5 ? '⚠️ Low stock' : 'Optimal level'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-[#E6EDE7]">
                      <span className="text-[10px] text-[#77857C] font-semibold block uppercase">
                        Unit Purchase Cost
                      </span>
                      <span className="text-sm font-bold text-[#174D35] mt-0.5 block">
                        {formatINR(matchedProduct.unitPrice)}
                      </span>
                      <span className="text-[10px] text-[#77857C]">Per piece cost</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-[#E6EDE7]">
                      <span className="text-[10px] text-[#77857C] font-semibold block uppercase">
                        Stock Valuation
                      </span>
                      <span className="text-sm font-bold text-[#168653] mt-0.5 block">
                        {formatINR(matchedProduct.quantity * matchedProduct.unitPrice)}
                      </span>
                      <span className="text-[10px] text-[#77857C]">On-hand value</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-[#E6EDE7]">
                      <span className="text-[10px] text-[#77857C] font-semibold block uppercase">
                        Category
                      </span>
                      <span className="text-sm font-bold text-[#174D35] mt-0.5 block truncate">
                        {matchedProduct.category || 'General'}
                      </span>
                      <span className="text-[10px] text-[#77857C]">Classification</span>
                    </div>
                  </div>

                  {/* Extended Hardware Details Row */}
                  <div className="bg-white p-3 rounded-2xl border border-[#E6EDE7] text-xs space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="text-[#77857C] text-[10px] block font-semibold">
                          ASSIGNED PROJECT:
                        </span>
                        <span className="text-[#174D35] font-semibold">
                          {matchedProduct.projectId ? projectMap.get(matchedProduct.projectId) || 'Assigned' : 'Not recorded'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[#77857C] text-[10px] block font-semibold">
                          STORAGE LOCATION:
                        </span>
                        <span className="text-[#25352C] font-medium">
                          {matchedProduct.storageLocation || 'Not recorded'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[#77857C] text-[10px] block font-semibold">
                          VERIFIED SUPPLIER:
                        </span>
                        <span className="text-[#25352C] font-medium">
                          {matchedProduct.vendor || 'Not recorded'}
                        </span>
                      </div>
                    </div>

                    {matchedProduct.description && (
                      <div className="pt-2 border-t border-[#F0F5F2] text-[11px] text-[#77857C]">
                        <strong className="text-[#25352C]">Specs:</strong> {matchedProduct.description}
                      </div>
                    )}

                    <div className="pt-2 border-t border-[#F0F5F2] flex items-center justify-between text-[11px] text-[#77857C]">
                      <span>
                        History: {productPurchases.length} POs • {productMovements.length} Stock logs
                      </span>
                      {matchedProduct.barcode && (
                        <span className="font-mono text-[10px]">
                          Barcode: {matchedProduct.barcode}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Immediate Actions Strip */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => onViewItemDetails(matchedProduct)}
                      className="px-3.5 py-2 rounded-xl bg-[#168653] hover:bg-[#126b42] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Full Details</span>
                    </button>

                    <button
                      onClick={() => onEditItem(matchedProduct)}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#168653]" />
                      <span>Edit Item</span>
                    </button>

                    <button
                      onClick={() => onAdjustStock(matchedProduct)}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#168653]" />
                      <span>Adjust Stock</span>
                    </button>

                    <button
                      onClick={() => onOpenLabelsForProduct(matchedProduct)}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5 text-[#168653]" />
                      <span>Print Label</span>
                    </button>

                    <button
                      onClick={handleDismissResult}
                      className="ml-auto px-3 py-2 rounded-xl bg-white/70 hover:bg-white text-[#77857C] hover:text-[#25352C] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Dismiss / Next Scan
                    </button>
                  </div>
                </div>
              ) : (
                /* UNKNOWN / NOT FOUND STATE */
                <div className="bg-[#FFFDF8] border-2 border-amber-300 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-amber-900">
                          Item not found in inventory
                        </h4>
                        <p className="text-xs text-amber-800 mt-0.5">
                          No matching record was found for barcode:{' '}
                          <code className="font-bold font-mono bg-white px-2 py-0.5 rounded-lg border border-amber-200">
                            {scannedCode}
                          </code>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleDismissResult}
                      className="p-1 rounded-lg text-amber-700 hover:text-amber-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/60">
                    <button
                      onClick={() => onOpenAddItemWithSku(scannedCode || '')}
                      className="px-3.5 py-2 rounded-xl bg-[#168653] hover:bg-[#126b42] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Register New Item with SKU "{scannedCode}"</span>
                    </button>

                    <button
                      onClick={() => {
                        handleDismissResult();
                        manualInputRef.current?.focus();
                      }}
                      className="px-3 py-2 rounded-xl bg-white border border-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-50 transition-colors cursor-pointer"
                    >
                      Enter SKU manually
                    </button>

                    <button
                      onClick={handleDismissResult}
                      className="px-3 py-2 rounded-xl text-amber-800 text-xs font-semibold hover:text-amber-900 cursor-pointer"
                    >
                      Retry scanning
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
    </div>
  );
};
