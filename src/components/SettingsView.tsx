import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  Database,
  CheckCircle2,
  RefreshCw,
  Shield,
  Sliders,
  Volume2,
  Tag,
  MapPin,
  Server,
  Layers,
  Info,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';

export const SettingsView: React.FC = () => {
  const {
    products,
    projects,
    purchases,
    stockMovements,
    totalInventoryValue,
    clearAllData,
    resetToSampleData,
  } = useInventory();

  // Confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Preference toggles
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('ddlc_scanner_sound') !== 'false';
  });
  const [defaultLocation, setDefaultLocation] = useState(() => {
    return localStorage.getItem('ddlc_default_location') || 'Main Lab';
  });
  const [skuPrefix, setSkuPrefix] = useState(() => {
    return localStorage.getItem('ddlc_sku_prefix') || 'DDLC';
  });

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('ddlc_scanner_sound', enabled ? 'true' : 'false');
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ddlc_default_location', defaultLocation);
    localStorage.setItem('ddlc_sku_prefix', skuPrefix);
    setStatusMessage({
      type: 'success',
      text: 'Settings preferences saved successfully.',
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDeleteAllData = async () => {
    if (confirmInput.trim().toUpperCase() !== 'DELETE ALL') {
      return;
    }

    try {
      setIsDeleting(true);
      setStatusMessage(null);
      await clearAllData();
      setIsDeleteModalOpen(false);
      setConfirmInput('');
      setStatusMessage({
        type: 'success',
        text: 'All records (products, purchases, projects, movements) have been permanently deleted from Cloud Firestore.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to delete all data.',
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
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white font-display flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#00FF66]" />
            <span>System Settings & Database Management</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Configure lab preferences, inspect Cloud Firestore telemetry, and purge system records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse" />
            FIRESTORE ONLINE
          </span>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex items-center gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-[#0E1B13] border-[#00FF66]/40 text-[#00FF66]'
              : 'bg-red-950/40 border-red-500/40 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Cloud Firestore Storage Telemetry Card */}
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#1A2228]">
          <Database className="w-4 h-4 text-[#00FF66]" />
          <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            Live Database Telemetry
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-[#0C1013] p-3 rounded-xl border border-[#182026]">
            <span className="text-[10px] text-gray-400 block">TOTAL PRODUCTS</span>
            <span className="text-base font-bold text-white mt-0.5 block">{products.length}</span>
            <span className="text-[10px] text-gray-500">Items recorded</span>
          </div>

          <div className="bg-[#0C1013] p-3 rounded-xl border border-[#182026]">
            <span className="text-[10px] text-gray-400 block">PURCHASE ORDERS</span>
            <span className="text-base font-bold text-white mt-0.5 block">{purchases.length}</span>
            <span className="text-[10px] text-gray-500">Ledger entries</span>
          </div>

          <div className="bg-[#0C1013] p-3 rounded-xl border border-[#182026]">
            <span className="text-[10px] text-gray-400 block">PROJECTS</span>
            <span className="text-base font-bold text-emerald-400 mt-0.5 block">{projects.length}</span>
            <span className="text-[10px] text-gray-500">Active prototypes</span>
          </div>

          <div className="bg-[#0C1013] p-3 rounded-xl border border-[#182026]">
            <span className="text-[10px] text-gray-400 block">STOCK VALUATION</span>
            <span className="text-base font-bold text-[#00FF66] mt-0.5 block truncate">
              {formatINR(totalInventoryValue)}
            </span>
            <span className="text-[10px] text-gray-500">Total assets</span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-gray-400 bg-[#0C1013] p-3 rounded-xl border border-[#182026] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Target Database:</span>
            <span className="text-white">ai-studio-1a2821a5-98f6-4b10-b864-7ab9c4f566b9</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Security Rules:</span>
            <span className="text-[#00FF66]">Strict RBAC & Audit Rules Active</span>
          </div>
        </div>
      </div>

      {/* Lab Preferences Form */}
      <form onSubmit={handleSavePreferences} className="bg-[#101418] border border-[#1C242C] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#1A2228]">
          <Sliders className="w-4 h-4 text-[#00FF66]" />
          <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            Hardware Lab Preferences
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
          <div>
            <label className="text-[11px] text-gray-400 block mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#00FF66]" />
              DEFAULT STORAGE LOCATION
            </label>
            <input
              type="text"
              value={defaultLocation}
              onChange={(e) => setDefaultLocation(e.target.value)}
              placeholder="e.g. Main Lab"
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
            />
          </div>

          <div>
            <label className="text-[11px] text-gray-400 block mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#00FF66]" />
              DEFAULT SKU PREFIX
            </label>
            <input
              type="text"
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value)}
              placeholder="e.g. DDLC"
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-[#182026]">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs font-mono font-medium text-white">Scanner Audio Confirmation</div>
              <div className="text-[10px] font-mono text-gray-500">Play tone on successful barcode decode</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleToggleSound(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-[#122217] text-[#00FF66] border-[#00FF66]/40'
                : 'bg-[#182026] text-gray-400 border-gray-700'
            }`}
          >
            {soundEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#16241B] hover:bg-[#1E3324] border border-[#00FF66]/40 text-[#00FF66] font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>

      {/* Danger Zone: Delete All Data (User Request Requirement) */}
      <div className="bg-[#140D0F] border border-red-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 pb-3 border-b border-red-900/30">
          <div className="w-6 h-6 rounded bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-red-200 font-mono uppercase tracking-wider">
              Danger Zone — Database Purge
            </h2>
            <p className="text-[11px] font-mono text-red-400">
              Permanently wipe all records from Cloud Firestore database
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-gray-300 leading-relaxed space-y-2">
          <p>
            This action will permanently delete all <strong className="text-white">{products.length} inventory products</strong>,{' '}
            <strong className="text-white">{purchases.length} purchases</strong>, projects, stock movements, and audit records stored in Firestore.
          </p>
          <p className="text-amber-400">
            ⚠️ This operation cannot be undone. Once confirmed, all hardware items and historical logs will be completely removed.
          </p>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-red-950/40">
          <button
            type="button"
            onClick={handleReseed}
            className="px-3.5 py-2 rounded-xl bg-[#182026] hover:bg-[#202A32] border border-[#2B3742] text-gray-300 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Reset to Initial Sample State</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConfirmInput('');
              setIsDeleteModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all cursor-pointer active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete All Data</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Delete All Data */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="bg-[#12161A] border border-red-500/50 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl relative font-mono">
            <div className="flex items-center gap-3 pb-3 border-b border-[#202931]">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-500/60 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Permanently Delete All Data?</h3>
                <p className="text-[11px] text-red-400">Irreversible Cloud Firestore Purge</p>
              </div>
            </div>

            <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
              <p>
                You are about to wipe the entire DDLC lab inventory. All products, purchase orders, BOM assignments, and stock records will be permanently erased.
              </p>
              <p className="text-gray-400">
                To confirm this destructive action, please type <strong className="text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-500/30">DELETE ALL</strong> below:
              </p>
            </div>

            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type DELETE ALL to confirm"
              className="w-full px-3 py-2 rounded-xl bg-[#0B0E11] border border-red-500/40 text-red-200 text-xs focus:outline-none focus:border-red-400"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E262E]">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setConfirmInput('');
                }}
                disabled={isDeleting}
                className="px-3.5 py-2 rounded-xl bg-[#182026] hover:bg-[#202A32] text-gray-300 text-xs font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteAllData}
                disabled={confirmInput.trim().toUpperCase() !== 'DELETE ALL' || isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(239,68,68,0.35)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
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
