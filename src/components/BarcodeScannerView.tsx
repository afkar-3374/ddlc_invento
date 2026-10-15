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

      // 4. Request camera stream with fallback constraints
      let stream: MediaStream | null = null;
      try {
        const videoConstraints: MediaTrackConstraints = selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: { ideal: 'environment' } };

        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      } catch (firstErr: any) {
        // Fallback: If deviceId exact constraint failed (e.g. device disconnected or OverconstrainedError), try simple video: true
        if (selectedCameraId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          }
        } else {
          // Fallback to basic video constraint
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
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
          {/* Case 1: Initial state (No scan attempted yet) */}
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

          {/* Case 2: Scanned code not found in Firestore */}
          {lookupAttempted && !matchedProduct && (
            <div className="bg-white border border-red-200 rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex items-start justify-between pb-3 border-b border-[#F0F5F2]">
                <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-bold uppercase tracking-wider">NO MATCH FOUND</span>
                </div>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                  CODE: {scannedCode}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#25352C]">
                  No registered product matched identifier "{scannedCode}"
                </h3>
                <p className="text-xs text-[#77857C] leading-relaxed">
                  The barcode or SKU was looked up against all registered items in Cloud Firestore, but no exact record matches this value.
                </p>
              </div>

              <div className="pt-3 border-t border-[#F0F5F2] flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setScannedCode(null);
                    setLookupAttempted(false);
                    setManualCode('');
                    if (manualInputRef.current) manualInputRef.current.focus();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#F5F9F6] hover:bg-[#E5F5E9] border border-[#E6EDE7] text-xs font-semibold text-[#25352C] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#168653]" />
                  <span>Retry Search</span>
                </button>

                {onOpenAddItemWithSku && scannedCode && (
                  <button
                    onClick={() => onOpenAddItemWithSku(scannedCode)}
                    className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register New Item with SKU "{scannedCode}"</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Case 3: Matched product found */}
          {lookupAttempted && matchedProduct && (
            <div className="bg-white border border-[#C6E7D2] rounded-3xl p-6 space-y-5 shadow-xs">
              {/* Top Banner with SKU and Status */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#F0F5F2]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {matchedProduct.sku}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F5F9F6] text-[#25352C] border border-[#E6EDE7]">
                      {matchedProduct.category || 'General'}
                    </span>
                    {matchedProduct.barcode && (
                      <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD]">
                        BARCODE: {matchedProduct.barcode}
                      </span>
                    )}
                    {matchedProduct.archived && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        ARCHIVED
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[#174D35]">
                    {matchedProduct.name}
                  </h3>
                  {(matchedProduct.brand || matchedProduct.model) && (
                    <div className="text-xs text-[#77857C] mt-0.5">
                      Brand: <span className="text-[#25352C] font-semibold">{matchedProduct.brand || 'Not recorded'}</span> • Model: <span className="text-[#25352C] font-semibold">{matchedProduct.model || 'Not recorded'}</span>
                    </div>
                  )}
                </div>

                {/* Primary Open Full Record Button */}
                <div className="flex items-center gap-2">
                  {onOpenItemDetails && (
                    <button
                      onClick={() => onOpenItemDetails(matchedProduct)}
                      className="px-3.5 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      title="Open full interactive inventory details dialog"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Full Record</span>
                    </button>
                  )}
                  {onOpenEditItem && (
                    <button
                      onClick={() => onOpenEditItem(matchedProduct)}
                      className="p-2 rounded-xl bg-[#F5F9F6] hover:bg-[#E5F5E9] border border-[#E6EDE7] text-[#77857C] hover:text-[#174D35] transition-all cursor-pointer"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Cost & Valuation Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F5F9F6] p-3.5 rounded-2xl border border-[#E6EDE7] text-xs">
                <div>
                  <span className="text-[10px] text-[#77857C] block uppercase font-semibold">Current Stock</span>
                  <span className="text-base font-bold text-[#174D35]">
                    {matchedProduct.quantity}{' '}
                    <span className="text-xs text-[#77857C] font-normal">
                      {matchedProduct.unit || 'pcs'}
                    </span>
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[#77857C] block uppercase font-semibold">Unit Cost</span>
                  <span className="text-base font-bold text-[#174D35]">
                    {formatINR(matchedProduct.unitPrice)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[#77857C] block uppercase font-semibold">Stock Valuation</span>
                  <span className="text-base font-bold text-[#168653]">
                    {formatINR(currentStockValuation)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[#77857C] block uppercase font-semibold">Total PO Value</span>
                  <span className="text-base font-bold text-[#0284C7]">
                    {formatINR(totalPurchaseExpenditure || matchedProduct.totalCost || currentStockValuation)}
                  </span>
                </div>
              </div>

              {/* Comprehensive Attribute Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Storage Location */}
                <div className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-[#168653] shrink-0" />
                  <div>
                    <span className="text-[10px] font-semibold text-[#77857C] block">STORAGE LOCATION</span>
                    <span className="text-[#25352C] font-semibold">
                      {matchedProduct.storageLocation || 'Not recorded'}
                    </span>
                  </div>
                </div>

                {/* Project Assignment */}
                <div className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderGit2 className="w-4 h-4 text-[#168653] shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-[#77857C] block">PROJECT ASSIGNMENT</span>
                      <span className="text-[#25352C] font-semibold truncate block">
                        {allocatedProject
                          ? `${allocatedProject.name} (${allocatedProject.code})`
                          : matchedProduct.projectId || 'Unassigned / General'}
                      </span>
                    </div>
                  </div>
                  {allocatedProject && onNavigateToProjects && (
                    <button
                      onClick={() => onNavigateToProjects(allocatedProject.id)}
                      className="text-[11px] text-[#168653] hover:underline shrink-0 font-semibold cursor-pointer"
                    >
                      View Project
                    </button>
                  )}
                </div>

                {/* Vendor / Supplier */}
                <div className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7]">
                  <span className="text-[10px] font-semibold text-[#77857C] block">VENDOR / SUPPLIER</span>
                  <span className="text-[#25352C] font-semibold">
                    {matchedProduct.vendor || 'Not recorded'}
                  </span>
                </div>

                {/* Purchase Date */}
                <div className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7]">
                  <span className="text-[10px] font-semibold text-[#77857C] block">PURCHASE DATE</span>
                  <span className="text-[#25352C] font-semibold">
                    {matchedProduct.purchaseDate || 'Not recorded'}
                  </span>
                </div>
              </div>

              {/* Description & Technical Specifications */}
              {matchedProduct.description && (
                <div className="p-3.5 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs">
                  <span className="text-[10px] font-semibold text-[#77857C] block mb-1">
                    SPECIFICATIONS & TECHNICAL DESCRIPTION
                  </span>
                  <p className="text-[#25352C] leading-relaxed">{matchedProduct.description}</p>
                </div>
              )}

              {/* Purchase History Section */}
              <div className="space-y-2 pt-2 border-t border-[#F0F5F2]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#174D35] font-semibold flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-[#168653]" />
                    Purchase History ({productPurchases.length})
                  </span>
                  {onNavigateToPurchases && productPurchases.length > 0 && (
                    <button
                      onClick={onNavigateToPurchases}
                      className="text-[#168653] hover:underline text-xs font-semibold cursor-pointer"
                    >
                      View All Purchases
                    </button>
                  )}
                </div>

                {productPurchases.length === 0 ? (
                  <div className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#77857C] text-center">
                    No dedicated purchase order entries linked.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {productPurchases.map((po) => (
                      <div
                        key={po.id}
                        className="p-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="text-[#174D35] font-bold">{po.purchaseNumber}</span>
                          <span className="text-[#77857C] text-[10px] ml-2">{po.purchaseDate}</span>
                          <div className="text-[10px] text-[#77857C]">{po.vendorNameSnapshot} • Qty: {po.quantity}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[#168653] font-bold">{formatINR(po.invoiceTotal)}</span>
                          <div className="text-[10px] text-[#77857C] uppercase">{po.paymentStatus}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Quick Label Actions */}
              <div className="pt-3 border-t border-[#F0F5F2] flex flex-wrap items-center justify-between gap-2.5">
                <button
                  onClick={() => downloadSingleLabelPng(matchedProduct)}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F5F9F6] border border-[#E6EDE7] text-xs font-semibold text-[#25352C] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-[#168653]" />
                  <span>Download Single Label (PNG)</span>
                </button>

                {onOpenLabelsForProduct && (
                  <button
                    onClick={() => onOpenLabelsForProduct(matchedProduct)}
                    className="px-3.5 py-2 rounded-xl bg-[#E5F5E9] hover:bg-[#D4EED9] text-[#168653] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
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
