import React from 'react';
import {
  X,
  Boxes,
  MapPin,
  Calendar,
  Building2,
  FolderGit2,
  Clock,
  Edit2,
  SlidersHorizontal,
  Plus,
  Archive,
  ArchiveRestore,
  Receipt,
  Layers,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types';
import { formatINR } from '../services/dbService';

interface ItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onEdit: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
  onAddPurchase: (product: Product) => void;
}

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
  isOpen,
  onClose,
  product,
  onEdit,
  onAdjustStock,
  onAddPurchase,
}) => {
  const { projects, stockMovements, purchases, archiveProduct } = useInventory();

  if (!isOpen || !product) return null;

  const project = projects.find((p) => p.id === product.projectId);
  const movements = stockMovements.filter((sm) => sm.productId === product.id);
  const itemPurchases = purchases.filter((po) => po.productId === product.id);
  const totalValuation = (product.quantity || 0) * (product.unitPrice || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#101418] border border-[#222B33] rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#182026]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-[#161D22] text-[#00FF66] border border-[#00FF66]/30">
                {product.sku}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#161D22] text-gray-300 border border-gray-700">
                {product.category}
              </span>
              {product.archived && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800">
                  ARCHIVED
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white font-display">
              {product.name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="p-1.5 rounded-lg bg-[#141A1F] text-gray-400 hover:text-white border border-[#232D35]"
              title="Edit Product"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stock & Valuation Highlight Banner */}
        <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0D1114] p-3.5 rounded-xl border border-[#1A232A] font-mono text-xs">
          <div>
            <span className="text-[10px] text-gray-400 block">CURRENT STOCK</span>
            <span className="text-base font-bold text-white">
              {product.quantity} <span className="text-xs text-gray-400">{product.unit}</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] text-gray-400 block">UNIT PRICE</span>
            <span className="text-base font-bold text-white">
              {formatINR(product.unitPrice)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-gray-400 block">ITEM NUMBER</span>
            <span className="text-base font-bold text-[#00FF66]">
              #{product.itemNumber || 1}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-gray-400 block">STOCK VALUATION</span>
            <span className="text-base font-bold text-[#00FF66]">
              {formatINR(totalValuation)}
            </span>
          </div>
        </div>

        {/* Technical Specs & Location */}
        <div className="space-y-3 text-xs mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-300">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#14191E] border border-[#1F262D]">
              <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
              <div>
                <span className="text-[10px] font-mono text-gray-400 block">STORAGE LOCATION</span>
                <span className="font-medium text-white">{product.storageLocation || 'Main Lab'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#14191E] border border-[#1F262D]">
              <FolderGit2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] font-mono text-gray-400 block">ALLOCATED PROJECT</span>
                <span className="font-medium text-white">{project ? `${project.name} (${project.code})` : 'Unassigned'}</span>
              </div>
            </div>
          </div>

          {product.description && (
            <div className="p-3 rounded-lg bg-[#14191E] border border-[#1F262D]">
              <span className="text-[10px] font-mono text-gray-400 block mb-1">TECHNICAL DESCRIPTION</span>
              <p className="text-gray-300 leading-relaxed">{product.description}</p>
            </div>
          )}

          {product.notes && (
            <div className="p-3 rounded-lg bg-[#14191E] border border-[#1F262D]">
              <span className="text-[10px] font-mono text-gray-400 block mb-1">LABORATORY NOTES</span>
              <p className="text-gray-300 leading-relaxed">{product.notes}</p>
            </div>
          )}
        </div>

        {/* History: Stock Movements Audit Ledger */}
        <div className="space-y-3 pt-3 border-t border-[#182026]">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-semibold uppercase text-gray-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#00FF66]" />
              Stock Movement Ledger ({movements.length})
            </h4>
          </div>

          {movements.length === 0 ? (
            <div className="py-6 text-center text-xs font-mono text-gray-400 bg-[#0C0F12] rounded-xl border border-[#182026]">
              No stock movements recorded yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-lg bg-[#12161A] border border-[#1B2228] flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <span className="font-bold text-white uppercase text-[11px]">{m.type}</span>
                    <span className="text-gray-400 text-[10px] ml-2">{new Date(m.createdAt).toLocaleDateString()}</span>
                    <div className="text-[10px] text-gray-400 mt-0.5">{m.notes}</div>
                  </div>
                  <div className="text-right">
                    <span className={m.newStock >= m.previousStock ? 'text-[#00FF66] font-bold' : 'text-amber-400 font-bold'}>
                      {m.newStock >= m.previousStock ? `+${m.quantity}` : `-${m.quantity}`}
                    </span>
                    <div className="text-[10px] text-gray-400">Bal: {m.newStock}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-5 mt-5 border-t border-[#182026]">
          <button
            onClick={() => {
              archiveProduct(product.id, product.archived);
              onClose();
            }}
            className="px-3 py-2 rounded-xl bg-[#141A1F] text-gray-400 hover:text-amber-400 border border-[#232D36] text-xs font-mono flex items-center gap-1.5"
          >
            {product.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            <span>{product.archived ? 'Restore' : 'Archive'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onAdjustStock(product);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#141A1F] hover:bg-[#1A222A] text-gray-200 border border-[#232D36] text-xs font-medium flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#00FF66]" />
              <span>Adjust Stock</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onAddPurchase(product);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-semibold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,102,0.25)]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Purchase Order</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
