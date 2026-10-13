import React, { useState, useRef, useEffect } from 'react';
import {
  BotMessageSquare,
  Sparkles,
  Send,
  User,
  ShieldAlert,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Terminal,
  Database,
  ArrowRight,
  PlusCircle,
  FileCheck2,
  Tag,
  Download,
  ExternalLink,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Product, ProposedAction } from '../types';
import { formatINR } from '../services/dbService';
import {
  generateLabelsPdf,
  filterProductsBySkuRange,
  LABEL_SIZES,
} from '../services/labelService';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  action?: ProposedAction;
  executed?: boolean;
}

interface AiAssistantViewProps {
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
  onOpenItemDetails?: (product: Product) => void;
  onOpenLabelsModal?: (options?: {
    startSku?: string;
    endSku?: string;
    productId?: string;
    projectId?: string;
  }) => void;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  initialPrompt,
  onClearInitialPrompt,
  onOpenItemDetails,
  onOpenLabelsModal,
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

  const [autoExecute, setAutoExecute] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleDownloadActionPdf = async (payload: any) => {
    try {
      setGeneratingPdf(true);
      let matched: Product[] = [];
      if (payload.startSku || payload.endSku) {
        const res = filterProductsBySkuRange(products, payload.startSku || '', payload.endSku || '');
        matched = res.matchedProducts;
      } else {
        matched = [...products];
      }
      if (payload.filterProject) {
        const pLower = payload.filterProject.toLowerCase();
        matched = matched.filter(
          (p) =>
            (p.projectId && p.projectId.toLowerCase().includes(pLower)) ||
            (projects.find((proj) => proj.id === p.projectId)?.name.toLowerCase().includes(pLower))
        );
      }
      if (payload.searchTerm) {
        const sLower = payload.searchTerm.toLowerCase();
        matched = matched.filter(
          (p) =>
            p.name.toLowerCase().includes(sLower) ||
            p.sku.toLowerCase().includes(sLower) ||
            p.category.toLowerCase().includes(sLower)
        );
      }
      if (matched.length === 0) {
        alert('No matching products found in database for this label selection.');
        return;
      }

      const copies = Math.max(1, payload.copies || 1);
      const blob = await generateLabelsPdf(
        matched.map((p) => ({ product: p, copies })),
        LABEL_SIZES[0]
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ddlc_labels_${matched.length}_items.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      alert(`PDF label generation failed: ${e?.message}`);
    } finally {
      setGeneratingPdf(false);
    }
  };
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'model',
      text: `Hey! I'm your lab hardware helper and inventory co-pilot.\n\nI keep an eye on all our stock, active projects, and purchase orders in real-time. Right now we have **${products.length} Products**, **${projects.length} Projects**, and **${purchases.length} Purchase Orders** recorded in the database.\n\nFeel free to ask me anything about what we have on the shelves, how project budgets are tracking, or component storage locations. You can also just tell me when new parts arrive—like *"Add 5 ESP32s at ₹450 to Beta 2"*—and I'll update Firestore for you right away. What are we working on today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      handleSend(initialPrompt);
      onClearInitialPrompt?.();
    }
  }, [initialPrompt]);

  const samplePrompts = [
    'Add 5x ESP32-WROOM-32D at ₹450 to Beta 2',
    'How is our inventory value looking right now?',
    'What have we spent on Beta 2 so far?',
    'Do we have any parts running low or out of stock?',
    'Where are our Raspberry Pi boards stored?',
    'Which components are allocated to Beta 2?',
    'What purchases did we log recently?',
  ];

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
          // Auto-create project so the item is linked!
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
        name: payload.name || 'Electronic Component',
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

      const projName = projects.find((p) => p.id === resolvedProjectId)?.name || resolvedProjectId;
      return `Added #${created.itemNumber || ''} **${created.name}** (${created.quantity} ${created.unit} @ ${formatINR(created.unitPrice)})${projName ? ` assigned to **${projName}**` : ''} • Total Cost: ${formatINR(created.totalCost)} (Auto-Marked as Purchase).`;
    }

