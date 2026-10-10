import React, { useState, useEffect } from 'react';
import { X, SlidersHorizontal, AlertCircle } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#101418] border border-[#222B33] rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-[#182026] mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#00FF66]" />
            <h3 className="text-sm font-bold text-white font-display">
              Adjust Stock Level
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <div className="font-mono text-[11px] text-[#00FF66] font-semibold">{product.sku}</div>
            <div className="font-medium text-white mt-0.5">{product.name}</div>
            <div className="text-[11px] text-gray-400 font-mono mt-1">
              Current Stock: <span className="text-white font-bold">{product.quantity} {product.unit}</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              NEW PHYSICAL STOCK COUNT ({product.unit}) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={newQuantity}
              onChange={(e) => setNewQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono text-base font-bold focus:outline-none focus:border-[#00FF66]"
            />
          </div>

          <div className="p-2.5 rounded-lg bg-[#141A1F] border border-[#1E2730] font-mono text-xs flex justify-between items-center">
            <span className="text-gray-400">Inventory Delta:</span>
            <span className={diff >= 0 ? 'text-[#00FF66] font-bold' : 'text-amber-400 font-bold'}>
              {diff > 0 ? `+${diff}` : diff} {product.unit}
            </span>
          </div>

          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              AUDIT ADJUSTMENT REASON
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#182026]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-[#141A1F] text-gray-400 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-semibold shadow-[0_0_10px_rgba(0,255,102,0.2)] disabled:opacity-50"
            >
              {saving ? 'Recording...' : 'Update & Log Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
