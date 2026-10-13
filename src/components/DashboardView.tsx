import React from 'react';
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
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';
import { NavTab } from './Sidebar';
import { AiCommandBar } from './AiCommandBar';
import { Product, Purchase } from '../types';

interface DashboardViewProps {
  onNavigate: (tab: NavTab, initialPrompt?: string) => void;
  onOpenAddItem: () => void;
  onOpenScanner: () => void;
  onOpenLabels: () => void;
  onViewItemDetails: (product: Product) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenAddItem,
  onOpenScanner,
  onOpenLabels,
  onViewItemDetails,
}) => {
  const {
    products,
    purchases,
    projects,
    stockMovements,
    totalInventoryValue,
    totalProductsCount,
    totalStockQuantity,
    activeProjectsCount,
    totalPurchasesValue,
    dataLoading,
  } = useInventory();

  // Recent 6 purchases
  const recentPurchases = purchases.slice(0, 6);

  // Recent 6 products (sorted by creation date)
  const recentProducts = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // Recent 6 stock movements
  const recentMovements = stockMovements.slice(0, 6);

  const hasData = products.length > 0 || purchases.length > 0;

  return (
    <div className="space-y-4">
      {/* Compact Top Header & Quick Action Hub (Requirement 2) */}
      <div className="bg-[#101418] border border-[#1C242C] rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66] animate-pulse shrink-0" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide font-display flex items-center gap-2">
              DDLC AI Inventory Hub
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/20 font-normal">
                LIVE
              </span>
            </h1>
            <p className="text-[11px] text-gray-400 font-mono">
              Hardware tracking • Barcode identification • Instant label printing
            </p>
          </div>
        </div>

        {/* 4 Primary Quick Access Action Buttons (Requirement 2) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action 1: Add Item */}
          <button
            onClick={onOpenAddItem}
            className="px-3 py-1.5 rounded-lg bg-[#00FF66] hover:bg-[#1aff75] text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,255,102,0.25)] cursor-pointer active:scale-95"
            title="Create new inventory record"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>

          {/* Action 2: Scan Barcode */}
          <button
            onClick={onOpenScanner}
            className="px-3 py-1.5 rounded-lg bg-[#141A1F] hover:bg-[#1A2229] border border-[#00FF66]/40 text-[#00FF66] text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Open camera or USB barcode scanner"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>Scan Barcode</span>
          </button>

          {/* Action 3: Generate Labels */}
          <button
            onClick={onOpenLabels}
            className="px-3 py-1.5 rounded-lg bg-[#141A1F] hover:bg-[#1A2229] border border-[#242F38] text-gray-200 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Print or export Code 128 barcode stickers"
          >
            <Tag className="w-3.5 h-3.5 text-[#00FF66]" />
            <span>Generate Labels</span>
          </button>

          {/* Action 4: Ask AI */}
          <button
            onClick={() => onNavigate('assistant')}
            className="px-3 py-1.5 rounded-lg bg-[#141A1F] hover:bg-[#1A2229] border border-[#242F38] text-gray-200 hover:text-[#00FF66] text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Open Gemini AI Lab Co-Pilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00FF66]" />
            <span>Ask AI</span>
          </button>
        </div>
      </div>

      {/* Single Compact Row of Statistics on Desktop (Requirement 2) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Stock Valuation */}
        <div className="bg-[#101418] border border-[#1C242C] rounded-xl px-3.5 py-2.5 flex items-center justify-between group hover:border-[#00FF66]/40 transition-colors">
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block truncate">
              Total Valuation
            </span>
            <div className="text-lg font-bold font-mono text-white tracking-tight truncate">
              {formatINR(totalInventoryValue)}
            </div>
            <span className="text-[10px] font-mono text-gray-400">
              {totalProductsCount} Active SKUs
            </span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-[#141A1F] border border-[#202931] flex items-center justify-center text-[#00FF66] shrink-0 ml-2">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Metric 2: Total Units in Stock */}
        <div className="bg-[#101418] border border-[#1C242C] rounded-xl px-3.5 py-2.5 flex items-center justify-between group hover:border-cyan-500/40 transition-colors">
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block truncate">
              Total Inventory Units
            </span>
            <div className="text-lg font-bold font-mono text-white tracking-tight truncate">
              {totalStockQuantity}{' '}
              <span className="text-xs text-gray-400 font-normal">pcs</span>
            </div>
            <span className="text-[10px] font-mono text-gray-400">
              Across {totalProductsCount} components
            </span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-[#141A1F] border border-[#202931] flex items-center justify-center text-cyan-400 shrink-0 ml-2">
            <Boxes className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Metric 3: Active Projects */}
        <div
          onClick={() => onNavigate('projects')}
          className="bg-[#101418] border border-[#1C242C] rounded-xl px-3.5 py-2.5 flex items-center justify-between group hover:border-emerald-500/40 transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block truncate">
              Active Projects
            </span>
            <div className="text-lg font-bold font-mono text-white tracking-tight truncate">
              {activeProjectsCount}{' '}
              <span className="text-xs text-gray-400 font-normal">
                / {projects.length}
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">
              Beta 0, Beta 1, Beta 2, etc.
            </span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-[#141A1F] border border-[#202931] flex items-center justify-center text-emerald-400 shrink-0 ml-2">
            <FolderGit2 className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Metric 4: Recorded Purchase Expenditure */}
        <div
          onClick={() => onNavigate('purchases')}
          className="bg-[#101418] border border-[#1C242C] rounded-xl px-3.5 py-2.5 flex items-center justify-between group hover:border-amber-500/40 transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block truncate">
              Purchases Logged
            </span>
            <div className="text-lg font-bold font-mono text-white tracking-tight truncate">
              {formatINR(totalPurchasesValue)}
            </div>
            <span className="text-[10px] font-mono text-amber-400">
              {purchases.length} Purchase Orders
            </span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-[#141A1F] border border-[#202931] flex items-center justify-center text-amber-400 shrink-0 ml-2">
            <Receipt className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Autonomous AI Ingest & Command Center */}
      <AiCommandBar
        placeholder="Ask DDLC AI: Generate labels for Beta 2, find SKU DDLC-CMP-00012, add 10 ESP32..."
        samplePrompts={[
          'Generate barcode labels for all items in Beta 2',
          'Find product with SKU DDLC-CMP-00010',
          'Add 10x ESP32-WROOM-32D at ₹450 for Beta 3',
          'Show full details of ITEM-001',
        ]}
        onOpenFullAssistant={(prompt) => onNavigate('assistant', prompt)}
      />

      {/* Main Split Tables: Recent Activity & Recent Purchases (Compact & Readable) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Recently Added / Updated Items */}
        <div className="bg-[#101418] border border-[#1C242C] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#182026]">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#00FF66]" />
              <h2 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                Recent Inventory Items
              </h2>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-[11px] font-mono text-gray-400 hover:text-[#00FF66] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View All ({products.length})</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {recentProducts.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400 font-mono">
              No inventory records registered yet.
            </div>
          ) : (
            <div className="divide-y divide-[#171E24]">
              {recentProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onViewItemDetails(p)}
                  className="py-2 px-1.5 rounded-lg hover:bg-[#141A1F] transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151D22] text-[#00FF66] border border-[#00FF66]/20 font-bold shrink-0">
                      {p.sku}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate group-hover:text-[#00FF66] transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400 flex items-center gap-2 mt-0.5">
                        <span>{p.category}</span>
                        {p.storageLocation && <span>• Loc: {p.storageLocation}</span>}
                        {p.projectId && (
                          <span className="text-emerald-400 font-semibold">• {p.projectId}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold text-white">
                      {p.quantity} <span className="text-[10px] text-gray-400">{p.unit}</span>
                    </div>
                    <div className="text-[10px] font-mono text-gray-400">
                      {formatINR(p.unitPrice)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Recent Purchase Orders & Stock Movements */}
        <div className="bg-[#101418] border border-[#1C242C] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#182026]">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                Latest Purchase Ledger
              </h2>
            </div>
            <button
              onClick={() => onNavigate('purchases')}
              className="text-[11px] font-mono text-gray-400 hover:text-[#00FF66] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View All ({purchases.length})</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {recentPurchases.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400 font-mono">
              No purchase orders logged yet.
            </div>
          ) : (
            <div className="divide-y divide-[#171E24]">
              {recentPurchases.map((po) => (
                <div
                  key={po.id}
                  className="py-2 px-1.5 rounded-lg hover:bg-[#141A1F] transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-white">
                        {po.purchaseNumber}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#182126] text-gray-300 border border-gray-700">
                        {po.vendorNameSnapshot || 'Direct'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 truncate mt-0.5">
                      {po.quantity}x {po.productNameSnapshot}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-2">
                      <span>{po.purchaseDate}</span>
                      {po.projectNameSnapshot && (
                        <span className="text-emerald-400 font-mono">
                          • {po.projectNameSnapshot}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-xs text-[#00FF66]">
                      {formatINR(po.invoiceTotal)}
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#182126] text-gray-400 uppercase">
                      {po.paymentStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
