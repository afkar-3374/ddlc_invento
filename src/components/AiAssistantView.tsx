import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Edit2,
  Trash2,
  Save,
  X,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ScanLine,
  Camera,
  Layout,
} from 'lucide-react';
import Barcode from 'react-barcode';
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
  onNavigateToStudio?: (options?: {
    startSku?: string;
    endSku?: string;
    productId?: string;
    projectId?: string;
  }) => void;
  isDrawer?: boolean;
  onClose?: () => void;
  onOpenScanner?: () => void;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  initialPrompt,
  onClearInitialPrompt,
  onOpenItemDetails,
  onOpenLabelsModal,
  onNavigateToStudio,
  isDrawer = false,
  onClose,
  onOpenScanner,
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

  // Confirmation mode
  const [autoExecute, setAutoExecute] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  const handleStartEdit = (msg: ChatMessage) => {
    if (!msg.action) return;
    setEditingMessageId(msg.id);
    setEditFormData({
      name: msg.action.payload?.name || '',
      category: msg.action.payload?.category || 'General',
      quantity: msg.action.payload?.quantity || 1,
      unit: msg.action.payload?.unit || 'pcs',
      unitPrice: msg.action.payload?.unitPrice || 0,
      projectId: msg.action.payload?.projectId || '',
      storageLocation: msg.action.payload?.storageLocation || 'Main Lab',
      vendor: msg.action.payload?.vendor || '',
      notes: msg.action.payload?.notes || '',
    });
  };

  const handleSaveEdit = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.action) {
          const updatedPayload = { ...m.action.payload, ...editFormData };
          return {
            ...m,
            action: {
              ...m.action,
              summary: `Add ${updatedPayload.name || 'Component'} (${updatedPayload.quantity} ${updatedPayload.unit} @ ${formatINR(updatedPayload.unitPrice)})`,
              payload: updatedPayload,
            },
          };
        }
        return m;
      })
    );
    setEditingMessageId(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditFormData({});
  };

  const handleClearAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          return {
            ...m,
            action: undefined,
            text: `${m.text}\n\n*(Proposed operation was cleared)*`,
          };
        }
        return m;
      })
    );
    if (editingMessageId === msgId) {
      setEditingMessageId(null);
    }
  };

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
      text: `Hey there! 👋 I'm your DDLC Lab assistant. Think of me as your extra pair of hands for keeping this place organized.

Right now, I'm looking at our Cloud Firestore and I see we've got **${products.length} items** in stock across **${projects.length} projects**.

I can help you with anything—from digging up specs on a specific SKU (just say "Find DDLC-0001") to calculating how much we've spent on a project. And if you've got new parts, just tell me "Add 10 ESP32s at ₹450" and I'll handle the paperwork for you!

What's on the workbench today?`,
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
    'Generate barcode labels',
    'How much did Beta 2 cost?',
    'Give detailed inventory analysis',
    'Add 5x ESP32 at ₹450 to Rover',
    'Find low stock components',
    'Show purchases from Robu',
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
            console.warn('Auto create project notice:', e);
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
        sku: payload.sku,
        barcode: payload.barcode,
        notes: payload.notes || '',
        archived: false,
      });

      const projName = projects.find((p) => p.id === resolvedProjectId)?.name || resolvedProjectId;
      return `Added **${created.name}** (SKU: \`${created.sku}\`, ${created.quantity} ${created.unit} @ ${formatINR(created.unitPrice)})${projName ? ` assigned to **${projName}**` : ''} • Total Cost: ${formatINR(created.totalCost)}.`;
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
          sku: item.sku,
          barcode: item.barcode,
          notes: item.notes || '',
          archived: false,
        });
        addedNames.push(`**${created.name}** (\`${created.sku}\`)`);
      }
      return `Added ${addedNames.length} components to inventory: ${addedNames.join(', ')}`;
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
      return `Created new project **${createdProj.name}** (\`${createdProj.code}\`) in Cloud Firestore.`;
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

    if (type === 'OPEN_STUDIO') {
      if (onNavigateToStudio) {
        onNavigateToStudio(payload);
        return `I've opened the Label Studio for you. You can see the details there!`;
      }
      return `Label Studio is ready.`;
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
          barcode: p.barcode,
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
      let responseText = data.text || '';
      let proposedAction: ProposedAction | undefined = data.action;

      // Special handling for the 'it will make our tasks done from chat' request
      // If the AI returns a tool call/action and autoExecute is on, we'll confirm it faster
      
      const actionMatch = responseText.match(/```(?:action|json)?\s*([\s\S]*?)\s*```/);
      if (actionMatch && !proposedAction) {
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

      const isExportOrViewAction =
        proposedAction?.type === 'GENERATE_LABELS' ||
        proposedAction?.type === 'OPEN_STUDIO' ||
        proposedAction?.type === 'SHOW_PRODUCT_DETAILS';

      let autoExecutedSummary = '';
      let isExecuted = isExportOrViewAction;

      if (proposedAction && !isExportOrViewAction) {
        if (autoExecute) {
          try {
            autoExecutedSummary = await executeActionDirectly(proposedAction);
            isExecuted = true;
            // Add a slight delay for better UX 'feeling' of work being done
            await new Promise(r => setTimeout(r, 600));
          } catch (e: any) {
            console.warn('Direct execution error:', e);
            autoExecutedSummary = `Error: ${e?.message}`;
          }
        } else {
          isExecuted = false;
        }
      }

      responseText = responseText.replace(/```(?:action|json)?[\s\S]*?```/g, '').trim();

      const modelMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'model',
        text: responseText || (autoExecutedSummary ? autoExecutedSummary : 'Request processed.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: proposedAction,
        executed: isExecuted,
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      console.warn('AI Assistant error, falling back:', err);
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now() + 2}`,
        role: 'model',
        text: `Oops, looks like I hit a snag! No worries though. I'm still here to help you manage the lab. You can ask me to check stock, add new parts (like "Add 5x ESP32 at ₹450"), or generate some barcodes. What's next?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

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

  // Helper to extract clickable follow-up option bullets from assistant questions
  const extractFollowUpChips = (text: string): string[] => {
    if (!text.includes('?')) return [];
    const lines = text.split('\n');
    const chips: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^[•\-\*]\s+(?:\*\*)?([^\*\(\n]+?)(?:\*\*)?(?:\s*\(.*?\))?$/);
      if (match && match[1] && match[1].length < 35 && !match[1].toLowerCase().includes('http')) {
        chips.push(match[1].trim());
      }
    }
    return chips.slice(0, 4);
  };

  return (
    <div
      className={`flex flex-col bg-white border border-[#E6EDE7] ${
        isDrawer ? 'h-full rounded-none' : 'h-[calc(100vh-6.5rem)] rounded-3xl'
      } overflow-hidden shadow-xs`}
    >
      {/* Header bar */}
      <div className="h-16 px-5 bg-white border-b border-[#F0F5F2] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center border border-[#CDE3D2] shadow-xs">
            <BotMessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#174D35] flex items-center gap-2">
              <span>DDLC AI Assistant</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#CDE3D2]">
                Colleague
              </span>
            </h2>
            <div className="text-[11px] text-[#77857C] font-medium">
              Hardware Laboratory • Real Cloud Firestore • DDLC- SKUs
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoExecute(!autoExecute)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
              autoExecute
                ? 'bg-[#E5F5E9] text-[#168653] border-[#CDE3D2]'
                : 'bg-[#F5F9F6] text-[#77857C] border-[#E6EDE7] hover:text-[#25352C]'
            }`}
            title="When active, your AI helper automatically executes additions and updates directly to Firestore without requiring manual confirmations"
          >
            <span className={`w-2 h-2 rounded-full ${autoExecute ? 'bg-[#168653] animate-pulse' : 'bg-[#77857C]'}`} />
            <span>Auto-Save:</span>
            <strong>{autoExecute ? 'ON' : 'OFF'}</strong>
          </button>

          {isDrawer && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#77857C] hover:text-[#25352C] hover:bg-[#F5F9F6] transition-colors cursor-pointer ml-1"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 bg-[#F5F9F6]">
        {messages.map((m) => {
          const isModel = m.role === 'model';
          const followUpChips = isModel ? extractFollowUpChips(m.text) : [];

          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isModel ? 'justify-start' : 'justify-end'}`}
            >
              {isModel && (
                <div className="w-8 h-8 rounded-xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center shrink-0 mt-0.5 border border-[#CDE3D2]">
                  <Cpu className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] lg:max-w-[75%] rounded-3xl p-4 text-xs leading-relaxed ${
                  isModel
                    ? 'bg-white border border-[#E6EDE7] text-[#25352C] shadow-2xs'
                    : 'bg-[#E5F5E9] border border-[#CDE3D2] text-[#174D35] shadow-2xs font-medium'
                }`}
              >
                {/* Text rendered with basic formatting */}
                <div className="prose prose-xs max-w-none space-y-2 whitespace-pre-wrap font-sans text-xs">
                  {m.text}
                </div>

                {/* Interactive Clickable Follow-up Question Chips */}
                {followUpChips.length > 0 && !m.action && (
                  <div className="mt-3 pt-2.5 border-t border-[#F0F5F2] space-y-1.5">
                    <span className="text-[10px] font-bold text-[#77857C] uppercase tracking-wider block">
                      Quick Responses:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {followUpChips.map((chip, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(chip)}
                          className="px-2.5 py-1 rounded-xl bg-[#F0F9F2] hover:bg-[#E5F5E9] border border-[#CDE3D2] text-[#168653] font-semibold text-[11px] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <span>{chip}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Cards */}
                {m.action && (
                  <div className="mt-3 pt-3 border-t border-[#F0F5F2]">
                    {/* 1. Label Generation Action */}
                    {m.action.type === 'GENERATE_LABELS' && (
                      <div className="p-4 rounded-2xl bg-[#F0F9F2] border border-[#CDE3D2] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-[#168653]">
                            <Tag className="w-4 h-4" />
                            <span>{m.action.summary || 'Barcode Labels Ready'}</span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#168653] border border-[#CDE3D2]">
                            Code 128 PDF
                          </span>
                        </div>

                        <div className="text-[11px] text-[#77857C]">
                          Print-ready industrial labels with crisp vector Code 128 symbols.
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            onClick={() => handleDownloadActionPdf(m.action!.payload)}
                            disabled={generatingPdf}
                            className="px-3.5 py-1.5 rounded-xl bg-[#168653] hover:bg-[#126b42] text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{generatingPdf ? 'Generating PDF...' : 'Download Labels PDF'}</span>
                          </button>

                          {onNavigateToStudio && (
                            <button
                              onClick={() => onNavigateToStudio(m.action!.payload)}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#168653]" />
                              <span>Open in Label Studio</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 1b. Scan Barcode Action */}
                    {m.action.type === 'SCAN_BARCODE' && (
                      <div className="p-4 rounded-2xl bg-[#F0F9F2] border border-[#CDE3D2] space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#168653]">
                          <ScanLine className="w-4 h-4" />
                          <span>{m.action.summary || 'Live Scanner Ready'}</span>
                        </div>
                        <div className="text-[11px] text-[#77857C]">
                          Ready to identify components via your device camera.
                        </div>
                        <button
                          onClick={() => onOpenScanner?.()}
                          className="w-full px-3.5 py-2 rounded-xl bg-[#168653] hover:bg-[#126b42] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Launch Scanner Camera</span>
                        </button>
                      </div>
                    )}

                    {/* 1c. Open Studio Action */}
                    {m.action.type === 'OPEN_STUDIO' && (
                      <div className="p-4 rounded-2xl bg-[#F0F9F2] border border-[#CDE3D2] space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#168653]">
                          <Layout className="w-4 h-4" />
                          <span>{m.action.summary || 'Label Studio'}</span>
                        </div>
                        <div className="text-[11px] text-[#77857C]">
                          Design, preview, and download your barcode labels in the studio.
                        </div>
                        <button
                          onClick={() => onNavigateToStudio?.(m.action!.payload)}
                          className="w-full px-3.5 py-2 rounded-xl bg-[#168653] hover:bg-[#126b42] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                          <Tag className="w-4 h-4" />
                          <span>Open Label Studio</span>
                        </button>
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
                        <div className="p-4 rounded-2xl bg-white border border-[#E6EDE7] space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-[#168653] px-2 py-0.5 rounded-lg bg-[#E5F5E9] border border-[#CDE3D2]" title="SKU">
                                {m.action.payload?.sku || prod?.sku}
                              </span>
                              {(m.action.payload?.barcode || prod?.barcode) && (
                                <span className="text-xs font-mono font-medium text-[#77857C] px-2 py-0.5 rounded-lg bg-[#F5F9F6] border border-[#E6EDE7]" title="Barcode">
                                  {m.action.payload?.barcode || prod?.barcode}
                                </span>
                              )}
                              <span className="text-xs font-bold text-[#174D35] truncate max-w-[200px]">
                                {prod?.name || 'Inventory Record'}
                              </span>
                            </div>
                            {prod && (
                              <span className="text-[11px] text-[#77857C]">
                                Stock: {prod.quantity} {prod.unit}
                              </span>
                            )}
                          </div>

                          {(m.action.payload?.barcode || prod?.barcode) && (
                            <div className="flex flex-col items-center justify-center p-3 bg-white border border-[#F0F5F2] rounded-xl">
                              <Barcode 
                                value={m.action.payload?.barcode || prod?.barcode || ''} 
                                width={1.2}
                                height={40}
                                fontSize={10}
                                margin={0}
                                background="transparent"
                              />
                            </div>
                          )}

                          {prod && (
                            <div className="grid grid-cols-2 gap-2 text-xs bg-[#F5F9F6] p-2.5 rounded-xl border border-[#E6EDE7]">
                              <div>Unit Cost: <span className="text-[#25352C] font-semibold">{formatINR(prod.unitPrice)}</span></div>
                              <div>Valuation: <span className="text-[#168653] font-bold">{formatINR((prod.quantity || 0) * (prod.unitPrice || 0))}</span></div>
                              <div>Location: <span className="text-[#25352C]">{prod.storageLocation || 'Main Lab'}</span></div>
                              <div>Project: <span className="text-[#168653] font-semibold">{prod.projectId || 'General'}</span></div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {prod && onOpenItemDetails && (
                              <button
                                onClick={() => onOpenItemDetails(prod)}
                                className="px-3 py-1.5 rounded-xl bg-[#E5F5E9] hover:bg-[#d8eedd] text-[#168653] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Full Record</span>
                              </button>
                            )}

                            {onNavigateToStudio && (
                              <button
                                onClick={() => onNavigateToStudio({ productId: prod?.id, startSku: prod?.sku, endSku: prod?.sku })}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Tag className="w-3.5 h-3.5 text-[#168653]" />
                                <span>Open in Studio</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 3. Database Modifications Action Card: Confirm, Edit, Clear */}
                    {m.action.type !== 'GENERATE_LABELS' && m.action.type !== 'SHOW_PRODUCT_DETAILS' && (
                      m.executed ? (
                        <div className="p-3.5 rounded-2xl bg-[#F0F9F2] border border-[#CDE3D2] flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-[#174D35] flex items-center gap-2">
                                <span>{m.action.summary || 'Item Added to Inventory'}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#168653] border border-[#CDE3D2] font-semibold">
                                  COMMITTED TO FIRESTORE
                                </span>
                              </div>
                              <div className="text-[11px] text-[#77857C] mt-0.5">
                                Live synchronization complete • Ledger & inventory records updated
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        editingMessageId === m.id ? (
                          <div className="p-4 rounded-2xl bg-white border border-[#E6EDE7] space-y-3 text-xs shadow-md">
                            <div className="flex items-center justify-between text-[#174D35] font-bold border-b border-[#F0F5F2] pb-2">
                              <span className="flex items-center gap-1.5">
                                <Edit2 className="w-3.5 h-3.5 text-[#168653]" />
                                Edit Proposed Item Parameters
                              </span>
                              <button onClick={handleCancelEdit} className="text-[#77857C] hover:text-[#25352C] p-1 cursor-pointer">
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div className="sm:col-span-2">
                                <label className="text-[10px] font-semibold text-[#77857C] block mb-1">PRODUCT NAME</label>
                                <input
                                  type="text"
                                  value={editFormData.name || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-[#77857C] block mb-1">CATEGORY</label>
                                <input
                                  type="text"
                                  value={editFormData.category || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-[#77857C] block mb-1">QUANTITY & UNIT</label>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    min="1"
                                    value={editFormData.quantity || 1}
                                    onChange={(e) => setEditFormData({ ...editFormData, quantity: Number(e.target.value) })}
                                    className="w-2/3 px-2.5 py-1.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                                  />
                                  <input
                                    type="text"
                                    value={editFormData.unit || 'pcs'}
                                    onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                                    className="w-1/3 px-2 py-1.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-[#77857C] block mb-1">UNIT PRICE (₹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editFormData.unitPrice || 0}
                                  onChange={(e) => setEditFormData({ ...editFormData, unitPrice: Number(e.target.value) })}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-[#77857C] block mb-1">PROJECT ASSIGNMENT</label>
                                <input
                                  type="text"
                                  value={editFormData.projectId || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, projectId: e.target.value })}
                                  placeholder="e.g. Rover MK-2"
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-[#77857C] block mb-1">STORAGE LOCATION</label>
                                <input
                                  type="text"
                                  value={editFormData.storageLocation || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, storageLocation: e.target.value })}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653]"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-[#F0F5F2]">
                              <button
                                onClick={() => handleSaveEdit(m.id)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#168653] hover:bg-[#126b42] text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                              >
                                <Save className="w-3.5 h-3.5" />
                                Save Changes
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1.5 rounded-xl bg-[#F5F9F6] text-[#77857C] text-xs font-semibold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl bg-white border border-[#CDE3D2] shadow-xs space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#168653] animate-pulse" />
                                <span className="text-xs font-bold text-[#174D35]">
                                  {m.action.summary || 'Proposed Item Addition'}
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#CDE3D2]">
                                Confirmation Required
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F5F9F6] p-2.5 rounded-xl border border-[#E6EDE7] text-xs">
                              <div>
                                <span className="text-[#77857C] block text-[10px]">QUANTITY</span>
                                <span className="text-[#25352C] font-bold">{m.action.payload?.quantity || 1} {m.action.payload?.unit || 'pcs'}</span>
                              </div>
                              <div>
                                <span className="text-[#77857C] block text-[10px]">UNIT PRICE</span>
                                <span className="text-[#25352C] font-bold">{formatINR(m.action.payload?.unitPrice || 0)}</span>
                              </div>
                              <div>
                                <span className="text-[#77857C] block text-[10px]">TOTAL COST</span>
                                <span className="text-[#168653] font-bold">
                                  {formatINR((m.action.payload?.quantity || 1) * (m.action.payload?.unitPrice || 0))}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#77857C] block text-[10px]">PROJECT</span>
                                <span className="text-[#168653] font-semibold">{m.action.payload?.projectId || 'Unassigned'}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-[#77857C] block text-[10px]">BARCODE</span>
                                <span className="text-[#25352C] font-mono mb-2 block">{m.action.payload?.barcode || m.action.payload?.sku || 'Auto-generated'}</span>
                                {(m.action.payload?.barcode || m.action.payload?.sku) && (
                                  <div className="flex justify-center p-2 bg-white rounded-lg border border-[#E6EDE7]">
                                    <Barcode 
                                      value={m.action.payload?.barcode || m.action.payload?.sku || 'DDLC-XXXX'} 
                                      width={1}
                                      height={30}
                                      fontSize={8}
                                      margin={0}
                                      background="transparent"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#F0F5F2]">
                              <button
                                onClick={() => handleExecuteAction(m)}
                                disabled={executingActionId === m.id}
                                className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126b42] text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{executingActionId === m.id ? 'Saving to Firestore...' : 'Confirm & Save to Firestore'}</span>
                              </button>

                              <button
                                onClick={() => handleStartEdit(m)}
                                className="px-3 py-2 rounded-xl bg-white hover:bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Edit item values before committing"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-[#168653]" />
                                <span>Edit</span>
                              </button>

                              <button
                                onClick={() => handleClearAction(m.id)}
                                className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Dismiss and clear this proposed addition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Clear</span>
                              </button>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                )}

                <div className="mt-2 text-[10px] text-[#77857C] text-right font-mono">
                  {m.timestamp}
                </div>
              </div>

              {!isModel && (
                <div className="w-8 h-8 rounded-xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center shrink-0 mt-0.5 border border-[#CDE3D2]">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center shrink-0 mt-0.5 animate-pulse border border-[#CDE3D2]">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="bg-white border border-[#E6EDE7] rounded-3xl p-4 text-xs text-[#168653] font-semibold flex items-center gap-2 shadow-2xs">
              <div className="w-3.5 h-3.5 border-2 border-[#168653] border-t-transparent rounded-full animate-spin" />
              <span>Analyzing workbench records & drafting response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="px-4 py-2.5 border-t border-[#F0F5F2] bg-white overflow-x-auto whitespace-nowrap flex items-center gap-2 scrollbar-none shrink-0">
        <span className="text-[11px] font-semibold text-[#77857C] shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#168653]" />
          Quick Actions:
        </span>
        {samplePrompts.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={loading}
            className="px-3 py-1.5 rounded-full bg-[#F5F9F6] hover:bg-[#E5F5E9] text-[#25352C] hover:text-[#174D35] border border-[#E6EDE7] text-xs font-medium shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="p-3 lg:p-4 bg-white border-t border-[#F0F5F2] shrink-0">
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
            placeholder="Ask questions about inventory, 'Generate barcode labels', or 'Add 5 ESP32 at ₹450'..."
            disabled={loading}
            className="flex-1 bg-[#F5F9F6] border border-[#E6EDE7] rounded-2xl px-4 py-2.5 text-xs text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white transition-colors"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-5 py-2.5 rounded-2xl bg-[#168653] hover:bg-[#126b42] text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-40 cursor-pointer active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
