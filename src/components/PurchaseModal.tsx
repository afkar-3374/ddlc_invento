import React, { useState, useEffect } from 'react';
import { X, Receipt, AlertCircle, Plus, Check } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProductId?: string;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  defaultProductId,
}) => {
  const { products, vendors, projects, addPurchase } = useInventory();

  const [productId, setProductId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(18);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Partially Paid' | 'Unpaid'>('Paid');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default product when opening
  useEffect(() => {
    if (defaultProductId) {
      setProductId(defaultProductId);
      const prod = products.find((p) => p.id === defaultProductId);
      if (prod) {
        setUnitPrice(prod.unitPrice || 0);
        setVendorName(prod.vendor || vendors[0]?.name || '');
        setProjectId(prod.projectId || '');
        setGstRate(prod.gstPercent || 18);
      }
    } else if (products.length > 0) {
      setProductId(products[0].id);
      setUnitPrice(products[0].unitPrice || 0);
      setVendorName(products[0].vendor || vendors[0]?.name || '');
      setProjectId(products[0].projectId || '');
      setGstRate(products[0].gstPercent || 18);
    }
    setInvoiceNumber(`INV-${Math.floor(100000 + Math.random() * 900000)}`);
    setError(null);
  }, [defaultProductId, isOpen, products]);

  // When selected product changes, pre-fill unit price and project
  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setUnitPrice(prod.unitPrice);
      if (prod.vendor) setVendorName(prod.vendor);
      if (prod.projectId) setProjectId(prod.projectId);
      if (prod.gstPercent !== undefined) setGstRate(prod.gstPercent);
    }
  };

  // Calculations
  const subtotal = Math.max(0, (Number(quantity) || 0) * (Number(unitPrice) || 0) - (Number(discount) || 0));
  const gstAmount = (subtotal * (Number(gstRate) || 0)) / 100;
  const invoiceTotal = subtotal + gstAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setError('Please select an inventory product.');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    const selectedProduct = products.find((p) => p.id === productId);
    if (!selectedProduct) {
      setError('Selected product not found.');
      return;
    }

    const selectedProj = projects.find((p) => p.id === projectId);
    const selectedVendorDoc = vendors.find((v) => v.name === vendorName);

    try {
      setSaving(true);
      setError(null);

      await addPurchase({
        productId,
        productNameSnapshot: selectedProduct.name,
        skuSnapshot: selectedProduct.sku,
        vendorId: selectedVendorDoc?.id || 'manual',
        vendorNameSnapshot: vendorName || 'Direct Purchase',
        projectId: projectId || '',
        projectNameSnapshot: selectedProj?.name || 'Unassigned',
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        discount: Number(discount) || 0,
        gstRate: Number(gstRate) || 0,
        gstAmount,
        invoiceTotal,
        invoiceNumber,
        purchaseDate,
        paymentStatus,
        notes,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record purchase.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#101418] border border-[#222B33] rounded-2xl w-full max-w-xl p-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#182026] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#141A1F] border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Record Purchase Order
              </h3>
              <p className="text-[11px] font-mono text-gray-400">
                Increments stock atomically & creates immutable financial ledger entry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Row 1: Target Product */}
          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              SELECT PRODUCT ITEM *
            </label>
            <select
              required
              value={productId}
              onChange={handleProductChange}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66] font-mono"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.name} (Cur. Stock: {p.quantity} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Vendor & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                SUPPLIER / VENDOR
              </label>
              <input
                type="text"
                placeholder="e.g. Robu.in, Mouser, Element14"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                CHARGE TO PROJECT
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66] font-mono"
              >
                <option value="">Unassigned (General Lab Expense)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Pricing & Quantity */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0E1216] p-3 rounded-xl border border-[#1C252C]">
            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                QTY RECEIVED *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                UNIT PRICE (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                DISCOUNT (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                GST RATE (%)
              </label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-amber-400 font-mono focus:outline-none focus:border-[#00FF66]"
              >
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>
          </div>

          {/* Row 4: Invoice Details & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                INVOICE NUMBER
              </label>
              <input
                type="text"
                placeholder="INV-98213"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                PURCHASE DATE
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                PAYMENT STATUS
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono focus:outline-none focus:border-[#00FF66]"
              >
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
          </div>

          {/* Real-time Calculation Breakdown Card */}
          <div className="p-3.5 rounded-xl bg-[#131A1F] border border-[#1E2931] font-mono space-y-1.5">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal ({quantity} units):</span>
              <span className="text-white">{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-amber-400">
              <span>GST Amount ({gstRate}%):</span>
              <span>{formatINR(gstAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-gray-700">
              <span>Final Invoice Total:</span>
              <span className="text-[#00FF66]">{formatINR(invoiceTotal)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              PURCHASE NOTES / REMARKS
            </label>
            <input
              type="text"
              placeholder="e.g. Expedited courier delivery, batch QC certificate attached"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#182026]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#141A1F] text-gray-400 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-semibold flex items-center gap-2 shadow-[0_0_12px_rgba(0,255,102,0.25)] disabled:opacity-50"
            >
              {saving ? 'Recording...' : 'Save & Increment Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
