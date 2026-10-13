import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Boxes,
  FolderGit2,
  Receipt,
  Sparkles,
  Plus,
  ScanLine,
  Tag,
  ArrowUpRight,
  Database,
  Layers,
  ChevronRight,
  ExternalLink,
  Clock,
  MapPin,
  Camera,
  CameraOff,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  BotMessageSquare,
  Send,
  Cpu,
  RefreshCw,
  Printer,
  Edit2,
  Sliders,
  FolderPlus,
  X,
} from 'lucide-react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';
import { Product, ProposedAction } from '../types';
import {
  generateLabelsPdf,
  filterProductsBySkuRange,
  LABEL_SIZES,
} from '../services/labelService';

interface DashboardViewProps {
  onOpenAddItem: () => void;
  onOpenAiAddItem: () => void;
  onOpenLabels: (options?: {
    startSku?: string;
    endSku?: string;
    productId?: string;
    projectId?: string;
  }) => void;
  onViewItemDetails: (product: Product) => void;
  onNavigateToSettings: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenAddItem,
  onOpenAiAddItem,
  onOpenLabels,
  onViewItemDetails,
  onNavigateToSettings,
}) => {
  const {
    products,
    purchases,
    projects,
    totalInventoryValue,
    totalProductsCount,
    totalStockQuantity,
    activeProjectsCount,
    totalPurchasesValue,
    addProduct,
    editProduct,
    addProject,
  } = useInventory();

  // Active dashboard view mode / tab
  const [activeTab, setActiveTab] = useState<'all' | 'scanner' | 'ai' | 'items'>('all');

  // ==========================================
  // 1. BARCODE SCANNER STATE & CAMERA LOGIC
  // ==========================================
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scannerInitializing, setScannerInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [manualCode, setManualCode] = useState('');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [lookupAttempted, setLookupAttempted] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  // Enumerate cameras
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
      } catch (e) {
        // Cameras optional on initial load
      }
    }
    loadCameras();

    return () => {
      stopCamera();
    };
  }, []);

  const playBeep = () => {
    try {
      if (localStorage.getItem('ddlc_scanner_sound') === 'false') return;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  const handleBarcodeLookup = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setScannedCode(trimmed);
    setLookupAttempted(true);

    const match = products.find((p) => {
      const s = (p.sku || '').toUpperCase();
      const b = (p.barcode || '').toUpperCase();
      return s === trimmed || b === trimmed;
    });

    if (match) {
      setMatchedProduct(match);
      playBeep();
    } else {
      setMatchedProduct(null);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setScannerInitializing(true);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScannerInitializing(false);
      setCameraError('Camera API is not supported in this environment.');
      return;
    }

    try {
      stopCamera();
      const reader = new BrowserMultiFormatReader();
      const deviceId = selectedCameraId || undefined;

      const constraints: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } } }
        : { video: { facingMode: 'environment' } };

      const controls = await reader.decodeFromConstraints(
        constraints,
        videoRef.current!,
        (result, error) => {
          if (result) {
            const text = result.getText();
            if (text) {
              handleBarcodeLookup(text);
            }
          }
        }
      );

      controlsRef.current = controls;
      setIsScanning(true);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (err?.name === 'NotAllowedError' || errMsg.includes('Permission denied')) {
        setCameraError('Camera access permission was denied. Please allow camera access in browser permissions or use manual/USB barcode scanning.');
      } else {
        setCameraError(`Camera initialization failed: ${errMsg}`);
      }
      setIsScanning(false);
    } finally {
      setScannerInitializing(false);
    }
  };

  const stopCamera = () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {}
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      } catch {}
    }
    setIsScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeLookup(manualCode);
    setManualCode('');
  };

  // ==========================================
  // 2. AI CO-PILOT & HARDWARE ACTIONS STATE
  // ==========================================
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<ProposedAction | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [aiActionExecuting, setAiActionExecuting] = useState(false);
  const [aiActionResult, setAiActionResult] = useState<string | null>(null);

  const sampleAiPrompts = [
    'Give detailed inventory analysis',
    'Add 5x ESP32-WROOM-32D at ₹450 from Robu',
    'Create new project Rover MK-2',
    'Give barcodes for all inventory items',
  ];

  const handleConfirmAddProduct = async (payload: any) => {
    try {
      setAiActionExecuting(true);
      const created = await addProduct(payload);
      setAiActionResult(`✨ Added "${created.name}" to Inventory! Assigned SKU: ${created.sku} (Saved to Cloud Firestore)`);
      setAiAction(null);
    } catch (err: any) {
      alert(`Failed to save product: ${err?.message || err}`);
    } finally {
      setAiActionExecuting(false);
    }
  };

  const handleConfirmCreateProject = async (payload: any) => {
    try {
      setAiActionExecuting(true);
      const created = await addProject(payload);
      setAiActionResult(`✨ Created Project "${created.name}" (${created.code}) in Cloud Firestore!`);
      setAiAction(null);
    } catch (err: any) {
      alert(`Failed to create project: ${err?.message || err}`);
    } finally {
      setAiActionExecuting(false);
    }
  };

  const handleAiSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || aiInput;
    if (!textToSend.trim() || aiLoading) return;

    setAiLoading(true);
    setAiResponse(null);
    setAiAction(null);
    setAiActionResult(null);
    setAiInput('');

    try {
      const databaseSnapshot = {
        products: products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          quantity: p.quantity,
          unit: p.unit,
          unitPrice: p.unitPrice,
          vendor: p.vendor,
          projectId: p.projectId,
          storageLocation: p.storageLocation,
        })),
        projects: projects.map((pr) => ({ id: pr.id, name: pr.name, code: pr.code })),
        purchases: purchases.map((pu) => ({
          purchaseNumber: pu.purchaseNumber,
          productName: pu.productNameSnapshot,
          sku: pu.skuSnapshot,
          invoiceTotal: pu.invoiceTotal,
        })),
        vendors: [],
        stockMovements: [],
      };

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: [],
          databaseSnapshot,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI assistant error: ${res.statusText}`);
      }

      const data = await res.json();
      let responseText = data.text || 'Response received.';

      let proposed: ProposedAction | null = null;
      const match = responseText.match(/```(?:action|json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        try {
          proposed = JSON.parse(match[1]);
        } catch {}
      }

      responseText = responseText.replace(/```(?:action|json)?[\s\S]*?```/g, '').trim();

      setAiResponse(responseText);
      setAiAction(proposed);
    } catch (err: any) {
      // Local fallback label handler if server unreachable
      const lower = textToSend.toLowerCase();
      if (lower.includes('label')) {
        const copies = 1;
        setAiResponse(
          `I've prepared the real barcode label generation for your inventory!\n\n• Matching items: ${products.length} products\n• Format: Standard Code 128 stickers\n\nClick the button below to download the real PDF or open in Label Studio.`
        );
        setAiAction({
          type: 'GENERATE_LABELS',
          summary: `Generate PDF labels for ${products.length} items`,
          payload: { copies: 1, sizeId: 'standard-50-25' },
        });
      } else {
        setAiResponse(`AI Assistant response: Ready to assist with inventory and label generation.`);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownloadLabelsPdf = async (payload: any) => {
    try {
      setGeneratingPdf(true);
      let matched: Product[] = [];
      if (payload.startSku || payload.endSku) {
        const res = filterProductsBySkuRange(products, payload.startSku || '', payload.endSku || '');
        matched = res.matchedProducts;
      } else {
        matched = [...products];
      }

      if (payload.filterProject) {
        const pLower = payload.filterProject.toLowerCase();
        matched = matched.filter((p) =>
          (p.projectId || '').toLowerCase().includes(pLower) ||
          (projects.find(pr => pr.id === p.projectId)?.name.toLowerCase().includes(pLower))
        );
      }

      if (payload.searchTerm) {
        const sLower = payload.searchTerm.toLowerCase();
        matched = matched.filter((p) =>
          p.name.toLowerCase().includes(sLower) ||
          p.sku.toLowerCase().includes(sLower) ||
          p.category.toLowerCase().includes(sLower)
        );
      }

      if (matched.length === 0) {
        alert('No matching products found in database for this label selection.');
        return;
      }

      const copies = Math.max(1, payload.copies || 1);
      const blob = await generateLabelsPdf(
        matched.map((p) => ({ product: p, copies })),
        LABEL_SIZES[0]
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ddlc_labels_${matched.length}_items.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      alert(`Label generation error: ${e?.message}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Search filter for inventory table
  const [searchTerm, setSearchTerm] = useState('');
  const filteredProducts = products.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      (p.barcode || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Header & Primary Action Bar */}
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-white font-display flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66] animate-pulse" />
            <span>DDLC AI Lab Control & Inventory Hub</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
              LIVE
            </span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            Hardware tracking • Barcode scanner • Natural-language label printing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Item Button */}
          <button
            onClick={onOpenAddItem}
            className="px-3.5 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-black font-bold font-mono text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,255,102,0.25)] cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>

          {/* Generate Labels Button */}
          <button
            onClick={() => onOpenLabels()}
            className="px-3.5 py-2 rounded-xl bg-[#141A1F] hover:bg-[#1A2229] border border-[#232F3A] text-white hover:text-[#00FF66] font-mono font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Open Code 128 label generator"
          >
            <Tag className="w-3.5 h-3.5 text-[#00FF66]" />
            <span>Generate Labels</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={onNavigateToSettings}
            className="px-3 py-2 rounded-xl bg-[#141A1F] hover:bg-[#1A2229] border border-[#232F3A] text-gray-300 hover:text-white font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Open system settings"
          >
            <Sliders className="w-3.5 h-3.5 text-gray-400" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* 2. Compact Statistics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#101418] border border-[#1C242C] rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block">
              Total Stock Valuation
            </span>
            <div className="text-base font-bold font-mono text-white mt-0.5">
              {formatINR(totalInventoryValue)}
            </div>
            <span className="text-[10px] font-mono text-gray-500">{products.length} registered SKUs</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#141F17] border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66] shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#101418] border border-[#1C242C] rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block">
              Inventory Units
            </span>
            <div className="text-base font-bold font-mono text-white mt-0.5">
              {totalStockQuantity} <span className="text-xs text-gray-400 font-normal">units</span>
            </div>
            <span className="text-[10px] font-mono text-gray-500">Physical stock count</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#121921] border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Boxes className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#101418] border border-[#1C242C] rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block">
              Active Projects
            </span>
            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
              {activeProjectsCount} <span className="text-xs text-gray-400 font-normal">/ {projects.length}</span>
            </div>
            <span className="text-[10px] font-mono text-gray-500">Beta 0, Beta 1, Beta 2</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#111C16] border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <FolderGit2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#101418] border border-[#1C242C] rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block">
              Purchases Recorded
            </span>
            <div className="text-base font-bold font-mono text-amber-300 mt-0.5">
              {formatINR(totalPurchasesValue)}
            </div>
            <span className="text-[10px] font-mono text-gray-500">{purchases.length} Purchase Orders</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#1F1912] border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Dedicated Barcode Scanner & AI Co-Pilot Split (User Core Requirement) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ========================================================= */}
        {/* PANEL A: BARCODE SCANNER                                  */}
        {/* ========================================================= */}
        <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-5 space-y-4 flex flex-col shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#1A2228]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#141C17] border border-[#00FF66]/40 flex items-center justify-center text-[#00FF66]">
                <ScanLine className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Barcode Scanner</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 font-normal">
                    CODE 128 / EAN / QR
                  </span>
                </h2>
                <p className="text-[10px] text-gray-400 font-mono">
                  Live camera scanning + USB barcode scanner hardware support
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isScanning ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-950/70 border border-red-500/40 text-red-300 font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CameraOff className="w-3.5 h-3.5" />
                  <span>Stop Scanner</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={scannerInitializing}
                  className="px-3.5 py-1.5 rounded-lg bg-[#142318] hover:bg-[#1A3021] border border-[#00FF66]/40 text-[#00FF66] font-mono font-bold text-xs flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,102,0.15)] transition-all cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{scannerInitializing ? 'Starting...' : 'Start Scanner'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Camera Viewport Area */}
          <div className="relative rounded-xl overflow-hidden bg-black/90 border border-[#1A2228] aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${isScanning ? 'block' : 'hidden'}`}
              playsInline
              muted
            />

            {/* Inactive or Error State */}
            {!isScanning && (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#141A1F] border border-[#232F3A] flex items-center justify-center text-gray-400">
                  <ScanLine className="w-6 h-6 text-[#00FF66]" />
                </div>
                <div className="text-xs font-mono text-gray-300 font-bold">
                  Camera Scanner Standby
                </div>
                <p className="text-[11px] font-mono text-gray-500 max-w-xs">
                  Click <strong className="text-[#00FF66]">Start Scanner</strong> to activate camera, or type / scan using a USB scanner below.
                </p>
              </div>
            )}

            {/* Active Scanning Reticle Overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-3/4 h-2/3 border-2 border-[#00FF66]/50 rounded-xl relative shadow-[0_0_20px_rgba(0,255,102,0.2)]">
                  {/* Glowing Laser Scan Bar */}
                  <div className="absolute left-0 right-0 h-0.5 bg-[#00FF66] shadow-[0_0_8px_#00FF66] animate-pulse top-1/2" />
                  <div className="absolute top-2 left-2 text-[9px] font-mono text-[#00FF66] bg-black/70 px-1 rounded">
                    SCANNING ACTIVE
                  </div>
                </div>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 text-xs font-mono text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Camera Selector when multiple cameras detected */}
          {cameras.length > 1 && (
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-[10px] text-gray-400 shrink-0">CAMERA:</span>
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  if (isScanning) startCamera();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#141A1F] border border-[#232F3A] text-xs text-white focus:outline-none focus:border-[#00FF66]"
              >
                {cameras.map((c, i) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Manual & USB Hardware Scanner Input */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={manualInputRef}
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Scan with USB barcode reader or type SKU (e.g. DDLC-CMP-00010)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141A1F] border border-[#232F3A] text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF66]"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-[#18231C] hover:bg-[#203025] border border-[#00FF66]/40 text-[#00FF66] font-mono font-bold text-xs cursor-pointer"
            >
              Lookup
            </button>
          </form>

          {/* Scan Result Feedback Card */}
          {lookupAttempted && (
            <div className="mt-2 pt-3 border-t border-[#1A2228]">
              {matchedProduct ? (
                <div className="p-3.5 rounded-xl bg-[#0D1812] border border-[#00FF66]/40 space-y-2.5 shadow-[0_0_15px_rgba(0,255,102,0.1)] font-mono">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#00FF66]" />
                      <span className="text-xs font-bold text-white truncate max-w-[200px]">
                        {matchedProduct.name}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#16231A] text-[#00FF66] border border-[#00FF66]/30 font-bold">
                      {matchedProduct.sku}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#090E0B] p-2 rounded-lg border border-[#16241C]">
                    <div>
                      <span className="text-gray-500 block text-[10px]">STOCK</span>
                      <span className="text-white font-bold">{matchedProduct.quantity} {matchedProduct.unit}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">UNIT COST</span>
                      <span className="text-white font-bold">{formatINR(matchedProduct.unitPrice)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">TOTAL VALUATION</span>
                      <span className="text-[#00FF66] font-bold">
                        {formatINR((matchedProduct.quantity || 0) * (matchedProduct.unitPrice || 0))}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">LOCATION</span>
                      <span className="text-gray-300 truncate">{matchedProduct.storageLocation || 'Main Lab'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onViewItemDetails(matchedProduct)}
                      className="px-3 py-1.5 rounded-lg bg-[#18231C] hover:bg-[#203126] border border-[#00FF66]/40 text-[#00FF66] text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Full Record</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 font-mono text-xs text-amber-300 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>No matching product found for code: <strong className="text-white">"{scannedCode}"</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAddItem}
                    className="px-2.5 py-1 rounded-lg bg-[#182026] hover:bg-[#222C35] text-white border border-[#2B3742] text-[11px] shrink-0 cursor-pointer"
                  >
                    Register New Item
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* PANEL B: AI LAB CO-PILOT & LABEL GENERATOR                */}
        {/* ========================================================= */}
        <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-5 space-y-4 flex flex-col shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#1A2228]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#141C17] border border-[#00FF66]/40 flex items-center justify-center text-[#00FF66]">
                <BotMessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>AI Co-Pilot & Label Generator</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 font-normal">
                    GEMINI LIVE
                  </span>
                </h2>
                <p className="text-[10px] text-gray-400 font-mono">
                  Natural language queries, SKU range filters, & instant PDF label generation
                </p>
              </div>
            </div>

            <button
              onClick={() => onOpenLabels()}
              className="px-2.5 py-1 rounded-lg bg-[#141A1F] hover:bg-[#1A2229] border border-[#232F3A] text-[#00FF66] font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Open full label studio modal"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Label Studio</span>
            </button>
          </div>

          {/* Quick AI Action Prompts */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#00FF66]" />
              Quick Co-Pilot Actions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sampleAiPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAiSend(p)}
                  disabled={aiLoading}
                  className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#141A1F] hover:bg-[#1C252E] text-gray-300 hover:text-white border border-[#222E39] transition-colors cursor-pointer disabled:opacity-50 text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* AI Result Banner (e.g. after adding product or creating project) */}
          {aiActionResult && (
            <div className="p-3 rounded-xl bg-[#0D1812] border border-[#00FF66]/50 flex items-center justify-between text-xs font-mono text-[#00FF66] shadow-[0_0_12px_rgba(0,255,102,0.15)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00FF66]" />
                <span>{aiActionResult}</span>
              </div>
              <button
                onClick={() => setAiActionResult(null)}
                className="text-gray-400 hover:text-white p-1"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* AI Response Card */}
          <div className="flex-1 min-h-[160px] bg-[#0C0F12] border border-[#182026] rounded-xl p-3.5 space-y-3 font-mono text-xs overflow-y-auto">
            {aiLoading ? (
              <div className="flex items-center gap-2 text-[#00FF66] py-8 justify-center">
                <div className="w-4 h-4 border-2 border-[#00FF66] border-t-transparent rounded-full animate-spin" />
                <span>Consulting Gemini Lab Assistant...</span>
              </div>
            ) : aiResponse ? (
              <div className="space-y-3">
                <div className="text-gray-200 leading-relaxed whitespace-pre-wrap font-sans text-xs">
                  {aiResponse}
                </div>

                {/* 1. ADD_PRODUCT ACTION CARD */}
                {aiAction && aiAction.type === 'ADD_PRODUCT' && (
                  <div className="p-3.5 rounded-xl bg-[#0D1812] border border-[#00FF66]/40 space-y-2.5 shadow-[0_0_12px_rgba(0,255,102,0.1)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#00FF66]">
                        <Plus className="w-4 h-4" />
                        <span>{aiAction.summary || 'Proposed Product Addition'}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/40 font-bold">
                        SKU: {aiAction.payload.sku || `DDLC-${String(products.length + 1).padStart(4, '0')}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono bg-[#0B0E11] p-2.5 rounded-lg border border-[#19222A]">
                      <div>
                        <span className="text-gray-500 block text-[9px]">ITEM NAME</span>
                        <span className="text-white font-medium truncate block">{aiAction.payload.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[9px]">QUANTITY</span>
                        <span className="text-white font-medium block">{aiAction.payload.quantity || 1} {aiAction.payload.unit || 'pcs'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[9px]">UNIT PRICE</span>
                        <span className="text-white font-medium block">{formatINR(aiAction.payload.unitPrice)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[9px]">TOTAL COST (0% GST)</span>
                        <span className="text-[#00FF66] font-bold block">{formatINR((Number(aiAction.payload.quantity) || 1) * (Number(aiAction.payload.unitPrice) || 0))}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleConfirmAddProduct(aiAction.payload)}
                        disabled={aiActionExecuting}
                        className="px-3.5 py-1.5 rounded-lg bg-[#00FF66] hover:bg-[#1aff75] text-black font-bold text-xs font-mono flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,102,0.2)] transition-all cursor-pointer"
                      >
                        {aiActionExecuting ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm & Save to Firestore</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setAiAction(null)}
                        className="px-3 py-1.5 rounded-lg bg-[#141A1F] hover:bg-[#1E2730] border border-[#232F3A] text-gray-400 hover:text-white text-xs font-mono transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. CREATE_PROJECT ACTION CARD */}
                {aiAction && aiAction.type === 'CREATE_PROJECT' && (
                  <div className="p-3.5 rounded-xl bg-[#0F161E] border border-cyan-500/40 space-y-2.5 shadow-[0_0_12px_rgba(6,182,212,0.1)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                        <FolderPlus className="w-4 h-4" />
                        <span>{aiAction.summary || 'Proposed Project Creation'}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                        CODE: {aiAction.payload.code || 'PROJ'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-gray-300 bg-[#0B0E11] p-2.5 rounded-lg border border-[#19222A]">
                      <div>Project Name: <strong className="text-white">{aiAction.payload.name}</strong></div>
                      <div className="text-gray-400 text-[10px] mt-0.5">{aiAction.payload.description || 'Hardware prototype tracking'}</div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleConfirmCreateProject(aiAction.payload)}
                        disabled={aiActionExecuting}
                        className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs font-mono flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.25)] transition-all cursor-pointer"
                      >
                        {aiActionExecuting ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>Creating...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm & Create Project</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setAiAction(null)}
                        className="px-3 py-1.5 rounded-lg bg-[#141A1F] hover:bg-[#1E2730] border border-[#232F3A] text-gray-400 hover:text-white text-xs font-mono transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. GENERATE_LABELS ACTION CARD */}
                {aiAction && aiAction.type === 'GENERATE_LABELS' && (
                  <div className="p-3.5 rounded-xl bg-[#0D1812] border border-[#00FF66]/40 space-y-2.5 shadow-[0_0_12px_rgba(0,255,102,0.1)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#00FF66]">
                        <Tag className="w-4 h-4" />
                        <span>{aiAction.summary || 'Code 128 Labels Ready'}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/30 font-bold">
                        PDF READY
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-400">
                      Print-ready Code 128 barcode stickers (all formatted with clean DDLC- SKUs).
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleDownloadLabelsPdf(aiAction.payload)}
                        disabled={generatingPdf}
                        className="px-3.5 py-1.5 rounded-lg bg-[#00FF66] hover:bg-[#1aff75] text-black font-bold text-xs font-mono flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,102,0.2)] transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{generatingPdf ? 'Generating PDF...' : 'Download Labels PDF'}</span>
                      </button>

                      <button
                        onClick={() => onOpenLabels(aiAction.payload)}
                        className="px-3 py-1.5 rounded-lg bg-[#141A1F] hover:bg-[#1E2730] border border-[#232F3A] text-gray-200 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#00FF66]" />
                        <span>Open in Label Studio</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. SHOW_PRODUCT_DETAILS ACTION CARD */}
                {aiAction && aiAction.type === 'SHOW_PRODUCT_DETAILS' && (
                  <div className="p-3.5 rounded-xl bg-[#141A1F] border border-[#2B3844] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>{aiAction.summary || 'Component Lookup'}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00FF66]/15 text-[#00FF66]">
                        {aiAction.payload.sku}
                      </span>
                    </div>
                    {products.find(p => p.id === aiAction.payload.productId || p.sku === aiAction.payload.sku) && (
                      <button
                        onClick={() => {
                          const p = products.find(prod => prod.id === aiAction.payload.productId || prod.sku === aiAction.payload.sku);
                          if (p) onViewItemDetails(p);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#00FF66] text-black font-bold font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Inspect Full Item Specs</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center text-gray-500 space-y-1">
                <BotMessageSquare className="w-6 h-6 text-gray-600 mb-1" />
                <span className="text-gray-300 text-xs font-medium">DDLC AI Co-Pilot Ready</span>
                <span className="text-[11px] text-gray-500 max-w-sm">
                  Ask for inventory analysis, add new parts (SKUs start with DDLC-), create projects, or generate barcode stickers.
                </span>
              </div>
            )}
          </div>

          {/* AI Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAiSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="e.g., Give analysis, Add 5 ESP32 at ₹450, Create project Rover MK-2, or Give barcodes..."
              className="flex-1 px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232F3A] text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF66]"
            />
            <button
              type="submit"
              disabled={!aiInput.trim() || aiLoading}
              className="px-3.5 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-black font-bold font-mono text-xs flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,255,102,0.2)] disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </form>
        </div>
      </div>

      {/* 4. Inventory Items Ledger Table (Clean & Compact) */}
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1A2228]">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#00FF66]" />
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Inventory Ledger & Component Records ({filteredProducts.length})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, SKU, category..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#141A1F] border border-[#232F3A] text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <button
              onClick={onOpenAddItem}
              className="px-3 py-1.5 rounded-lg bg-[#16231A] hover:bg-[#1E3023] border border-[#00FF66]/40 text-[#00FF66] font-mono font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-gray-500">
            No inventory records found. Click <strong className="text-[#00FF66]">Add Item</strong> above to register parts.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#1A2228] text-[10px] text-gray-400 uppercase tracking-wider">
                  <th className="py-2 px-2">SKU</th>
                  <th className="py-2 px-2">Product Name</th>
                  <th className="py-2 px-2">Category</th>
                  <th className="py-2 px-2 text-right">Stock</th>
                  <th className="py-2 px-2 text-right">Unit Price</th>
                  <th className="py-2 px-2 text-right">Valuation</th>
                  <th className="py-2 px-2">Location</th>
                  <th className="py-2 px-2">Project</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#161D23]">
                {filteredProducts.map((p) => {
                  const val = (p.quantity || 0) * (p.unitPrice || 0);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[#13191E] transition-colors group cursor-pointer"
                      onClick={() => onViewItemDetails(p)}
                    >
                      <td className="py-2 px-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#141C17] text-[#00FF66] border border-[#00FF66]/30 font-bold text-[11px]">
                          {p.sku}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-white font-medium max-w-[200px] truncate">
                        {p.name}
                      </td>
                      <td className="py-2 px-2 text-gray-400">{p.category}</td>
                      <td className="py-2 px-2 text-right font-bold text-white">
                        {p.quantity} <span className="text-gray-500 font-normal">{p.unit}</span>
                      </td>
                      <td className="py-2 px-2 text-right text-gray-300">
                        {formatINR(p.unitPrice)}
                      </td>
                      <td className="py-2 px-2 text-right text-[#00FF66] font-bold">
                        {formatINR(val)}
                      </td>
                      <td className="py-2 px-2 text-gray-400 truncate max-w-[120px]">
                        {p.storageLocation || 'Main Lab'}
                      </td>
                      <td className="py-2 px-2 text-emerald-400">
                        {projects.find((pr) => pr.id === p.projectId)?.name || p.projectId || 'General'}
                      </td>
                      <td className="py-2 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenLabels({ productId: p.id, startSku: p.sku, endSku: p.sku })}
                            className="p-1 rounded text-gray-400 hover:text-[#00FF66] hover:bg-[#182026] transition-colors cursor-pointer"
                            title="Generate label for this item"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onViewItemDetails(p)}
                            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#182026] transition-colors cursor-pointer"
                            title="View full record"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
