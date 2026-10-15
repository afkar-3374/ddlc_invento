import React, { useState, useMemo, useEffect } from 'react';
import {
  Tag,
  Search,
  Filter,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  Eye,
  RefreshCw,
  Layout,
  Maximize2,
  FileDown,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Hash,
  Layers,
  Settings2,
  Sliders,
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

  interface LabelStudioViewProps {
  initialProductId?: string;
  initialStartSku?: string;
  initialEndSku?: string;
  initialProjectId?: string;
}

export const LabelStudioView: React.FC<LabelStudioViewProps> = ({
  initialProductId,
  initialStartSku,
  initialEndSku,
  initialProjectId,
}) => {
  const { products, projects } = useInventory();

  // Selection state
  const [selectionMode, setSelectionMode] = useState<'range' | 'manual' | 'all'>(
    initialProductId || initialProjectId ? 'manual' : 'range'
  );
  const [startSku, setStartSku] = useState(initialStartSku || '');
  const [endSku, setEndSku] = useState(initialEndSku || '');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [projectIdFilter, setProjectIdFilter] = useState(initialProjectId || '');

  // Design state
  const [selectedSize, setSelectedSize] = useState<LabelSizeOption>(LABEL_SIZES[0]);
  const [copiesPerItem, setCopiesPerItem] = useState(1);
  const [showMetadata, setShowMetadata] = useState(true);
  const [showProject, setShowProject] = useState(true);

  // Status state
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Preview state
  const [previewPage, setPreviewPage] = useState(0);
  const itemsPerPage = 6;

  // Sync initial selection
  useEffect(() => {
    if (initialProductId) {
      setSelectedProductIds(new Set([initialProductId]));
      setSelectionMode('manual');
    }
  }, [initialProductId]);

  // Compute matched products
  const matchedProducts = useMemo(() => {
    if (selectionMode === 'all') {
      return products.filter((p) => !p.archived);
    }
    if (selectionMode === 'range') {
      if (!startSku && !endSku) return [];
      const { matchedProducts } = filterProductsBySkuRange(products, startSku, endSku);
      return matchedProducts;
    }
    // Manual selection
    let filtered = products.filter((p) => !p.archived);
    
    if (selectedProductIds.size > 0) {
      filtered = filtered.filter(p => selectedProductIds.has(p.id));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (projectIdFilter) {
      filtered = filtered.filter(p => p.projectId === projectIdFilter);
    }
    return filtered;
  }, [selectionMode, startSku, endSku, selectedProductIds, products, searchQuery, projectIdFilter]);

  // Handle PDF generation
  const handleDownloadPdf = async () => {
    if (matchedProducts.length === 0) {
      setStatusMsg({ type: 'error', text: 'No products selected for labeling.' });
      return;
    }

    setIsGenerating(true);
    setStatusMsg({ type: 'info', text: 'Generating high-resolution label sheet...' });

    try {
      const items = matchedProducts.map((p) => ({ product: p, copies: copiesPerItem }));
      const blob = await generateLabelsPdf(items, selectedSize);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DDLC_Labels_${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setStatusMsg({ type: 'success', text: `Successfully generated ${matchedProducts.length * copiesPerItem} labels.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to generate PDF.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const visibleMatched = matchedProducts.slice(previewPage * itemsPerPage, (previewPage + 1) * itemsPerPage);
  const totalPages = Math.ceil(matchedProducts.length / itemsPerPage);

  return (
    <div className="flex flex-col h-full bg-[#F5F9F6]">
      {/* Studio Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#168653] text-white flex items-center justify-center shadow-lg shadow-[#168653]/20">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#174D35] tracking-tight">Label Studio</h1>
            <p className="text-sm text-[#77857C] font-medium">Design & print industrial hardware labels</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {statusMsg && (
            <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border animate-in fade-in slide-in-from-top-2 duration-300 ${
              statusMsg.type === 'success' ? 'bg-[#E5F5E9] text-[#168653] border-[#CDE3D2]' : 
              statusMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' :
              'bg-[#F0F9F2] text-[#174D35] border-[#E6EDE7]'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {statusMsg.text}
            </div>
          )}

          <button
            onClick={handleDownloadPdf}
            disabled={isGenerating || matchedProducts.length === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#168653] hover:bg-[#126b42] text-white font-bold text-sm shadow-lg shadow-[#168653]/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isGenerating ? 'Generating...' : 'Print Labels PDF'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
        {/* Left Sidebar: Controls (4 columns) */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 scrollbar-none">
          
          {/* 1. Selection Strategy */}
          <div className="bg-white rounded-3xl border border-[#E6EDE7] p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#174D35] flex items-center gap-2 uppercase tracking-wider">
              <Filter className="w-4 h-4" />
              1. Choose Products
            </h3>

            <div className="flex p-1 bg-[#F5F9F6] rounded-2xl border border-[#E6EDE7]">
              {(['range', 'manual', 'all'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSelectionMode(mode)}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-xl capitalize transition-all cursor-pointer ${
                    selectionMode === mode ? 'bg-white text-[#168653] shadow-sm' : 'text-[#77857C] hover:text-[#174D35]'
                  }`}
                >
                  {mode === 'range' ? 'SKU Range' : mode === 'manual' ? 'Selection' : 'All Active'}
                </button>
              ))}
            </div>

            {selectionMode === 'range' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#77857C] uppercase tracking-wide px-1">From SKU</label>
                  <input
                    type="text"
                    value={startSku}
                    onChange={(e) => setStartSku(e.target.value)}
                    placeholder="DDLC-0001"
                    className="w-full bg-[#F5F9F6] border border-[#E6EDE7] rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-[#168653] focus:outline-none focus:border-[#168653] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#77857C] uppercase tracking-wide px-1">To SKU</label>
                  <input
                    type="text"
                    value={endSku}
                    onChange={(e) => setEndSku(e.target.value)}
                    placeholder="DDLC-0050"
                    className="w-full bg-[#F5F9F6] border border-[#E6EDE7] rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-[#168653] focus:outline-none focus:border-[#168653] transition-all"
                  />
                </div>
              </div>
            )}

            {selectionMode === 'manual' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#77857C] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or SKU..."
                    className="w-full bg-[#F5F9F6] border border-[#E6EDE7] rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[#168653]"
                  />
                </div>
                
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {products.filter(p => !p.archived).map(p => {
                    const isSelected = selectedProductIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          const next = new Set(selectedProductIds);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          setSelectedProductIds(next);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected ? 'bg-[#E5F5E9] border-[#CDE3D2] text-[#174D35]' : 'bg-white border-[#E6EDE7] text-[#77857C] hover:border-[#CDE3D2]'
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-mono font-bold uppercase">{p.sku}</span>
                          <span className="text-xs font-semibold truncate">{p.name}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#168653]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Format & Layout */}
          <div className="bg-white rounded-3xl border border-[#E6EDE7] p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#174D35] flex items-center gap-2 uppercase tracking-wider">
              <Layout className="w-4 h-4" />
              2. Label Format
            </h3>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#77857C] uppercase tracking-wide px-1">Dimensions</label>
                <select
                  value={selectedSize.id}
                  onChange={(e) => {
                    const found = LABEL_SIZES.find(s => s.id === e.target.value);
                    if (found) setSelectedSize(found);
                  }}
                  className="w-full bg-[#F5F9F6] border border-[#E6EDE7] rounded-xl px-3 py-2.5 text-xs text-[#25352C] focus:outline-none focus:border-[#168653]"
                >
                  {LABEL_SIZES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#77857C] uppercase tracking-wide px-1">Copies per item</label>
                  <input
                    type="number"
                    min="1"
                    value={copiesPerItem}
                    onChange={(e) => setCopiesPerItem(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-[#F5F9F6] border border-[#E6EDE7] rounded-xl px-3 py-2 text-xs font-bold text-[#174D35] focus:outline-none focus:border-[#168653]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#77857C] uppercase tracking-wide px-1">Total count</label>
                  <div className="w-full bg-[#F0F9F2] border border-[#CDE3D2] rounded-xl px-3 py-2 text-xs font-bold text-[#168653] flex items-center justify-center">
                    {matchedProducts.length * copiesPerItem} Labels
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Appearance Customization */}
          <div className="bg-white rounded-3xl border border-[#E6EDE7] p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#174D35] flex items-center gap-2 uppercase tracking-wider">
              <Settings2 className="w-4 h-4" />
              3. Visual Settings
            </h3>

            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] cursor-pointer hover:bg-[#E5F5E9] transition-colors group">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showMetadata ? 'bg-[#168653] text-white' : 'bg-white text-[#77857C]'}`}>
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-[#174D35]">Show Metadata (Loc/Qty)</span>
                </div>
                <input
                  type="checkbox"
                  checked={showMetadata}
                  onChange={(e) => setShowMetadata(e.target.checked)}
                  className="w-4 h-4 rounded text-[#168653] focus:ring-[#168653]"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] cursor-pointer hover:bg-[#E5F5E9] transition-colors group">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showProject ? 'bg-[#168653] text-white' : 'bg-white text-[#77857C]'}`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-[#174D35]">Include Project Tags</span>
                </div>
                <input
                  type="checkbox"
                  checked={showProject}
                  onChange={(e) => setShowProject(e.target.checked)}
                  className="hidden"
                />
                <div 
                  className={`w-10 h-5 rounded-full relative transition-colors ${showProject ? 'bg-[#168653]' : 'bg-[#D1D9D4]'}`}
                  onClick={() => setShowProject(!showProject)}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showProject ? 'left-6' : 'left-1'}`} />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Area: Preview (8 columns) */}
        <div className="lg:col-span-8 flex flex-col bg-white rounded-3xl border border-[#E6EDE7] shadow-xs overflow-hidden">
          {/* Preview Toolbar */}
          <div className="px-6 py-4 bg-white border-b border-[#F0F5F2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#168653]" />
              <h4 className="text-sm font-bold text-[#174D35]">Real-time Layout Preview</h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5F9F6] text-[#77857C] border border-[#E6EDE7]">
                {matchedProducts.length} Results
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
                  disabled={previewPage === 0}
                  className="p-1.5 rounded-xl border border-[#E6EDE7] text-[#77857C] hover:text-[#174D35] hover:bg-[#F5F9F6] disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-bold text-[#174D35]">
                  Page {previewPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPreviewPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={previewPage >= totalPages - 1}
                  className="p-1.5 rounded-xl border border-[#E6EDE7] text-[#77857C] hover:text-[#174D35] hover:bg-[#F5F9F6] disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Preview Grid */}
          <div className="flex-1 p-8 bg-[#F8FAF9] overflow-y-auto scrollbar-none">
            {matchedProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {visibleMatched.map((product) => (
                  <LabelPreviewCard
                    key={product.id}
                    product={product}
                    size={selectedSize}
                    showMetadata={showMetadata}
                    showProject={showProject}
                  />
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                <div className="w-20 h-20 rounded-full bg-[#E5F5E9] flex items-center justify-center text-[#168653]">
                  <Tag className="w-10 h-10" />
                </div>
                <div className="max-w-xs">
                  <h5 className="font-bold text-[#174D35]">Empty Preview</h5>
                  <p className="text-xs text-[#77857C]">Adjust your SKU range or select products from the sidebar to see the label designs.</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Summary Bar */}
          <div className="px-6 py-4 bg-[#F5F9F6] border-t border-[#E6EDE7] flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-6 text-[#77857C]">
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                Total: <strong>{matchedProducts.length * copiesPerItem} labels</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5" />
                Output: <strong>{selectedSize.widthMm}x{selectedSize.heightMm}mm</strong>
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button className="text-[#168653] font-bold hover:underline cursor-pointer flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Assets
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LabelPreviewCardProps {
  product: Product;
  size: LabelSizeOption;
  showMetadata: boolean;
  showProject: boolean;
}

const LabelPreviewCard: React.FC<LabelPreviewCardProps> = ({
  product,
  size,
  showMetadata,
  showProject,
}) => {
  const barcodeUrl = useMemo(() => {
    const val = product.barcode || product.sku;
    return generateBarcodeDataUrl(val, { width: 2, height: 40, displayValue: false });
  }, [product]);

  return (
    <div className="bg-white rounded-2xl border border-[#CDE3D2] shadow-md p-4 space-y-2.5 group relative overflow-hidden transition-all hover:scale-[1.02] active:scale-95 duration-200">
      {/* Label Brand Header */}
      <div className="flex items-center justify-between text-[9px] border-b border-[#F0F5F2] pb-1.5 font-bold tracking-widest text-[#168653]/60">
        <span>DDLC AI SYSTEM</span>
        <span className="font-mono">{product.category.toUpperCase().slice(0, 12)}</span>
      </div>

      {/* Item Title */}
      <div className="font-bold text-xs text-[#174D35] leading-tight truncate">
        {product.name}
      </div>

      {/* Barcode & SKU Section */}
      <div className="bg-[#F5F9F6]/50 rounded-xl py-2 px-1 flex flex-col items-center justify-center border border-[#E6EDE7]/50">
        <img src={barcodeUrl} alt="Barcode" className="w-full h-10 object-contain mix-blend-multiply" />
        <div className="font-mono font-bold text-[11px] text-[#25352C] tracking-[0.15em] mt-1 bg-white px-2 py-0.5 rounded-lg border border-[#E6EDE7] shadow-2xs">
          {product.sku}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[9px] text-[#77857C] pt-1.5 border-t border-[#F0F5F2]">
        <div className="flex flex-col gap-0.5">
          {showMetadata && (
            <span className="font-medium truncate max-w-[80px]">Loc: {product.storageLocation || 'Lab'}</span>
          )}
          {showProject && product.projectId && (
            <span className="font-bold text-[#168653] uppercase">{product.projectId.slice(0, 10)}</span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
             <button
              onClick={() => downloadSingleLabelPng(product, size)}
              className="p-1 rounded-lg hover:bg-[#E5F5E9] text-[#77857C] hover:text-[#168653] transition-colors cursor-pointer"
              title="Download PNG"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => downloadSingleLabelSvg(product, size)}
              className="p-1 rounded-lg hover:bg-[#E5F5E9] text-[#77857C] hover:text-[#168653] transition-colors cursor-pointer"
              title="Download SVG"
            >
              <FileDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Format Overlay */}
      <div className="absolute top-0 right-0 p-1.5">
         <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900 text-white opacity-0 group-hover:opacity-100 transition-opacity">
           {size.widthMm}x{size.heightMm}mm
         </span>
      </div>
    </div>
  );
};
