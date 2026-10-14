import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Zap,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { ProposedAction } from '../types';
import { formatINR } from '../services/dbService';

interface AiCommandBarProps {
  placeholder?: string;
  samplePrompts?: string[];
  onOpenFullAssistant?: (prompt: string) => void;
}

export const AiCommandBar: React.FC<AiCommandBarProps> = ({
  placeholder = 'Tell DDLC AI: "Add 10 ESP32 at ₹450", "Adjust stock of Pi to 15", "Create project Beta 3"...',
  samplePrompts = [
    'Add 5x ESP32-WROOM-32D at ₹450 for Beta 2',
    'Set stock of Raspberry Pi to 20',
    'Create project Beta 3',
    'Record purchase: 10 sensors from Robu at ₹450',
  ],
  onOpenFullAssistant,
}) => {
  const {
    products,
    projects,
    purchases,
    vendors,
    stockMovements,
    addProduct,
    editProduct,
    archiveProduct,
    adjustProductStock,
    deleteProduct,
    addPurchase,
    addProject,
    addVendor,
  } = useInventory();

  const [mode, setMode] = useState<'ai' | 'direct'>('ai');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Quick direct fields (Zero-modal)
  const [directName, setDirectName] = useState('');
  const [directQty, setDirectQty] = useState('10');
  const [directPrice, setDirectPrice] = useState('450');
  const [directCategory, setDirectCategory] = useState('Microcontrollers');
  const [directProjectId, setDirectProjectId] = useState('');

  // 1-Click Hardware Quick Add templates
  const quickTemplates = [
    { name: 'ESP32-WROOM-32D', qty: 10, price: 450, category: 'Microcontrollers', location: 'Lab Shelf A1' },
    { name: 'Raspberry Pi 5 8GB', qty: 5, price: 28499, category: 'Computing', location: 'Drawer C-02' },
    { name: 'STM32F401 BlackPill', qty: 20, price: 750, category: 'Microcontrollers', location: 'Lab Shelf A2' },
    { name: 'HC-SR04 Ultrasonic Sensor', qty: 15, price: 120, category: 'Sensors', location: 'Bin S-04' },
    { name: 'LiPo 3.7V 2200mAh Battery', qty: 8, price: 650, category: 'Power & Battery', location: 'Fireproof Bin P-1' },
    { name: 'SX1278 LoRa 433MHz Module', qty: 6, price: 520, category: 'Connectivity', location: 'Bin RF-02' },
  ];

  const handleQuickTemplateAdd = async (tpl: typeof quickTemplates[0]) => {
    if (loading) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      const created = await addProduct({
        name: tpl.name,
        category: tpl.category,
        description: `Direct 1-click ingest: ${tpl.name}`,
        quantity: tpl.qty,
        unit: 'pcs',
        unitPrice: tpl.price,
        gstPercent: 0,
        gstAmount: 0,
        vendor: 'Robu / Mouser',
        purchaseDate: new Date().toISOString().slice(0, 10),
        projectId: projects[0]?.id || '',
        storageLocation: tpl.location,
        notes: 'Direct 1-click addition',
        archived: false,
      });

      setStatusMessage({
        type: 'success',
        text: `✨ Added "${created.name}"! Assigned SKU: ${created.sku} (${created.quantity} pcs @ ${formatINR(created.unitPrice)}) • Saved to Cloud Firestore!`,
      });
    } catch (err: any) {
      let errTxt = err?.message || 'Failed to add item.';
      try {
        const parsed = JSON.parse(errTxt);
        if (parsed.error) errTxt = parsed.error;
      } catch {}
      setStatusMessage({
        type: 'error',
        text: errTxt,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDirectFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directName.trim() || loading) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      const qty = parseInt(directQty, 10) || 1;
      const price = parseFloat(directPrice) || 0;

      const created = await addProduct({
        name: directName.trim(),
        category: directCategory,
        description: `Directly ingested component`,
        quantity: qty,
        unit: 'pcs',
        unitPrice: price,
        gstPercent: 0,
        gstAmount: 0,
        vendor: '',
        purchaseDate: new Date().toISOString().slice(0, 10),
        projectId: directProjectId,
        storageLocation: 'Main Lab',
        notes: '',
        archived: false,
      });

      setStatusMessage({
        type: 'success',
        text: `✨ Added "${created.name}"! Assigned SKU: ${created.sku} (${created.quantity} pcs @ ${formatINR(created.unitPrice)}) • Saved to Cloud Firestore!`,
      });
      setDirectName('');
      setDirectPrice('');
    } catch (err: any) {
      let errTxt = err?.message || 'Failed to add item.';
      try {
        const parsed = JSON.parse(errTxt);
        if (parsed.error) errTxt = parsed.error;
      } catch {}
      setStatusMessage({
        type: 'error',
        text: errTxt,
      });
    } finally {
      setLoading(false);
    }
  };

  const executeActionDirectly = async (action: ProposedAction): Promise<string> => {
    const { type, payload } = action;

    if (type === 'ADD_PRODUCT') {
      let resolvedProjectId = payload.projectId || '';
      if (resolvedProjectId) {
        const matched = projects.find(
          (p) =>
            p.id === resolvedProjectId ||
            p.name.toLowerCase() === resolvedProjectId.toLowerCase() ||
            p.code.toLowerCase() === resolvedProjectId.toLowerCase()
        );
        if (matched) {
          resolvedProjectId = matched.id;
        } else {
          try {
            const newPrj = await addProject({
              name: resolvedProjectId,
              code: resolvedProjectId.replace(/\s+/g, '').toUpperCase().slice(0, 6),
              description: `Engineering project ${resolvedProjectId}`,
              status: 'Active',
              startDate: new Date().toISOString().slice(0, 10),
              notes: '',
            });
            resolvedProjectId = newPrj.id;
          } catch (e) {
            console.warn('Auto create project error:', e);
          }
        }
      }

      const unitPrice = Number(payload.unitPrice) || 0;
      const created = await addProduct({
        name: payload.name || 'Component',
        category: payload.category || 'General',
        description: payload.description || payload.notes || '',
        quantity: Number(payload.quantity) || 1,
        unit: payload.unit || 'pcs',
        unitPrice: unitPrice,
        gstPercent: 0,
        gstAmount: 0,
        vendor: payload.vendor || '',
        purchaseDate: payload.purchaseDate || new Date().toISOString().slice(0, 10),
        projectId: resolvedProjectId,
        storageLocation: payload.storageLocation || 'Main Lab',
        notes: payload.notes || '',
        archived: false,
      });
      return `✨ Added "${created.name}"! Assigned SKU: ${created.sku} (${created.quantity} ${created.unit} @ ${formatINR(created.unitPrice)}) • Total Cost: ${formatINR(created.totalCost)} (Saved to Cloud Firestore)`;
    }

    if (type === 'BATCH_ADD_PRODUCTS') {
      const list = payload.products || [];
      const addedNames: string[] = [];
      for (const item of list) {
        const created = await addProduct({
          name: item.name,
          category: item.category || 'General',
          description: item.description || item.notes || '',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || 'pcs',
          unitPrice: Number(item.unitPrice) || 0,
          gstPercent: 0,
          gstAmount: 0,
          vendor: item.vendor || '',
          purchaseDate: item.purchaseDate || new Date().toISOString().slice(0, 10),
          projectId: item.projectId || '',
          storageLocation: item.storageLocation || 'Main Lab',
          notes: item.notes || '',
          archived: false,
        });
        addedNames.push(`${created.name} (${created.sku})`);
      }
      return `Batch added ${addedNames.length} items: ${addedNames.join(', ')}`;
    }

    if (type === 'ADJUST_STOCK') {
      let targetId = payload.productId;
      if (!targetId && payload.productSku) {
        const match = products.find((p) => p.sku === payload.productSku);
        if (match) targetId = match.id;
      }
      if (!targetId) {
        throw new Error('Target product not found in database.');
      }
      await adjustProductStock(targetId, Number(payload.newQuantity) || 0, payload.reason || 'AI Command adjustment');
      return `Stock updated to ${payload.newQuantity} units.`;
    }

    if (type === 'UPDATE_PRODUCT') {
      await editProduct(payload.id, payload.updates);
      return `Product details updated in Firestore.`;
    }

    if (type === 'DELETE_PRODUCT') {
      await deleteProduct(payload.id);
      return `Deleted item from database.`;
    }

    if (type === 'ARCHIVE_PRODUCT') {
      await archiveProduct(payload.id, payload.currentArchived ?? false);
      return payload.currentArchived ? 'Product restored from archive.' : 'Product archived.';
    }

    if (type === 'CREATE_PROJECT') {
      const projName = payload.name || payload.projectName || payload.title || payload.project || 'Engineering Project';
      const createdProj = await addProject({
        name: projName,
        code: payload.code || (projName || 'PRJ').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'PRJ',
        description: payload.description || '',
        status: payload.status || 'Active',
        startDate: payload.startDate || new Date().toISOString().slice(0, 10),
        notes: payload.notes || '',
      });
      return `Created Project ${createdProj.name} (${createdProj.code})`;
    }

    if (type === 'ASSIGN_PROJECT') {
      await editProduct(payload.productId, { projectId: payload.projectId });
      return `Item assigned to project.`;
    }

    if (type === 'ADD_PURCHASE') {
      const createdPu = await addPurchase(payload);
      return `Logged purchase order ${createdPu.purchaseNumber} for ${formatINR(createdPu.invoiceTotal)}`;
    }

    if (type === 'ADD_VENDOR') {
      const createdV = await addVendor(payload);
      return `Added supplier ${createdV.name}`;
    }

    return 'Action executed successfully.';
  };

  const handleCommand = async (commandText: string) => {
    const prompt = commandText.trim();
    if (!prompt || loading) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      // Direct Fast-Path regex parser: "Add 5 ESP32 at 450"
      const directAddMatch = prompt.match(/^(?:add|create)\s+(\d+)?\s*(?:x|pcs|units)?\s*(.*?)\s+(?:at|@|for|rs\.?|₹)\s*([\d,]+)(?:\s+(?:for|to|project)\s+(.*?))?$/i);
      if (directAddMatch) {
        const qty = parseInt(directAddMatch[1] || '1', 10);
        const name = directAddMatch[2]?.trim() || 'Component';
        const price = parseFloat(directAddMatch[3]?.replace(/,/g, '') || '0');
        const projName = directAddMatch[4]?.trim() || '';

        const action: ProposedAction = {
          type: 'ADD_PRODUCT',
          summary: `Direct add ${qty}x ${name} @ ₹${price}`,
          payload: {
            name,
            quantity: qty,
            unitPrice: price,
            projectId: projName,
            category: 'Microcontrollers',
            unit: 'pcs',
            gstPercent: 0,
          },
        };
        const summary = await executeActionDirectly(action);
        setStatusMessage({
          type: 'success',
          text: `⚡ Directly Added & Saved: ${summary}`,
        });
        setInput('');
        setLoading(false);
        return;
      }

      // Fast-path delete command: "Delete item 2" or "Delete item #1" or "Remove ESP32"
      const deleteMatch = prompt.match(/^(?:delete|remove)\s+(?:item\s+)?#?([a-zA-Z0-9_\-\s]+)$/i);
      if (deleteMatch) {
        const queryTarget = deleteMatch[1].trim().toLowerCase();
        const found = products.find(
          (p) =>
            String(p.itemNumber) === queryTarget ||
            p.id.toLowerCase() === queryTarget ||
            p.sku.toLowerCase() === queryTarget ||
            p.name.toLowerCase().includes(queryTarget)
        );
        if (found) {
          await deleteProduct(found.id);
          setStatusMessage({
            type: 'success',
            text: `🗑️ Deleted item #${found.itemNumber || ''} ${found.name}`,
          });
          setInput('');
          setLoading(false);
          return;
        }
      }

      // Fast-path adjust stock: "Set stock of item 1 to 20" or "Change Pi stock to 15"
      const stockMatch = prompt.match(/^(?:set|change|adjust)\s+(?:stock\s+(?:of\s+)?)?(?:item\s+)?#?([a-zA-Z0-9_\-\s]+?)\s+(?:stock\s+)?(?:to|=|count\s+is)\s*(\d+)$/i);
      if (stockMatch) {
        const queryTarget = stockMatch[1].trim().toLowerCase();
        const newCount = parseInt(stockMatch[2], 10);
        const found = products.find(
          (p) =>
            String(p.itemNumber) === queryTarget ||
            p.id.toLowerCase() === queryTarget ||
            p.sku.toLowerCase() === queryTarget ||
            p.name.toLowerCase().includes(queryTarget)
        );
        if (found) {
          await adjustProductStock(found.id, newCount, 'AI Command');
          setStatusMessage({
            type: 'success',
            text: `📦 Updated #${found.itemNumber || ''} ${found.name} stock to ${newCount} units`,
          });
          setInput('');
          setLoading(false);
          return;
        }
      }

      // Build snapshot for backend grounding
      const databaseSnapshot = {
        products: products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          quantity: p.quantity,
          unit: p.unit,
          unitPrice: p.unitPrice,
          gstPercent: p.gstPercent,
          vendor: p.vendor,
          projectId: p.projectId,
          storageLocation: p.storageLocation,
          archived: p.archived,
        })),
        projects: projects.map((pr) => ({
          id: pr.id,
          name: pr.name,
          code: pr.code,
          status: pr.status,
          startDate: pr.startDate,
        })),
        purchases: purchases.map((pu) => ({
          purchaseNumber: pu.purchaseNumber,
          productName: pu.productNameSnapshot,
          sku: pu.skuSnapshot,
          vendor: pu.vendorNameSnapshot,
          project: pu.projectNameSnapshot,
          quantity: pu.quantity,
          unitPrice: pu.unitPrice,
          invoiceTotal: pu.invoiceTotal,
        })),
        vendors: vendors.map((v) => ({ name: v.name, gstin: v.gstin })),
        stockMovements: stockMovements.slice(0, 10),
      };

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          history: [],
          databaseSnapshot,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI assistant error (${res.status}): ${res.statusText}`);
      }

      const data = await res.json();
      const rawText = data.text || '';

      // Check for action block or json block
      let proposedAction: ProposedAction | null = null;
      const actionMatch = rawText.match(/```(?:action|json)?\s*([\s\S]*?)\s*```/);
      if (actionMatch) {
        try {
          const parsed = JSON.parse(actionMatch[1]);
          if (parsed.type || parsed.payload || parsed.name) {
            if (!parsed.type && parsed.name) {
              proposedAction = {
                type: 'ADD_PRODUCT',
                summary: `Add ${parsed.name}`,
                payload: parsed,
              };
            } else {
              proposedAction = parsed;
            }
          }
        } catch (e) {
          console.warn('Failed to parse action json:', e);
        }
      }

      // Fast-path fallback for "Add item" requests
      if (!proposedAction && (prompt.toLowerCase().startsWith('add ') || prompt.toLowerCase().includes('add item'))) {
        try {
          const parseRes = await fetch('/api/ai-parse-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: prompt,
              projectList: projects.map((p) => ({ id: p.id, name: p.name, code: p.code })),
            }),
          });
          if (parseRes.ok) {
            const parsedData = await parseRes.json();
            if (parsedData.name) {
              proposedAction = {
                type: 'ADD_PRODUCT',
                summary: `Add ${parsedData.name}`,
                payload: parsedData,
              };
            }
          }
        } catch (e) {
          console.warn('Fast-path parse error:', e);
        }
      }

      if (proposedAction) {
        const summary = await executeActionDirectly(proposedAction);
        setStatusMessage({
          type: 'success',
          text: `⚡ Directly Added & Saved: ${summary}`,
        });
        setInput('');
      } else {
        // No direct write action detected; route query to full assistant chat
        if (onOpenFullAssistant) {
          onOpenFullAssistant(prompt);
        } else {
          setStatusMessage({
            type: 'success',
            text: rawText.replace(/[*#]/g, '').slice(0, 140) + '...',
          });
        }
      }
    } catch (err: any) {
      console.warn('AI Assistant network fallback triggering for command:', prompt, err);

      // Smart client-side parsing fallback so app works 100% offline or when opened directly:
      const addGuess = prompt.match(/(?:add|buy|procure|insert)\s+(\d+)?\s*(.*?)(?:\s+(?:at|@|for|rs\.?|₹)\s*([\d,]+))?$/i);
      if (addGuess) {
        try {
          const qty = parseInt(addGuess[1] || '1', 10);
          let name = addGuess[2]?.trim() || 'Component';
          name = name.replace(/^(?:units?|pcs|x)\s+/i, '');
          const price = parseFloat(addGuess[3]?.replace(/,/g, '') || '450');
          const created = await addProduct({
            name,
            quantity: qty,
            unitPrice: price,
            unit: 'pcs',
            category: 'Hardware',
            description: 'Direct AI intake',
            gstPercent: 0,
            gstAmount: 0,
            vendor: 'Direct Purchase',
            purchaseDate: new Date().toISOString().slice(0, 10),
            projectId: '',
            storageLocation: 'Main Lab',
            notes: 'Processed by DDLC AI Engine',
            archived: false,
          });
          setStatusMessage({
            type: 'success',
            text: `⚡ Added #${created.itemNumber || ''} ${created.name} (${created.quantity} pcs @ ${formatINR(created.unitPrice)}) • Total Cost: ${formatINR(created.totalCost)} (Marked as Purchase)`,
          });
          setInput('');
          setLoading(false);
          return;
        } catch (innerE) {
          console.error('Fallback add error:', innerE);
        }
      }

      let errTxt = err?.message || 'Failed to execute command.';
      try {
        const parsed = JSON.parse(errTxt);
        if (parsed.error) errTxt = parsed.error;
      } catch {}
      setStatusMessage({
        type: 'error',
        text: errTxt,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCommand(input);
  };

  return (
    <div className="bg-white border border-[#E6EDE7] rounded-3xl p-4 shadow-xs space-y-3 font-sans">
      {/* Mode Switch Tabs & Info Header */}
      <div className="flex items-center justify-between border-b border-[#F0F5F2] pb-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === 'ai'
                ? 'bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2]'
                : 'text-[#77857C] hover:text-[#174D35] border border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Natural Command</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('direct')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === 'direct'
                ? 'bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2]'
                : 'text-[#77857C] hover:text-[#174D35] border border-transparent'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Direct Quick Ingest</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#77857C]">
          <span className="w-2 h-2 rounded-full bg-[#168653]" />
          <span>Direct Firestore Execution</span>
        </div>
      </div>

      {/* Mode A: Natural Language AI Command Bar */}
      {mode === 'ai' && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative flex items-center bg-[#F5F9F6] border border-[#E6EDE7] focus-within:border-[#168653] focus-within:bg-white rounded-2xl px-3.5 py-2.5 transition-colors">
            <Sparkles className="w-4 h-4 text-[#168653] shrink-0 mr-2.5" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              disabled={loading}
              className="w-full bg-transparent text-xs text-[#25352C] placeholder-[#77857C] focus:outline-none font-sans"
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput('')}
                className="text-[#77857C] hover:text-[#25352C] text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-2xl bg-[#168653] hover:bg-[#126E43] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <span>⚡ Direct Add</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Mode B: Direct Quick Ingest (Zero-modal, 3 fast fields) */}
      {mode === 'direct' && (
        <form onSubmit={handleDirectFieldSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <div className="sm:col-span-4">
            <input
              type="text"
              required
              placeholder="Component Name (e.g. ESP32-S3)..."
              value={directName}
              onChange={(e) => setDirectName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <input
              type="number"
              min="1"
              placeholder="Qty"
              value={directQty}
              onChange={(e) => setDirectQty(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] placeholder-[#77857C] font-semibold focus:outline-none focus:border-[#168653] focus:bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <input
              type="number"
              step="any"
              placeholder="Price ₹"
              value={directPrice}
              onChange={(e) => setDirectPrice(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] placeholder-[#77857C] font-semibold focus:outline-none focus:border-[#168653] focus:bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <select
              value={directCategory}
              onChange={(e) => setDirectCategory(e.target.value)}
              className="w-full px-2 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
            >
              <option value="Microcontrollers">MCU</option>
              <option value="Computing">Computing</option>
              <option value="Sensors">Sensors</option>
              <option value="Power & Battery">Power</option>
              <option value="Connectivity">RF / Net</option>
              <option value="Components">Components</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading || !directName.trim()}
              className="w-full py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Add Direct</span>
            </button>
          </div>
        </form>
      )}

      {/* 1-Click Hardware Quick Add Template Chips */}
      <div className="pt-1 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-[#168653] uppercase tracking-wider font-semibold">
          1-Click Quick Ingest:
        </span>
        {quickTemplates.map((tpl, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleQuickTemplateAdd(tpl)}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded-lg bg-[#F5F9F6] hover:bg-[#E5F5E9] text-[#25352C] hover:text-[#174D35] border border-[#E6EDE7] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span className="text-[#168653] font-bold">+</span>
            <span>{tpl.qty}x {tpl.name}</span>
            <span className="text-[#77857C] font-normal">({formatINR(tpl.price)})</span>
          </button>
        ))}
      </div>

      {/* Execution status banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 transition-all ${
            statusMessage.type === 'success'
              ? 'bg-[#F0F9F2] border-[#C6E7D2] text-[#174D35]'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#168653]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span className="truncate font-medium">{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-[11px] text-[#77857C] hover:text-[#25352C] px-1 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
