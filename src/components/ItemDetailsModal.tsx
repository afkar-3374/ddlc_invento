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
  Barcode as BarcodeIcon,
  Tag,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types';
import { formatINR } from '../services/dbService';
import { downloadSingleLabelPng } from '../services/labelService';

interface ItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onEdit: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
  onAddPurchase: (product: Product) => void;
  onGenerateLabel?: (product: Product) => void;
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToPurchases?: () => void;
}

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
  isOpen,
  onClose,
  product,
  onEdit,
  onAdjustStock,
  onAddPurchase,
  onGenerateLabel,
  onNavigateToProject,
  onNavigateToPurchases,
}) => {
  const { projects, stockMovements, purchases, archiveProduct } = useInventory();

  if (!isOpen || !product) return null;

  const project = projects.find((p) => p.id === product.projectId);
  const movements = stockMovements.filter((sm) => sm.productId === product.id);
  const itemPurchases = purchases.filter((po) => po.productId === product.id);

  // Strictly separate valuations (Requirement 4)
  const unitCost = product.unitPrice || 0;
  const currentStockValuation = (product.quantity || 0) * unitCost;
  const totalRecordedPurchaseValue = itemPurchases.reduce(
    (acc, po) => acc + (Number(po.invoiceTotal) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#101418] border border-[#222B33] rounded-2xl w-full max-w-3xl p-5 sm:p-6 shadow-2xl relative my-6 max-h-[90vh] flex flex-col">
        {/* Header Bar */}
        <div className="flex items-start justify-between pb-4 border-b border-[#182026] shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-[#161D22] text-[#00FF66] border border-[#00FF66]/30">
                {product.sku}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#161D22] text-gray-300 border border-gray-700">
                {product.category || 'General'}
              </span>
              {product.barcode && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161D22] text-cyan-400 border border-cyan-800">
                  BARCODE: {product.barcode}
                </span>
              )}
              {product.archived && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800">
                  ARCHIVED
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white font-display">
              {product.name}
            </h3>
            {(product.brand || product.model) && (
              <div className="text-xs text-gray-400 font-mono mt-0.5">
                Brand: <span className="text-gray-200">{product.brand || 'Not recorded'}</span> • Model: <span className="text-gray-200">{product.model || 'Not recorded'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="p-1.5 rounded-lg bg-[#141A1F] text-gray-400 hover:text-white border border-[#232D35] transition-colors cursor-pointer"
              title="Edit Product"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 min-h-0">
          {/* Cost & Stock Valuation Banner (Requirement 4: Distinctly Separate Values) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0D1114] p-3.5 rounded-xl border border-[#1A232A] font-mono text-xs">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase">Current Stock</span>
              <span className="text-base font-bold text-white">
                {product.quantity} <span className="text-xs text-gray-400 font-normal">{product.unit || 'pcs'}</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block uppercase">Unit Purchase Cost</span>
              <span className="text-base font-bold text-white">
                {formatINR(unitCost)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block uppercase">Stock Valuation</span>
              <span className="text-base font-bold text-[#00FF66]">
                {formatINR(currentStockValuation)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block uppercase">Total PO Value</span>
              <span className="text-base font-bold text-cyan-400">
                {formatINR(totalRecordedPurchaseValue || product.totalCost || currentStockValuation)}
              </span>
            </div>
          </div>

          {/* Technical Specifications & Allocation Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#14191E] border border-[#1F262D]">
              <span className="text-[10px] font-mono text-gray-400 block">BARCODE VALUE</span>
              <span className="font-mono text-white font-medium">
                {product.barcode || 'Not recorded'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#14191E] border border-[#1F262D]">
              <span className="text-[10px] font-mono text-gray-400 block">STORAGE LOCATION</span>
              <span className="font-medium text-white">
                {product.storageLocation || 'Not recorded'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#14191E] border border-[#1F262D] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-gray-400 block">PROJECT ALLOCATION</span>
                <span className="font-medium text-white">
                  {project ? `${project.name} (${project.code})` : product.projectId || 'Unassigned / General'}
                </span>
              </div>
              {project && onNavigateToProject && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToProject(project.id);
                  }}
                  className="text-[10px] font-mono text-emerald-400 hover:underline cursor-pointer"
                >
                  View Project
                </button>
              )}
            </div>

            <div className="p-3 rounded-xl bg-[#14191E] border border-[#1F262D]">
              <span className="text-[10px] font-mono text-gray-400 block">SUPPLIER / VENDOR</span>
              <span className="font-medium text-white">
                {product.vendor || 'Not recorded'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#14191E] border border-[#1F262D]">
              <span className="text-[10px] font-mono text-gray-400 block">PURCHASE DATE</span>
              <span className="font-medium text-white">
                {product.purchaseDate || 'Not recorded'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#14191E] border border-[#1F262D]">
              <span className="text-[10px] font-mono text-gray-400 block">GST RATE & RECORDED AMOUNT</span>
              <span className="font-medium text-white">
                {product.gstPercent && product.gstPercent > 0
                  ? `${product.gstPercent}% (${formatINR(product.gstAmount)})`
                  : '0% / Exempted (Direct Lab Cost)'}
              </span>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="p-3.5 rounded-xl bg-[#14191E] border border-[#1F262D] text-xs">
              <span className="text-[10px] font-mono text-gray-400 block mb-1">
                DESCRIPTION & SPECIFICATIONS
              </span>
              <p className="text-gray-300 leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Notes */}
          {product.notes && (
            <div className="p-3.5 rounded-xl bg-[#14191E] border border-[#1F262D] text-xs">
              <span className="text-[10px] font-mono text-gray-400 block mb-1">LAB NOTES</span>
              <p className="text-gray-300 leading-relaxed">{product.notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="p-3 rounded-xl bg-[#14191E] border border-[#1F262D] text-[11px] font-mono flex items-center justify-between text-gray-400">
            <span>Created: {product.createdAt ? new Date(product.createdAt).toLocaleString() : 'Not recorded'}</span>
            <span>Last Updated: {product.updatedAt ? new Date(product.updatedAt).toLocaleString() : 'Not recorded'}</span>
          </div>

          {/* Purchase History Ledger */}
          <div className="space-y-2 pt-2 border-t border-[#182026]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-semibold uppercase text-gray-300 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-400" />
                Purchase History ({itemPurchases.length})
              </h4>
              {onNavigateToPurchases && itemPurchases.length > 0 && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToPurchases();
                  }}
                  className="text-[10px] font-mono text-[#00FF66] hover:underline cursor-pointer"
                >
                  View All Orders
                </button>
              )}
            </div>

            {itemPurchases.length === 0 ? (
              <div className="py-4 text-center text-xs font-mono text-gray-400 bg-[#0C0F12] rounded-xl border border-[#182026]">
                No explicit purchase orders linked to this SKU.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {itemPurchases.map((po) => (
                  <div
                    key={po.id}
                    className="p-2.5 rounded-lg bg-[#12161A] border border-[#1B2228] flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <span className="font-bold text-white">{po.purchaseNumber}</span>
                      <span className="text-gray-400 text-[10px] ml-2">{po.purchaseDate}</span>
                      <div className="text-[10px] text-gray-400">
                        {po.vendorNameSnapshot} • Qty: {po.quantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[#00FF66] font-bold">
                        {formatINR(po.invoiceTotal)}
                      </span>
                      <div className="text-[10px] text-gray-400 uppercase">{po.paymentStatus}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock Movements Ledger */}
          <div className="space-y-2 pt-2 border-t border-[#182026]">
            <h4 className="text-xs font-mono font-semibold uppercase text-gray-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#00FF66]" />
              Stock Movements Ledger ({movements.length})
            </h4>

            {movements.length === 0 ? (
              <div className="py-4 text-center text-xs font-mono text-gray-400 bg-[#0C0F12] rounded-xl border border-[#182026]">
                No stock movement events recorded yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {movements.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-lg bg-[#12161A] border border-[#1B2228] flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <span className="font-bold text-white uppercase text-[11px]">{m.type}</span>
                      <span className="text-gray-400 text-[10px] ml-2">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                      <div className="text-[10px] text-gray-400 mt-0.5">{m.notes}</div>
                    </div>
                    <div className="text-right">
                      <span
                        className={
                          m.newStock >= m.previousStock
                            ? 'text-[#00FF66] font-bold'
                            : 'text-amber-400 font-bold'
                        }
                      >
                        {m.newStock >= m.previousStock ? `+${m.quantity}` : `-${m.quantity}`}
                      </span>
                      <div className="text-[10px] text-gray-400">Bal: {m.newStock}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-4 border-t border-[#182026] shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                archiveProduct(product.id, product.archived);
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#141A1F] text-gray-400 hover:text-amber-400 border border-[#232D36] text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {product.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              <span>{product.archived ? 'Restore' : 'Archive'}</span>
            </button>

            <button
              onClick={() => downloadSingleLabelPng(product)}
              className="px-3 py-1.5 rounded-xl bg-[#141A1F] hover:bg-[#1A2229] border border-[#242F38] text-xs font-mono text-gray-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
              title="Download barcode label as PNG"
            >
              <Printer className="w-3.5 h-3.5 text-[#00FF66]" />
              <span>Label PNG</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onGenerateLabel && (
              <button
                onClick={() => {
                  onClose();
                  onGenerateLabel(product);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#141A1F] hover:bg-[#1A2229] text-[#00FF66] border border-[#00FF66]/30 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Batch Labels</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onAdjustStock(product);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#141A1F] hover:bg-[#1A2229] text-gray-200 border border-[#232D36] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#00FF66]" />
              <span>Adjust Stock</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onAddPurchase(product);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-semibold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,102,0.25)] transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New PO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
