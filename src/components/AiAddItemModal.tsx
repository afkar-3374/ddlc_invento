import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Check,
  AlertCircle,
  ArrowRight,
  BotMessageSquare,
  Edit2,
  Copy,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { generateUniqueSKU, formatINR } from '../services/dbService';
import { Product } from '../types';

interface AiAddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLabelsForProduct?: (product: Product) => void;
}

export const AiAddItemModal: React.FC<AiAddItemModalProps> = ({
  isOpen,
  onClose,
  onOpenLabelsForProduct,
}) => {
  const { addProduct, projects } = useInventory();

  const [aiPrompt, setAiPrompt] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted item state
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [skuPreview, setSkuPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedProduct, setSavedProduct] = useState<Product | null>(null);
  const [copiedSku, setCopiedSku] = useState(false);

  if (!isOpen) return null;

  const handleParse = async (customPrompt?: string) => {
    const textToParse = customPrompt || aiPrompt;
    if (!textToParse.trim()) return;

    try {
      setParsing(true);
      setError(null);
      setParsedData(null);
      setSavedProduct(null);

      const res = await fetch('/api/ai-parse-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToParse,
          projectList: projects.map((p) => ({ id: p.id, name: p.name, code: p.code })),
        }),
      });

      if (!res.ok) {
        throw new Error(`AI extraction error: ${res.statusText}`);
      }

      const data = await res.json();
      setParsedData(data);

      // Generate preview SKU starting with DDLC-
      const categoryCode = (data.category || 'GEN').slice(0, 3).toUpperCase();
      const generatedSku = await generateUniqueSKU(categoryCode);
      setSkuPreview(generatedSku);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse component details with AI.');
    } finally {
      setParsing(false);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!parsedData) return;

    try {
      setSaving(true);
      setError(null);

      // Ensure SKU starts with DDLC-
      let finalSku = skuPreview || (await generateUniqueSKU(parsedData.category?.slice(0, 3) || 'GEN'));
      if (!finalSku.toUpperCase().startsWith('DDLC-')) {
        finalSku = `DDLC-${finalSku.toUpperCase()}`;
      }

      const created = await addProduct({
        name: parsedData.name || 'Electronic Component',
        description: parsedData.notes || parsedData.name || 'Component added via AI Ingestion',
        sku: finalSku,
        barcode: finalSku,
        category: parsedData.category || 'General',
        quantity: Number(parsedData.quantity) || 1,
        unit: parsedData.unit || 'pcs',
        unitPrice: Number(parsedData.unitPrice) || 0,
        gstPercent: 0,
        gstAmount: 0,
        vendor: parsedData.vendor || '',
        purchaseDate: new Date().toISOString().slice(0, 10),
        projectId: parsedData.projectId || '',
        storageLocation: parsedData.storageLocation || 'Main Lab',
        notes: parsedData.notes || '',
        archived: false,
      });

      // Show celebratory post-add state showing assigned DDLC- SKU
      setSavedProduct(created);
    } catch (err: any) {
      setError(err?.message || 'Failed to commit item to Firestore.');
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

  const examplePrompts = [
    'Add 5x Raspberry Pi 5 (8GB) at ₹28,499 from Robu for Beta 2 stored in Locker C-01',
    'Received 20 units STM32F401 BlackPill at ₹749 in Microcontrollers category',
    'Add 8 pieces BME688 AI Environmental Gas Sensor at 2150 INR from Mouser',
    'Add 100x 10k Ohm 1% SMD resistors at 1.5 INR each in Drawer Bin D-12',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#E6EDE7] rounded-3xl w-full max-w-xl p-6 shadow-2xl relative my-8 font-sans animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F0F5F2] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center">
              <BotMessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#174D35]">
                AI Quick Add to Inventory
              </h3>
              <p className="text-xs text-[#77857C]">
                Natural language ingestion & auto-schema mapping to Cloud Firestore
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

        {/* Post-Add Celebratory View (Requirement: "once added a product, show sku of that must starts with DDLC-") */}
        {savedProduct ? (
          <div className="py-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-[#E5F5E9] text-[#168653] flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-[#174D35]">
                Product Added via AI!
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
                  <span>Print Barcode Sticker</span>
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
          <>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Input Area */}
            <div className="space-y-3">
              <label className="text-[11px] font-semibold text-[#77857C] block">
                DESCRIBE THE ITEM IN NATURAL LANGUAGE OR PASTE PART DETAILS:
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Bought 5x ESP32-WROOM-32D at ₹450 from Robu for Beta 2 stored in Locker C-01"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white leading-relaxed"
              />

              {/* Sample Prompts */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-[#77857C] uppercase tracking-wider block">
                  Example natural-language prompts:
                </span>
                <div className="flex flex-col gap-1.5">
                  {examplePrompts.map((eg, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setAiPrompt(eg);
                        handleParse(eg);
                      }}
                      className="text-left text-xs p-2 rounded-xl bg-[#F5F9F6] hover:bg-[#E5F5E9] text-[#25352C] hover:text-[#174D35] border border-[#E6EDE7] transition-colors cursor-pointer"
                    >
                      {eg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleParse()}
                  disabled={parsing || !aiPrompt.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {parsing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Extracting hardware parameters...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Parse Component with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Extracted Item Preview */}
            {parsedData && (
              <div className="mt-5 pt-4 border-t border-[#F0F5F2] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#174D35]">
                    Extracted Hardware Parameters
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-xs text-[#168653] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'View Summary' : 'Edit Fields'}</span>
                  </button>
                </div>

                {/* SKU Preview Pill (DDLC- standard) */}
                <div className="p-2.5 rounded-xl bg-[#E5F5E9] border border-[#C6E7D2] flex items-center justify-between text-xs">
                  <span className="text-[#174D35] font-medium">Automatic Concurrency-Safe SKU:</span>
                  <span className="font-mono font-bold text-[#168653] bg-white px-2.5 py-0.5 rounded-lg border border-[#C6E7D2]">
                    {skuPreview}
                  </span>
                </div>

                {/* Editable form or Readonly card */}
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#F5F9F6] p-3 rounded-2xl border border-[#E6EDE7]">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-[#77857C] block mb-1">PRODUCT NAME</label>
                      <input
                        type="text"
                        value={parsedData.name || ''}
                        onChange={(e) => setParsedData({ ...parsedData, name: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[#77857C] block mb-1">QUANTITY</label>
                      <input
                        type="number"
                        min="0"
                        value={parsedData.quantity || 1}
                        onChange={(e) =>
                          setParsedData({ ...parsedData, quantity: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[#77857C] block mb-1">UNIT PRICE (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={parsedData.unitPrice || 0}
                        onChange={(e) =>
                          setParsedData({ ...parsedData, unitPrice: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[#77857C] block mb-1">SUPPLIER</label>
                      <input
                        type="text"
                        value={parsedData.vendor || ''}
                        onChange={(e) => setParsedData({ ...parsedData, vendor: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[#77857C] block mb-1">STORAGE LOCATION</label>
                      <input
                        type="text"
                        value={parsedData.storageLocation || ''}
                        onChange={(e) =>
                          setParsedData({ ...parsedData, storageLocation: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                      />
                    </div>
                  </div>
                ) : (
                  /* Read-only summary card */
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#F5F9F6] p-3 rounded-2xl border border-[#E6EDE7] text-xs">
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-[10px] text-[#77857C] block">PRODUCT NAME</span>
                      <span className="text-[#174D35] font-bold text-sm">{parsedData.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#77857C] block">CATEGORY</span>
                      <span className="text-[#25352C]">{parsedData.category}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#77857C] block">QUANTITY</span>
                      <span className="text-[#25352C] font-bold">
                        {parsedData.quantity} {parsedData.unit || 'pcs'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#77857C] block">UNIT PRICE</span>
                      <span className="text-[#168653] font-bold">
                        {formatINR(parsedData.unitPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#77857C] block">TOTAL COST</span>
                      <span className="text-[#168653] font-bold">
                        {formatINR((parsedData.quantity || 1) * (parsedData.unitPrice || 0))}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#77857C] block">SUPPLIER</span>
                      <span className="text-[#25352C]">{parsedData.vendor || 'Direct'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#77857C] block">LOCATION</span>
                      <span className="text-[#25352C]">{parsedData.storageLocation || 'Main Lab'}</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveToFirestore}
                  disabled={saving}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Writing document to Firestore...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Add to Cloud Firestore</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