    if (type === 'BATCH_ADD_PRODUCTS') {
      const list = payload.products || [];
      const addedNames: string[] = [];
      for (const item of list) {
        const unitPrice = Number(item.unitPrice) || 0;
        const created = await addProduct({
          name: item.name || 'Component',
          category: item.category || 'General',
          description: item.description || item.notes || '',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || 'pcs',
          unitPrice: unitPrice,
          gstPercent: 0,
          gstAmount: 0,
          vendor: item.vendor || '',
          purchaseDate: item.purchaseDate || new Date().toISOString().slice(0, 10),
          projectId: item.projectId || '',
          storageLocation: item.storageLocation || 'Main Lab',
          notes: item.notes || '',
          archived: false,
        });
        addedNames.push(`**${created.name}** (\`${created.sku}\`)`);
      }
      return `Added ${addedNames.length} components to inventory: ${addedNames.join(', ')}`;
    }

    if (type === 'UPDATE_PRODUCT') {
      let targetId = payload.id;
      if (!targetId && payload.sku) {
        const match = products.find((p) => p.sku === payload.sku || p.name.toLowerCase() === payload.name?.toLowerCase());
        if (match) targetId = match.id;
      }
      if (!targetId) throw new Error('Product not found in database to update.');
      await editProduct(targetId, payload.updates);
      return `Product updated directly in Firestore.`;
    }

    if (type === 'DELETE_PRODUCT') {
      let targetId = payload.id;
      if (!targetId && (payload.sku || payload.itemNumber)) {
        const match = products.find((p) => p.sku === payload.sku || String(p.itemNumber) === String(payload.itemNumber));
        if (match) targetId = match.id;
      }
      if (!targetId) throw new Error('Product not found in database to delete.');
      await deleteProduct(targetId);
      return `Deleted item from database.`;
    }

    if (type === 'ARCHIVE_PRODUCT') {
      let targetId = payload.id;
      if (!targetId && payload.sku) {
        const match = products.find((p) => p.sku === payload.sku);
        if (match) targetId = match.id;
      }
      if (!targetId) throw new Error('Product not found in database to archive.');
      await archiveProduct(targetId, payload.currentArchived ?? false);
      return payload.currentArchived ? `Restored product from archive directly in Firestore.` : `Archived product directly in Firestore.`;
    }

    if (type === 'ADD_PURCHASE') {
      let prodId = payload.productId;
      if (!prodId) {
        const existing = products.find(
          (p) =>
            (payload.skuSnapshot && p.sku === payload.skuSnapshot) ||
            (payload.productNameSnapshot && p.name.toLowerCase() === payload.productNameSnapshot.toLowerCase())
        );
        if (existing) {
          prodId = existing.id;
        } else {
          const newProd = await addProduct({
            name: payload.productNameSnapshot || 'Procured Component',
            category: 'General',
            description: 'Item created from purchase order',
            quantity: 0,
            unit: 'pcs',
            unitPrice: Number(payload.unitPrice) || 0,
            gstPercent: 0,
            gstAmount: 0,
            vendor: payload.vendorNameSnapshot || '',
            purchaseDate: payload.purchaseDate || new Date().toISOString().slice(0, 10),
            projectId: payload.projectId || '',
            storageLocation: 'Main Lab',
            notes: '',
            archived: false,
          });
          prodId = newProd.id;
        }
      }
      const createdPu = await addPurchase({
        ...payload,
        productId: prodId,
      });
      return `Recorded purchase order **${createdPu.purchaseNumber}** for ${formatINR(createdPu.invoiceTotal)}.`;
    }

    if (type === 'ASSIGN_PROJECT') {
      await editProduct(payload.productId, { projectId: payload.projectId });
      return `Component assigned to project.`;
    }

    if (type === 'CREATE_PROJECT') {
      const createdProj = await addProject({
        name: payload.name,
        code: payload.code || (payload.name || 'PRJ').slice(0, 4).toUpperCase(),
        description: payload.description || '',
        status: payload.status || 'Active',
        startDate: payload.startDate || new Date().toISOString().slice(0, 10),
        notes: payload.notes || '',
      });
      return `Created new project **${createdProj.name}** (\`${createdProj.code}\`) in the database.`;
    }

