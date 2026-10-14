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
          <span className="px-2.5 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2] text-[11px] font-semibold">
            Paid
          </span>
        );
      case 'Partially Paid':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
            Partial
          </span>
        );
      case 'Unpaid':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold">
            Unpaid
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="bg-white border border-[#E6EDE7] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2] flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              Procurement & POs
            </span>
            <span className="text-xs text-[#77857C]">{filteredPurchases.length} Records</span>
          </div>
          <h2 className="text-lg font-bold text-[#174D35] tracking-tight">
            Purchase Orders & Invoices
          </h2>
          <p className="text-xs text-[#77857C] mt-0.5">
            Immutable procurement ledger with real-time Firestore tracking and automatic stock updates.
          </p>
        </div>

        <button
          onClick={onOpenAddPurchase}
          className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase Order</span>
        </button>
      </div>

      {/* Omnipresent AI Command Engine for Purchases */}
      <AiCommandBar
        placeholder="Tell DDLC AI: Add item, record purchase, or inspect purchase ledger..."
        samplePrompts={[
          'Add 5x ESP32-WROOM-32D at ₹450',
          'Record purchase of 5 Raspberry Pi 5 for Rover MK-2',
          'Log invoice INV-904 from Robu for ₹4,500',
        ]}
        onOpenFullAssistant={onNavigateToAssistant}
      />

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-[#E6EDE7] shadow-xs">
          <span className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider block">
            Total Purchase Cost
          </span>
          <span className="text-2xl font-bold text-[#174D35] mt-1 block">
            {formatINR(totalPurchasesValue)}
          </span>
          <span className="text-[11px] text-[#77857C]">Recorded in ledger</span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#E6EDE7] shadow-xs">
          <span className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider block">
            Total Units Procured
          </span>
          <span className="text-2xl font-bold text-[#174D35] mt-1 block">
            {purchases.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)} <span className="text-sm font-normal text-[#77857C]">units</span>
          </span>
          <span className="text-[11px] text-[#77857C]">Physical parts</span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#E6EDE7] shadow-xs">
          <span className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider block">
            Purchase Orders Logged
          </span>
          <span className="text-2xl font-bold text-[#0284C7] mt-1 block">
            {purchases.length} <span className="text-sm font-normal text-[#77857C]">entries</span>
          </span>
          <span className="text-[11px] text-[#77857C]">Cloud Firestore ledger</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E6EDE7] rounded-3xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-[#77857C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by PO number, invoice number, item name, SKU, vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white transition-colors"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
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

          <div className="w-full sm:w-40">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
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
      <div className="bg-white border border-[#E6EDE7] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#25352C]">
            <thead className="bg-[#F0F9F2] border-b border-[#E6EDE7] text-[#174D35] text-[11px] font-semibold uppercase tracking-wider select-none">
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
            <tbody className="divide-y divide-[#F0F5F2]">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#77857C] text-xs">
                    No purchase records match current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((po) => (
                  <tr key={po.id} className="hover:bg-[#F5F9F6] transition-colors">
                    {/* PO Ref & Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-[#174D35]">{po.purchaseNumber}</div>
                      <div className="text-[11px] text-[#77857C]">{po.purchaseDate}</div>
                      {po.invoiceNumber && (
                        <div className="text-[10px] text-[#77857C]">Inv: {po.invoiceNumber}</div>
                      )}
                    </td>

                    {/* Item */}
                    <td className="py-3.5 px-4 min-w-[180px]">
                      <div className="font-semibold text-[#174D35]">{po.productNameSnapshot}</div>
                      <div className="text-[11px] text-[#168653] font-mono font-bold mt-0.5">
                        {po.skuSnapshot}
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-[#25352C]">{po.vendorNameSnapshot}</span>
                    </td>

                    {/* Project */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {po.projectNameSnapshot && po.projectNameSnapshot !== 'Unassigned' ? (
                        <span className="text-[#0284C7] font-semibold">
                          {po.projectNameSnapshot}
                        </span>
                      ) : (
                        <span className="text-[#77857C]">Unassigned</span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-4 text-center font-bold text-[#25352C] whitespace-nowrap">
                      {po.quantity}
                    </td>

                    {/* Unit Price */}
                    <td className="py-3.5 px-4 text-right text-[#77857C] whitespace-nowrap">
                      {formatINR(po.unitPrice)}
                      {po.discount > 0 && (
                        <span className="block text-[10px] text-amber-600">
                          -₹{po.discount} Disc
                        </span>
                      )}
                    </td>

                    {/* Total Cost */}
                    <td className="py-3.5 px-4 text-right font-bold text-sm text-[#168653] whitespace-nowrap">
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
