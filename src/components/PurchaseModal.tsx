import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  AlertCircle,
  Plus,
  Check,
  Edit2,
  Trash2,
  RotateCcw,
  Package,
  Layers,
  ArrowRight,
  Calculator,
  ShoppingCart,
  Calendar,
  Building2,
  FolderGit2,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';

export interface PurchaseItemLine {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  currentStock: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

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

  // Invoice-level details
  const [vendorName, setVendorName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Partially Paid' | 'Unpaid'>('Paid');
  const [notes, setNotes] = useState('');

  // Added items list
  const [addedItems, setAddedItems] = useState<PurchaseItemLine[]>([]);

  // Item form inputs (for adding new or editing an existing added item)
  const [activeProductId, setActiveProductId] = useState('');
  const [activeQuantity, setActiveQuantity] = useState<number>(1);
  const [activeUnitPrice, setActiveUnitPrice] = useState<number>(0);
  const [activeDiscount, setActiveDiscount] = useState<number>(0);

  // Editing state: if string, points to PurchaseItemLine.id currently being edited
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemActionSuccess, setItemActionSuccess] = useState<string | null>(null);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setInvoiceNumber(`INV-${Math.floor(100000 + Math.random() * 900000)}`);
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setPaymentStatus('Paid');
    setNotes('');
    setAddedItems([]);
    setEditingItemId(null);
    setError(null);
    setItemActionSuccess(null);

    const initialProd = defaultProductId
      ? products.find((p) => p.id === defaultProductId)
      : products[0];

