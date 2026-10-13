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
} from 'lucide-react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types';
import { formatINR } from '../services/dbService';
import { generateBarcodeDataUrl, downloadSingleLabelPng } from '../services/labelService';

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
      // Guard against unsupported mediaDevices or non-secure contexts
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          'Camera access is not available in this browser or iframe environment. You can enter any SKU or scan via a USB barcode reader below.'
        );
        setIsScanning(false);
        setScannerInitializing(false);
        return;
      }

      // First ensure camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: 'environment' },
      });

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
        throw new Error('Video element not mounted');
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
      // Gracefully handle browser camera permissions and device states without throwing uncaught console errors
      const errName = err?.name || '';
      const errMsg = (err?.message || '').toLowerCase();

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.includes('permission denied') ||
        errMsg.includes('not allowed') ||
        errMsg.includes('permission')
      ) {
        setCameraError(
          'Camera permission denied. You can allow camera access in your browser or immediately use the manual SKU input & USB handheld scanner below.'
        );
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errMsg.includes('not found') ||
        errMsg.includes('no device')
      ) {
        setCameraError(
          'No camera hardware detected on this device. You can type any SKU or scan via a USB barcode scanner in the box below.'
        );
      } else {
        setCameraError(
          err?.message ||
            'Unable to access camera feed. Please check device permissions or use manual SKU / USB scanner input.'
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
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30 flex items-center gap-1.5">
              <ScanLine className="w-3.5 h-3.5" />
              HARDWARE BARCODE SCANNER
            </span>
            <span className="text-xs text-gray-400 font-mono">CODE 128 • EAN-13 • QR</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide font-display">
            Fast Barcode & SKU Inspection
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Scan via live device camera or type/plug in a USB handheld barcode reader with automatic Enter detection.
          </p>
        </div>

        {/* Quick action button */}
        <div className="flex items-center gap-2">
          {!isScanning ? (
            <button
              onClick={startCamera}
              disabled={scannerInitializing}
              className="px-4 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(0,255,102,0.3)] cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>{scannerInitializing ? 'Starting Camera...' : 'Start Camera Scanner'}</span>
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
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
          <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-4 overflow-hidden relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#182026] mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#00FF66]" />
                <span className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
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
                  className="text-[11px] font-mono bg-[#141A1F] text-gray-300 border border-[#222C35] rounded-lg px-2 py-1 focus:outline-hidden focus:border-[#00FF66]"
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
            <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-black flex items-center justify-center border border-[#1E262E]">
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
                  <div className="w-3/4 h-1/2 border-2 border-[#00FF66]/70 rounded-xl relative shadow-[0_0_20px_rgba(0,255,102,0.3)]">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-3 border-l-3 border-[#00FF66]" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-3 border-r-3 border-[#00FF66]" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-3 border-l-3 border-[#00FF66]" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-3 border-r-3 border-[#00FF66]" />
                    {/* Laser sweep animation line */}
                    <div className="w-full h-0.5 bg-[#00FF66] shadow-[0_0_10px_#00FF66] absolute top-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <div className="absolute bottom-3 text-[10px] font-mono text-[#00FF66] bg-black/75 px-3 py-1 rounded-full border border-[#00FF66]/30">
                    ALIGN BARCODE INSIDE RETICLE
                  </div>
                </div>
              )}

              {/* Camera Idle State */}
              {!isScanning && (
                <div className="text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#141A1F] border border-[#212C35] flex items-center justify-center mx-auto text-gray-500">
                    <CameraOff className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-mono text-gray-400">
                      Camera feed is currently stopped
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Click below to request camera permission and begin scanning.
                    </p>
                  </div>
                  <button
                    onClick={startCamera}
                    disabled={scannerInitializing}
                    className="px-4 py-2 rounded-xl bg-[#141A1F] hover:bg-[#1A2229] border border-[#00FF66]/40 text-[#00FF66] font-mono text-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{scannerInitializing ? 'Initializing...' : 'Activate Camera'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Camera Error banner */}
            {cameraError && (
              <div className="mt-3 p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/40 text-xs font-mono text-amber-200 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed flex-1">{cameraError}</div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      manualInputRef.current?.focus();
                      manualInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>Focus Manual / USB Input</span>
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={scannerInitializing}
                    className="px-2.5 py-1 rounded-lg bg-[#141A1F] hover:bg-[#1E262E] text-gray-300 hover:text-white border border-[#283540] text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${scannerInitializing ? 'animate-spin' : ''}`} />
                    <span>Retry Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraError(null)}
                    className="ml-auto px-2 py-1 text-[11px] font-mono text-gray-400 hover:text-gray-200 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Manual Input / USB Keyboard Scanner Box */}
          <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[#00FF66]" />
                <span className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                  Manual SKU / USB Scanner Input
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#00FF66] bg-[#00FF66]/10 px-2 py-0.5 rounded border border-[#00FF66]/20">
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
                  placeholder="e.g. DDLC-CMP-00010 or ITEM-001 or barcode..."
                  className="w-full bg-[#14191E] border border-[#242F38] focus:border-[#00FF66] rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-hidden pr-20 transition-all"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-[#00FF66] hover:bg-[#1aff75] text-black font-mono font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Find</span>
                </button>
              </div>

              <div className="text-[11px] text-gray-400 flex items-center justify-between font-mono">
                <span>Supports handheld laser/CCD scanners</span>
                <span className="text-gray-400">Exact match lookup</span>
              </div>
            </form>

            {/* Quick SKU selector from inventory if available */}
            {products.length > 0 && (
              <div className="pt-2 border-t border-[#182026]">
                <div className="text-[10px] font-mono text-gray-400 mb-1.5">
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
                      className="px-2 py-1 rounded bg-[#13171B] hover:bg-[#192229] border border-[#202931] hover:border-[#00FF66]/40 text-[10px] font-mono text-gray-300 hover:text-white transition-all cursor-pointer"
                    >
                      {p.sku}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scan Result & Complete Inventory Details Panel (7 Cols) */}
        <div className="lg:col-span-7">
          {/* Case 1: Initial state (No scan attempted yet) */}
          {!lookupAttempted && (
            <div className="h-full min-h-[400px] bg-[#101418] border border-dashed border-[#202931] rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#141A1F] border border-[#222D36] flex items-center justify-center text-gray-500">
                <BarcodeIcon className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white font-display">
                Scanner Ready For Identification
              </h3>
              <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                Scan an item barcode with your camera or enter the SKU code to instantly pull up complete specifications, purchase costs, project allocation, and audit history.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs font-mono text-[#00FF66]">
                <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-pulse" />
                <span>STANDBY: WAITING FOR INPUT</span>
              </div>
            </div>
          )}

          {/* Case 2: Scanned code not found in Firestore */}
          {lookupAttempted && !matchedProduct && (
            <div className="bg-[#101418] border border-red-500/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-[#182026]">
                <div className="flex items-center gap-2 text-red-400 font-mono text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-bold uppercase tracking-wider">NO MATCH FOUND</span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/40">
                  CODE: {scannedCode}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">
                  No registered product matched identifier "{scannedCode}"
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  The barcode or SKU was looked up against all registered items in Cloud Firestore, but no exact record matches this value.
                </p>
              </div>

              <div className="pt-3 border-t border-[#182026] flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setScannedCode(null);
                    setLookupAttempted(false);
                    setManualCode('');
                    if (manualInputRef.current) manualInputRef.current.focus();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#141A1F] hover:bg-[#1A2229] border border-[#222C35] text-xs font-mono text-gray-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Search</span>
                </button>

                {onOpenAddItemWithSku && scannedCode && (
                  <button
                    onClick={() => onOpenAddItemWithSku(scannedCode)}
                    className="px-4 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,255,102,0.25)] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register New Item with SKU "{scannedCode}"</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Case 3: Matched product found — Complete Inventory Details Panel (Requirement 4) */}
          {lookupAttempted && matchedProduct && (
            <div className="bg-[#101418] border border-[#00FF66]/30 rounded-2xl p-5 lg:p-6 space-y-5 shadow-[0_0_20px_rgba(0,255,102,0.05)]">
              {/* Top Banner with SKU and Status */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#182026]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {matchedProduct.sku}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#151B20] text-gray-300 border border-gray-700">
                      {matchedProduct.category || 'General'}
                    </span>
                    {matchedProduct.barcode && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151B20] text-cyan-400 border border-cyan-800">
                        BARCODE: {matchedProduct.barcode}
                      </span>
                    )}
                    {matchedProduct.archived && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800">
                        ARCHIVED
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white font-display">
                    {matchedProduct.name}
                  </h3>
                  {(matchedProduct.brand || matchedProduct.model) && (
                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                      Brand: <span className="text-gray-200">{matchedProduct.brand || 'Not recorded'}</span> • Model: <span className="text-gray-200">{matchedProduct.model || 'Not recorded'}</span>
                    </div>
                  )}
                </div>

                {/* Primary Open Full Record Button */}
                <div className="flex items-center gap-2">
                  {onOpenItemDetails && (
                    <button
                      onClick={() => onOpenItemDetails(matchedProduct)}
                      className="px-3.5 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,255,102,0.25)] cursor-pointer"
                      title="Open full interactive inventory details dialog"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Full Record</span>
                    </button>
                  )}
                  {onOpenEditItem && (
                    <button
                      onClick={() => onOpenEditItem(matchedProduct)}
                      className="p-2 rounded-xl bg-[#141A1F] hover:bg-[#1A2229] border border-[#242F38] text-gray-300 hover:text-white transition-all cursor-pointer"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Cost & Valuation Grid (Strict Separation of Unit Cost, Stock Valuation & Recorded Purchase Total) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0D1114] p-3.5 rounded-xl border border-[#1A232A] font-mono text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Current Stock</span>
                  <span className="text-base font-bold text-white">
                    {matchedProduct.quantity}{' '}
                    <span className="text-xs text-gray-400 font-normal">
                      {matchedProduct.unit || 'pcs'}
                    </span>
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Unit Cost</span>
                  <span className="text-base font-bold text-white">
                    {formatINR(matchedProduct.unitPrice)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Stock Valuation</span>
                  <span className="text-base font-bold text-[#00FF66]">
                    {formatINR(currentStockValuation)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Total PO Value</span>
                  <span className="text-base font-bold text-cyan-400">
                    {formatINR(totalPurchaseExpenditure || matchedProduct.totalCost || currentStockValuation)}
                  </span>
                </div>
              </div>

              {/* Comprehensive Attribute Grid (Requirement 4) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Storage Location */}
                <div className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329] flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-[#00FF66] shrink-0" />
                  <div>
                    <span className="text-[10px] font-mono text-gray-400 block">STORAGE LOCATION</span>
                    <span className="text-white font-medium">
                      {matchedProduct.storageLocation || 'Not recorded'}
                    </span>
                  </div>
                </div>

                {/* Project Assignment */}
                <div className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329] flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderGit2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-gray-400 block">PROJECT ASSIGNMENT</span>
                      <span className="text-white font-medium truncate block">
                        {allocatedProject
                          ? `${allocatedProject.name} (${allocatedProject.code})`
                          : matchedProduct.projectId || 'Unassigned / General'}
                      </span>
                    </div>
                  </div>
                  {allocatedProject && onNavigateToProjects && (
                    <button
                      onClick={() => onNavigateToProjects(allocatedProject.id)}
                      className="text-[10px] font-mono text-emerald-400 hover:underline shrink-0"
                    >
                      View Project
                    </button>
                  )}
                </div>

                {/* Vendor / Supplier */}
                <div className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329]">
                  <span className="text-[10px] font-mono text-gray-400 block">VENDOR / SUPPLIER</span>
                  <span className="text-white font-medium">
                    {matchedProduct.vendor || 'Not recorded'}
                  </span>
                </div>

                {/* Purchase Date */}
                <div className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329]">
                  <span className="text-[10px] font-mono text-gray-400 block">PURCHASE DATE</span>
                  <span className="text-white font-medium">
                    {matchedProduct.purchaseDate || 'Not recorded'}
                  </span>
                </div>

                {/* GST Info */}
                <div className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329]">
                  <span className="text-[10px] font-mono text-gray-400 block">GST RATE & AMOUNT</span>
                  <span className="text-white font-medium">
                    {matchedProduct.gstPercent && matchedProduct.gstPercent > 0
                      ? `${matchedProduct.gstPercent}% (${formatINR(matchedProduct.gstAmount)})`
                      : '0% / Exempted (Direct Lab Cost)'}
                  </span>
                </div>

                {/* Created & Updated Dates */}
                <div className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329] font-mono text-[11px]">
                  <span className="text-[10px] text-gray-400 block">AUDIT TIMESTAMPS</span>
                  <div className="text-gray-300">
                    Created: {matchedProduct.createdAt ? new Date(matchedProduct.createdAt).toLocaleDateString() : 'Not recorded'}
                  </div>
                  <div className="text-gray-400 text-[10px]">
                    Updated: {matchedProduct.updatedAt ? new Date(matchedProduct.updatedAt).toLocaleDateString() : 'Not recorded'}
                  </div>
                </div>
              </div>

              {/* Description & Technical Specifications */}
              {matchedProduct.description && (
                <div className="p-3.5 rounded-xl bg-[#13171B] border border-[#1C2329] text-xs">
                  <span className="text-[10px] font-mono text-gray-400 block mb-1">
                    SPECIFICATIONS & TECHNICAL DESCRIPTION
                  </span>
                  <p className="text-gray-300 leading-relaxed">{matchedProduct.description}</p>
                </div>
              )}

              {/* Notes */}
              {matchedProduct.notes && (
                <div className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329] text-xs">
                  <span className="text-[10px] font-mono text-gray-400 block mb-1">LABORATORY NOTES</span>
                  <p className="text-gray-300 leading-relaxed">{matchedProduct.notes}</p>
                </div>
              )}

              {/* Purchase History Section */}
              <div className="space-y-2 pt-2 border-t border-[#182026]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-[#00FF66]" />
                    Purchase History ({productPurchases.length})
                  </span>
                  {onNavigateToPurchases && productPurchases.length > 0 && (
                    <button
                      onClick={onNavigateToPurchases}
                      className="text-[#00FF66] hover:underline text-[11px]"
                    >
                      View All Purchases
                    </button>
                  )}
                </div>

                {productPurchases.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#0D1114] border border-[#182026] text-[11px] font-mono text-gray-400 text-center">
                    No dedicated purchase order entries linked.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {productPurchases.map((po) => (
                      <div
                        key={po.id}
                        className="p-2.5 rounded-lg bg-[#0E1216] border border-[#1A2229] flex items-center justify-between text-xs font-mono"
                      >
                        <div>
                          <span className="text-white font-bold">{po.purchaseNumber}</span>
                          <span className="text-gray-400 text-[10px] ml-2">{po.purchaseDate}</span>
                          <div className="text-[10px] text-gray-400">{po.vendorNameSnapshot} • Qty: {po.quantity}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[#00FF66] font-bold">{formatINR(po.invoiceTotal)}</span>
                          <div className="text-[10px] text-gray-400 uppercase">{po.paymentStatus}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stock Movement History Section */}
              <div className="space-y-2 pt-2 border-t border-[#182026]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Stock Movement History ({productMovements.length})
                  </span>
                </div>

                {productMovements.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#0D1114] border border-[#182026] text-[11px] font-mono text-gray-400 text-center">
                    No stock movements recorded yet.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {productMovements.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-lg bg-[#0E1216] border border-[#1A2229] flex items-center justify-between text-xs font-mono"
                      >
                        <div>
                          <span className="text-white font-bold uppercase">{m.type}</span>
                          <span className="text-gray-400 text-[10px] ml-2">
                            {new Date(m.createdAt).toLocaleDateString()}
                          </span>
                          <div className="text-[10px] text-gray-400">{m.notes}</div>
                        </div>
                        <div className="text-right">
                          <span
                            className={
                              m.newStock >= m.previousStock
                                ? 'text-[#00FF66] font-bold'
                                : 'text-amber-400 font-bold'
                            }
                          >
                            {m.newStock >= m.previousStock ? `+${m.quantity}` : `-${m.quantity}`}
                          </span>
                          <div className="text-[10px] text-gray-400">Balance: {m.newStock}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Quick Label Actions */}
              <div className="pt-3 border-t border-[#182026] flex flex-wrap items-center justify-between gap-2.5">
                <button
                  onClick={() => downloadSingleLabelPng(matchedProduct)}
                  className="px-3 py-1.5 rounded-xl bg-[#141A1F] hover:bg-[#1A2229] border border-[#242F38] text-xs font-mono text-gray-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-[#00FF66]" />
                  <span>Download Single Label (PNG)</span>
                </button>

                {onOpenLabelsForProduct && (
                  <button
                    onClick={() => onOpenLabelsForProduct(matchedProduct)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#141A1F] hover:bg-[#1A2229] border border-[#00FF66]/30 text-[#00FF66] text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Generate Batch Labels PDF</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
