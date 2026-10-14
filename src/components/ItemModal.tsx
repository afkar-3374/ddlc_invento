import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  AlertCircle,
  Plus,
  Info,
  CheckCircle2,
  Copy,
  Check,
  Tag,
  ExternalLink,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types';
import { generateUniqueSKU, formatINR } from '../services/dbService';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  initialSku?: string;
  onOpenLabelsForProduct?: (product: Product) => void;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  initialSku,
  onOpenLabelsForProduct,
}) => {
  const { addProduct, editProduct, categories, projects, vendors, addCategory } = useInventory();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('Computing');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('pcs');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [vendor, setVendor] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [generatingSku, setGeneratingSku] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state showing assigned SKU (Requirement: "once added a product, show sku of that must starts with DDLC-")
  const [savedProduct, setSavedProduct] = useState<Product | null>(null);
  const [copiedSku, setCopiedSku] = useState(false);

  // Initialize form state
  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setSku(productToEdit.sku);
      setBarcode(productToEdit.barcode || '');
      setBrand(productToEdit.brand || '');
      setModel(productToEdit.model || '');
      setCategory(productToEdit.category || 'Computing');
      setDescription(productToEdit.description || '');
      setQuantity(productToEdit.quantity || 0);
      setUnit(productToEdit.unit || 'pcs');
      setUnitPrice(productToEdit.unitPrice || 0);
      setVendor(productToEdit.vendor || '');
      setPurchaseDate(productToEdit.purchaseDate || new Date().toISOString().slice(0, 10));
      setProjectId(productToEdit.projectId || '');
      setStorageLocation(productToEdit.storageLocation || '');
      setNotes(productToEdit.notes || '');
    } else {
      setName('');
      setCategory('Computing');
      setBarcode('');
      setBrand('');
      setModel('');
      setDescription('');
      setQuantity(1);
      setUnit('pcs');
      setUnitPrice(0);
      setVendor(vendors[0]?.name || '');
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      setProjectId(projects[0]?.id || '');
      setStorageLocation('Lab Rack 1');
      setNotes('');
      if (initialSku) {
        const cleanSku = initialSku.toUpperCase().startsWith('DDLC-') ? initialSku.toUpperCase() : `DDLC-${initialSku.toUpperCase()}`;
        setSku(cleanSku);
      } else {
        generatePreviewSku('Computing');
      }
    }
    setError(null);
    setSavedProduct(null);
    setCopiedSku(false);
  }, [productToEdit, isOpen, initialSku]);

  const generatePreviewSku = async (catName: string) => {
    try {
      setGeneratingSku(true);
      const code = catName.slice(0, 3).toUpperCase() || 'GEN';
      const newSku = await generateUniqueSKU(code);
      setSku(newSku);
    } catch (e) {
      console.warn('SKU gen error:', e);
    } finally {
      setGeneratingSku(false);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__NEW__') {
      setShowNewCatInput(true);
    } else {
      setShowNewCatInput(false);
      setCategory(val);
      if (!productToEdit) {
        generatePreviewSku(val);
      }
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    const catCode = newCategoryName.slice(0, 3).toUpperCase();
    await addCategory({
      name: newCategoryName.trim(),
      code: catCode,
      description: 'Custom category',
    });
    setCategory(newCategoryName.trim());
    setShowNewCatInput(false);
    if (!productToEdit) {
      generatePreviewSku(newCategoryName);
    }
    setNewCategoryName('');
  };

  const totalPrice = (Number(unitPrice) || 0) * (Number(quantity) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Ensure SKU starts with DDLC-
      let finalSku = sku.trim();
      if (!finalSku) {
        finalSku = await generateUniqueSKU(category.slice(0, 3));
      }
      if (!finalSku.toUpperCase().startsWith('DDLC-')) {
        finalSku = `DDLC-${finalSku.toUpperCase()}`;
      }

      const payload = {
        sku: finalSku,
        barcode: barcode.trim() || finalSku,
        brand: brand.trim(),
        model: model.trim(),
        name: name.trim(),
        category,
        description,
        quantity: Number(quantity) || 0,
        unit,
        unitPrice: Number(unitPrice) || 0,
        gstPercent: 0,
        gstAmount: 0,
        vendor,
        purchaseDate,
        projectId,
        storageLocation,
        notes,
        archived: productToEdit?.archived || false,
      };

      if (productToEdit) {
        await editProduct(productToEdit.id, payload);
        onClose();
      } else {
        const created = await addProduct(payload);
        // Show celebratory success screen with the newly assigned SKU!
        setSavedProduct(created);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save product to database.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopySku = () => {
    if (savedProduct?.sku && navigator?.clipboard) {
      navigator.clipboard.writeText(savedProduct.sku);
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#E6EDE7] rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F0F5F2] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#174D35]">
                {productToEdit ? 'Edit Inventory Item' : 'Add Item to Inventory'}
              </h3>
              <p className="text-xs text-[#77857C]">
                Automatic DDLC- SKU allocation • Cloud Firestore sync
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

        {/* Celebratory Post-Add Screen (Requirement: "once added a product, show sku of that must starts with DDLC-") */}
        {savedProduct ? (
          <div className="py-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-[#E5F5E9] text-[#168653] flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-[#174D35]">
                Product Registered Successfully!
              </h4>
              <p className="text-xs text-[#77857C]">
                Saved permanently to Cloud Firestore with automatic purchase order ledger.
              </p>
            </div>

            {/* Prominent SKU Display Card */}
            <div className="bg-[#F5F9F6] border-2 border-[#168653] p-5 rounded-2xl max-w-md mx-auto space-y-3 shadow-xs">
              <span className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider block">
                ASSIGNED PERMANENT SKU (DDLC- MANDATE)
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-mono font-bold text-[#168653] bg-white px-4 py-1 rounded-xl border border-[#C6E7D2] shadow-2xs">
                  {savedProduct.sku}
                </span>
                <button
                  onClick={handleCopySku}
                  className="p-2 rounded-xl bg-white border border-[#E6EDE7] hover:bg-[#E5F5E9] text-[#168653] transition-colors cursor-pointer"
                  title="Copy SKU"
                >
                  {copiedSku ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <div className="text-xs text-[#25352C] font-semibold pt-1">
                {savedProduct.name} ({savedProduct.quantity} {savedProduct.unit} • {formatINR(savedProduct.totalCost)})
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              {onOpenLabelsForProduct && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenLabelsForProduct(savedProduct);
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#E6EDE7] text-[#174D35] font-semibold text-xs flex items-center gap-2 hover:bg-[#F5F9F6] cursor-pointer"
                >
                  <Tag className="w-4 h-4 text-[#168653]" />
                  <span>Print Barcode Label</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Normal Form */
          <>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Row 1: SKU & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    UNIQUE SKU (DDLC-...) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#168653] font-mono font-bold focus:outline-none focus:border-[#168653] focus:bg-white"
                    />
                    {generatingSku && (
                      <span className="absolute right-2.5 top-2 text-[10px] text-[#77857C] animate-pulse">
                        Allocating...
                      </span>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    PRODUCT NAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Raspberry Pi 5 8GB or ESP32-WROOM-32D"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 2: Category & Project */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    CATEGORY
                  </label>
                  {!showNewCatInput ? (
                    <select
                      value={category}
                      onChange={handleCategoryChange}
                      className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                      <option value="__NEW__">+ Create New Category...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="New Category Name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewCategory}
                        className="px-3 py-2 rounded-xl bg-[#168653] text-white font-semibold"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewCatInput(false)}
                        className="px-2 py-2 text-[#77857C] hover:text-[#25352C]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    ASSIGNED PROJECT
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
                  >
                    <option value="">Unassigned (General Lab Stock)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Quantity, Unit, Unit Price, Total Cost */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F5F9F6] p-3.5 rounded-2xl border border-[#E6EDE7]">
                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    QUANTITY *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] font-semibold focus:outline-none focus:border-[#168653]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    UNIT (UOM)
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                  >
                    <option value="pcs">pcs (Pieces)</option>
                    <option value="units">units</option>
                    <option value="sets">sets</option>
                    <option value="m">m (Meters)</option>
                    <option value="reels">reels</option>
                    <option value="pkts">pkts</option>
                    <option value="kg">kg</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    UNIT PRICE (₹ INR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] font-semibold focus:outline-none focus:border-[#168653]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    TOTAL COST (0% GST)
                  </label>
                  <div className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6EDE7] text-[#168653] font-bold text-xs flex items-center">
                    {formatINR(totalPrice)}
                  </div>
                </div>
              </div>

              {/* Row 4: Barcode, Brand & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    BARCODE / UPC (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="External barcode or SKU"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    BRAND / MANUFACTURER
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Raspberry Pi, Espressif"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    MODEL / REVISION
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Model B Rev 1.2"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 5: Vendor & Storage Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    SUPPLIER / VENDOR
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Robu.in or Mouser"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                    STORAGE LOCATION
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Locker C-01, Drawer Bin A-03"
                    value={storageLocation}
                    onChange={(e) => setStorageLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
                  />
                </div>
              </div>

              {/* Description & Notes */}
              <div>
                <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                  TECHNICAL SPECIFICATIONS & DESCRIPTION
                </label>
                <textarea
                  rows={2}
                  placeholder="Key technical specs, pinout, interfaces, intended circuit application..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#F0F5F2]">
                {!productToEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setName('');
                      setBarcode('');
                      setBrand('');
                      setModel('');
                      setDescription('');
                      setQuantity(1);
                      setUnitPrice(0);
                      setVendor('');
                      setStorageLocation('');
                      setNotes('');
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    Clear Form
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-[#F5F9F6] text-[#77857C] hover:text-[#25352C] font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Writing to Firestore...' : productToEdit ? 'Save Changes' : 'Create Product'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
