import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Mail,
  Phone,
  MapPin,
  FileText,
  Search,
  ExternalLink,
  Receipt,
  X,
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
          <h2 className="text-xl font-bold text-white tracking-wide font-display flex items-center gap-2">
            <span>Supplier Directory</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-[#161F18] text-[#00FF66] border border-[#00FF66]/30">
              {vendors.length} Vendors
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Verified distributors, semiconductor manufacturers, and fabrication partners.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 rounded-xl bg-[#131E17] hover:bg-[#18281E] border border-[#00FF66]/40 text-[#00FF66] font-mono text-xs font-medium flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,255,102,0.15)] self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Manual Supplier Form</span>
        </button>
      </div>

      {/* Omnipresent AI Command Engine for Suppliers */}
      <AiCommandBar
        placeholder="Tell DDLC AI: Add supplier Mouser Electronics India, GSTIN 29AAACM1234F1Z5..."
        samplePrompts={[
          'Add supplier Mouser India with contact Sales and GSTIN 29AAACM1234F1Z5',
          'Add supplier Element14 India with phone +91 80 4000 3000',
        ]}
        onOpenFullAssistant={onNavigateToAssistant}
      />

      {/* Search Bar */}
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by vendor name, GSTIN, contact person..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF66]"
          />
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVendors.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 font-mono text-xs bg-[#101418] rounded-2xl border border-dashed border-[#232D36]">
            No supplier records found.
          </div>
        ) : (
          filteredVendors.map((v) => {
            const vendorPurchases = purchases.filter((p) => p.vendorNameSnapshot === v.name);
            const totalSpent = vendorPurchases.reduce((acc, p) => acc + (p.invoiceTotal || 0), 0);

            return (
              <div
                key={v.id}
                className="bg-[#101418] border border-[#1C242C] hover:border-[#2C3844] rounded-2xl p-5 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#161D22] text-[#00FF66] border border-[#232E37]">
                      {v.gstin || 'NO GSTIN'}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {vendorPurchases.length} POs
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">{v.name}</h3>
                  {v.contactPerson && (
                    <div className="text-xs text-gray-300 mt-0.5">Contact: {v.contactPerson}</div>
                  )}

                  <div className="mt-3 space-y-1.5 text-xs text-gray-400 font-sans">
                    {v.email && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="truncate">{v.email}</span>
                      </div>
                    )}
                    {v.phone && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>{v.phone}</span>
                      </div>
                    )}
                    {v.address && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="truncate">{v.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#182026] flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400 text-[11px]">LIFETIME SPEND:</span>
                  <span className="text-amber-400 font-semibold">{formatINR(totalSpent)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#101418] border border-[#222B33] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#182026] mb-4">
              <h3 className="text-base font-bold text-white font-display">Add New Supplier</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  SUPPLIER / COMPANY NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robu.in or Mouser"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-gray-400 block mb-1">
                    CONTACT PERSON
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-400 block mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="27AAGCR4321F1ZX"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-gray-400 block mb-1">
                    EMAIL
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-400 block mb-1">
                    PHONE
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  OFFICE / WAREHOUSE ADDRESS
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#182026]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-xl bg-[#141A1F] text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-semibold flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,102,0.2)] disabled:opacity-50"
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
