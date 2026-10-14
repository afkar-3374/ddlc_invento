import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Mail,
  Phone,
  MapPin,
  Search,
  Receipt,
  X,
  CreditCard,
  Briefcase,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Vendor } from '../types';
import { formatINR } from '../services/dbService';
import { AiCommandBar } from './AiCommandBar';

interface VendorsViewProps {
  onNavigateToAssistant?: (prompt: string) => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({ onNavigateToAssistant }) => {
  const { vendors, purchases, addVendor } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredVendors = vendors.filter((v) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.gstin?.toLowerCase().includes(q) ||
      v.contactPerson?.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      await addVendor({
        name,
        contactPerson,
        email,
        phone,
        gstin,
        address,
        notes,
      });
      setShowAddModal(false);
      setName('');
      setContactPerson('');
      setEmail('');
      setPhone('');
      setGstin('');
      setAddress('');
      setNotes('');
    } catch (e: any) {
      alert(`Error adding vendor: ${e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center font-bold shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#174D35] tracking-tight">
                  Suppliers & Vendors
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#E5F5E9] text-[#168653] border border-[#CDE9D5]">
                  {vendors.length} Registered
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#77857C] mt-0.5">
                Verified electronic component distributors, fab partners & local suppliers
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-2xl bg-[#168653] hover:bg-[#126b42] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-[#168653]/15 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* Omnipresent AI Command Engine for Suppliers */}
      <AiCommandBar
        placeholder="Ask DDLC AI: Add supplier Mouser Electronics India, GSTIN 29AAACM1234F1Z5..."
        samplePrompts={[
          'Add supplier Mouser India with contact Sales and GSTIN 29AAACM1234F1Z5',
          'Add supplier Element14 India with phone +91 80 4000 3000',
        ]}
        onOpenFullAssistant={onNavigateToAssistant}
      />

      {/* Search & Filter Bar */}
      <div className="bg-white border border-[#E6EDE7] rounded-2xl p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-[#77857C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by supplier name, GSTIN, contact person or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs sm:text-sm text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVendors.length === 0 ? (
          <div className="col-span-full py-14 text-center bg-white rounded-3xl border border-dashed border-[#E6EDE7] shadow-xs p-6">
            <div className="w-12 h-12 rounded-2xl bg-[#E5F5E9] text-[#168653] mx-auto flex items-center justify-center mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-[#174D35]">No suppliers found</p>
            <p className="text-xs text-[#77857C] mt-1 max-w-sm mx-auto">
              {searchTerm
                ? 'Try matching another name or GSTIN number'
                : 'Get started by adding your first vendor or using DDLC AI to import suppliers.'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-[#E5F5E9] hover:bg-[#d5edd9] text-[#168653] text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Supplier</span>
            </button>
          </div>
        ) : (
          filteredVendors.map((v) => {
            const vendorPurchases = purchases.filter((p) => p.vendorNameSnapshot === v.name);
            const totalSpent = vendorPurchases.reduce((acc, p) => acc + (p.invoiceTotal || 0), 0);

            return (
              <div
                key={v.id}
                className="bg-white border border-[#E6EDE7] hover:border-[#168653]/30 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-[#F5F9F6] text-[#174D35] border border-[#E6EDE7]">
                      {v.gstin || 'NO GSTIN'}
                    </span>
                    <span className="text-[11px] font-medium text-[#77857C] flex items-center gap-1">
                      <Receipt className="w-3 h-3 text-[#168653]" />
                      {vendorPurchases.length} Invoices
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#174D35]">{v.name}</h3>
                  {v.contactPerson && (
                    <div className="text-xs text-[#77857C] mt-0.5 font-medium">
                      Contact: {v.contactPerson}
                    </div>
                  )}

                  <div className="mt-3.5 space-y-2 text-xs text-[#25352C]">
                    {v.email && (
                      <div className="flex items-center gap-2 text-[#25352C]">
                        <Mail className="w-3.5 h-3.5 text-[#77857C] shrink-0" />
                        <span className="truncate">{v.email}</span>
                      </div>
                    )}
                    {v.phone && (
                      <div className="flex items-center gap-2 text-[#25352C]">
                        <Phone className="w-3.5 h-3.5 text-[#77857C] shrink-0" />
                        <span>{v.phone}</span>
                      </div>
                    )}
                    {v.address && (
                      <div className="flex items-center gap-2 text-[#77857C]">
                        <MapPin className="w-3.5 h-3.5 text-[#77857C] shrink-0" />
                        <span className="truncate">{v.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E6EDE7] flex items-center justify-between text-xs">
                  <span className="text-[#77857C] text-[11px] font-medium uppercase tracking-wider">
                    Lifetime Spend
                  </span>
                  <span className="text-[#168653] font-bold text-sm">
                    {formatINR(totalSpent)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E6EDE7] rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6EDE7] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#174D35]">Add New Supplier</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-[#77857C] hover:text-[#25352C] hover:bg-[#F5F9F6] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-[#174D35] block mb-1">
                  SUPPLIER / COMPANY NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robu.in or Mouser India"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#174D35] block mb-1">
                    CONTACT PERSON
                  </label>
                  <input
                    type="text"
                    placeholder="Sales Rep Name"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#174D35] block mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="27AAGCR4321F1ZX"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#174D35] block mb-1">
                    EMAIL
                  </label>
                  <input
                    type="email"
                    placeholder="orders@supplier.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#174D35] block mb-1">
                    PHONE
                  </label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#174D35] block mb-1">
                  OFFICE / WAREHOUSE ADDRESS
                </label>
                <input
                  type="text"
                  placeholder="Street, City, State, PIN"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E6EDE7]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F5F9F6] text-[#77857C] hover:text-[#25352C] font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#168653] hover:bg-[#126b42] text-white font-semibold flex items-center gap-2 shadow-md shadow-[#168653]/15 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
