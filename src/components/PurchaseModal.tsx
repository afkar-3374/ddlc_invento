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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#E6EDE7] rounded-3xl w-full max-w-4xl p-5 sm:p-7 shadow-2xl relative my-6 text-[#25352C] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F0F5F2] mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#174D35]">
                  Record Purchase Order & Invoice
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2] font-semibold">
                  {addedItems.length} {addedItems.length === 1 ? 'Item' : 'Items'} Added
                </span>
              </div>
              <p className="text-xs text-[#77857C]">
                Multi-item procurement with real-time stock increment & financial ledger entry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#77857C] hover:text-[#25352C] hover:bg-[#F5F9F6] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Action feedback toast */}
        {itemActionSuccess && (
          <div className="mb-4 p-2.5 rounded-xl bg-[#F0F9F2] border border-[#C6E7D2] text-xs text-[#168653] font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-[#168653] shrink-0" />
            <span>{itemActionSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmitPurchaseOrder} className="space-y-5 text-xs">
          {/* SECTION 1: INVOICE & ORDER METADATA */}
          <div className="bg-[#F5F9F6] border border-[#E6EDE7] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-[#E6EDE7]">
              <span className="flex items-center gap-1.5 text-[#174D35] font-bold">
                <Building2 className="w-3.5 h-3.5 text-[#168653]" />
                1. INVOICE & VENDOR DETAILS
              </span>
              <span className="text-[#77857C]">Ledger Header</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Invoice Number */}
              <div>
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  INVOICE / BILL #
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="INV-109283"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] font-semibold focus:outline-none focus:border-[#168653]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceNumber(`INV-${Math.floor(100000 + Math.random() * 900000)}`)
                    }
                    className="absolute right-2 top-2 text-xs text-[#77857C] hover:text-[#168653]"
                    title="Generate random invoice ID"
                  >
                    🎲
                  </button>
                </div>
              </div>

              {/* Vendor */}
              <div>
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  SUPPLIER / VENDOR
                </label>
                <input
                  type="text"
                  list="vendor-datalist"
                  placeholder="e.g. Robu.in, Mouser, Digikey"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                />
                <datalist id="vendor-datalist">
                  {vendors.map((v) => (
                    <option key={v.id} value={v.name} />
                  ))}
                </datalist>
              </div>

              {/* Purchase Date */}
              <div>
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  PURCHASE DATE
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                />
              </div>

              {/* Payment Status */}
              <div>
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  PAYMENT STATUS
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                >
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            {/* Project Allocation */}
            <div className="pt-1">
              <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                CHARGE TO PROJECT (OPTIONAL)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
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
            className={`rounded-2xl p-4 transition-all border ${
              editingItemId
                ? 'bg-amber-50 border-amber-300'
                : 'bg-[#F5F9F6] border-[#E6EDE7]'
            }`}
          >
            <div className="flex items-center justify-between text-xs pb-2.5 mb-3 border-b border-[#E6EDE7]">
              <div className="flex items-center gap-2">
                <span
                  className={`font-bold flex items-center gap-1.5 ${
                    editingItemId ? 'text-amber-800' : 'text-[#174D35]'
                  }`}
                >
                  {editingItemId ? (
                    <>
                      <Edit2 className="w-3.5 h-3.5" />
                      EDITING ADDED ITEM: [{currentEditingProduct?.sku}]
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 text-[#168653]" />
                      2. ADD ITEM TO INVOICE
                    </>
                  )}
                </span>
                {editingItemId && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                    Edit Mode
                  </span>
                )}
              </div>

              {editingItemId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-[#77857C] hover:text-[#25352C] flex items-center gap-1 cursor-pointer"
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
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  PRODUCT / SKU *
                </label>
                <select
                  value={activeProductId}
                  onChange={handleProductChange}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
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
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  QTY RECEIVED *
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveQuantity((q) => Math.max(1, q - 1))}
                    className="px-2.5 py-2 bg-white hover:bg-[#F5F9F6] text-[#25352C] rounded-l-xl border border-r-0 border-[#E6EDE7] cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={activeQuantity}
                    onChange={(e) => setActiveQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-center py-2 bg-white border-y border-[#E6EDE7] text-[#25352C] font-semibold focus:outline-none focus:border-[#168653]"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveQuantity((q) => q + 1)}
                    className="px-2.5 py-2 bg-white hover:bg-[#F5F9F6] text-[#25352C] rounded-r-xl border border-l-0 border-[#E6EDE7] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Unit Price */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  UNIT PRICE (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={activeUnitPrice}
                  onChange={(e) => setActiveUnitPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] font-semibold focus:outline-none focus:border-[#168653]"
                />
              </div>

              {/* Discount */}
              <div className="sm:col-span-1">
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  DISCOUNT
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={activeDiscount}
                  onChange={(e) => setActiveDiscount(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                />
              </div>

              {/* Line Total & Add / Update Button */}
              <div className="sm:col-span-2 flex flex-col justify-end">
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  LINE TOTAL: <span className="text-[#168653] font-bold">{formatINR(currentLineTotal)}</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddOrUpdateItem}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    editingItemId
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-[#168653] hover:bg-[#126E43] text-white'
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

          {/* SECTION 3: ADDED ITEMS TABLE & ACTIONS */}
          <div className="bg-[#F5F9F6] border border-[#E6EDE7] rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#E6EDE7]">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-[#174D35] flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-[#168653]" />
                  3. ADDED ITEMS ({addedItems.length})
                </span>
                {addedItems.length > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white text-[#168653] border border-[#C6E7D2] font-semibold">
                    {totalUnits} Units • {formatINR(grandInvoiceTotal)}
                  </span>
                )}
              </div>

              {addedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAddedItems}
                  className="px-2.5 py-1 rounded-xl text-xs text-red-600 hover:bg-red-50 border border-red-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Clear all added items from this purchase list"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Added Items</span>
                </button>
              )}
            </div>

            {/* List / Table of added items */}
            {addedItems.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white border border-dashed border-[#E6EDE7] text-center space-y-2">
                <Package className="w-8 h-8 text-[#168653] mx-auto opacity-40" />
                <p className="text-xs font-semibold text-[#174D35]">
                  No items added to this purchase order yet.
                </p>
                <p className="text-[11px] text-[#77857C]">
                  Select a product above and click{' '}
                  <span className="text-[#168653] font-bold">+ Add Item</span>, or save now to record the selected item.
                </p>
                <button
                  type="button"
                  onClick={handleAddOrUpdateItem}
                  className="mt-1 px-3 py-1.5 rounded-xl bg-[#E5F5E9] hover:bg-[#D4EED9] text-[#168653] text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Current Item ({products.find((p) => p.id === activeProductId)?.sku || 'Product'})</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-[#E6EDE7] bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F0F9F2] text-[#174D35] text-[11px] font-semibold uppercase border-b border-[#E6EDE7]">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Product / SKU</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Discount</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F5F2]">
                      {addedItems.map((item, index) => {
                        const isBeingEdited = editingItemId === item.id;
                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${
                              isBeingEdited
                                ? 'bg-amber-50 font-medium'
                                : 'hover:bg-[#F5F9F6]'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-[#77857C] text-[11px]">{index + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[#168653] font-bold text-[11px]">
                                  {item.sku}
                                </span>
                                <span className="font-semibold text-[#174D35] truncate max-w-[200px]">
                                  {item.productName}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right text-[#77857C]">
                              {formatINR(item.unitPrice)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-lg bg-[#F5F9F6] text-[#25352C] font-semibold">
                                {item.quantity} {item.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-[#77857C]">
                              {item.discount > 0 ? `-${formatINR(item.discount)}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-[#168653]">
                              {formatINR(item.lineTotal)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditItem(item)}
                                  className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                    isBeingEdited
                                      ? 'bg-amber-600 text-white font-bold'
                                      : 'bg-[#F5F9F6] text-amber-700 hover:bg-amber-50 border border-amber-200'
                                  }`}
                                  title="Edit this added item"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1.5 rounded-lg text-xs bg-[#F5F9F6] text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
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
              </div>
            )}
          </div>

          {/* SECTION 4: GRAND SUMMARY & NOTES */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
            {/* Notes Field */}
            <div className="sm:col-span-7 bg-[#F5F9F6] border border-[#E6EDE7] rounded-2xl p-3.5 flex flex-col justify-between">
              <div>
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  PURCHASE ORDER NOTES & REMARKS
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Courier tracking info, vendor invoice notes, batch approval"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] text-xs resize-none"
                />
              </div>
              <div className="text-[10px] text-[#77857C] mt-2">
                All records sync to Cloud Firestore with atomic audit entries.
              </div>
            </div>

            {/* Total Calculation Card */}
            <div className="sm:col-span-5 bg-white border border-[#E6EDE7] rounded-2xl p-4 flex flex-col justify-between space-y-2 shadow-xs">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[#77857C]">
                  <span>Line Items:</span>
                  <span className="text-[#25352C] font-bold">
                    {addedItems.length > 0 ? addedItems.length : '1 (pending)'}
                  </span>
                </div>
                <div className="flex justify-between text-[#77857C]">
                  <span>Total Units:</span>
                  <span className="text-[#25352C] font-bold">
                    {addedItems.length > 0 ? totalUnits : activeQuantity} units
                  </span>
                </div>
                {totalDiscounts > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Total Discount:</span>
                    <span>-{formatINR(totalDiscounts)}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#F0F5F2] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#77857C] uppercase tracking-wider block">
                    GRAND TOTAL
                  </span>
                  <span className="text-xs text-[#77857C]">0% GST Recorded</span>
                </div>
                <span className="text-xl font-bold text-[#168653]">
                  {formatINR(addedItems.length > 0 ? grandInvoiceTotal : currentLineTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 5: MODAL ACTIONS */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#F0F5F2]">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#F5F9F6] text-[#77857C] hover:text-[#25352C] font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {addedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAddedItems}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
                >
                  Clear Items ({addedItems.length})
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
