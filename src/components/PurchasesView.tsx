import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Building2,
  FolderGit2,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Purchase } from '../types';
import { formatINR } from '../services/dbService';
import { AiCommandBar } from './AiCommandBar';

interface PurchasesViewProps {
  onOpenAddPurchase: () => void;
  onNavigateToAssistant?: (prompt: string) => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  onOpenAddPurchase,
  onNavigateToAssistant,
}) => {
  const { purchases, vendors, projects, totalPurchasesValue, totalGstRecorded } = useInventory();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Paid' | 'Partially Paid' | 'Unpaid'>('ALL');

  const filteredPurchases = useMemo(() => {
    return purchases.filter((po) => {
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesPoNum = po.purchaseNumber.toLowerCase().includes(query);
        const matchesInvNum = po.invoiceNumber.toLowerCase().includes(query);
        const matchesProduct = po.productNameSnapshot.toLowerCase().includes(query);
        const matchesSku = po.skuSnapshot.toLowerCase().includes(query);
        const matchesVendor = po.vendorNameSnapshot.toLowerCase().includes(query);
        if (!matchesPoNum && !matchesInvNum && !matchesProduct && !matchesSku && !matchesVendor) return false;
      }

      // Vendor
      if (selectedVendor !== 'ALL' && po.vendorNameSnapshot !== selectedVendor) {
        return false;
      }

      // Project
      if (selectedProject !== 'ALL') {
        if (selectedProject === 'UNASSIGNED' && po.projectId) return false;
        if (selectedProject !== 'UNASSIGNED' && po.projectId !== selectedProject) return false;
      }

      // Payment Status
      if (statusFilter !== 'ALL' && po.paymentStatus !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [purchases, searchTerm, selectedVendor, selectedProject, statusFilter]);

  const uniqueVendors = useMemo(() => {
    const set = new Set<string>();
    purchases.forEach((p) => {
      if (p.vendorNameSnapshot) set.add(p.vendorNameSnapshot);
    });
    return Array.from(set);
  }, [purchases]);

  const paymentStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-600/40 text-[10px] font-mono">
            PAID
          </span>
        );
      case 'Partially Paid':
        return (
          <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-600/40 text-[10px] font-mono">
            PARTIAL
          </span>
        );
      case 'Unpaid':
        return (
          <span className="px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-600/40 text-[10px] font-mono">
            UNPAID
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 text-[10px] font-mono">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide font-display flex items-center gap-2">
            <span>Purchase Orders & Invoices</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-[#161F18] text-[#00FF66] border border-[#00FF66]/30">
              {filteredPurchases.length} Records
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Immutable procurement ledger with verified GST calculations and atomic stock increments.
          </p>
        </div>

        <button
          onClick={onOpenAddPurchase}
          className="px-3.5 py-1.5 rounded-xl bg-[#131E17] hover:bg-[#18281E] border border-[#00FF66]/40 text-[#00FF66] font-mono text-xs font-medium flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,255,102,0.15)] self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Manual Entry Form</span>
        </button>
      </div>

      {/* Omnipresent AI Command Engine for Purchases */}
      <AiCommandBar
        placeholder="Tell DDLC AI: Add item, record purchase, or inspect purchase ledger..."
        samplePrompts={[
          'Add 5x ESP32-WROOM-32D at ₹450',
          'Record purchase of 5 Raspberry Pi 5 for Beta 2',
          'Log invoice INV-904 from Robu for ₹4,500',
        ]}
        onOpenFullAssistant={onNavigateToAssistant}
      />

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#101418] border border-[#1C242C]">
          <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block">
            Total Purchase Cost
          </span>
          <span className="text-xl font-bold font-mono text-[#00FF66] mt-1 block">
            {formatINR(totalPurchasesValue)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#101418] border border-[#1C242C]">
          <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block">
            Total Units Procured
          </span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">
            {purchases.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)} units
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#101418] border border-[#1C242C]">
          <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block">
            Purchase Orders Logged
          </span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
            {purchases.length} Records
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by PO number, invoice number, item name, SKU, vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF66] transition-colors"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-gray-200 focus:outline-none focus:border-[#00FF66] font-mono"
            >
              <option value="ALL">All Suppliers</option>
              {uniqueVendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

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

          <div className="w-full sm:w-40">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-gray-200 focus:outline-none focus:border-[#00FF66] font-mono"
            >
              <option value="ALL">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0C0F12] border-b border-[#1A2228] text-gray-400 font-mono text-[11px] uppercase tracking-wider select-none">
              <tr>
                <th className="py-3 px-4">PO Ref / Date</th>
                <th className="py-3 px-4">Item & SKU Snapshot</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Total Cost</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#182026]">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 font-mono text-xs">
                    No purchase records match current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((po) => (
                  <tr key={po.id} className="hover:bg-[#13191E] transition-colors">
                    {/* PO Ref & Date */}
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      <div className="font-semibold text-white">{po.purchaseNumber}</div>
                      <div className="text-[10px] text-gray-400">{po.purchaseDate}</div>
                      {po.invoiceNumber && (
                        <div className="text-[9px] text-gray-400">Inv: {po.invoiceNumber}</div>
                      )}
                    </td>

                    {/* Item */}
                    <td className="py-3.5 px-4 min-w-[180px]">
                      <div className="font-medium text-white">{po.productNameSnapshot}</div>
                      <div className="text-[10px] text-[#00FF66] font-mono mt-0.5">
                        {po.skuSnapshot}
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-medium text-gray-300">{po.vendorNameSnapshot}</span>
                    </td>

                    {/* Project */}
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      {po.projectNameSnapshot && po.projectNameSnapshot !== 'Unassigned' ? (
                        <span className="text-emerald-400 font-medium">
                          {po.projectNameSnapshot}
                        </span>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-white whitespace-nowrap">
                      {po.quantity}
                    </td>

                    {/* Unit Price */}
                    <td className="py-3.5 px-4 text-right font-mono text-gray-200 whitespace-nowrap">
                      {formatINR(po.unitPrice)}
                      {po.discount > 0 && (
                        <span className="block text-[9px] text-amber-400">
                          -₹{po.discount} Disc
                        </span>
                      )}
                    </td>

                    {/* Total Cost */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-[#00FF66] whitespace-nowrap">
                      {formatINR(po.invoiceTotal)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {paymentStatusBadge(po.paymentStatus)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
