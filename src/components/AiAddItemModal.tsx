import React, { useState } from 'react';
import { Sparkles, X, Check, AlertCircle, ArrowRight, Layers, BotMessageSquare } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { generateUniqueSKU, formatINR } from '../services/dbService';

interface AiAddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiAddItemModal: React.FC<AiAddItemModalProps> = ({ isOpen, onClose }) => {
  const { addProduct, projects } = useInventory();

  const [aiPrompt, setAiPrompt] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted item state
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [skuPreview, setSkuPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleParse = async (customPrompt?: string) => {
    const textToParse = customPrompt || aiPrompt;
    if (!textToParse.trim()) return;

    try {
      setParsing(true);
      setError(null);
      setParsedData(null);
      setSavedSuccess(false);

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
      if (!data.name) {
        throw new Error('Could not identify product details. Please provide more specifics.');
      }

      // Generate preview SKU
      const categoryCode = (data.category || 'GEN').slice(0, 3).toUpperCase();
      const generatedSku = await generateUniqueSKU(categoryCode);
      setSkuPreview(generatedSku);
      setParsedData(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to extract product parameters.');
    } finally {
      setParsing(false);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!parsedData) return;

    try {
      setSaving(true);
      setError(null);

      await addProduct({
        sku: skuPreview,
        name: parsedData.name,
        category: parsedData.category || 'General',
        description: parsedData.notes || '',
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

      setSavedSuccess(true);
      setTimeout(() => {
        onClose();
        setParsedData(null);
        setAiPrompt('');
        setSavedSuccess(false);
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to commit item to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  const examplePrompts = [
    'Add 5x Raspberry Pi 5 (8GB) at ₹28,499 from Robu for Beta 2 stored in Locker C-01',
    'Received 20 units STM32F401 BlackPill at ₹749 in Microcontrollers category',
    'Add 8 pieces BME688 AI Environmental Gas Sensor at 2150 INR from Mouser',
    'Add 100x 10k Ohm 1% SMD resistors at 1.5 INR each in Drawer Bin D-12',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#101418] border border-[#222B33] rounded-2xl w-full max-w-xl p-6 shadow-2xl relative my-8 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#182026] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#141F18] border border-[#00FF66]/40 flex items-center justify-center text-[#00FF66] shadow-[0_0_12px_rgba(0,255,102,0.2)]">
              <BotMessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Add Item with DDLC AI
              </h3>
              <p className="text-[11px] font-mono text-gray-400">
                Natural language ingestion & auto-schema mapping to Cloud Firestore
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Area */}
        <div className="space-y-3">
          <label className="text-[10px] font-mono text-gray-400 block">
            DESCRIBE THE ITEM IN NATURAL LANGUAGE OR PASTE PART DETAILS:
          </label>
          <textarea
            rows={3}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g., Add 4 units of Raspberry Pi 5 (8GB) at ₹28,499 with 18% GST from Robu.in for Beta 2 stored in Locker C-01..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF66]"
          />

          {/* Quick example prompt chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[10px] font-mono text-gray-500 self-center mr-1">Examples:</span>
            {examplePrompts.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setAiPrompt(ex);
                  handleParse(ex);
                }}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#13181C] hover:bg-[#1A2228] text-gray-300 hover:text-white border border-[#212B34] transition-colors"
              >
                {ex.slice(0, 32)}...
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleParse()}
            disabled={!aiPrompt.trim() || parsing}
            className="w-full py-2.5 px-4 rounded-xl bg-[#131E17] hover:bg-[#18281E] border border-[#00FF66]/40 text-[#00FF66] font-mono font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_12px_rgba(0,255,102,0.15)] disabled:opacity-50 cursor-pointer"
          >
            {parsing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[#00FF66] border-t-transparent rounded-full animate-spin" />
                <span>Extracting parameters with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Parse & Extract Parameters</span>
              </>
            )}
          </button>
        </div>

        {/* Parsed Extraction Result Preview */}
        {parsedData && (
          <div className="mt-5 pt-4 border-t border-[#1C252C] space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-[#00FF66]">
              <span className="flex items-center gap-1.5 font-bold">
                <Check className="w-3.5 h-3.5" />
                EXTRACTED PARAMETERS READY FOR FIRESTORE
              </span>
              <span className="text-white font-bold bg-[#141A1F] px-2 py-0.5 rounded border border-[#232D35]">
                {skuPreview}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#0E1216] p-3 rounded-xl border border-[#1E2730] text-xs font-mono">
              <div className="col-span-2 sm:col-span-3">
                <span className="text-[10px] text-gray-500 block">PRODUCT NAME</span>
                <span className="text-white font-bold text-sm">{parsedData.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">CATEGORY</span>
                <span className="text-gray-300">{parsedData.category}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">QUANTITY</span>
                <span className="text-white font-bold">
                  {parsedData.quantity} {parsedData.unit || 'pcs'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">UNIT PRICE</span>
                <span className="text-[#00FF66] font-bold">
                  {formatINR(parsedData.unitPrice)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">TOTAL COST</span>
                <span className="text-[#00FF66] font-bold">
                  {formatINR((parsedData.quantity || 1) * (parsedData.unitPrice || 0))}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">SUPPLIER</span>
                <span className="text-gray-300">{parsedData.vendor || 'Direct'}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">LOCATION</span>
                <span className="text-gray-300">{parsedData.storageLocation || 'Main Lab'}</span>
              </div>
            </div>

            {savedSuccess ? (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>Successfully committed to Cloud Firestore!</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSaveToFirestore}
                disabled={saving}
                className="w-full py-2.5 px-4 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,255,102,0.25)] cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Writing document to Firestore...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Add to Cloud Firestore</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
