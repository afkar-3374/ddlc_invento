import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Plus, Info } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types';
import { generateUniqueSKU, formatINR } from '../services/dbService';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  initialSku?: string;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  initialSku,
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
  const [gstPercent, setGstPercent] = useState<number>(0);
  const [vendor, setVendor] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [generatingSku, setGeneratingSku] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setGstPercent(0);
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
      setGstPercent(0);
      setVendor(vendors[0]?.name || '');
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      setProjectId(projects[0]?.id || '');
      setStorageLocation('Lab Rack 1');
      setNotes('');
      if (initialSku) {
        setSku(initialSku);
      } else {
        generatePreviewSku('Computing');
      }
    }
    setError(null);
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

  const gstAmount = 0;
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

      const payload = {
        sku: sku || (await generateUniqueSKU(category.slice(0, 3))),
        barcode: barcode.trim(),
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
      } else {
        await addProduct(payload);
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product to database.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#101418] border border-[#222B33] rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#182026] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#141A1F] border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                {productToEdit ? 'Edit Inventory Item' : 'Add Item to Inventory'}
              </h3>
              <p className="text-[11px] font-mono text-gray-400">
                Automatic concurrency-safe SKU generation & Firestore sync
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
          {/* Row 1: SKU & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                UNIQUE SKU (GENERATED) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-[#00FF66] font-mono font-semibold focus:outline-none focus:border-[#00FF66]"
                />
                {generatingSku && (
                  <span className="absolute right-2.5 top-2 text-[10px] font-mono text-gray-400 animate-pulse">
                    Allocating...
                  </span>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                ITEM NAME *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Raspberry Pi 5 (8GB RAM)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
              />
            </div>
          </div>

          {/* Row 2: Category & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                CATEGORY
              </label>
              {!showNewCatInput ? (
                <select
                  value={category}
                  onChange={handleCategoryChange}
                  className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66] font-mono"
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
                    className="flex-1 px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewCategory}
                    className="px-3 py-2 rounded-xl bg-[#00FF66] text-black font-semibold"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCatInput(false)}
                    className="px-2 py-2 text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                ASSIGNED PROJECT
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66] font-mono"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0E1216] p-3 rounded-xl border border-[#1C252C]">
            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                QUANTITY *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                UNIT (UOM)
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono focus:outline-none focus:border-[#00FF66]"
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
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                UNIT PRICE (₹ INR) *
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
                TOTAL COST (₹)
              </label>
              <div className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-[#00FF66] font-mono font-bold text-xs flex items-center">
                {formatINR(totalPrice)}
              </div>
            </div>
          </div>

          {/* Computed Line Total Badge */}
          <div className="flex items-center justify-between text-xs font-mono px-3 py-2 rounded-lg bg-[#141A1F] border border-[#1E2730]">
            <span className="text-gray-400">
              Calculation: {quantity} {unit} × {formatINR(unitPrice)}
            </span>
            <span className="text-white font-bold">
              Total Cost: <span className="text-[#00FF66]">{formatINR(totalPrice)}</span>
            </span>
          </div>

          {/* Row 4: Barcode, Brand & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                BARCODE VALUE (OPTIONAL)
              </label>
              <input
                type="text"
                placeholder="External barcode / UPC"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-cyan-400 font-mono text-xs focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                BRAND / MANUFACTURER
              </label>
              <input
                type="text"
                placeholder="e.g. Raspberry Pi, Espressif"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                MODEL / REVISION
              </label>
              <input
                type="text"
                placeholder="e.g. Model B Rev 1.2"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
              />
            </div>
          </div>

          {/* Row 5: Vendor & Storage Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                SUPPLIER / VENDOR
              </label>
              <input
                type="text"
                placeholder="e.g. Robu.in or Mouser"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                STORAGE LOCATION
              </label>
              <input
                type="text"
                placeholder="e.g. Locker C-01, Drawer Bin A-03"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
              />
            </div>
          </div>

          {/* Description & Notes */}
          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              TECHNICAL SPECIFICATIONS & DESCRIPTION
            </label>
            <textarea
              rows={2}
              placeholder="Key technical specs, pinout, interfaces, intended circuit application..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-[#182026]">
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
                className="px-3 py-2 rounded-xl text-xs font-mono text-red-400 hover:text-red-300 border border-red-500/30 hover:bg-red-950/40 transition-colors cursor-pointer"
              >
                Clear Form
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
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
                {saving ? 'Writing to Firestore...' : productToEdit ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