    if (initialProd) {
      setActiveProductId(initialProd.id);
      setActiveUnitPrice(initialProd.unitPrice || 0);
      setActiveQuantity(1);
      setActiveDiscount(0);
      setVendorName(initialProd.vendor || vendors[0]?.name || '');
      setProjectId(initialProd.projectId || '');
    }
  }, [isOpen, defaultProductId, products, vendors]);

  // When selected product changes in the input form
  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setActiveProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setActiveUnitPrice(prod.unitPrice || 0);
      if (!vendorName && prod.vendor) setVendorName(prod.vendor);
      if (!projectId && prod.projectId) setProjectId(prod.projectId);
    }
  };

  // Line total for current inputs
  const currentLineTotal = Math.max(
    0,
    (Number(activeQuantity) || 0) * (Number(activeUnitPrice) || 0) - (Number(activeDiscount) || 0)
  );

  // Add Item to List
  const handleAddOrUpdateItem = () => {
    setError(null);
    if (!activeProductId) {
      setError('Please select a product.');
      return;
    }
    if (activeQuantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    const prod = products.find((p) => p.id === activeProductId);
    if (!prod) {
      setError('Selected product not found.');
      return;
    }

    const lineTotal = Math.max(
      0,
      activeQuantity * (Number(activeUnitPrice) || 0) - (Number(activeDiscount) || 0)
    );

    if (editingItemId) {
      // Update existing item
      setAddedItems((prev) =>
        prev.map((item) =>
          item.id === editingItemId
            ? {
                ...item,
                productId: prod.id,
                productName: prod.name,
                sku: prod.sku,
                unit: prod.unit || 'pcs',
                currentStock: prod.quantity || 0,
                quantity: activeQuantity,
                unitPrice: Number(activeUnitPrice) || 0,
                discount: Number(activeDiscount) || 0,
                lineTotal,
              }
            : item
        )
      );
      setEditingItemId(null);
      setItemActionSuccess(`Updated item [${prod.sku}] in purchase list`);
    } else {
      // Add new item
      const newItem: PurchaseItemLine = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        unit: prod.unit || 'pcs',
        currentStock: prod.quantity || 0,
        quantity: activeQuantity,
        unitPrice: Number(activeUnitPrice) || 0,
        discount: Number(activeDiscount) || 0,
        lineTotal,
      };

      setAddedItems((prev) => [...prev, newItem]);
      setItemActionSuccess(`Added [${prod.sku}] ${prod.name.slice(0, 20)} to purchase list`);
    }

    // Reset inputs for next item
    const remainingProducts = products.filter(
      (p) => p.id !== activeProductId && !addedItems.some((ai) => ai.productId === p.id)
    );
    const nextProd = remainingProducts[0] || prod;
    if (nextProd && nextProd.id !== activeProductId) {
      setActiveProductId(nextProd.id);
      setActiveUnitPrice(nextProd.unitPrice || 0);
    }
    setActiveQuantity(1);
    setActiveDiscount(0);

    setTimeout(() => {
      setItemActionSuccess(null);
    }, 2200);
  };

  // Start editing an added item
  const handleStartEditItem = (item: PurchaseItemLine) => {
    setEditingItemId(item.id);
    setActiveProductId(item.productId);
    setActiveQuantity(item.quantity);
    setActiveUnitPrice(item.unitPrice);
    setActiveDiscount(item.discount);
    setError(null);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setActiveQuantity(1);
    setActiveDiscount(0);
    if (products.length > 0) {
      setActiveProductId(products[0].id);
      setActiveUnitPrice(products[0].unitPrice || 0);
    }
  };

  // Remove single item
  const handleRemoveItem = (id: string) => {
    if (editingItemId === id) {
      handleCancelEdit();
    }
    setAddedItems((prev) => prev.filter((item) => item.id !== id));
    setItemActionSuccess('Removed item from purchase list');
    setTimeout(() => setItemActionSuccess(null), 2000);
  };

  // Clear ALL added items
  const handleClearAddedItems = () => {
    if (addedItems.length === 0) return;
    setAddedItems([]);
    setEditingItemId(null);
    setItemActionSuccess('Cleared all added items');
    setTimeout(() => setItemActionSuccess(null), 2000);
  };

  // Grand totals
  const totalUnits = addedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalGrossCost = addedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const totalDiscounts = addedItems.reduce(
    (sum, item) => sum + (Number(item.discount) || 0),
    0
  );
  const grandInvoiceTotal = Math.max(0, totalGrossCost - totalDiscounts);

  // Submit & Save to Firestore
  const handleSubmitPurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If user has not explicitly clicked "Add Item" yet, but has an active product selected with qty > 0,
    // let's auto-include it if addedItems is empty so user never feels blocked!
    let itemsToSave = [...addedItems];
    if (itemsToSave.length === 0) {
      if (!activeProductId || activeQuantity <= 0) {
        setError('Please add at least one item to this purchase order.');
        return;
      }
      const prod = products.find((p) => p.id === activeProductId);
      if (!prod) {
        setError('Selected product not found.');
        return;
      }
      itemsToSave = [
        {
          id: `item_auto_${Date.now()}`,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          unit: prod.unit || 'pcs',
          currentStock: prod.quantity || 0,
          quantity: activeQuantity,
          unitPrice: Number(activeUnitPrice) || 0,
          discount: Number(activeDiscount) || 0,
          lineTotal: currentLineTotal,
        },
      ];
    }

    const selectedProj = projects.find((p) => p.id === projectId);
    const selectedVendorDoc = vendors.find((v) => v.name === vendorName);

    try {
      setSaving(true);
      setError(null);

      // Save each added item as a purchase ledger entry and increment stock atomically
      for (const item of itemsToSave) {
        await addPurchase({
          productId: item.productId,
          productNameSnapshot: item.productName,
          skuSnapshot: item.sku,
          vendorId: selectedVendorDoc?.id || 'manual',
          vendorNameSnapshot: vendorName || 'Direct Purchase',
          projectId: projectId || '',
          projectNameSnapshot: selectedProj?.name || 'Unassigned',
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount) || 0,
          gstRate: 0,
          gstAmount: 0,
          invoiceTotal: item.lineTotal,
          invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-6)}`,
          purchaseDate,
          paymentStatus,
          notes:
            notes.trim() ||
            (itemsToSave.length > 1 ? `Multi-item invoice [${item.sku}]` : 'Recorded via Purchase Order'),
        });
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record purchase order to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentEditingProduct = editingItemId
    ? addedItems.find((i) => i.id === editingItemId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0E1216] border border-[#222B33] rounded-2xl w-full max-w-4xl p-5 sm:p-7 shadow-2xl relative my-6 font-sans text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1A2229] mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#141F18] border border-[#00FF66]/40 flex items-center justify-center text-[#00FF66] shadow-[0_0_12px_rgba(0,255,102,0.2)]">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white font-display">
                  Record Purchase Order & Invoice
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#16221A] text-[#00FF66] border border-[#00FF66]/30">
                  {addedItems.length} {addedItems.length === 1 ? 'Item' : 'Items'} Added
                </span>
              </div>
              <p className="text-[11px] font-mono text-gray-400">
                Multi-item procurement with real-time stock increment & financial ledger entry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1A2229] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-200 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Action feedback toast */}
        {itemActionSuccess && (
          <div className="mb-4 p-2.5 rounded-xl bg-[#12231A] border border-[#00FF66]/40 text-xs font-mono text-[#00FF66] flex items-center gap-2">
            <Check className="w-4 h-4 text-[#00FF66] shrink-0" />
            <span>{itemActionSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmitPurchaseOrder} className="space-y-5 text-xs">
          {/* SECTION 1: INVOICE & ORDER METADATA */}
          <div className="bg-[#12161A] border border-[#1C252D] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 pb-2 border-b border-[#1A2229]">
              <span className="flex items-center gap-1.5 text-[#00FF66] font-bold">
                <Building2 className="w-3.5 h-3.5" />
                1. INVOICE & VENDOR DETAILS
              </span>
              <span className="text-gray-500 font-mono">Ledger Header</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Invoice Number */}
              <div>
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  INVOICE / BILL #
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="INV-109283"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#161C22] border border-[#242F3A] text-white font-mono focus:outline-none focus:border-[#00FF66]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceNumber(`INV-${Math.floor(100000 + Math.random() * 900000)}`)
                    }
                    className="absolute right-2 top-2 text-[10px] font-mono text-gray-500 hover:text-[#00FF66]"
                    title="Generate random invoice ID"
                  >
                    🎲
                  </button>
                </div>
              </div>

              {/* Vendor */}
              <div>
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  SUPPLIER / VENDOR
                </label>
                <input
                  type="text"
                  list="vendor-datalist"
                  placeholder="e.g. Robu.in, Mouser, Digikey"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#161C22] border border-[#242F3A] text-white focus:outline-none focus:border-[#00FF66]"
                />
                <datalist id="vendor-datalist">
                  {vendors.map((v) => (
                    <option key={v.id} value={v.name} />
                  ))}
                </datalist>
              </div>

              {/* Purchase Date */}
              <div>
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  PURCHASE DATE
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#161C22] border border-[#242F3A] text-white font-mono focus:outline-none focus:border-[#00FF66]"
                />
              </div>

              {/* Payment Status */}
              <div>
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  PAYMENT STATUS
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#161C22] border border-[#242F3A] text-white font-mono focus:outline-none focus:border-[#00FF66]"
                >
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            {/* Project Allocation */}
            <div className="pt-1">
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                CHARGE TO PROJECT (OPTIONAL)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#161C22] border border-[#242F3A] text-white font-mono focus:outline-none focus:border-[#00FF66]"
              >
                <option value="">Unassigned (General Lab Procurement / Shared Inventory)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) — Status: {p.status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SECTION 2: ADD / EDIT ITEM TO PURCHASE FORM */}
          <div
            className={`rounded-xl p-4 transition-all border ${
              editingItemId
                ? 'bg-[#1C180E] border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                : 'bg-[#12161A] border-[#1C252D]'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono pb-2.5 mb-3 border-b border-[#1E2730]">
              <div className="flex items-center gap-2">
                <span
                  className={`font-bold flex items-center gap-1.5 ${
                    editingItemId ? 'text-amber-400' : 'text-[#00FF66]'
                  }`}
                >
                  {editingItemId ? (
                    <>
                      <Edit2 className="w-3.5 h-3.5" />
                      EDITING ADDED ITEM: [{currentEditingProduct?.sku}]
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      2. ADD ITEM TO INVOICE
                    </>
                  )}
                </span>
                {editingItemId && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    Active Edit Mode
                  </span>
                )}
              </div>

              {editingItemId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-[11px] font-mono text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Product Select */}
              <div className="sm:col-span-5">
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  PRODUCT / SKU *
                </label>
                <select
                  value={activeProductId}
                  onChange={handleProductChange}
                  className="w-full px-3 py-2 rounded-xl bg-[#161C22] border border-[#242F3A] text-white focus:outline-none focus:border-[#00FF66] font-mono"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} (Stock: {p.quantity} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="sm:col-span-2">
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  QTY RECEIVED *
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveQuantity((q) => Math.max(1, q - 1))}
                    className="px-2.5 py-2 bg-[#1A222A] hover:bg-[#222E38] text-gray-300 rounded-l-xl border border-r-0 border-[#242F3A] cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={activeQuantity}
                    onChange={(e) => setActiveQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-center py-2 bg-[#161C22] border-y border-[#242F3A] text-white font-mono focus:outline-none focus:border-[#00FF66]"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveQuantity((q) => q + 1)}
                    className="px-2.5 py-2 bg-[#1A222A] hover:bg-[#222E38] text-gray-300 rounded-r-xl border border-l-0 border-[#242F3A] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Unit Price */}
              <div className="sm:col-span-2">
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  UNIT PRICE (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={activeUnitPrice}
                  onChange={(e) => setActiveUnitPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#161C22] border border-[#242F3A] text-white font-mono focus:outline-none focus:border-[#00FF66]"
                />
              </div>

              {/* Discount */}
              <div className="sm:col-span-1">
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  DISCOUNT
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={activeDiscount}
                  onChange={(e) => setActiveDiscount(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#161C22] border border-[#242F3A] text-white font-mono focus:outline-none focus:border-[#00FF66]"
                />
              </div>

              {/* Line Total & Add / Update Button */}
              <div className="sm:col-span-2 flex flex-col justify-end">
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  LINE TOTAL: <span className="text-[#00FF66] font-bold">{formatINR(currentLineTotal)}</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddOrUpdateItem}
                  className={`w-full py-2 px-3 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
                    editingItemId
                      ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                      : 'bg-[#15271C] hover:bg-[#1A3324] border border-[#00FF66]/50 text-[#00FF66] shadow-[0_0_10px_rgba(0,255,102,0.15)]'
                  }`}
                >
                  {editingItemId ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Update Item</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Item</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: ADDED ITEMS TABLE & ACTIONS (EDIT & CLEAR) */}
          <div className="bg-[#12161A] border border-[#1C252D] rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#1E2730]">
              <div className="flex items-center gap-2.5">
                <span className="font-bold font-mono text-[#00FF66] flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  3. ADDED ITEMS ({addedItems.length})
                </span>
                {addedItems.length > 0 && (
                  <span className="text-[10px] font-mono text-gray-400 bg-[#161D22] px-2 py-0.5 rounded border border-[#24303B]">
                    {totalUnits} Units • {formatINR(grandInvoiceTotal)}
                  </span>
                )}
              </div>

              {/* Action buttons: Edit & Clear Added Items */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {addedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAddedItems}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 border border-red-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Clear all added items from this purchase list"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Added Items</span>
                  </button>
                )}
              </div>
            </div>

            {/* List / Table of added items */}
            {addedItems.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#0F1317] border border-dashed border-[#222C36] text-center space-y-2">
                <Package className="w-8 h-8 text-gray-600 mx-auto" />
                <p className="text-xs text-gray-400">
                  No items added to this purchase order yet.
                </p>
                <p className="text-[11px] font-mono text-gray-500">
                  Select a product above and click{' '}
                  <span className="text-[#00FF66] font-bold">+ Add Item</span>, or save now to record the selected item.
                </p>
                <button
                  type="button"
                  onClick={handleAddOrUpdateItem}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-[#141E18] text-[#00FF66] border border-[#00FF66]/30 text-xs font-mono hover:bg-[#1A2820] cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Current Item ({products.find((p) => p.id === activeProductId)?.sku || 'Product'})</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Desktop View Table */}
                <div className="hidden sm:block overflow-x-auto rounded-lg border border-[#1E2730]">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#151B20] text-gray-400 text-[10px] uppercase border-b border-[#1E2730]">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Product / SKU</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Discount</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#182128]">
                      {addedItems.map((item, index) => {
                        const isBeingEdited = editingItemId === item.id;
                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${
                              isBeingEdited
                                ? 'bg-amber-950/20 text-white font-medium'
                                : 'bg-[#101418] hover:bg-[#141A20] text-gray-300'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-gray-500 text-[11px]">{index + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[#00FF66] font-bold text-[11px]">
                                  {item.sku}
                                </span>
                                <span className="text-white font-sans truncate max-w-[200px]">
                                  {item.productName}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-300">
                              {formatINR(item.unitPrice)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded bg-[#182128] text-white font-bold">
                                {item.quantity} {item.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-400">
                              {item.discount > 0 ? `-${formatINR(item.discount)}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-[#00FF66]">
                              {formatINR(item.lineTotal)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Edit Added Item */}
                                <button
                                  type="button"
                                  onClick={() => handleStartEditItem(item)}
                                  className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                    isBeingEdited
                                      ? 'bg-amber-500 text-black font-bold'
                                      : 'bg-[#182028] text-amber-400 hover:bg-amber-950/50 hover:text-amber-300 border border-amber-500/30'
                                  }`}
                                  title="Edit this added item"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Remove Added Item */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1.5 rounded-lg text-xs bg-[#182028] text-red-400 hover:bg-red-950/50 hover:text-red-300 border border-red-500/30 transition-colors cursor-pointer"
                                  title="Remove this item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Cards */}
                <div className="sm:hidden space-y-2">
                  {addedItems.map((item, index) => {
                    const isBeingEdited = editingItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isBeingEdited
                            ? 'bg-amber-950/20 border-amber-500/50'
                            : 'bg-[#101418] border-[#1C252D]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono text-[#00FF66] font-bold">
                              #{index + 1} • {item.sku}
                            </span>
                            <h4 className="text-xs font-semibold text-white mt-0.5">
                              {item.productName}
                            </h4>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#00FF66]">
                            {formatINR(item.lineTotal)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#182128] text-[11px] font-mono text-gray-400">
                          <div>
                            <span>Qty: </span>
                            <span className="text-white font-bold">
                              {item.quantity} {item.unit}
                            </span>{' '}
                            <span>@ {formatINR(item.unitPrice)}</span>
                            {item.discount > 0 && (
                              <span className="text-amber-400 ml-1">(-{formatINR(item.discount)})</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEditItem(item)}
                              className="px-2 py-1 rounded bg-[#182028] text-amber-400 border border-amber-500/30 text-[10px] flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="px-2 py-1 rounded bg-[#182028] text-red-400 border border-red-500/30 text-[10px] flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: GRAND SUMMARY & NOTES */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
            {/* Notes Field */}
            <div className="sm:col-span-7 bg-[#12161A] border border-[#1C252D] rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <label className="text-[10px] font-mono text-gray-400 block mb-1">
                  PURCHASE ORDER NOTES & REMARKS
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Expedited courier delivery, batch QC certificate attached, PO approved by lead"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#161C22] border border-[#242F3A] text-white focus:outline-none focus:border-[#00FF66] text-xs resize-none"
                />
              </div>
              <div className="text-[10px] font-mono text-gray-500 mt-2">
                All records sync to Cloud Firestore with atomic audit entries.
              </div>
            </div>

            {/* Total Calculation Card */}
            <div className="sm:col-span-5 bg-[#12181E] border border-[#1E2B35] rounded-xl p-3.5 flex flex-col justify-between space-y-2 font-mono">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Line Items:</span>
                  <span className="text-white font-bold">
                    {addedItems.length > 0 ? addedItems.length : '1 (pending)'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Total Units:</span>
                  <span className="text-white font-bold">
                    {addedItems.length > 0 ? totalUnits : activeQuantity} units
                  </span>
                </div>
                {totalDiscounts > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Total Discount:</span>
                    <span>-{formatINR(totalDiscounts)}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#22303D] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                    GRAND TOTAL
                  </span>
                  <span className="text-xs text-gray-500 font-mono">0% GST Recorded</span>
                </div>
                <span className="text-xl font-bold text-[#00FF66] tracking-tight drop-shadow-[0_0_8px_rgba(0,255,102,0.3)]">
                  {formatINR(addedItems.length > 0 ? grandInvoiceTotal : currentLineTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 5: MODAL ACTIONS */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#182026]">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#141A1F] hover:bg-[#1A2228] text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {addedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAddedItems}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-mono text-red-400 hover:text-white hover:bg-red-950/40 border border-red-500/30 transition-colors cursor-pointer"
                >
                  Clear Items ({addedItems.length})
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,255,102,0.25)] cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Recording Purchase Order...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    Save Purchase Order ({addedItems.length > 0 ? addedItems.length : 1}{' '}
                    {addedItems.length === 1 || addedItems.length === 0 ? 'Item' : 'Items'})
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
