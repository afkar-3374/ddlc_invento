import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Tag,
  Printer,
  Download,
  Search,
  Check,
  AlertTriangle,
  Layers,
  FileText,
  Sliders,
  Image,
  FolderGit2,
  CheckSquare,
  Square,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types';
import {
  LABEL_SIZES,
  LabelSizeOption,
  generateBarcodeDataUrl,
  downloadSingleLabelPng,
  downloadSingleLabelSvg,
  generateLabelsPdf,
  filterProductsBySkuRange,
} from '../services/labelService';

interface GenerateLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
  initialStartSku?: string;
  initialEndSku?: string;
  initialProjectId?: string;
}

export const GenerateLabelsModal: React.FC<GenerateLabelsModalProps> = ({
  isOpen,
  onClose,
  initialProductId,
  initialStartSku,
  initialEndSku,
  initialProjectId,
}) => {
  const { products, projects } = useInventory();

  // Mode: 'range' or 'select'
  const [mode, setMode] = useState<'range' | 'select'>('range');

  // Range inputs
  const [startSku, setStartSku] = useState(initialStartSku || '');
  const [endSku, setEndSku] = useState(initialEndSku || '');

  // Filter inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState(initialProjectId || '');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Generation options
  const [copiesPerItem, setCopiesPerItem] = useState(1);
  const [selectedSize, setSelectedSize] = useState<LabelSizeOption>(LABEL_SIZES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Preview index
  const [previewIndex, setPreviewIndex] = useState(0);

  // Sync initial product if passed
  useEffect(() => {
    if (initialProductId) {
      setSelectedProductIds(new Set([initialProductId]));
      const p = products.find((prod) => prod.id === initialProductId);
      if (p) {
        setStartSku(p.sku);
        setEndSku(p.sku);
      }
    }
    if (initialStartSku) setStartSku(initialStartSku);
    if (initialEndSku) setEndSku(initialEndSku);
    if (initialProjectId) setFilterProject(initialProjectId);
  }, [initialProductId, initialStartSku, initialEndSku, initialProjectId, products]);

  // Compute products to label based on mode
  const { matchedProducts, missingSkus } = useMemo(() => {
    if (mode === 'range') {
      if (!startSku.trim() && !endSku.trim()) {
        return { matchedProducts: [], missingSkus: [] };
      }
      return filterProductsBySkuRange(products, startSku, endSku);
    } else {
      // Manual selection mode
      const list = products.filter((p) => selectedProductIds.has(p.id));
      return { matchedProducts: list, missingSkus: [] };
    }
  }, [mode, startSku, endSku, products, selectedProductIds]);

  // Filtered available products for selection mode
  const selectableProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.archived) return false;
      if (filterProject && p.projectId !== filterProject) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, filterProject, searchQuery]);

  // Toggle single product selection
  const toggleProductSelect = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProductIds(next);
  };

  // Select all / Deselect all selectable
  const handleSelectAll = () => {
    if (selectedProductIds.size === selectableProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(selectableProducts.map((p) => p.id)));
    }
  };

  // Preview item
  const currentPreviewProduct =
    matchedProducts.length > 0
      ? matchedProducts[Math.min(previewIndex, matchedProducts.length - 1)]
      : null;

  // Barcode data url for preview
  const previewBarcodeUrl = useMemo(() => {
    if (!currentPreviewProduct) return '';
    const code = currentPreviewProduct.barcode || currentPreviewProduct.sku;
    return generateBarcodeDataUrl(code, { width: 2, height: 40, displayValue: false });
  }, [currentPreviewProduct]);

  // Total label count
  const totalLabelsCount = matchedProducts.length * Math.max(1, copiesPerItem);

  // Download PDF Handler
  const handleDownloadPdf = async () => {
    if (matchedProducts.length === 0) return;
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const items = matchedProducts.map((p) => ({
        product: p,
        copies: copiesPerItem,
      }));

      const blob = await generateLabelsPdf(items, selectedSize);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName =
        mode === 'range' && startSku
          ? `ddlc_labels_${startSku}_to_${endSku || startSku}.pdf`
          : `ddlc_labels_batch_${matchedProducts.length}_items.pdf`;
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setGenerationError(err.message || 'Failed to generate PDF labels.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#E6EDE7] rounded-3xl w-full max-w-4xl p-5 sm:p-6 shadow-2xl relative my-6 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#F0F5F2] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                DDLC Label Studio
              </span>
              <span className="text-xs text-[#77857C]">Code 128 Vector Barcodes</span>
            </div>
            <h3 className="text-lg font-bold text-[#174D35] tracking-tight">
              Generate Barcode & SKU Labels
            </h3>
            <p className="text-xs text-[#77857C] mt-0.5">
              Printable industrial stickers with Code 128 barcodes, product name, and permanent DDLC- SKU.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#77857C] hover:text-[#25352C] hover:bg-[#F5F9F6] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split into Setup on Left (60%) and Live Preview on Right (40%) */}
        <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 text-xs">
          {/* Left: Configuration Form (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Mode Tabs */}
            <div className="flex items-center gap-2 p-1 bg-[#F5F9F6] rounded-2xl border border-[#E6EDE7]">
              <button
                onClick={() => setMode('range')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'range'
                    ? 'bg-[#168653] text-white shadow-xs'
                    : 'text-[#77857C] hover:text-[#25352C]'
                }`}
              >
                1. SKU Range Batch
              </button>
              <button
                onClick={() => setMode('select')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'select'
                    ? 'bg-[#168653] text-white shadow-xs'
                    : 'text-[#77857C] hover:text-[#25352C]'
                }`}
              >
                2. Product Selection ({selectedProductIds.size})
              </button>
            </div>

            {/* Mode 1: SKU Range Inputs */}
            {mode === 'range' && (
              <div className="bg-[#F5F9F6] border border-[#E6EDE7] rounded-2xl p-4 space-y-3">
                <div className="text-xs text-[#174D35] font-bold flex items-center justify-between">
                  <span>SPECIFY SKU INTERVAL</span>
                  <span className="text-[11px] text-[#77857C] font-normal">e.g. DDLC-0001 to DDLC-0010</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                      Starting SKU
                    </label>
                    <input
                      type="text"
                      value={startSku}
                      onChange={(e) => setStartSku(e.target.value)}
                      placeholder="e.g. DDLC-0001"
                      className="w-full bg-white border border-[#E6EDE7] focus:border-[#168653] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#168653] placeholder-[#77857C] focus:outline-hidden transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                      Ending SKU
                    </label>
                    <input
                      type="text"
                      value={endSku}
                      onChange={(e) => setEndSku(e.target.value)}
                      placeholder="e.g. DDLC-0015"
                      className="w-full bg-white border border-[#E6EDE7] focus:border-[#168653] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#168653] placeholder-[#77857C] focus:outline-hidden transition-all"
                    />
                  </div>
                </div>

                {/* Quick Autofill Buttons from Existing Range */}
                {products.length > 0 && (
                  <div className="pt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[#77857C]">Quick ranges:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const sorted = [...products].sort((a, b) => a.sku.localeCompare(b.sku));
                        setStartSku(sorted[0].sku);
                        setEndSku(sorted[Math.min(sorted.length - 1, 9)].sku);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white text-[#174D35] hover:bg-[#E5F5E9] border border-[#E6EDE7] transition-colors cursor-pointer font-medium"
                    >
                      First 10 SKUs
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const sorted = [...products].sort((a, b) => a.sku.localeCompare(b.sku));
                        setStartSku(sorted[0].sku);
                        setEndSku(sorted[sorted.length - 1].sku);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white text-[#174D35] hover:bg-[#E5F5E9] border border-[#E6EDE7] transition-colors cursor-pointer font-medium"
                    >
                      All ({products.length} SKUs)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Multi-product selection */}
            {mode === 'select' && (
              <div className="bg-[#F5F9F6] border border-[#E6EDE7] rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-[#77857C] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, SKU, or category..."
                      className="w-full bg-white border border-[#E6EDE7] focus:border-[#168653] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#25352C] placeholder-[#77857C] focus:outline-hidden"
                    />
                  </div>

                  {/* Project filter */}
                  <select
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                    className="bg-white border border-[#E6EDE7] text-xs text-[#25352C] rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-[#168653]"
                  >
                    <option value="">All Projects</option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#77857C] pt-1">
                  <span>Available: {selectableProducts.length} items • Selected: {selectedProductIds.size}</span>
                  <div className="flex items-center gap-2">
                    {selectedProductIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedProductIds(new Set())}
                        className="text-red-600 hover:underline cursor-pointer"
                      >
                        Clear Selected ({selectedProductIds.size})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[#168653] font-semibold hover:underline cursor-pointer"
                    >
                      {selectedProductIds.size === selectableProducts.length
                        ? 'Deselect All'
                        : 'Select All Filtered'}
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {selectableProducts.map((p) => {
                    const isSelected = selectedProductIds.has(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleProductSelect(p.id)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#E5F5E9] border-[#C6E7D2] text-[#174D35]'
                            : 'bg-white border-[#E6EDE7] text-[#25352C] hover:border-[#C6E7D2]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#168653] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-[#77857C] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-[11px] text-[#168653] mr-2">
                              {p.sku}
                            </span>
                            <span className="font-semibold truncate">{p.name}</span>
                          </div>
                        </div>

                        <span className="text-[10px] text-[#77857C] shrink-0">
                          Qty: {p.quantity} {p.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Label Dimensions & Copies Configuration */}
            <div className="bg-[#F5F9F6] border border-[#E6EDE7] rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Size Selector */}
                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    Label Size & Format
                  </label>
                  <select
                    value={selectedSize.id}
                    onChange={(e) => {
                      const found = LABEL_SIZES.find((s) => s.id === e.target.value);
                      if (found) setSelectedSize(found);
                    }}
                    className="w-full bg-white border border-[#E6EDE7] focus:border-[#168653] rounded-xl px-3 py-2 text-xs text-[#25352C] focus:outline-hidden"
                  >
                    {LABEL_SIZES.map((sz) => (
                      <option key={sz.id} value={sz.id}>
                        {sz.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#77857C] mt-1">{selectedSize.description}</p>
                </div>

                {/* Copies Per Item */}
                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    Copies Per Product
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={copiesPerItem}
                      onChange={(e) => setCopiesPerItem(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-white border border-[#E6EDE7] focus:border-[#168653] rounded-xl px-3 py-2 text-xs font-bold text-[#25352C] focus:outline-hidden"
                    />
                    <div className="flex gap-1 shrink-0">
                      {[1, 2, 5].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setCopiesPerItem(qty)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            copiesPerItem === qty
                              ? 'bg-[#168653] border-[#168653] text-white'
                              : 'bg-white border-[#E6EDE7] text-[#25352C] hover:bg-[#F5F9F6]'
                          }`}
                        >
                          {qty}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Results / Missing SKU summary */}
            <div className="bg-[#F5F9F6] border border-[#E6EDE7] rounded-2xl p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#25352C]">
                  Matched Products: <strong className="text-[#174D35]">{matchedProducts.length}</strong>
                </span>
                <span className="text-[#168653] font-bold">
                  Total Labels: <strong>{totalLabelsCount}</strong>
                </span>
              </div>

              {missingSkus.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Missing SKUs in Firestore range ({missingSkus.length} omitted):</span>
                  </div>
                  <div className="max-h-16 overflow-y-auto leading-relaxed text-amber-700 break-words font-mono">
                    {missingSkus.join(', ')}
                  </div>
                </div>
              )}

              {matchedProducts.length === 0 && (
                <div className="text-[#77857C] text-[11px]">
                  {mode === 'range'
                    ? 'Enter a valid starting and ending SKU above to pull matching inventory records.'
                    : 'Select one or more products above to generate barcode labels.'}
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Label Preview (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs text-[#174D35] font-bold">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#168653]" />
                Live Label Print Preview
              </span>
              {matchedProducts.length > 1 && (
                <span className="text-[11px] text-[#77857C] font-normal">
                  {previewIndex + 1} of {matchedProducts.length}
                </span>
              )}
            </div>

            {/* Visual Label Mockup Card */}
            <div className="flex-1 min-h-[260px] bg-[#F5F9F6] border border-[#E6EDE7] rounded-2xl p-4 flex flex-col items-center justify-center relative shadow-inner">
              {currentPreviewProduct ? (
                <div className="w-full max-w-[280px] bg-white text-black rounded-xl p-3.5 shadow-md border border-[#E6EDE7] space-y-1.5 select-none font-sans">
                  {/* Label Header */}
                  <div className="flex items-center justify-between text-[10px] border-b border-gray-100 pb-1">
                    <span className="font-bold tracking-wider text-[#168653]">DDLC AI</span>
                    <span className="text-gray-500 font-mono text-[9px] truncate max-w-[120px]">
                      {currentPreviewProduct.projectId || currentPreviewProduct.category}
                    </span>
                  </div>

                  {/* Product Title */}
                  <div className="font-bold text-xs text-gray-900 leading-tight truncate">
                    {currentPreviewProduct.name}
                  </div>

                  {/* Barcode Render */}
                  <div className="py-1 flex flex-col items-center">
                    {previewBarcodeUrl ? (
                      <img
                        src={previewBarcodeUrl}
                        alt="Barcode"
                        className="w-full h-11 object-contain"
                      />
                    ) : (
                      <div className="h-11 flex items-center justify-center text-xs text-gray-400 font-mono">
                        [Barcode Code 128]
                      </div>
                    )}
                    {/* SKU Text */}
                    <div className="font-mono font-bold text-xs text-black tracking-wider text-center mt-0.5">
                      {currentPreviewProduct.sku}
                    </div>
                  </div>

                  {/* Footer metadata */}
                  <div className="text-[9px] text-gray-500 flex items-center justify-between pt-1 border-t border-gray-100 font-mono">
                    <span>Loc: {currentPreviewProduct.storageLocation || 'Main Lab'}</span>
                    <span>Qty: {currentPreviewProduct.quantity} {currentPreviewProduct.unit}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 space-y-2 text-[#77857C] text-xs">
                  <Tag className="w-8 h-8 mx-auto text-[#168653] opacity-40" />
                  <p>No product selected for preview</p>
                </div>
              )}

              {/* Navigation Arrows for multi-item preview */}
              {matchedProducts.length > 1 && (
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                    disabled={previewIndex === 0}
                    className="px-2.5 py-1 rounded-lg bg-white text-xs font-semibold text-[#25352C] disabled:opacity-30 border border-[#E6EDE7] shadow-2xs hover:bg-[#E5F5E9] cursor-pointer"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() =>
                      setPreviewIndex((prev) => Math.min(matchedProducts.length - 1, prev + 1))
                    }
                    disabled={previewIndex >= matchedProducts.length - 1}
                    className="px-2.5 py-1 rounded-lg bg-white text-xs font-semibold text-[#25352C] disabled:opacity-30 border border-[#E6EDE7] shadow-2xs hover:bg-[#E5F5E9] cursor-pointer"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>

            {/* Single Item Quick Formats (PNG / SVG) */}
            {currentPreviewProduct && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs">
                <span className="text-[#77857C] text-[10px] font-semibold uppercase">CURRENT LABEL:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadSingleLabelPng(currentPreviewProduct, selectedSize)}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-[#E5F5E9] text-[#174D35] text-xs font-semibold border border-[#E6EDE7] transition-colors cursor-pointer"
                    title="Download active preview as PNG image"
                  >
                    PNG
                  </button>
                  <button
                    onClick={() => downloadSingleLabelSvg(currentPreviewProduct, selectedSize)}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-[#E5F5E9] text-[#174D35] text-xs font-semibold border border-[#E6EDE7] transition-colors cursor-pointer"
                    title="Download active preview as Vector SVG"
                  >
                    SVG
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with Download actions */}
        <div className="pt-4 border-t border-[#F0F5F2] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#77857C]">
            {generationError && <span className="text-red-600 mr-2">{generationError}</span>}
            <span>Print ready: 300 DPI high-contrast vector symbols</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#F5F9F6] hover:bg-[#E5F5E9] border border-[#E6EDE7] text-xs font-semibold text-[#77857C] hover:text-[#25352C] transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={matchedProducts.length === 0 || isGenerating}
              className="px-5 py-2.5 rounded-xl bg-[#168653] hover:bg-[#126E43] disabled:opacity-40 disabled:hover:bg-[#168653] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                {isGenerating
                  ? 'Generating PDF...'
                  : `Download PDF (${totalLabelsCount} ${totalLabelsCount === 1 ? 'Label' : 'Labels'})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
