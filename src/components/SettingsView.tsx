import React, { useState } from 'react';
import {
  Sliders,
  Database,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Tag,
  MapPin,
  X,
  Shield,
  Layers,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';

export const SettingsView: React.FC = () => {
  const {
    products,
    purchases,
    projects,
    categories,
    totalInventoryValue,
    clearAllData,
    resetToSampleData,
  } = useInventory();

  // Settings State
  const [defaultLocation, setDefaultLocation] = useState(
    localStorage.getItem('ddlc_default_location') || 'Main Lab'
  );
  const [skuPrefix, setSkuPrefix] = useState(
    localStorage.getItem('ddlc_sku_prefix') || 'DDLC'
  );
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem('ddlc_sound_enabled') !== 'false'
  );

  // Status feedback
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Danger Zone confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ddlc_default_location', defaultLocation.trim());
    localStorage.setItem('ddlc_sku_prefix', skuPrefix.trim().toUpperCase());
    localStorage.setItem('ddlc_sound_enabled', String(soundEnabled));

    setStatusMessage({
      type: 'success',
      text: 'Lab preferences saved successfully.',
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleToggleSound = (val: boolean) => {
    setSoundEnabled(val);
    localStorage.setItem('ddlc_sound_enabled', String(val));
  };

  const handleDeleteAllData = async () => {
    if (confirmInput.trim().toUpperCase() !== 'DELETE ALL') {
      return;
    }

    try {
      setIsDeleting(true);
      await clearAllData();
      setIsDeleteModalOpen(false);
      setConfirmInput('');
      setStatusMessage({
        type: 'success',
        text: 'All Firestore inventory documents and records have been deleted.',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to purge database.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReseed = () => {
    if (window.confirm('Reset to initial sample project and clear custom items?')) {
      resetToSampleData();
      setStatusMessage({
        type: 'success',
        text: 'Database reset to initial sample structure.',
      });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-[#E6EDE7] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#174D35] flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#168653]" />
            <span>System Settings & Database Management</span>
          </h1>
          <p className="text-xs text-[#77857C] mt-1">
            Configure lab preferences, inspect Cloud Firestore telemetry, and manage system records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#168653] animate-pulse" />
            Live Cloud Firestore
          </span>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-3 animate-in fade-in duration-150 ${
            statusMessage.type === 'success'
              ? 'bg-[#F0F9F2] border-[#C6E7D2] text-[#174D35]'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#168653]" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Cloud Firestore Storage Telemetry Card */}
      <div className="bg-white border border-[#E6EDE7] rounded-3xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-[#F0F5F2]">
          <Database className="w-4 h-4 text-[#168653]" />
          <h2 className="text-xs font-bold text-[#174D35] uppercase tracking-wider">
            Live Database Metrics
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#F5F9F6] p-3 rounded-2xl border border-[#E6EDE7]">
            <span className="text-[10px] font-semibold text-[#77857C] block uppercase">TOTAL PRODUCTS</span>
            <span className="text-lg font-bold text-[#174D35] mt-0.5 block">{products.length}</span>
            <span className="text-[11px] text-[#77857C]">Items recorded</span>
          </div>

          <div className="bg-[#F5F9F6] p-3 rounded-2xl border border-[#E6EDE7]">
            <span className="text-[10px] font-semibold text-[#77857C] block uppercase">PURCHASE ORDERS</span>
            <span className="text-lg font-bold text-[#174D35] mt-0.5 block">{purchases.length}</span>
            <span className="text-[11px] text-[#77857C]">Ledger entries</span>
          </div>

          <div className="bg-[#F5F9F6] p-3 rounded-2xl border border-[#E6EDE7]">
            <span className="text-[10px] font-semibold text-[#77857C] block uppercase">PROJECTS</span>
            <span className="text-lg font-bold text-[#0284C7] mt-0.5 block">{projects.length}</span>
            <span className="text-[11px] text-[#77857C]">Active prototypes</span>
          </div>

          <div className="bg-[#F5F9F6] p-3 rounded-2xl border border-[#E6EDE7]">
            <span className="text-[10px] font-semibold text-[#77857C] block uppercase">STOCK VALUATION</span>
            <span className="text-lg font-bold text-[#168653] mt-0.5 block truncate">
              {formatINR(totalInventoryValue)}
            </span>
            <span className="text-[11px] text-[#77857C]">Total assets</span>
          </div>
        </div>

        <div className="text-xs text-[#77857C] bg-[#F5F9F6] p-3.5 rounded-2xl border border-[#E6EDE7] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[#77857C]">Target Database:</span>
            <span className="text-[#25352C] font-mono font-medium">ai-studio-1a2821a5-98f6-4b10-b864-7ab9c4f566b9</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#77857C]">Security Rules:</span>
            <span className="text-[#168653] font-semibold">Strict RBAC & Audit Rules Active</span>
          </div>
        </div>
      </div>

      {/* Lab Preferences Form */}
      <form onSubmit={handleSavePreferences} className="bg-white border border-[#E6EDE7] rounded-3xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-[#F0F5F2]">
          <Sliders className="w-4 h-4 text-[#168653]" />
          <h2 className="text-xs font-bold text-[#174D35] uppercase tracking-wider">
            Hardware Lab Preferences
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-[#77857C] block mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#168653]" />
              DEFAULT STORAGE LOCATION
            </label>
            <input
              type="text"
              value={defaultLocation}
              onChange={(e) => setDefaultLocation(e.target.value)}
              placeholder="e.g. Main Lab"
              className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#77857C] block mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#168653]" />
              DEFAULT SKU PREFIX
            </label>
            <input
              type="text"
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value)}
              placeholder="e.g. DDLC"
              className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#168653] font-mono font-bold focus:outline-none focus:border-[#168653] focus:bg-white"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-[#F0F5F2]">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-[#77857C]" />
            <div>
              <div className="text-xs font-semibold text-[#25352C]">Scanner Audio Confirmation</div>
              <div className="text-[11px] text-[#77857C]">Play tone on successful barcode decode</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleToggleSound(!soundEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-[#E5F5E9] text-[#168653] border-[#C6E7D2]'
                : 'bg-[#F5F9F6] text-[#77857C] border-[#E6EDE7]'
            }`}
          >
            {soundEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>

      {/* Danger Zone: Delete All Data */}
      <div className="bg-white border border-red-200 rounded-3xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2.5 pb-3 border-b border-red-100">
          <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-red-800 uppercase tracking-wider">
              Danger Zone — Database Purge
            </h2>
            <p className="text-[11px] text-red-600">
              Permanently wipe all records from Cloud Firestore database
            </p>
          </div>
        </div>

        <div className="text-xs text-[#25352C] leading-relaxed space-y-2">
          <p>
            This action will permanently delete all <strong className="text-red-700">{products.length} inventory products</strong>,{' '}
            <strong className="text-red-700">{purchases.length} purchases</strong>, projects, stock movements, and audit records stored in Firestore.
          </p>
          <p className="text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs">
            ⚠️ This operation cannot be undone. Once confirmed, all hardware items and historical logs will be completely removed.
          </p>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-red-100">
          <button
            type="button"
            onClick={handleReseed}
            className="px-3.5 py-2 rounded-xl bg-[#F5F9F6] hover:bg-[#E5F5E9] border border-[#E6EDE7] text-[#25352C] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#168653]" />
            <span>Reset to Initial Sample State</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConfirmInput('');
              setIsDeleteModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete All Data</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Delete All Data */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-red-200 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-red-100">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-900">Permanently Delete All Data?</h3>
                <p className="text-[11px] text-red-600">Irreversible Cloud Firestore Purge</p>
              </div>
            </div>

            <div className="text-xs text-[#25352C] space-y-2 leading-relaxed">
              <p>
                You are about to wipe the entire DDLC lab inventory. All products, purchase orders, BOM assignments, and stock records will be permanently erased.
              </p>
              <p className="text-[#77857C]">
                To confirm this destructive action, please type <strong className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 font-mono">DELETE ALL</strong> below:
              </p>
            </div>

            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type DELETE ALL to confirm"
              className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-red-200 text-red-700 text-xs font-mono font-bold focus:outline-none focus:border-red-500 focus:bg-white"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0F5F2]">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setConfirmInput('');
                }}
                disabled={isDeleting}
                className="px-3.5 py-2 rounded-xl bg-[#F5F9F6] hover:bg-[#E5F5E9] text-[#77857C] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteAllData}
                disabled={confirmInput.trim().toUpperCase() !== 'DELETE ALL' || isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Purging Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm & Delete All</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
