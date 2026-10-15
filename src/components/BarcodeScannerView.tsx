import React, { useState, useEffect, useRef } from 'react';
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
  Calendar,
  ExternalLink,
  Plus,
  RefreshCw,
  Keyboard,
  Barcode as BarcodeIcon,
  Tag,
  Clock,
  Printer,
  Edit2,
  Receipt,
  ShieldAlert,
  X,
} from 'lucide-react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types';
import { formatINR } from '../services/dbService';
import { generateBarcodeDataUrl, downloadSingleLabelPng } from '../services/labelService';
import { CameraPermissionModal } from './CameraPermissionModal';

interface BarcodeScannerViewProps {
  onOpenItemDetails?: (product: Product) => void;
  onOpenAddItemWithSku?: (sku: string) => void;
  onOpenEditItem?: (product: Product) => void;
  onOpenLabelsForProduct?: (product: Product) => void;
  onNavigateToProjects?: (projectId: string) => void;
  onNavigateToPurchases?: () => void;
}

export const BarcodeScannerView: React.FC<BarcodeScannerViewProps> = ({
  onOpenItemDetails,
  onOpenAddItemWithSku,
  onOpenEditItem,
  onOpenLabelsForProduct,
  onNavigateToProjects,
  onNavigateToPurchases,
}) => {
  const { products, purchases, stockMovements, projects } = useInventory();

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerInitializing, setScannerInitializing] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Manual input and scan result
  const [manualCode, setManualCode] = useState('');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [lookupAttempted, setLookupAttempted] = useState(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  // Available cameras enumerator
  useEffect(() => {
    async function loadCameras() {
      try {
        if (
          typeof navigator !== 'undefined' &&
          navigator.mediaDevices &&
          typeof navigator.mediaDevices.enumerateDevices === 'function'
        ) {
          const devices = await BrowserMultiFormatReader.listVideoInputDevices();
          if (Array.isArray(devices) && devices.length > 0) {
            setCameras(devices);
            if (!selectedCameraId) {
              const backCam = devices.find(
                (d) =>
                  d.label.toLowerCase().includes('back') ||
                  d.label.toLowerCase().includes('environment')
              );
              setSelectedCameraId(backCam ? backCam.deviceId : devices[0].deviceId);
            }
          }
        }
      } catch (err: any) {
        // Device listing is optional before user activation; ignore initial enumeration notice
      }
    }
    loadCameras();

    return () => {
      stopCamera();
    };
  }, []);

  // Stop camera stream safely
  const stopCamera = () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {
        // Scanner controls stop notice
      }
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      } catch (e) {
        // Video tracks stop notice
      }
    }
    setIsScanning(false);
    setScannerInitializing(false);
  };

  // Start camera scanner
  const startCamera = async () => {
    setCameraError(null);
    setScannerInitializing(true);

    try {
      // 1. Guard against non-secure context or missing mediaDevices API
      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
        setCameraError('Camera access requires HTTPS.');
        setIsScanning(false);
        setScannerInitializing(false);
        return;
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          'Live camera access is not supported in this browser or preview container. You can immediately enter any SKU or scan via a USB barcode reader below.'
        );
        setIsScanning(false);
        setScannerInitializing(false);
        return;
      }

      // 2. Direct request via getUserMedia is more reliable than permissions.query in iframes
      // Stop existing tracks safely before requesting a new stream
      stopCamera();

      // 4. Request camera stream with minimal constraints first to ensure prompt success
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
        throw new Error('Could not acquire camera media stream.');
      }

      // Update camera list now that permissions are granted
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (Array.isArray(devices) && devices.length > 0) {
          setCameras(devices);
        }
      } catch (devErr) {
        // Device listing non-critical
      }

      const codeReader = new BrowserMultiFormatReader();

      if (!videoRef.current) {
        // Stop stream if component unmounted
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('Video element not mounted in DOM');
      }

      // Attach stream
      videoRef.current.srcObject = stream;

      const controls = await codeReader.decodeFromVideoElement(
        videoRef.current,
        (result, error, ctrls) => {
          if (result) {
            const rawText = result.getText().trim();
            if (rawText) {
              handleCodeLookup(rawText);
              // Audio beep feedback if Web Audio API is available
              playBeepSound();
            }
          }
        }
      );

      controlsRef.current = controls;
      setIsScanning(true);
    } catch (err: any) {
      // Gracefully categorize all browser camera permissions, hardware states, and constraints
      const errName = err?.name || '';
      const errMsg = (err?.message || '').toLowerCase();

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.includes('permission denied') ||
        errMsg.includes('not allowed') ||
        errMsg.includes('permission')
      ) {
        setShowPermissionModal(true);
        setCameraError(
          'Camera access was not granted. Please click the button below to try again.'
        );
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errMsg.includes('not found') ||
        errMsg.includes('no device')
      ) {
        setCameraError(
          'No camera hardware detected on this device. Manual SKU lookup and USB scanners are ready.'
        );
      } else if (
        errName === 'NotReadableError' ||
        errName === 'TrackStartError' ||
        errMsg.includes('already in use')
      ) {
        setCameraError(
          'Camera is in use by another application. Please close it and click Retry Camera.'
        );
      } else if (errName === 'OverconstrainedError') {
        setCameraError(
          'Camera constraints not supported by your hardware. Please select a different camera or use manual SKU input.'
        );
      } else if (errName === 'SecurityError') {
        setCameraError(
          'Camera access blocked due to security settings or iframe restrictions.'
        );
      } else {
        setCameraError(
          err?.message ||
            'Unable to start camera feed. Please check device permissions or use manual SKU / USB scanner input.'
        );
      }
      setIsScanning(false);
    } finally {
      setScannerInitializing(false);
    }
  };

  // Audio feedback for successful scan
  const playBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      // Ignore audio error if unsupported
    }
  };

  // Exact Identifier Lookup
  const handleCodeLookup = (code: string) => {
    const query = code.trim();
    if (!query) return;

    setScannedCode(query);
    setLookupAttempted(true);

    // Exact matching rule:
    // 1. Exact match against SKU (case-insensitive)
    // 2. Exact match against registered barcode field (case-insensitive)
    // 3. Exact match against itemNumber formatted SKU (e.g. "ITEM-001" or numeric itemNumber)
    const upperQuery = query.toUpperCase();

    const found = products.find((p) => {
      if (p.sku && p.sku.toUpperCase() === upperQuery) return true;
      if (p.barcode && p.barcode.toUpperCase() === upperQuery) return true;
      if (p.itemNumber && `ITEM-${String(p.itemNumber).padStart(3, '0')}`.toUpperCase() === upperQuery) return true;
      if (p.itemNumber && String(p.itemNumber) === query) return true;
      return false;
    });

    setMatchedProduct(found || null);

    // Add haptic feedback (vibration) if supported by device
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleCodeLookup(manualCode.trim());
    }
  };

  // Calculate detailed product metrics
  const productMovements = matchedProduct
    ? stockMovements.filter((m) => m.productId === matchedProduct.id)
    : [];
  const productPurchases = matchedProduct
    ? purchases.filter((po) => po.productId === matchedProduct.id)
    : [];

  const totalPurchaseExpenditure = productPurchases.reduce(
    (sum, po) => sum + (Number(po.invoiceTotal) || 0),
    0
  );
  const currentStockValuation = matchedProduct
    ? (matchedProduct.quantity || 0) * (matchedProduct.unitPrice || 0)
    : 0;

  const allocatedProject = matchedProduct?.projectId
    ? projects.find((p) => p.id === matchedProduct.projectId)
    : null;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white border border-[#E6EDE7] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2] flex items-center gap-1.5">
              <ScanLine className="w-3.5 h-3.5" />
              Hardware Barcode Scanner
            </span>
            <span className="text-xs text-[#77857C]">Code 128 • EAN-13 • QR</span>
          </div>
          <h2 className="text-lg font-bold text-[#174D35] tracking-tight">
            Fast Barcode & SKU Inspection
          </h2>
          <p className="text-xs text-[#77857C] mt-0.5">
            Scan via live device camera or type/plug in a USB handheld barcode reader with automatic Enter detection.
          </p>
        </div>

        {/* Quick action button */}
        <div className="flex items-center gap-2">
          {!isScanning ? (
            <button
              onClick={startCamera}
              disabled={scannerInitializing}
              className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>{scannerInitializing ? 'Starting Camera...' : 'Start Camera Scanner'}</span>
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <CameraOff className="w-4 h-4" />
              <span>Stop Camera</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split: Scanner / Manual Input on Left, Scanned Record on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewport & Manual/USB Input (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Camera Viewport Container */}
          <div className="bg-white border border-[#E6EDE7] rounded-3xl p-5 shadow-xs overflow-hidden relative space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F5F2]">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#168653]" />
                <span className="text-xs font-bold text-[#174D35] uppercase tracking-wider">
                  Optical Camera Feed
                </span>
              </div>

              {cameras.length > 1 && (
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    if (isScanning) {
                      stopCamera();
                      setTimeout(startCamera, 300);
                    }
                  }}
                  className="text-xs bg-[#F5F9F6] text-[#25352C] border border-[#E6EDE7] rounded-xl px-2.5 py-1 focus:outline-none focus:border-[#168653]"
                >
                  {cameras.map((c, i) => (
                    <option key={c.deviceId || i} value={c.deviceId}>
                      {c.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Video or Camera Off Placeholder */}
            <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-[#F5F9F6] flex items-center justify-center border border-[#E6EDE7]">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${!isScanning ? 'hidden' : 'block'}`}
                autoPlay
                playsInline
                muted
              />

              {/* Scanning Reticle Overlay when active */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-3/4 h-1/2 border-2 border-[#168653] rounded-2xl relative shadow-md">
                    <div className="w-full h-0.5 bg-[#168653] absolute top-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <div className="absolute bottom-3 text-[10px] font-mono text-white bg-[#168653] px-3 py-1 rounded-full font-semibold">
                    ALIGN BARCODE INSIDE RETICLE
                  </div>
                </div>
              )}

              {/* Camera Idle State */}
              {!isScanning && (
                <div className="text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#E6EDE7] flex items-center justify-center mx-auto text-[#77857C] shadow-xs">
                    <CameraOff className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#25352C]">
                      Camera feed is currently stopped
                    </p>
                    <p className="text-[11px] text-[#77857C] mt-1">
                      Click below to activate camera or manage permissions.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError(null);
                        startCamera();
                      }}
                      className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Allow Camera from App</span>
                    </button>
                    <button
                      onClick={startCamera}
                      disabled={scannerInitializing}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F5F9F6] text-[#25352C] border border-[#E6EDE7] text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${scannerInitializing ? 'animate-spin' : ''}`} />
                      <span>{scannerInitializing ? 'Initializing...' : 'Start Camera'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Error banner */}
            {cameraError && (
              <div className="mt-3 p-4 rounded-2xl bg-[#FFF9E6] border border-[#FFE8A3] text-xs text-[#7A5B04] space-y-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-[#FFF0C2] flex items-center justify-center shrink-0 mt-0.5 text-[#B88700]">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="font-bold text-xs text-[#6B4F00]">
                      Camera Access
                    </div>
                    <div className="leading-relaxed text-[#7A5B04]">{cameraError}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-[#FFE8A3] flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setCameraError(null);
                      startCamera();
                    }}
                    className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Allow Camera from App</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      manualInputRef.current?.focus();
                      manualInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-2xs"
                  >
                    <Keyboard className="w-4 h-4" />
                    <span>Use Manual SKU Input</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Manual Input / USB Keyboard Scanner Box */}
          <div className="bg-white border border-[#E6EDE7] rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[#168653]" />
                <span className="text-xs font-bold text-[#174D35] uppercase tracking-wider">
                  Manual SKU / USB Scanner Input
                </span>
              </div>
              <span className="text-[10px] font-semibold text-[#168653] bg-[#E5F5E9] px-2.5 py-0.5 rounded-full border border-[#C6E7D2]">
                ENTER TO SEARCH
              </span>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-2">
              <div className="relative">
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. DDLC-0001 or barcode..."
                  className="w-full bg-[#F5F9F6] border border-[#E6EDE7] focus:border-[#168653] rounded-2xl px-3.5 py-2.5 text-xs text-[#25352C] placeholder-[#77857C] focus:outline-none focus:bg-white pr-20 transition-all font-mono"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Find</span>
                </button>
              </div>

              <div className="text-[11px] text-[#77857C] flex items-center justify-between">
                <span>Supports handheld laser/CCD scanners</span>
                <span>Exact match lookup</span>
              </div>
            </form>

            {/* Quick SKU selector from inventory if available */}
            {products.length > 0 && (
              <div className="pt-2 border-t border-[#F0F5F2]">
                <div className="text-[10px] font-semibold text-[#77857C] mb-1.5 uppercase tracking-wider">
                  RECENT REGISTERED SKUs IN LAB:
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {products.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setManualCode(p.sku);
                        handleCodeLookup(p.sku);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#F5F9F6] hover:bg-[#E5F5E9] border border-[#E6EDE7] hover:border-[#168653] text-xs font-mono font-bold text-[#168653] transition-all cursor-pointer"
                    >
                      {p.sku}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scan Result & Complete Inventory Details Panel */}
        <div className="lg:col-span-7">
          {/* Initial state (No scan attempted yet) placeholder */}
          {!lookupAttempted && (
            <div className="h-full min-h-[400px] bg-white border border-dashed border-[#E6EDE7] rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-[#E5F5E9] flex items-center justify-center text-[#168653]">
                <BarcodeIcon className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-[#174D35]">
                Scanner Ready For Identification
              </h3>
              <p className="text-xs text-[#77857C] max-w-sm leading-relaxed">
                Scan an item barcode with your camera or enter the SKU code to instantly pull up complete specifications, purchase costs, project allocation, and audit history.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-[#168653]">
                <span className="w-2 h-2 rounded-full bg-[#168653] animate-pulse" />
                <span>STANDBY: WAITING FOR INPUT</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* CUTE POPUP CARD FOR SCAN RESULTS                          */}
          {/* ========================================================= */}
          {lookupAttempted && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#174D35]/25 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-lg bg-white rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.2)] border border-white overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
                {/* Visual Header */}
                <div className="h-3 bg-gradient-to-r from-[#168653] via-[#4ADE80] to-[#168653]" />
                
                <div className="p-7 sm:p-10 space-y-7">
                  {matchedProduct ? (
                    /* MATCH FOUND */
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-5">
                          <div className="w-16 h-16 rounded-3xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center shadow-inner shrink-0 rotate-3">
                            <CheckCircle2 className="w-10 h-10" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] bg-[#168653] px-3 py-1 rounded-full shadow-sm">
                                DISCOVERED!
                              </span>
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-black text-[#174D35] leading-tight mt-2">
                              {matchedProduct.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="font-mono text-sm font-black text-[#54655B] bg-[#F5F9F6] px-3 py-1 rounded-xl border border-[#E6EDE7]">
                                {matchedProduct.sku}
                              </span>
                              <span className="text-xs px-3 py-1 rounded-xl bg-[#F5F9F6] text-[#25352C] border border-[#E6EDE7] font-bold">
                                {matchedProduct.category || 'General'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setLookupAttempted(false)}
                          className="w-12 h-12 rounded-2xl bg-[#F5F9F6] text-[#77857C] flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer active:scale-90 shadow-xs border border-[#E6EDE7]"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>

                      {/* Highlight Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#F0F9F2] p-5 rounded-[32px] border-2 border-[#CDE3D2] relative overflow-hidden group">
                          <div className="absolute -right-3 -bottom-3 opacity-10 text-[#168653] group-hover:rotate-12 transition-transform duration-500">
                            <Package className="w-20 h-20" />
                          </div>
                          <span className="text-[11px] text-[#54655B] font-black uppercase tracking-widest block">STOCK ON HAND</span>
                          <span className="text-3xl font-black text-[#174D35] mt-2 block">
                            {matchedProduct.quantity} <small className="text-sm font-bold opacity-70">{matchedProduct.unit || 'pcs'}</small>
                          </span>
                          <div className="mt-2 flex items-center gap-2">
                            <div className={`h-2.5 w-2.5 rounded-full ${matchedProduct.quantity <= 5 ? 'bg-amber-500 animate-pulse' : 'bg-[#168653]'}`} />
                            <span className="text-[10px] font-black text-[#174D35]/60 uppercase tracking-wider">
                              {matchedProduct.quantity <= 5 ? 'Restock Soon' : 'Levels Healthy'}
                            </span>
                          </div>
                        </div>

                        <div className="bg-[#F5F9F6] p-5 rounded-[32px] border-2 border-[#E6EDE7] relative overflow-hidden group">
                          <div className="absolute -right-3 -bottom-3 opacity-10 text-[#174D35] group-hover:rotate-12 transition-transform duration-500">
                            <Tag className="w-20 h-20" />
                          </div>
                          <span className="text-[11px] text-[#54655B] font-black uppercase tracking-widest block">UNIT VALUE</span>
                          <span className="text-3xl font-black text-[#174D35] mt-2 block">
                            {formatINR(matchedProduct.unitPrice)}
                          </span>
                          <span className="text-[10px] font-black text-[#174D35]/60 uppercase tracking-wider block mt-2">
                            Market Rate
                          </span>
                        </div>
                      </div>

                      {/* Detail Cards */}
                      <div className="bg-white p-6 rounded-[32px] border-2 border-dashed border-[#CDE3D2] grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-lg bg-[#E5F5E9] text-[#168653] flex items-center justify-center">
                              <MapPin className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] text-[#77857C] font-black uppercase tracking-widest">Location</span>
                          </div>
                          <span className="text-sm font-black text-[#174D35] ml-8 block">
                            {matchedProduct.storageLocation || 'Main Lab'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-lg bg-[#E5F5E9] text-[#168653] flex items-center justify-center">
                              <FolderGit2 className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] text-[#77857C] font-black uppercase tracking-widest">Project</span>
                          </div>
                          <span className="text-sm font-black text-[#174D35] ml-8 block truncate">
                            {allocatedProject ? allocatedProject.name : 'General Inventory'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => {
                            onOpenItemDetails?.(matchedProduct);
                            setLookupAttempted(false);
                          }}
                          className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#168653] text-white text-sm font-black hover:bg-[#126b42] transition-all shadow-lg active:scale-95 shadow-[#168653]/20"
                        >
                          <ExternalLink className="w-5 h-5" />
                          <span>FULL RECORD</span>
                        </button>
                        <button
                          onClick={() => {
                            onOpenEditItem?.(matchedProduct);
                            setLookupAttempted(false);
                          }}
                          className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white border-2 border-[#E6EDE7] text-[#174D35] text-sm font-black hover:bg-[#F5F9F6] transition-all active:scale-95"
                        >
                          <Edit2 className="w-5 h-5" />
                          <span>EDIT INFO</span>
                        </button>
                        <button
                          onClick={() => {
                            onOpenLabelsForProduct?.(matchedProduct);
                            setLookupAttempted(false);
                          }}
                          className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white border-2 border-[#E6EDE7] text-[#174D35] text-sm font-black hover:bg-[#F5F9F6] transition-all active:scale-95"
                        >
                          <Printer className="w-5 h-5" />
                          <span>PRINT LABEL</span>
                        </button>
                        <button
                          onClick={() => setLookupAttempted(false)}
                          className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#F5F9F6] text-[#77857C] text-sm font-black hover:bg-[#E5F5E9] hover:text-[#174D35] transition-all active:scale-95"
                        >
                          <ScanLine className="w-5 h-5" />
                          <span>NEW SCAN</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    /* NOT FOUND */
                    <div className="text-center py-8 space-y-8">
                      <div className="w-24 h-24 rounded-[40px] bg-red-50 text-red-500 flex items-center justify-center mx-auto shadow-inner border-2 border-white rotate-6">
                        <ShieldAlert className="w-12 h-12" />
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-3xl font-black text-red-900 leading-tight tracking-tight">
                          Item Not Found
                        </h3>
                        <p className="text-[#54655B] text-base font-bold max-w-xs mx-auto">
                          identifier <code className="bg-red-100 px-2 py-1 rounded-lg text-red-900 border border-red-200">{scannedCode}</code> is not in our system.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <button
                          onClick={() => {
                            onOpenAddItemWithSku?.(scannedCode || '');
                            setLookupAttempted(false);
                          }}
                          className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[24px] bg-[#168653] text-white text-base font-black hover:bg-[#126b42] transition-all shadow-xl active:scale-95 shadow-[#168653]/30"
                        >
                          <Plus className="w-6 h-6" />
                          <span>REGISTER NEW PRODUCT</span>
                        </button>
                        <button
                          onClick={() => setLookupAttempted(false)}
                          className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[24px] bg-white border-2 border-[#E6EDE7] text-[#174D35] text-base font-black hover:bg-[#F5F9F6] transition-all active:scale-95"
                        >
                          <span>CONTINUE SCANNING</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Permission Popup Modal */}
      <CameraPermissionModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onPermissionGranted={() => {
          setCameraError(null);
          startCamera();
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
