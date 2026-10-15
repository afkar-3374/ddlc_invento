import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Search,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Archive,
  ArchiveRestore,
  ExternalLink,
  ChevronRight,
  MapPin,
  Download,
  Check,
  ScanLine,
  Tag,
  Sparkles,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types';
import { formatINR } from '../services/dbService';
import { AiCommandBar } from './AiCommandBar';

interface InventoryViewProps {
  onOpenAddItem: () => void;
  onOpenAiAddItem: () => void;
  onEditItem: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
  onViewItemDetails: (product: Product) => void;
  onNavigateToAssistant?: (prompt: string) => void;
  onOpenLabels?: (product?: Product) => void;
  onNavigateToStudio?: (options?: { productId?: string; startSku?: string; endSku?: string }) => void;
  onOpenScanner?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  onOpenAddItem,
  onOpenAiAddItem,
  onEditItem,
  onAdjustStock,
  onViewItemDetails,
  onNavigateToAssistant,
  onOpenLabels,
  onNavigateToStudio,
  onOpenScanner,
}) => {
  const {
    products,
    projects,
    categories,
    totalPurchasesValue,
    totalProductsCount,
    totalStockQuantity,
    activeProjectsCount,
    archiveProduct,
    adjustProductStock,
    deleteProduct,
    clearAllData,
  } = useInventory();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [exportedRecently, setExportedRecently] = useState(false);

  // Export inventory to CSV
  const handleExportCSV = () => {
    const itemsToExport = filteredProducts.length > 0 ? filteredProducts : products;
    if (itemsToExport.length === 0) return;

    const headers = [
      'Item #',
      'SKU / Code',
      'Item Name',
      'Category',
      'Quantity',
      'Unit',
      'Unit Price (INR)',
      'Total Cost (INR)',
      'Project',
      'Storage Location',
      'Vendor',
      'Purchase Date',
      'Status',
      'Notes',
      'Created Date',
    ];

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/\r\n/g, ' ').replace(/[\r\n]/g, ' ');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = itemsToExport.map((p, idx) => {
      const itemNum = p.itemNumber ?? idx + 1;
      const sku = p.sku || '';
      const name = p.name || '';
      const category = p.category || 'General';
      const quantity = p.quantity ?? 0;
      const unit = p.unit || 'pcs';
      const unitPrice = Number(p.unitPrice || 0).toFixed(2);
      const totalCost = Number(p.totalCost ?? ((p.quantity || 0) * (p.unitPrice || 0))).toFixed(2);
      const project = p.projectId ? (projectMap[p.projectId] || p.projectId) : 'Unassigned';
      const location = p.storageLocation || '';
      const vendor = p.vendor || '';
      const purchaseDate = p.purchaseDate || '';
      const status = p.archived
        ? 'Archived'
        : p.quantity <= 0
        ? 'Out of Stock'
        : p.quantity <= 5
        ? 'Low Stock'
        : 'In Stock';
      const notes = p.notes || '';
      const createdDate = p.createdAt ? p.createdAt.slice(0, 10) : '';

      return [
        escapeCsv(itemNum),
        escapeCsv(sku),
        escapeCsv(name),
        escapeCsv(category),
        escapeCsv(quantity),
        escapeCsv(unit),
        escapeCsv(unitPrice),
        escapeCsv(totalCost),
        escapeCsv(project),
        escapeCsv(location),
        escapeCsv(vendor),
        escapeCsv(purchaseDate),
        escapeCsv(status),
        escapeCsv(notes),
        escapeCsv(createdDate),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `ddlc_inventory_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportedRecently(true);
    setTimeout(() => {
      setExportedRecently(false);
    }, 2500);
  };

  // Map project ID to name
  const projectMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [projects]);

  // Unique categories list
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => set.add(c.name));
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [categories, products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Archived filter
      if (showArchived) {
        if (!p.archived) return false;
      } else {
        if (p.archived) return false;
      }

      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(query);
        const matchesSku = p.sku?.toLowerCase().includes(query);
        const matchesLoc = p.storageLocation?.toLowerCase().includes(query);
        const matchesVendor = p.vendor?.toLowerCase().includes(query);
        if (!matchesName && !matchesSku && !matchesLoc && !matchesVendor) return false;
      }

      // Category
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) {
        return false;
      }

      // Project
      if (selectedProject !== 'ALL') {
        if (selectedProject === 'UNASSIGNED' && p.projectId) return false;
        if (selectedProject !== 'UNASSIGNED' && p.projectId !== selectedProject) return false;
      }

      // Stock status
      if (stockFilter === 'OUT_OF_STOCK' && p.quantity > 0) return false;
      if (stockFilter === 'LOW_STOCK' && (p.quantity <= 0 || p.quantity > 5)) return false;
      if (stockFilter === 'IN_STOCK' && p.quantity <= 0) return false;

      return true;
    });
  }, [products, showArchived, searchTerm, selectedCategory, selectedProject, stockFilter]);

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="bg-white border border-[#E6EDE7] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#174D35] tracking-tight">
              Inventory & Purchase Ledger
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2]">
              {filteredProducts.length} Items
            </span>
          </div>
          <p className="text-xs text-[#77857C] mt-1">
            Every added item is automatically numbered, calculated for total cost, and recorded as a purchase.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenAddItem}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#168653] hover:bg-[#126E43] text-white transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>

          {onOpenAiAddItem && (
            <button
              onClick={onOpenAiAddItem}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#E5F5E9] text-[#168653] hover:bg-[#D4EED9] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Ingest</span>
            </button>
          )}

          {onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#E6EDE7] bg-white text-[#25352C] hover:bg-[#F5F9F6] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Open Barcode Scanner"
            >
              <ScanLine className="w-3.5 h-3.5 text-[#168653]" />
              <span>Scan</span>
            </button>
          )}

          {(onOpenLabels || onNavigateToStudio) && (
            <button
              onClick={() => {
                if (onNavigateToStudio) {
                  onNavigateToStudio();
                } else if (onOpenLabels) {
                  onOpenLabels();
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#E6EDE7] bg-white text-[#25352C] hover:bg-[#F5F9F6] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Open Label Studio for design & print"
            >
              <Tag className="w-3.5 h-3.5 text-[#168653]" />
              <span>Studio</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            disabled={products.length === 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
              products.length === 0
                ? 'opacity-40 cursor-not-allowed bg-[#F5F9F6] text-[#77857C] border-[#E6EDE7]'
                : exportedRecently
                ? 'bg-[#E5F5E9] text-[#168653] border-[#C6E7D2]'
                : 'bg-white text-[#25352C] border-[#E6EDE7] hover:bg-[#F5F9F6]'
            }`}
          >
            {exportedRecently ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#168653]" />
                <span className="text-[#168653]">Exported!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-[#77857C]" />
                <span>Export CSV</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
              showArchived
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-white text-[#77857C] border-[#E6EDE7] hover:text-[#25352C]'
            }`}
          >
            {showArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            <span>{showArchived ? 'Archived' : 'Active'}</span>
          </button>
        </div>
      </div>

      {/* 3 Live Metric Cards: Total Cost, Items Count, Active Projects */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-[#E6EDE7] flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider flex items-center justify-between">
            <span>TOTAL PURCHASES (COST)</span>
            <span className="w-2 h-2 rounded-full bg-[#168653]" />
          </div>
          <div className="text-2xl font-bold text-[#174D35] mt-1.5">
            {formatINR(totalPurchasesValue)}
          </div>
          <div className="text-[11px] text-[#77857C] mt-1">
            Auto-calculated across all recorded purchases
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#E6EDE7] flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider">
            ITEMS IN INVENTORY
          </div>
          <div className="text-2xl font-bold text-[#174D35] mt-1.5">
            {totalProductsCount} <span className="text-sm font-normal text-[#77857C]">items</span>
          </div>
          <div className="text-[11px] text-[#77857C] mt-1">
            {totalStockQuantity} total physical units on hand
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#E6EDE7] flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider">
            ACTIVE PROJECTS
          </div>
          <div className="text-2xl font-bold text-[#174D35] mt-1.5">
            {activeProjectsCount}
          </div>
          <div className="text-[11px] text-[#77857C] mt-1">
            Live allocations and BOM tracking
          </div>
        </div>
      </div>

      {/* Omnipresent AI Command Engine */}
      <AiCommandBar
        placeholder="Tell DDLC AI: Add 10 ESP32 at ₹450, adjust stock, assign project, or archive..."
        samplePrompts={[
          'Add 5x ESP32-WROOM-32D at ₹450',
          'Add 10x STM32F401 BlackPill at ₹750',
          'Set stock of Raspberry Pi 5 to 20',
          'Archive DDLC-CMP-00001',
        ]}
        onOpenFullAssistant={onNavigateToAssistant}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E6EDE7] rounded-3xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-[#77857C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by SKU, product name, vendor, storage location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white transition-colors"
            />
          </div>

          {/* Category Dropdown */}
          <div className="w-full sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
            >
              <option value="ALL">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Project Dropdown */}
          <div className="w-full sm:w-48">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
            >
              <option value="ALL">All Projects</option>
              <option value="UNASSIGNED">Unassigned</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Stock Level Filter */}
          <div className="w-full sm:w-44">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock (&gt;0)</option>
              <option value="LOW_STOCK">Low Stock (≤5)</option>
              <option value="OUT_OF_STOCK">Out of Stock (0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products & Purchases Table */}
      <div className="bg-white border border-[#E6EDE7] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#25352C]">
            <thead className="bg-[#F0F9F2] border-b border-[#E6EDE7] text-[#174D35] text-[11px] font-semibold uppercase tracking-wider select-none">
              <tr>
                <th className="py-3 px-4 text-center w-14">#</th>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Stock Units</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right text-[#168653]">Total Cost</th>
                <th className="py-3 px-4 text-center">Purchase Ledger</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F5F2]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[#77857C] text-xs">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center mx-auto">
                        <Boxes className="w-5 h-5" />
                      </div>
                      <p className="text-[#174D35] font-semibold text-sm">
                        {products.length === 0 ? 'No items in database yet' : 'No items match your filters'}
                      </p>
                      <p className="text-[#77857C] text-xs">
                        {products.length === 0
                          ? "Type what you want to add in the AI prompt above (e.g. 'Add 5x ESP32 at ₹450') and AI will handle everything automatically."
                          : 'Try clearing your search query or changing category and project filters.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => {
                  const isOutOfStock = p.quantity <= 0;
                  const isLowStock = p.quantity > 0 && p.quantity <= 5;
                  const itemAutoNum = p.itemNumber || (idx + 1);
                  const computedTotalCost = (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0);
                  const projectName = p.projectId ? projectMap[p.projectId] || 'Project' : 'Unassigned';

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[#F5F9F6] transition-colors group"
                    >
                      {/* Automatic Sequential Number */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2]">
                          #{itemAutoNum}
                        </span>
                      </td>

                      {/* Product Name, SKU, Location */}
                      <td className="py-3.5 px-4 min-w-[190px]">
                        <div
                          onClick={() => onViewItemDetails(p)}
                          className="font-bold text-[#174D35] hover:underline cursor-pointer transition-colors"
                        >
                          {p.name}
                        </div>
                        <div className="text-[11px] text-[#77857C] mt-0.5 flex items-center gap-2">
                          <span className="font-mono font-bold text-[#168653]">{p.sku}</span>
                          {p.storageLocation && (
                            <span className="flex items-center gap-1 text-[#77857C]">
                              <MapPin className="w-2.5 h-2.5 text-[#77857C]" />
                              {p.storageLocation}
                            </span>
                          )}
                          {p.vendor && <span>• {p.vendor}</span>}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-[#77857C] whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F5F9F6] text-[#25352C] border border-[#E6EDE7]">
                          {p.category || 'General'}
                        </span>
                      </td>

                      {/* Stock Level with Direct +/- Buttons */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 bg-[#F5F9F6] border border-[#E6EDE7] p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (p.quantity > 0) {
                                adjustProductStock(p.id, p.quantity - 1, 'Quick stock decrement (-1)');
                              }
                            }}
                            disabled={p.quantity <= 0}
                            title="Decrement stock (-1)"
                            className="w-6 h-6 rounded-lg bg-white border border-[#E6EDE7] hover:bg-[#E5F5E9] disabled:opacity-30 disabled:cursor-not-allowed text-[#25352C] flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                          >
                            -
                          </button>

                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdjustStock(p);
                            }}
                            title="Click to set exact count"
                            className="px-2 py-0.5 rounded-md text-xs font-bold cursor-pointer hover:underline"
                            style={{
                              color: isOutOfStock
                                ? '#dc2626'
                                : isLowStock
                                ? '#d97706'
                                : '#168653',
                            }}
                          >
                            {p.quantity} <span className="text-[10px] text-[#77857C] font-normal">{p.unit}</span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustProductStock(p.id, p.quantity + 1, 'Quick stock increment (+1)');
                            }}
                            title="Increment stock (+1)"
                            className="w-6 h-6 rounded-lg bg-white border border-[#E6EDE7] hover:bg-[#E5F5E9] text-[#25352C] hover:text-[#168653] flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Unit Price (No GST) */}
                      <td className="py-3.5 px-4 text-right text-[#77857C] whitespace-nowrap font-medium">
                        {formatINR(p.unitPrice)}
                      </td>

                      {/* Total Cost (Strictly Qty * Unit Price) */}
                      <td className="py-3.5 px-4 text-right font-bold text-[#168653] whitespace-nowrap text-xs">
                        {formatINR(computedTotalCost)}
                      </td>

                      {/* Purchase Ledger Record (Marked as Purchase) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#168653]" />
                          <span>PO-#{itemAutoNum} • Paid</span>
                        </span>
                      </td>

                      {/* Project */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {p.projectId ? (
                          <span className="text-[#174D35] font-semibold">
                            {projectName}
                          </span>
                        ) : (
                          <span className="text-[#77857C]">General</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {onOpenLabels && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenLabels(p);
                              }}
                              className="p-1.5 rounded-lg text-[#77857C] hover:text-[#168653] hover:bg-[#E5F5E9] transition-colors cursor-pointer"
                              title="Print barcode label for this SKU"
                            >
                              <Tag className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveProduct(p.id, p.archived);
                            }}
                            className="p-1.5 rounded-lg text-[#77857C] hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                            title={p.archived ? 'Restore item' : 'Archive item'}
                          >
                            {p.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProduct(p.id);
                            }}
                            className="p-1.5 rounded-lg text-[#77857C] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewItemDetails(p);
                            }}
                            className="px-2 py-1 rounded-lg text-[#77857C] hover:text-[#174D35] hover:bg-[#E5F5E9] transition-all flex items-center gap-1 text-xs cursor-pointer font-semibold"
                            title="Inspect item details"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
