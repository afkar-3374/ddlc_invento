import React, { useMemo } from 'react';
import {
  TrendingUp,
  Boxes,
  FolderGit2,
  Receipt,
  Sparkles,
  Plus,
  ScanLine,
  Tag,
  AlertTriangle,
  ArrowRight,
  Eye,
  CheckCircle2,
  ChevronRight,
  Layers,
  Building2,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';
import { Product } from '../types';
import { AlwaysReadyScanner } from './AlwaysReadyScanner';

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
  onEditItem?: (product: Product) => void;
  onAdjustStock?: (product: Product) => void;
  onOpenAddItemWithSku?: (sku: string) => void;
  onNavigateToSettings?: () => void;
  onOpenScanner?: () => void;
  onNavigateToInventory?: () => void;
  onNavigateToProjects?: () => void;
  onOpenAiAssistant?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenAddItem,
  onOpenAiAddItem,
  onOpenLabels,
  onViewItemDetails,
  onEditItem,
  onAdjustStock,
  onOpenAddItemWithSku,
  onNavigateToSettings,
  onOpenScanner,
  onNavigateToInventory,
  onNavigateToProjects,
  onOpenAiAssistant,
}) => {
  const {
    products,
    projects,
    purchases,
    stockMovements,
    totalInventoryValue,
    totalProductsCount,
    totalStockQuantity,
    activeProjectsCount,
  } = useInventory();

  // Active (non-archived) products
  const activeProducts = useMemo(() => {
    return products.filter((p) => !p.archived);
  }, [products]);

  // Recent inventory items (latest updated or created)
  const recentProducts = useMemo(() => {
    return [...activeProducts]
      .sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 6);
  }, [activeProducts]);

  // Low stock items (quantity <= 5)
  const lowStockProducts = useMemo(() => {
    return activeProducts.filter((p) => Number(p.quantity) <= 5).slice(0, 5);
  }, [activeProducts]);

  // Project map for quick lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((pr) => map.set(pr.id, pr.name));
    return map;
  }, [projects]);

  // Project statistics (active projects with assigned components count)
  const projectStats = useMemo(() => {
    return projects.map((pr) => {
      const assigned = products.filter((p) => !p.archived && p.projectId === pr.id);
      const totalUnits = assigned.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
      const totalCost = assigned.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);
      return {
        ...pr,
        assignedCount: assigned.length,
        totalUnits,
        totalCost,
      };
    });
  }, [projects, products]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ========================================================= */}
      {/* 1. COLORFUL HERO SECTION (SUPER.MONEY-INSPIRED)             */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#B9F2D0]/55 via-[#E9DFFF]/45 to-[#DDEBFF]/55 border border-[#E6EDE7] p-5 sm:p-7 shadow-xs">
        {/* Soft background ambient glow spots */}
        <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full bg-[#B9F2D0]/40 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-[#E9DFFF]/35 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 backdrop-blur-xs border border-[#CDE3D2] text-[11px] font-bold text-[#168653] shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#168653]" />
              <span>DDLC AI LAB WORKSPACE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#174D35] tracking-tight">
              Your lab, organized <span className="inline-block animate-pulse">✨</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#465A4F] font-medium leading-relaxed">
              Every component. Every project. One place.
            </p>
          </div>

          {/* Friendly Circuit/Hardware Icon & Translucent Action Tiles */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onOpenAddItem}
              className="px-4 py-2.5 rounded-2xl bg-white/95 hover:bg-white text-[#174D35] text-xs sm:text-sm font-bold flex items-center gap-2 border border-white/80 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95 backdrop-blur-xs"
            >
              <div className="w-6 h-6 rounded-lg bg-[#E5F5E9] text-[#168653] flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span>Add Item</span>
            </button>

            <button
              onClick={onOpenAiAssistant || onOpenAiAddItem}
              className="px-4 py-2.5 rounded-2xl bg-[#168653] hover:bg-[#126b42] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm shadow-[#168653]/20 transition-all cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-[#B9F2D0]" />
              <span>Ask AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. ALWAYS-READY BARCODE SCANNER (DIRECTLY BELOW HERO)     */}
      {/* ========================================================= */}
      <AlwaysReadyScanner
        products={products}
        projects={projects}
        purchases={purchases}
        stockMovements={stockMovements}
        onViewItemDetails={onViewItemDetails}
        onEditItem={(p) => {
          if (onEditItem) onEditItem(p);
        }}
        onAdjustStock={(p) => {
          if (onAdjustStock) onAdjustStock(p);
        }}
        onOpenAddItemWithSku={(sku) => {
          if (onOpenAddItemWithSku) onOpenAddItemWithSku(sku);
          else onOpenAddItem();
        }}
        onOpenLabelsForProduct={(p) => {
          onOpenLabels({ productId: p.id, startSku: p.sku, endSku: p.sku });
        }}
      />

      {/* ========================================================= */}
      {/* 3. FOUR PASTEL STATISTIC CARDS (SUPER.MONEY-INSPIRED)     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Inventory Value (Soft Mint) */}
        <div className="bg-gradient-to-br from-white via-white to-[#B9F2D0]/20 border border-[#E6EDE7] rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider">
              Total Inventory Value
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#B9F2D0]/40 text-[#168653] flex items-center justify-center shrink-0 border border-[#B9F2D0]/60">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-[#174D35] tracking-tight">
              {formatINR(totalInventoryValue)}
            </div>
            <p className="text-[11px] text-[#77857C] mt-1 font-medium">
              Based on active stock prices
            </p>
          </div>
        </div>

        {/* Card 2: Registered Items (Soft Lavender) */}
        <div className="bg-gradient-to-br from-white via-white to-[#E9DFFF]/25 border border-[#E6EDE7] rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider">
              Registered Items
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#E9DFFF]/60 text-[#6B46C1] flex items-center justify-center shrink-0 border border-[#E9DFFF]">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-[#174D35] tracking-tight">
              {totalProductsCount}
            </div>
            <p className="text-[11px] text-[#77857C] mt-1 font-medium">
              Unique component records
            </p>
          </div>
        </div>

        {/* Card 3: Physical Stock Units (Soft Sky Blue) */}
        <div className="bg-gradient-to-br from-white via-white to-[#DDEBFF]/30 border border-[#E6EDE7] rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider">
              Physical Stock Units
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#DDEBFF]/70 text-[#2563EB] flex items-center justify-center shrink-0 border border-[#DDEBFF]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-[#174D35] tracking-tight">
              {totalStockQuantity.toLocaleString()}
            </div>
            <p className="text-[11px] text-[#77857C] mt-1 font-medium">
              Total quantity in lab bins
            </p>
          </div>
        </div>

        {/* Card 4: Active Projects (Soft Blush) */}
        <div className="bg-gradient-to-br from-white via-white to-[#FFE3EF]/30 border border-[#E6EDE7] rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider">
              Active Projects
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#FFE3EF]/70 text-[#D946EF] flex items-center justify-center shrink-0 border border-[#FFE3EF]">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-[#174D35] tracking-tight">
              {activeProjectsCount}
            </div>
            <p className="text-[11px] text-[#77857C] mt-1 font-medium">
              Prototyping & R&D projects
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. QUICK ACTIONS (SUPER.MONEY PASTEL TILES)               */}
      {/* ========================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#174D35] uppercase tracking-wider">
            Quick Actions
          </h2>
          <span className="text-[11px] text-[#77857C]">Everyday lab shortcuts</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Tile 1: ADD ITEM */}
          <button
            onClick={onOpenAddItem}
            className="group bg-white hover:bg-gradient-to-br hover:from-white hover:to-[#B9F2D0]/15 border border-[#E6EDE7] hover:border-[#168653]/30 rounded-3xl p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#B9F2D0]/40 text-[#168653] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-[#B9F2D0]/60">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base text-[#174D35] group-hover:text-[#168653] transition-colors">
                Add Item
              </div>
              <p className="text-xs text-[#77857C] mt-1 line-clamp-2">
                Add a component to inventory.
              </p>
            </div>
          </button>

          {/* Tile 2: SCAN & LOOK UP */}
          <button
            onClick={onOpenScanner}
            className="group bg-white hover:bg-gradient-to-br hover:from-white hover:to-[#DDEBFF]/15 border border-[#E6EDE7] hover:border-[#2563EB]/30 rounded-3xl p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#DDEBFF]/60 text-[#2563EB] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-[#DDEBFF]">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base text-[#174D35] group-hover:text-[#168653] transition-colors">
                Scan & Look Up
              </div>
              <p className="text-xs text-[#77857C] mt-1 line-clamp-2">
                Scan a product label and retrieve its details.
              </p>
            </div>
          </button>

          {/* Tile 3: GENERATE LABELS */}
          <button
            onClick={() => onOpenLabels()}
            className="group bg-white hover:bg-gradient-to-br hover:from-white hover:to-[#E9DFFF]/15 border border-[#E6EDE7] hover:border-[#6B46C1]/30 rounded-3xl p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#E9DFFF]/60 text-[#6B46C1] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-[#E9DFFF]">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base text-[#174D35] group-hover:text-[#168653] transition-colors">
                Generate Labels
              </div>
              <p className="text-xs text-[#77857C] mt-1 line-clamp-2">
                Create printable SKU barcode labels.
              </p>
            </div>
          </button>

          {/* Tile 4: ASK AI */}
          <button
            onClick={onOpenAiAssistant || onOpenAiAddItem}
            className="group bg-white hover:bg-gradient-to-br hover:from-white hover:to-[#FFE3EF]/15 border border-[#E6EDE7] hover:border-[#D946EF]/30 rounded-3xl p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#FFE3EF]/60 text-[#D946EF] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-[#FFE3EF]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base text-[#174D35] group-hover:text-[#168653] transition-colors">
                Ask AI
              </div>
              <p className="text-xs text-[#77857C] mt-1 line-clamp-2">
                Ask questions about inventory and purchases.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. RECENT INVENTORY & LOW STOCK                           */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width): RECENT INVENTORY TABLE */}
        <div className="lg:col-span-2 bg-white border border-[#E6EDE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6EDE7]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[#174D35]">Recent Inventory</h3>
                <p className="text-[11px] text-[#77857C]">Latest active components in your lab</p>
              </div>
            </div>

            {onNavigateToInventory && (
              <button
                onClick={onNavigateToInventory}
                className="text-xs font-semibold text-[#168653] hover:text-[#126b42] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {recentProducts.length === 0 ? (
            <div className="py-12 text-center text-[#77857C] text-xs space-y-2">
              <Boxes className="w-8 h-8 text-[#CDE3D2] mx-auto" />
              <p className="font-medium">No items registered yet.</p>
              <button
                onClick={onOpenAddItem}
                className="px-3.5 py-1.5 rounded-xl bg-[#E5F5E9] text-[#168653] font-semibold text-xs inline-flex items-center gap-1.5 hover:bg-[#d8eedd] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Item</span>
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Compact Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E6EDE7] text-[#77857C] text-[11px] uppercase tracking-wider">
                      <th className="pb-2.5 font-semibold">Product Name</th>
                      <th className="pb-2.5 font-semibold">SKU</th>
                      <th className="pb-2.5 font-semibold text-right">Quantity</th>
                      <th className="pb-2.5 font-semibold text-right">Unit Cost</th>
                      <th className="pb-2.5 font-semibold">Project</th>
                      <th className="pb-2.5 text-center font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F5F2]">
                    {recentProducts.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-[#F5F9F6] transition-colors cursor-pointer group"
                        onClick={() => onViewItemDetails(p)}
                      >
                        <td className="py-2.5 pr-2">
                          <div className="font-semibold text-[#25352C] group-hover:text-[#168653] truncate max-w-[160px]">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-[#77857C]">{p.category}</div>
                        </td>
                        <td className="py-2.5 pr-2 font-mono text-[11px] text-[#174D35] font-medium">
                          {p.sku}
                        </td>
                        <td className="py-2.5 pr-2 text-right font-semibold text-[#25352C]">
                          {p.quantity} {p.unit || 'pcs'}
                        </td>
                        <td className="py-2.5 pr-2 text-right text-[#77857C]">
                          {formatINR(p.unitPrice)}
                        </td>
                        <td className="py-2.5 pr-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F5F9F6] text-[#25352C] border border-[#E6EDE7] inline-block max-w-[120px] truncate">
                            {p.projectId ? projectMap.get(p.projectId) || 'Assigned' : 'General'}
                          </span>
                        </td>
                        <td className="py-2.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewItemDetails(p);
                            }}
                            className="p-1 rounded-lg text-[#77857C] hover:text-[#168653] hover:bg-[#E5F5E9] transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Compact Cards */}
              <div className="sm:hidden space-y-2">
                {recentProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onViewItemDetails(p)}
                    className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] flex items-center justify-between active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold text-[#174D35] truncate">{p.name}</div>
                      <div className="text-[11px] text-[#77857C] font-mono mt-0.5">{p.sku}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-[#168653]">
                        {p.quantity} {p.unit || 'pcs'}
                      </div>
                      <div className="text-[10px] text-[#77857C]">{formatINR(p.unitPrice)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right Column (1/3 width): LOW STOCK ALERTS */}
        <div className="bg-white border border-[#E6EDE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6EDE7]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[#174D35]">Low Stock</h3>
                <p className="text-[11px] text-[#77857C]">Items requiring restocking</p>
              </div>
            </div>

            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {lowStockProducts.length} Alert{lowStockProducts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="py-10 text-center text-[#77857C] text-xs space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#168653] mx-auto opacity-70" />
              <p className="font-semibold text-[#174D35]">All levels healthy!</p>
              <p className="text-[11px] text-[#77857C] max-w-xs mx-auto">
                No items are currently below 5 units.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl bg-[#FFFDF8] border border-amber-200/70 hover:border-amber-300 transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-[#174D35] truncate">{p.name}</div>
                    <div className="text-[10px] text-[#77857C] font-mono mt-0.5">{p.sku}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-semibold border border-red-200">
                        {p.quantity === 0 ? 'Out of stock' : `Only ${p.quantity} left`}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onViewItemDetails(p)}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#F5F9F6] border border-[#E6EDE7] text-[#174D35] text-[11px] font-semibold transition-colors shrink-0 cursor-pointer shadow-2xs"
                  >
                    View Item
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Small Note */}
          <div className="pt-2 border-t border-[#E6EDE7] text-[11px] text-[#77857C]">
            Trigger purchase orders directly from item details to reorder.
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 6. PROJECT OVERVIEW & ALLOCATIONS                         */}
      {/* ========================================================= */}
      <div className="bg-white border border-[#E6EDE7] rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E6EDE7]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#174D35]">
                Project Overview & Allocations
              </h3>
              <p className="text-[11px] text-[#77857C]">Active hardware prototypes & component counts</p>
            </div>
          </div>

          {onNavigateToProjects && (
            <button
              onClick={onNavigateToProjects}
              className="text-xs font-semibold text-[#168653] hover:text-[#126b42] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Manage Projects</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {projectStats.length === 0 ? (
          <div className="py-8 text-center text-[#77857C] text-xs">
            No active projects registered. Create your first project to organize components.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {projectStats.map((pr) => (
              <div
                key={pr.id}
                className="p-4 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] hover:border-[#168653]/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-[#174D35] border border-[#E6EDE7]">
                      {pr.code || 'PROJ'}
                    </span>
                    <span className="text-[11px] font-semibold text-[#168653]">
                      {pr.status || 'Active'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-[#174D35] truncate">{pr.name}</h4>
                  <p className="text-[11px] text-[#77857C] mt-0.5 line-clamp-1">
                    {pr.description || 'Hardware prototype tracking'}
                  </p>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-[#E6EDE7] flex items-center justify-between text-xs">
                  <span className="text-[#77857C] text-[11px]">Assigned:</span>
                  <span className="font-semibold text-[#174D35]">
                    {pr.assignedCount} parts ({pr.totalUnits} units)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
