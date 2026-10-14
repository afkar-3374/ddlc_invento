import React, { useState, useEffect } from 'react';
import { X, SlidersHorizontal, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types';

interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const { adjustProductStock } = useInventory();
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [reason, setReason] = useState('Physical lab count reconciliation');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setNewQuantity(product.quantity);
      setReason('Physical lab count reconciliation');
    }
    setError(null);
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const diff = newQuantity - product.quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newQuantity < 0) {
      setError('Quantity cannot be negative.');
      return;
    }
    if (newQuantity === product.quantity) {
      onClose();
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await adjustProductStock(product.id, newQuantity, reason);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to adjust stock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-[#E6EDE7] rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#F0F5F2] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#174D35]">
              Adjust Stock Level
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#77857C] hover:text-[#25352C] hover:bg-[#F5F9F6] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] space-y-1">
            <span className="font-mono text-xs font-bold text-[#168653] bg-white px-2 py-0.5 rounded-lg border border-[#C6E7D2] inline-block">
              {product.sku}
            </span>
            <div className="font-bold text-[#174D35] text-sm pt-0.5">{product.name}</div>
            <div className="text-[11px] text-[#77857C]">
              Current stock: <strong className="text-[#25352C]">{product.quantity} {product.unit}</strong>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
              NEW PHYSICAL STOCK COUNT ({product.unit}) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={newQuantity}
              onChange={(e) => setNewQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#174D35] font-bold text-base focus:outline-none focus:border-[#168653] focus:bg-white"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs flex justify-between items-center">
            <span className="text-[#77857C]">Inventory Adjustment Delta:</span>
            <span className={`font-bold ${diff >= 0 ? 'text-[#168653]' : 'text-amber-600'}`}>
              {diff > 0 ? `+${diff}` : diff} {product.unit}
            </span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
              AUDIT ADJUSTMENT REASON *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F0F5F2]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-[#F5F9F6] text-[#77857C] hover:text-[#25352C] font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Recording...' : 'Update & Log Movement'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
