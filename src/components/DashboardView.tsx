import React, { useState } from 'react';
import {
  TrendingUp,
  PackageCheck,
  Boxes,
  FolderGit2,
  Receipt,
  Sparkles,
  Plus,
  ArrowUpRight,
  Database,
  Calendar,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';
import { NavTab } from './Sidebar';
import { AiCommandBar } from './AiCommandBar';

interface DashboardViewProps {
  onNavigate: (tab: NavTab, initialPrompt?: string) => void;
  onOpenAddItem: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenAddItem,
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
    totalGstRecorded,
    clearAllData,
    dataLoading,
  } = useInventory();

  const [clearing, setClearing] = useState(false);

  const handleClearDatabase = async () => {
    if (window.confirm('Wipe all existing database records to start 100% clean? This cannot be undone.')) {
      try {
        setClearing(true);
        await clearAllData();
      } catch (e) {
        console.error('Clear error:', e);
      } finally {
        setClearing(false);
      }
    }
  };

  // Recent 5 purchases
  const recentPurchases = purchases.slice(0, 5);

  // Recent 5 products
  const recentProducts = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const hasData = products.length > 0 || purchases.length > 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome with Quick Actions */}
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-5 lg:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/20">
              INSTRUMENT DASHBOARD
            </span>
            <span className="text-xs text-gray-400 font-mono">LIVE FIRESTORE ENGINE</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide font-display">
            DDLC Hardware Telemetry & Stock
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time material valuation, project allocations, and inventory movements.
          </p>
        </div>

        {/* Actions & Clear */}
        <div className="flex items-center gap-2">
          {hasData && (
            <button
              onClick={handleClearDatabase}
              disabled={clearing}
              className="px-2.5 py-1.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-900/40 text-xs font-mono transition-all shrink-0 cursor-pointer"
              title="Delete all documents from Firestore database to start completely fresh"
            >
              {clearing ? '...' : 'Reset Database'}
            </button>
          )}
        </div>
      </div>

      {/* Autonomous AI Command Center */}
      <AiCommandBar
        placeholder="Tell DDLC AI: Add 10 ESP32, create project Beta 3, log invoice from Robu..."
        samplePrompts={[
          'Add 5x ESP32-WROOM-32D at ₹450 for Beta 2',
          'Set stock of Raspberry Pi 5 to 20',
          'Create project Beta 3 - Telemetry System',
          'Record purchase of 10 sensors from Robu at ₹450',
        ]}
        onOpenFullAssistant={(prompt) => onNavigate('assistant', prompt)}
      />

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Inventory Value */}
        <div className="bg-[#101418] border border-[#1C242C] rounded-xl p-4 relative overflow-hidden group hover:border-[#00FF66]/40 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
              Total Stock Valuation
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#141B20] border border-[#212A32] flex items-center justify-center text-[#00FF66]">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {formatINR(totalInventoryValue)}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#182026] text-[11px] font-mono text-gray-400">
            <span>{totalProductsCount} ACTIVE SKUs</span>
            <span className="text-[#00FF66]">LIVE VALUE</span>
          </div>
        </div>

        {/* Metric 2: Unique Products */}
        <div className="bg-[#101418] border border-[#1C242C] rounded-xl p-4 relative overflow-hidden group hover:border-[#00FF66]/40 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
              Unique Products
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#141B20] border border-[#212A32] flex items-center justify-center text-cyan-400">
              <Boxes className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {totalProductsCount}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#182026] text-[11px] font-mono text-gray-400">
            <span>TOTAL QUANTITY:</span>
            <span className="text-gray-200 font-semibold">{totalStockQuantity} UNITS</span>
          </div>
        </div>

        {/* Metric 3: Active Projects */}
        <div className="bg-[#101418] border border-[#1C242C] rounded-xl p-4 relative overflow-hidden group hover:border-[#00FF66]/40 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
              Active Projects
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#141B20] border border-[#212A32] flex items-center justify-center text-emerald-400">
              <FolderGit2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {activeProjectsCount}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#182026] text-[11px] font-mono text-gray-400">
            <span>TOTAL PROJECTS:</span>
            <span className="text-gray-200">{projects.length}</span>
          </div>
        </div>

        {/* Metric 4: Recorded Purchase Expenditure */}
        <div className="bg-[#101418] border border-[#1C242C] rounded-xl p-4 relative overflow-hidden group hover:border-[#00FF66]/40 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
              Recorded PO Total
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#141B20] border border-[#212A32] flex items-center justify-center text-amber-400">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {formatINR(totalPurchasesValue)}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#182026] text-[11px] font-mono text-gray-400">
            <span>GST RECORDED:</span>
            <span className="text-amber-400 font-semibold">{formatINR(totalGstRecorded)}</span>
          </div>
        </div>
      </div>

      {/* Empty State when 0 records in real database */}
      {!hasData && !dataLoading && (
        <div className="bg-[#101418] border border-dashed border-[#232D36] rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#161D22] border border-[#26323B] flex items-center justify-center mx-auto text-[#00FF66]">
            <Database className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-semibold text-white">
              Cloud Firestore Database Empty
            </h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Your real Cloud Firestore database is active with 0 stored records. Add your real products, components, and purchase orders manually or use DDLC AI for instant natural language ingestion.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-2.5 pt-2">
            <button
              onClick={() => onNavigate('assistant')}
              className="px-5 py-2.5 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(0,255,102,0.3)] cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4 fill-black" />
              <span>Use DDLC AI to Ingest Inventory & Create Projects</span>
            </button>
            <button
              onClick={onOpenAddItem}
              className="text-[11px] text-gray-400 hover:text-white font-mono transition-colors"
            >
              or open manual item form
            </button>
          </div>
        </div>
      )}

      {/* Tables section: Recent Purchases & Recently Added Items */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Purchases */}
          <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182026]">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#00FF66]" />
                <h3 className="text-sm font-semibold text-white">Recent Purchase Orders</h3>
              </div>
              <button
                onClick={() => onNavigate('purchases')}
                className="text-xs font-mono text-gray-400 hover:text-[#00FF66] flex items-center gap-1 transition-colors"
              >
                <span>View All ({purchases.length})</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            {recentPurchases.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 font-mono">
                No purchase records logged yet.
              </div>
            ) : (
              <div className="space-y-2">
                {recentPurchases.map((po) => (
                  <div
                    key={po.id}
                    className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329] hover:border-[#28353F] transition-all flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-white">
                          {po.purchaseNumber}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#182126] text-gray-300 border border-gray-700">
                          {po.vendorNameSnapshot}
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
                      <div className="font-mono font-bold text-sm text-[#00FF66]">
                        {formatINR(po.invoiceTotal)}
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#182126] text-gray-400 uppercase">
                        {po.paymentStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recently Added Items */}
          <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#182026]">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Recently Added Products</h3>
              </div>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs font-mono text-gray-400 hover:text-[#00FF66] flex items-center gap-1 transition-colors"
              >
                <span>View All ({products.length})</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            {recentProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 font-mono">
                No items in inventory.
              </div>
            ) : (
              <div className="space-y-2">
                {recentProducts.map((p) => {
                  const isOutOfStock = p.quantity <= 0;
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329] hover:border-[#28353F] transition-all flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-[#00FF66] font-medium bg-[#101914] px-1.5 py-0.2 rounded border border-[#00FF66]/20">
                            {p.sku}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {p.category}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-white truncate mt-1">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          Location: {p.storageLocation || 'Main Lab'}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-semibold text-xs text-white">
                          {formatINR(p.unitPrice)}
                        </div>
                        <div className="mt-1">
                          {isOutOfStock ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800">
                              OUT OF STOCK
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-emerald-400">
                              {p.quantity} {p.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
