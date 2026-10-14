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

  // Strictly separate valuations
  const unitCost = product.unitPrice || 0;
  const currentStockValuation = (product.quantity || 0) * unitCost;
  const totalRecordedPurchaseValue = itemPurchases.reduce(
    (acc, po) => acc + (Number(po.invoiceTotal) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#E6EDE7] rounded-3xl w-full max-w-3xl p-5 sm:p-6 shadow-2xl relative my-6 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="flex items-start justify-between pb-4 border-b border-[#F0F5F2] shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2]">
                {product.sku}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F5F9F6] text-[#25352C] border border-[#E6EDE7] font-medium">
                {product.category || 'General'}
              </span>
              {product.barcode && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD]">
                  BARCODE: {product.barcode}
                </span>
              )}
              {product.archived && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                  Archived
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-[#174D35] tracking-tight">
              {product.name}
            </h3>
            {(product.brand || product.model) && (
              <div className="text-xs text-[#77857C] mt-0.5">
                Brand: <span className="text-[#25352C] font-semibold">{product.brand || 'Not recorded'}</span> • Model: <span className="text-[#25352C] font-semibold">{product.model || 'Not recorded'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="p-2 rounded-xl bg-[#F5F9F6] text-[#77857C] hover:text-[#174D35] border border-[#E6EDE7] hover:bg-[#E5F5E9] transition-colors cursor-pointer"
              title="Edit Product"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#77857C] hover:text-[#25352C] hover:bg-[#F5F9F6] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 min-h-0 text-xs">
          {/* Cost & Stock Valuation Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F5F9F6] p-4 rounded-2xl border border-[#E6EDE7]">
            <div>
              <span className="text-[10px] font-semibold text-[#77857C] block uppercase tracking-wider">Current Stock</span>
              <span className="text-lg font-bold text-[#174D35]">
                {product.quantity} <span className="text-xs text-[#77857C] font-normal">{product.unit || 'pcs'}</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-[#77857C] block uppercase tracking-wider">Unit Purchase Cost</span>
              <span className="text-lg font-bold text-[#25352C]">
                {formatINR(unitCost)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-[#77857C] block uppercase tracking-wider">Stock Valuation</span>
              <span className="text-lg font-bold text-[#168653]">
                {formatINR(currentStockValuation)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-[#77857C] block uppercase tracking-wider">Total Recorded PO</span>
              <span className="text-lg font-bold text-[#0284C7]">
                {formatINR(totalRecordedPurchaseValue || product.totalCost || currentStockValuation)}
              </span>
            </div>
          </div>

          {/* Technical Specifications & Allocation Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE7]">
              <span className="text-[10px] font-semibold text-[#77857C] block uppercase tracking-wider">BARCODE VALUE</span>
              <span className="font-mono text-[#168653] font-bold">
                {product.barcode || 'Not recorded'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE7]">
              <span className="text-[10px] font-semibold text-[#77857C] block uppercase tracking-wider">STORAGE LOCATION</span>
              <span className="font-semibold text-[#25352C]">
                {product.storageLocation || 'Main Lab'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE7] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-[#77857C] block uppercase tracking-wider">PROJECT ALLOCATION</span>
                <span className="font-semibold text-[#174D35]">
                  {project ? `${project.name} (${project.code})` : product.projectId || 'Unassigned / General'}
                </span>
              </div>
              {project && onNavigateToProject && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToProject(project.id);
                  }}
                  className="text-xs font-semibold text-[#168653] hover:underline cursor-pointer"
                >
                  View Project
                </button>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE7]">
              <span className="text-[10px] font-semibold text-[#77857C] block uppercase tracking-wider">SUPPLIER / VENDOR</span>
              <span className="font-semibold text-[#25352C]">
                {product.vendor || 'Direct Purchase'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE7]">
              <span className="text-[10px] font-semibold text-[#77857C] block uppercase tracking-wider">PURCHASE DATE</span>
              <span className="font-semibold text-[#25352C]">
                {product.purchaseDate || 'Not recorded'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE7]">
              <span className="text-[10px] font-semibold text-[#77857C] block uppercase tracking-wider">GST RATE & AMOUNT</span>
              <span className="font-semibold text-[#25352C]">
                {product.gstPercent && product.gstPercent > 0
                  ? `${product.gstPercent}% (${formatINR(product.gstAmount)})`
                  : '0% / Exempted (Direct Lab Cost)'}
              </span>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE7]">
              <span className="text-[10px] font-semibold text-[#77857C] block mb-1 uppercase tracking-wider">
                DESCRIPTION & TECHNICAL SPECIFICATIONS
              </span>
              <p className="text-[#25352C] leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Notes */}
          {product.notes && (
            <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE7]">
              <span className="text-[10px] font-semibold text-[#77857C] block mb-1 uppercase tracking-wider">LAB NOTES</span>
              <p className="text-[#25352C] leading-relaxed">{product.notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-[11px] flex items-center justify-between text-[#77857C]">
            <span>Created: {product.createdAt ? new Date(product.createdAt).toLocaleString() : 'Not recorded'}</span>
            <span>Last Updated: {product.updatedAt ? new Date(product.updatedAt).toLocaleString() : 'Not recorded'}</span>
          </div>

          {/* Purchase History Ledger */}
          <div className="space-y-2 pt-2 border-t border-[#F0F5F2]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#174D35] uppercase flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-[#168653]" />
                Purchase History ({itemPurchases.length})
              </h4>
              {onNavigateToPurchases && itemPurchases.length > 0 && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToPurchases();
                  }}
                  className="text-xs font-semibold text-[#168653] hover:underline cursor-pointer"
                >
                  View All Orders
                </button>
              )}
            </div>

            {itemPurchases.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#77857C] bg-[#F5F9F6] rounded-2xl border border-[#E6EDE7]">
                No explicit purchase orders linked to this SKU.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {itemPurchases.map((po) => (
                  <div
                    key={po.id}
                    className="p-3 rounded-xl bg-white border border-[#E6EDE7] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#174D35]">{po.purchaseNumber}</span>
                      <span className="text-[#77857C] text-[11px] ml-2">{po.purchaseDate}</span>
                      <div className="text-[11px] text-[#77857C]">
                        {po.vendorNameSnapshot} • Qty: {po.quantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[#168653] font-bold">
                        {formatINR(po.invoiceTotal)}
                      </span>
                      <div className="text-[10px] text-[#77857C] uppercase">{po.paymentStatus}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock Movements Ledger */}
          <div className="space-y-2 pt-2 border-t border-[#F0F5F2]">
            <h4 className="text-xs font-bold text-[#174D35] uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#168653]" />
              Stock Movements Ledger ({movements.length})
            </h4>

            {movements.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#77857C] bg-[#F5F9F6] rounded-2xl border border-[#E6EDE7]">
                No stock movement events recorded yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {movements.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-white border border-[#E6EDE7] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#174D35] uppercase text-[11px]">{m.type}</span>
                      <span className="text-[#77857C] text-[11px] ml-2">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                      <div className="text-[11px] text-[#77857C] mt-0.5">{m.notes}</div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-bold ${
                          m.newStock >= m.previousStock
                            ? 'text-[#168653]'
                            : 'text-amber-600'
                        }`}
                      >
                        {m.newStock >= m.previousStock ? `+${m.quantity}` : `-${m.quantity}`}
                      </span>
                      <div className="text-[10px] text-[#77857C]">Balance: {m.newStock}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-4 border-t border-[#F0F5F2] shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                archiveProduct(product.id, product.archived);
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#F5F9F6] text-[#77857C] hover:text-amber-600 border border-[#E6EDE7] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {product.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              <span>{product.archived ? 'Restore' : 'Archive'}</span>
            </button>

            <button
              onClick={() => downloadSingleLabelPng(product)}
              className="px-3 py-1.5 rounded-xl bg-[#F5F9F6] hover:bg-[#E5F5E9] border border-[#E6EDE7] text-xs font-semibold text-[#174D35] transition-all cursor-pointer flex items-center gap-1.5"
              title="Download barcode label as PNG"
            >
              <Printer className="w-3.5 h-3.5 text-[#168653]" />
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
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#F5F9F6] border border-[#E6EDE7] text-[#168653] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
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
              className="px-3.5 py-1.5 rounded-xl bg-[#F5F9F6] hover:bg-[#E5F5E9] text-[#25352C] border border-[#E6EDE7] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#168653]" />
              <span>Adjust Stock</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onAddPurchase(product);
              }}
              className="px-4 py-1.5 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
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
