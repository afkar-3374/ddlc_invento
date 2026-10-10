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
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  onOpenAddItem,
  onOpenAiAddItem,
  onEditItem,
  onAdjustStock,
  onViewItemDetails,
  onNavigateToAssistant,
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
    <div className="space-y-5">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide font-display flex items-center gap-2">
            <span>Items & Purchases</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-[#161F18] text-[#00FF66] border border-[#00FF66]/30">
              {filteredProducts.length} Items
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Every added item is automatically numbered, calculated for total cost, and recorded as a purchase. AI handles all operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddItem}
            className="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-[#00FF66] text-black hover:bg-[#1aff75] transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(0,255,102,0.25)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
              showArchived
                ? 'bg-amber-950/40 text-amber-400 border-amber-600/40'
                : 'bg-[#12161A] text-gray-400 border-[#222B33] hover:text-white'
            }`}
          >
            {showArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            <span>{showArchived ? 'Archived' : 'Active Items'}</span>
          </button>

          {products.length > 0 && (
            <button
              onClick={() => {
                clearAllData();
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-mono text-gray-400 border border-[#222B33] bg-[#12161A] hover:text-red-400 hover:border-red-900/40 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Clear all records to start completely clean"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Live Metric Cards: Total Cost, Items Count, Active Projects */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[#0D1216] border border-[#1C262F] flex flex-col justify-between shadow-lg">
          <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <span>TOTAL PURCHASES (COST)</span>
            <span className="w-2 h-2 rounded-full bg-[#00FF66] neon-dot" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#00FF66] mt-1.5">
            {formatINR(totalPurchasesValue)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            Auto-calculated across all recorded purchases
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1216] border border-[#1C262F] flex flex-col justify-between shadow-lg">
          <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
            ITEMS IN INVENTORY
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1.5">
            {totalProductsCount} <span className="text-sm font-normal text-gray-400">items</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {totalStockQuantity} total physical units on hand
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1216] border border-[#1C262F] flex flex-col justify-between shadow-lg">
          <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
            ACTIVE PROJECTS
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1.5">
            {activeProjectsCount}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
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
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by SKU, product name, vendor, storage location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF66] transition-colors font-sans"
            />
          </div>

          {/* Category Dropdown */}
          <div className="w-full sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-gray-200 focus:outline-none focus:border-[#00FF66] font-mono"
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
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-gray-200 focus:outline-none focus:border-[#00FF66] font-mono"
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
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-gray-200 focus:outline-none focus:border-[#00FF66] font-mono"
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
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0C0F12] border-b border-[#1A2228] text-gray-400 font-mono text-[11px] uppercase tracking-wider select-none">
              <tr>
                <th className="py-3 px-4 text-center w-14">#</th>
                <th className="py-3 px-4">Item & Code</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Stock Units</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right text-[#00FF66]">Total Cost</th>
                <th className="py-3 px-4 text-center">Purchase Ledger</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#182026]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400 font-mono text-xs">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-[#121E16] text-[#00FF66] border border-[#00FF66]/30 flex items-center justify-center mx-auto">
                        <Boxes className="w-5 h-5" />
                      </div>
                      <p className="text-white font-medium text-sm">
                        {products.length === 0 ? 'No items in database yet' : 'No items match your filters'}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {products.length === 0
                          ? "Type what you want to add in the AI prompt above (e.g. 'Add 5x ESP32 at ₹450' or 'Add 2 Raspberry Pi at ₹8000') and AI will handle everything automatically."
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
                      className="hover:bg-[#13191E] transition-colors group"
                    >
                      {/* Automatic Sequential Number */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-[#122216] border border-[#00FF66]/40 text-[#00FF66] shadow-[0_0_8px_rgba(0,255,102,0.15)]">
                          #{itemAutoNum}
                        </span>
                      </td>

                      {/* Product Name, SKU, Location */}
                      <td className="py-3.5 px-4 min-w-[190px]">
                        <div
                          onClick={() => onViewItemDetails(p)}
                          className="font-medium text-white hover:text-[#00FF66] cursor-pointer transition-colors"
                        >
                          {p.name}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-2">
                          <span className="text-[#00FF66]/80">{p.sku}</span>
                          {p.storageLocation && (
                            <span className="flex items-center gap-1 text-gray-300">
                              <MapPin className="w-2.5 h-2.5 text-gray-400" />
                              {p.storageLocation}
                            </span>
                          )}
                          {p.vendor && <span>• {p.vendor}</span>}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 font-mono text-gray-300 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-[#151D22] text-gray-300 border border-[#212B33]">
                          {p.category || 'General'}
                        </span>
                      </td>

                      {/* Stock Level with Direct +/- Buttons */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 bg-[#141A1F] border border-[#232D35] p-1 rounded-xl">
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
                            className="w-6 h-6 rounded-lg bg-[#101418] hover:bg-[#1D252C] disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:text-white flex items-center justify-center font-bold text-xs font-mono transition-colors cursor-pointer"
                          >
                            -
                          </button>

                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdjustStock(p);
                            }}
                            title="Click to set exact count"
                            className="px-2 py-0.5 rounded-md font-mono text-xs font-bold cursor-pointer hover:underline"
                            style={{
                              color: isOutOfStock
                                ? '#fca5a5'
                                : isLowStock
                                ? '#fde68a'
                                : '#34d399',
                            }}
                          >
                            {p.quantity} <span className="text-[10px] opacity-75 font-normal">{p.unit}</span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustProductStock(p.id, p.quantity + 1, 'Quick stock increment (+1)');
                            }}
                            title="Increment stock (+1)"
                            className="w-6 h-6 rounded-lg bg-[#101418] hover:bg-[#1D252C] text-gray-300 hover:text-[#00FF66] flex items-center justify-center font-bold text-xs font-mono transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Unit Price (No GST) */}
                      <td className="py-3.5 px-4 text-right font-mono text-white whitespace-nowrap">
                        {formatINR(p.unitPrice)}
                      </td>

                      {/* Total Cost (Strictly Qty * Unit Price) */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#00FF66] whitespace-nowrap text-xs">
                        {formatINR(computedTotalCost)}
                      </td>

                      {/* Purchase Ledger Record (Marked as Purchase) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-950/50 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>PO-#{itemAutoNum} • Paid</span>
                        </span>
                      </td>

                      {/* Project */}
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        {p.projectId ? (
                          <span className="text-emerald-400 font-medium">
                            {projectName}
                          </span>
                        ) : (
                          <span className="text-gray-400">General</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveProduct(p.id, p.archived);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-[#1F1A14] transition-colors cursor-pointer"
                            title={p.archived ? 'Restore item' : 'Archive item'}
                          >
                            {p.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProduct(p.id);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewItemDetails(p);
                            }}
                            className="px-2 py-1 rounded-lg text-gray-400 hover:text-[#00FF66] hover:bg-[#15201A] transition-all flex items-center gap-1 text-xs font-mono cursor-pointer"
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