    if (type === 'ADJUST_STOCK') {
      let targetId = payload.productId;
      if (!targetId && payload.productSku) {
        const match = products.find((p) => p.sku === payload.productSku);
        if (match) targetId = match.id;
      }
      if (!targetId) {
        const match = products.find((p) => p.name.toLowerCase().includes(payload.productName?.toLowerCase() || ''));
        if (match) targetId = match.id;
      }
      if (!targetId) throw new Error('Product not found in database to adjust stock.');
      await adjustProductStock(targetId, Number(payload.newQuantity) || 0, payload.reason || 'AI reconciliation');
      return `Stock quantity updated to **${payload.newQuantity}** units.`;
    }

    if (type === 'ADD_VENDOR') {
      const createdV = await addVendor(payload);
      return `Added supplier **${createdV.name}** to the database.`;
    }

    return 'Action saved to Firestore.';
  };

  const handleSend = async (userPrompt?: string) => {
    const textToSend = userPrompt || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
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
          projectId: pu.projectId,
          quantity: pu.quantity,
          unitPrice: pu.unitPrice,
          gstRate: pu.gstRate,
          gstAmount: pu.gstAmount,
          invoiceTotal: pu.invoiceTotal,
          invoiceNumber: pu.invoiceNumber,
          purchaseDate: pu.purchaseDate,
          paymentStatus: pu.paymentStatus,
        })),
        vendors: vendors.map((v) => ({ name: v.name, gstin: v.gstin })),
        stockMovements: stockMovements.slice(0, 15),
      };

      // Call server endpoint
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          databaseSnapshot,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      let responseText = data.text || 'No response returned.';

      // Check if response contains an action block or json block
      let proposedAction: ProposedAction | undefined = undefined;
      const actionMatch = responseText.match(/```(?:action|json)?\s*([\s\S]*?)\s*```/);
      if (actionMatch) {
        try {
          const parsed = JSON.parse(actionMatch[1]);
          if (parsed.type || parsed.payload || parsed.name) {
            if (!parsed.type && parsed.name) {
              proposedAction = {
                type: 'ADD_PRODUCT',
                summary: `Add ${parsed.name} (${parsed.quantity || 1} pcs)`,
                payload: parsed,
              };
            } else {
              proposedAction = parsed;
            }
          }
        } catch (e) {
          console.warn('Failed to parse proposed action JSON:', e);
        }
      }

      // Fallback fast-path parsing if user asked to add an item
      if (!proposedAction && (textToSend.toLowerCase().startsWith('add ') || textToSend.toLowerCase().includes('add item'))) {
        try {
          const parseRes = await fetch('/api/ai-parse-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: textToSend,
              projectList: projects.map((p) => ({ id: p.id, name: p.name, code: p.code })),
            }),
          });
          if (parseRes.ok) {
            const parsedData = await parseRes.json();
            if (parsedData.name) {
              proposedAction = {
                type: 'ADD_PRODUCT',
                summary: `Add ${parsedData.name} (${parsedData.quantity || 1} ${parsedData.unit || 'pcs'})`,
                payload: parsedData,
              };
            }
          }
        } catch (e) {
          console.warn('Fast-path parse error:', e);
        }
      }

      // Direct adding: Always execute immediately without writing raw JSON code
      let autoExecutedSummary = '';
      if (proposedAction) {
        try {
          autoExecutedSummary = await executeActionDirectly(proposedAction);
        } catch (e: any) {
          console.warn('Direct execution error:', e);
          autoExecutedSummary = `Error: ${e?.message}`;
        }
      }

      // Strip all raw code blocks and technical writing from the message
      responseText = responseText.replace(/```(?:action|json)?[\s\S]*?```/g, '').trim();
      responseText = responseText.replace(/\{\s*"(?:type|name|invoiceNumber|payload|products)"[\s\S]*?\}/g, '').trim();

      const modelMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'model',
        text: responseText || (autoExecutedSummary ? autoExecutedSummary : 'Request processed.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: proposedAction,
        executed: true,
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      console.warn('AI Assistant service fallback triggering for static/GitHub hosting:', err);

      // Autonomous client-side lab co-pilot when hosted statically on GitHub Pages:
      const lower = textToSend.toLowerCase();

      // 1. Add item command
      const addGuess = textToSend.match(/(?:add|buy|procure|insert)\s+(\d+)?\s*(.*?)(?:\s+(?:at|@|for|rs\.?|₹)\s*([\d,]+))?$/i);
      if (addGuess && (lower.includes('add ') || lower.includes('buy ') || lower.includes('insert '))) {
        try {
          const qty = parseInt(addGuess[1] || '1', 10);
          let name = addGuess[2]?.trim() || 'Electronic Component';
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

          const totalCostStr = formatINR(qty * price);
          const replyMsg: ChatMessage = {
            id: `msg_${Date.now() + 2}`,
            role: 'model',
            text: `Got it! I've added ${qty}x **${created.name}** at ${formatINR(created.unitPrice)} each (Total Cost: ${totalCostStr}). It has been assigned automatic item number **#${created.itemNumber || 1}** and recorded as a purchase in your ledger.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            executed: true,
          };
          setMessages((prev) => [...prev, replyMsg]);
          return;
        } catch (e: any) {
          console.error('Client add fallback error:', e);
        }
      }

      // 2. Delete item command
      const delGuess = textToSend.match(/(?:delete|remove)\s+(?:item\s+)?#?([a-zA-Z0-9_\-\s]+)$/i);
      if (delGuess) {
        const queryTarget = delGuess[1].trim().toLowerCase();
        const found = products.find(
          (p) =>
            String(p.itemNumber) === queryTarget ||
            p.id.toLowerCase() === queryTarget ||
            p.sku.toLowerCase() === queryTarget ||
            p.name.toLowerCase().includes(queryTarget)
        );
        if (found) {
          await deleteProduct(found.id);
          const replyMsg: ChatMessage = {
            id: `msg_${Date.now() + 2}`,
            role: 'model',
            text: `Done! I've permanently removed #${found.itemNumber || ''} **${found.name}** from the lab inventory and purchase ledger.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            executed: true,
          };
          setMessages((prev) => [...prev, replyMsg]);
          return;
        }
      }

      // 3. Stock or inventory queries
      if (lower.includes('stock') || lower.includes('what do we have') || lower.includes('inventory') || lower.includes('components')) {
        const totalUnits = products.reduce((s, p) => s + (p.quantity || 0), 0);
        const totalVal = products.reduce((s, p) => s + ((p.quantity || 0) * (p.unitPrice || 0)), 0);
        const replyMsg: ChatMessage = {
          id: `msg_${Date.now() + 2}`,
          role: 'model',
          text: `Right now in the lab we have **${products.length} component types** recorded with **${totalUnits} total physical units** on hand, valued at **${formatINR(totalVal)}**. Tell me anytime if you'd like to add new parts, adjust stock, or record a purchase!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          executed: true,
        };
        setMessages((prev) => [...prev, replyMsg]);
        return;
      }

      // 4. General fallback message
      let errTxt = err?.message || 'Unable to connect to assistant service.';
      try {
        const parsed = JSON.parse(errTxt);
        if (parsed.error) errTxt = parsed.error;
      } catch {}
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now() + 2}`,
        role: 'model',
        text: `I'm operating in standalone browser mode! You can tell me commands like *"Add 5x ESP32 at ₹450"* or *"Delete item 1"*, or ask *"What is in stock?"* and I will handle it directly for you.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Execute proposed action manually if needed
  const handleExecuteAction = async (msg: ChatMessage) => {
    if (!msg.action || msg.executed) return;
    setExecutingActionId(msg.id);

    try {
      const summary = await executeActionDirectly(msg.action);
      setMessages((prev) => [
        ...prev.map((m) => (m.id === msg.id ? { ...m, executed: true } : m)),
        {
          id: `msg_${Date.now() + 5}`,
          role: 'model',
          text: `✅ **Committed to Firestore**: ${summary}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      alert(`Action failed: ${err?.message}`);
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col bg-[#0F1317] border border-[#1C242C] rounded-2xl overflow-hidden shadow-2xl">
      {/* Header bar */}
      <div className="h-14 px-4 lg:px-6 bg-[#0B0E11] border-b border-[#1A2228] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#141C17] border border-[#00FF66]/30 flex items-center justify-center shadow-[0_0_10px_rgba(0,255,102,0.2)]">
            <BotMessageSquare className="w-4 h-4 text-[#00FF66]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide font-display flex items-center gap-2">
              <span>DDLC Lab Assistant & Helper</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
                AI CO-PILOT
              </span>
            </h2>
            <div className="text-[10px] text-gray-400 font-mono">
              REAL-TIME FIRESTORE • CONVERSATIONAL CO-PILOT
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoExecute(!autoExecute)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
              autoExecute
                ? 'bg-[#122217] text-[#00FF66] border-[#00FF66]/40 shadow-[0_0_10px_rgba(0,255,102,0.15)]'
                : 'bg-[#182026] text-gray-400 border-gray-700 hover:text-white'
            }`}
            title="When active, your AI helper automatically executes additions and updates directly to Firestore without requiring manual confirmations"
          >
            <span className="w-2 h-2 rounded-full bg-[#00FF66] neon-dot" />
            <span>Helper Auto-Sync:</span>
            <span className="font-bold">{autoExecute ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 font-sans">
        {messages.map((m) => {
          const isModel = m.role === 'model';
          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isModel ? 'justify-start' : 'justify-end'}`}
            >
              {isModel && (
                <div className="w-8 h-8 rounded-lg bg-[#131D17] border border-[#00FF66]/30 flex items-center justify-center shrink-0 mt-0.5 text-[#00FF66]">
                  <Cpu className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] lg:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed ${
                  isModel
                    ? 'bg-[#14191E] border border-[#1F272F] text-gray-200'
                    : 'bg-[#16221A] border border-[#00FF66]/40 text-white shadow-[0_0_12px_rgba(0,255,102,0.1)]'
                }`}
              >
                {/* Text rendered with basic formatting */}
                <div className="prose prose-invert prose-xs max-w-none space-y-2 whitespace-pre-wrap font-sans">
                  {m.text}
                </div>

                {/* Action Cards */}
                {m.action && (
                  <div className="mt-3 pt-3 border-t border-[#1F272F]">
                    {/* 1. Label Generation Action */}
                    {m.action.type === 'GENERATE_LABELS' && (
                      <div className="p-3.5 rounded-xl bg-[#0D1612] border border-[#00FF66]/40 shadow-[0_0_15px_rgba(0,255,102,0.12)] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#00FF66]">
                            <Tag className="w-4 h-4" />
                            <span>{m.action.summary || 'Barcode Labels Ready'}</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/30">
                            CODE 128 PDF
                          </span>
                        </div>

                        <div className="text-[11px] text-gray-300 font-mono">
                          Ready for print on standard sheets or thermal roll printers (50×25mm).
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            onClick={() => handleDownloadActionPdf(m.action!.payload)}
                            disabled={generatingPdf}
                            className="px-3.5 py-1.5 rounded-lg bg-[#00FF66] hover:bg-[#1aff75] text-black font-bold text-xs font-mono flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{generatingPdf ? 'Generating PDF...' : 'Download Labels PDF'}</span>
                          </button>

                          {onOpenLabelsModal && (
                            <button
                              onClick={() => onOpenLabelsModal(m.action!.payload)}
                              className="px-3 py-1.5 rounded-lg bg-[#141A1F] hover:bg-[#1C252D] border border-[#232F3A] text-gray-200 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#00FF66]" />
                              <span>Open in Label Studio</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. Show Product Details Action */}
                    {m.action.type === 'SHOW_PRODUCT_DETAILS' && (() => {
                      const prod = products.find(
                        (p) =>
                          p.id === m.action!.payload?.productId ||
                          p.sku === m.action!.payload?.sku
                      );
                      return (
                        <div className="p-3.5 rounded-xl bg-[#12171B] border border-[#222E39] space-y-2.5 shadow-md">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-[#00FF66] px-2 py-0.5 rounded bg-[#16221A] border border-[#00FF66]/30">
                                {m.action.payload?.sku || prod?.sku}
                              </span>
                              <span className="text-xs font-bold text-white truncate max-w-[200px]">
                                {prod?.name || 'Inventory Record'}
                              </span>
                            </div>
                            {prod && (
                              <span className="text-[11px] font-mono text-gray-300">
                                Stock: {prod.quantity} {prod.unit}
                              </span>
                            )}
                          </div>

                          {prod && (
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-400 bg-[#0C1013] p-2 rounded-lg border border-[#1A2228]">
                              <div>Unit Cost: <span className="text-white font-semibold">{formatINR(prod.unitPrice)}</span></div>
                              <div>Valuation: <span className="text-[#00FF66] font-semibold">{formatINR((prod.quantity || 0) * (prod.unitPrice || 0))}</span></div>
                              <div>Location: <span className="text-white">{prod.storageLocation || 'Main Lab'}</span></div>
                              <div>Project: <span className="text-emerald-400">{prod.projectId || 'General'}</span></div>
                            </div>
                          )}

                          {prod && onOpenItemDetails && (
                            <button
                              onClick={() => onOpenItemDetails(prod)}
                              className="px-3 py-1.5 rounded-lg bg-[#182128] hover:bg-[#202C36] border border-[#2A3744] text-[#00FF66] text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open Full Record</span>
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* 3. Database Modifications Action Badge */}
                    {m.action.type !== 'GENERATE_LABELS' && m.action.type !== 'SHOW_PRODUCT_DETAILS' && (
                      <div className="p-3 rounded-xl bg-[#0F1B14] border border-[#00FF66]/30 flex items-center justify-between gap-3 shadow-[0_0_12px_rgba(0,255,102,0.1)]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#14261C] border border-[#00FF66]/40 flex items-center justify-center shrink-0 text-[#00FF66]">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                              <span>{m.action.summary || 'Item Directly Added'}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/40">
                                DIRECTLY SAVED
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                              Committed to real Cloud Firestore database • Live synchronization active
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 text-[10px] text-gray-400 font-mono text-right">
                  {m.timestamp}
                </div>
              </div>

              {!isModel && (
                <div className="w-8 h-8 rounded-lg bg-[#18221B] border border-[#00FF66]/30 flex items-center justify-center shrink-0 mt-0.5 text-[#00FF66]">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-[#131D17] border border-[#00FF66]/30 flex items-center justify-center shrink-0 mt-0.5 text-[#00FF66] animate-pulse">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="bg-[#14191E] border border-[#1F272F] rounded-2xl p-4 text-xs font-mono text-[#00FF66] flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-[#00FF66] border-t-transparent rounded-full animate-spin" />
              <span>Reviewing lab inventory & records...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="px-4 py-2 border-t border-[#182026] bg-[#0C0F12] overflow-x-auto whitespace-nowrap flex items-center gap-2 scrollbar-none">
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#00FF66]" />
          Quick Queries:
        </span>
        {samplePrompts.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={loading}
            className="px-2.5 py-1 rounded-full bg-[#13181C] hover:bg-[#1A2228] text-gray-300 hover:text-white border border-[#212B34] text-[11px] font-mono shrink-0 transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="p-3 lg:p-4 bg-[#0B0E11] border-t border-[#182026] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about stock, project budgets, or say 'Add 5 ESP32s at ₹450 to Beta 2'..."
            disabled={loading}
            className="flex-1 bg-[#14191E] border border-[#232D36] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF66] transition-colors"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,255,102,0.25)] disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send Query</span>
          </button>
        </form>
      </div>
    </div>
  );
};
