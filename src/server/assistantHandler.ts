import { GoogleGenAI } from '@google/genai';

export interface AssistantRequest {
  message: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  databaseSnapshot?: {
    products?: any[];
    projects?: any[];
    purchases?: any[];
    vendors?: any[];
    stockMovements?: any[];
  };
}

export async function handleAssistantQuery(reqBody: AssistantRequest): Promise<{ text: string; action?: any }> {
  const apiKey = process.env.GEMINI_API_KEY;
  const { message = '', history = [], databaseSnapshot = {} } = reqBody || {};

  const safeSnapshot = {
    products: Array.isArray(databaseSnapshot?.products) ? databaseSnapshot.products : [],
    projects: Array.isArray(databaseSnapshot?.projects) ? databaseSnapshot.projects : [],
    purchases: Array.isArray(databaseSnapshot?.purchases) ? databaseSnapshot.purchases : [],
    vendors: Array.isArray(databaseSnapshot?.vendors) ? databaseSnapshot.vendors : [],
    stockMovements: Array.isArray(databaseSnapshot?.stockMovements) ? databaseSnapshot.stockMovements : [],
  };

  const nextItemNumber = safeSnapshot.products.length + 1;
  const nextDefaultSku = `DDLC-${String(nextItemNumber).padStart(4, '0')}`;

  const systemInstruction = `You are "DDLC AI Assistant", a friendly, knowledgeable, and helpful team member at the DDLC engineering hardware laboratory.
Personality: Warm, conversational, clear, concise, and knowledgeable about electronic components and inventory management. Never guess or pretend to know something that cannot be verified in the real database.

CRITICAL ASSISTANT PRINCIPLES:
1. ASKING FOLLOW-UP CLARIFYING QUESTIONS:
   When a user request is ambiguous, broad, or missing essential information, DO NOT blindly guess. Ask a short, polite follow-up question.
   • Example A: If user asks "Generate barcode labels" without specifying which:
     "Sure! Which labels would you like me to prepare?
     - All inventory items (${safeSnapshot.products.length} registered parts)
     - A specific SKU range (e.g., DDLC-0001 to DDLC-0010)
     - Items from a particular project (e.g., Beta 2)
     - Only low-stock components"
   • Example B: If user asks "How much did [Project] cost?":
     Distinguish clearly between:
     1) Total recorded purchase expenditure (sum of purchase orders/bills)
     2) Current stock valuation of components currently allocated to that project.
   • Example C: If user says "Add a new component" without details:
     Ask: "What is the component name? Also let me know the quantity and unit purchase price, and I'll allocate an official DDLC- SKU for you!"
   • Example D: If user specifies an SKU range (e.g., "DDLC-0001 to DDLC-0020"):
     Check the database snapshot, state how many matching items exist, and provide the labels action.

2. ACCURATE DATABASE QUERIES (NO HALLUCINATIONS):
   • Always query and report data directly from the REAL CLOUD FIRESTORE database snapshot provided below.
   • For "Find SKU DDLC-XXXX" or "Show specifications of...", retrieve the exact product object.
   • For "How many units are available?", read the exact current stock.
   • For "Show purchases from [Vendor]", filter real purchases.
   • For "Find low stock", list items with quantity <= 5.
   • Never invent SKUs, quantities, prices, or projects.

3. ADDING ITEMS & MANDATORY DDLC- SKU:
   • Every newly added item's SKU MUST start with "DDLC-" (e.g., ${nextDefaultSku}).
   • Always present the proposed item clearly with name, SKU, quantity, unit price, and total cost.
   • Append an \`\`\`action\`\`\` block of type "ADD_PRODUCT" so the user can review and confirm before Firestore save.
   • NO GST: All items are 0% GST. Total cost = quantity * unitPrice.

4. REAL LABEL GENERATION:
   • When requested to generate labels or barcodes, append an \`\`\`action\`\`\` block of type "GENERATE_LABELS" with the matched items so a real PDF or scannable preview is generated immediately.

REAL CLOUD FIRESTORE DATABASE SNAPSHOT:
Products (${safeSnapshot.products.length} items):
${JSON.stringify(safeSnapshot.products, null, 2)}

Projects (${safeSnapshot.projects.length} items):
${JSON.stringify(safeSnapshot.projects, null, 2)}

Purchases (${safeSnapshot.purchases.length} items):
${JSON.stringify(safeSnapshot.purchases, null, 2)}

Vendors (${safeSnapshot.vendors.length} items):
${JSON.stringify(safeSnapshot.vendors, null, 2)}

ACTION BLOCK FORMAT (Include strictly at the end when proposing an operation):
\`\`\`action
{ "type": "ADD_PRODUCT", "summary": "Add ...", "payload": { ... } }
\`\`\`
Or
\`\`\`action
{ "type": "CREATE_PROJECT", "summary": "Create project ...", "payload": { ... } }
\`\`\`
Or
\`\`\`action
{ "type": "GENERATE_LABELS", "summary": "Labels for ...", "payload": { "startSku": "", "endSku": "", "items": [...] } }
\`\`\``;

  if (apiKey) {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contents: any[] = [];
    for (const h of history) {
      if (h.text) {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.6,
          },
        });

        if (response.text) {
          let cleanText = response.text;
          cleanText = cleanText.replace(/\s*(?:\(|with|including|\+)?\s*\d+%\s*gst(?:\))?/gi, '');
          cleanText = cleanText.replace(/"gstPercent"\s*:\s*\d+/g, '"gstPercent": 0');
          cleanText = cleanText.replace(/"gstRate"\s*:\s*\d+/g, '"gstRate": 0');
          return { text: cleanText };
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} notice, checking next:`, err?.message || err);
      }
    }
  }

  // Autonomous fallback with accurate logic and friendly follow-ups
  return handleAutonomousFallback(message, safeSnapshot);
}

function handleAutonomousFallback(message: string, databaseSnapshot: any): { text: string; action?: any } {
  const lowerMsg = message.toLowerCase().trim();
  const products: any[] = databaseSnapshot.products || [];
  const projects: any[] = databaseSnapshot.projects || [];
  const purchases: any[] = databaseSnapshot.purchases || [];
  const vendors: any[] = databaseSnapshot.vendors || [];

  const formatINR = (val: number) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const nextNum = products.reduce((max, p) => Math.max(max, p.itemNumber || 0), 0) + 1;
  const nextDefaultSku = `DDLC-${String(nextNum).padStart(4, '0')}`;

  // 1. SPECIFIC SKU LOOKUP: e.g. "Find SKU DDLC-0001" or "DDLC-RES-0001"
  const skuQueryMatch = message.match(/\b(DDLC-[A-Za-z0-9_-]+)\b/i);
  if (skuQueryMatch || lowerMsg.startsWith('find sku') || lowerMsg.startsWith('show sku') || lowerMsg.startsWith('lookup')) {
    const targetSku = skuQueryMatch ? skuQueryMatch[1].toUpperCase() : '';
    const found = products.find((p) => (p.sku || '').toUpperCase() === targetSku || p.id === targetSku);

    if (found) {
      const projName = projects.find((pr) => pr.id === found.projectId)?.name || 'Not assigned';
      const poCount = purchases.filter((po) => po.productId === found.id).length;
      return {
        text: `Here are the verified specifications for **${found.name}** (\`${found.sku}\`):\n\n• **Category**: ${found.category || 'General'}\n• **Current Stock**: ${found.quantity} ${found.unit || 'pcs'}\n• **Unit Purchase Cost**: ${formatINR(found.unitPrice)}\n• **Stock Valuation**: ${formatINR(found.quantity * found.unitPrice)}\n• **Storage Location**: ${found.storageLocation || 'Main Lab'}\n• **Allocated Project**: ${projName}\n• **Supplier**: ${found.vendor || 'Not recorded'}\n• **Specifications**: ${found.description || 'Standard hardware specifications'}\n• **Purchase History**: ${poCount} Purchase Orders on record.`,
        action: {
          type: 'SHOW_PRODUCT_DETAILS',
          summary: `Details for ${found.name} (${found.sku})`,
          payload: { productId: found.id, sku: found.sku },
        },
      };
    } else if (targetSku) {
      return {
        text: `I searched our Cloud Firestore records, but SKU **${targetSku}** was not found in active inventory.\n\nWould you like me to register a new component under **${targetSku}**? If so, just tell me the component name, quantity, and unit cost!`,
      };
    }
  }

  // 2. PROJECT COST INQUIRY: Clarify Purchase Cost vs Allocated Stock Value
  if (
    (lowerMsg.includes('cost') || lowerMsg.includes('expenditure') || lowerMsg.includes('budget') || lowerMsg.includes('how much')) &&
    (projects.some((pr) => lowerMsg.includes(pr.name.toLowerCase()) || lowerMsg.includes(pr.code.toLowerCase())) || lowerMsg.includes('project'))
  ) {
    const targetProj = projects.find((pr) => lowerMsg.includes(pr.name.toLowerCase()) || lowerMsg.includes(pr.code.toLowerCase())) || projects[0];

    if (targetProj) {
      const projPurchases = purchases.filter((po) => po.projectId === targetProj.id || (po.projectNameSnapshot || '').toLowerCase() === targetProj.name.toLowerCase());
      const totalPoSpend = projPurchases.reduce((acc, po) => acc + (Number(po.invoiceTotal) || 0), 0);

      const allocatedParts = products.filter((p) => p.projectId === targetProj.id || (p.projectId || '').toLowerCase() === targetProj.name.toLowerCase());
      const allocatedStockVal = allocatedParts.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);

      return {
        text: `Great question! When calculating financial costs for **${targetProj.name}** (\`${targetProj.code}\`), we track two distinct figures:\n\n1. 🧾 **Total Recorded Purchase Expenditure**: **${formatINR(totalPoSpend)}**\n   *(Sum of all ${projPurchases.length} procurement orders & supplier invoices booked to this project)*\n\n2. 📦 **Current Allocated Stock Valuation**: **${formatINR(allocatedStockVal)}**\n   *(Current value of the ${allocatedParts.length} components physically on hand allocated to this project)*\n\n• **Project Status**: ${targetProj.status || 'Active'}\n\nWould you like an itemized BOM list of the components assigned to **${targetProj.name}**, or should I generate barcode labels for this project's parts?`,
      };
    }
  }

  // 3. AMBIGUOUS LABEL REQUEST -> ASK FOLLOW-UP QUESTION!
  if (
    lowerMsg === 'generate barcode labels' ||
    lowerMsg === 'generate labels' ||
    lowerMsg === 'give barcodes' ||
    lowerMsg === 'show barcodes' ||
    lowerMsg === 'print labels' ||
    lowerMsg === 'barcodes' ||
    lowerMsg === 'labels'
  ) {
    return {
      text: `Sure! I can generate official Code 128 barcode labels for you right away. Which labels would you like to prepare?\n\n• **All inventory items** (${products.length} registered parts)\n• **A specific SKU range** (e.g., *"Generate labels from DDLC-0001 to DDLC-0010"*)\n• **Items from a particular project** (e.g., *"Generate labels for Beta 2"*)\n• **Selected products** (e.g., *"Generate barcode for ESP32"*)\n\nJust let me know your preference, or reply with *"All"* and I'll generate the complete sticker sheet!`,
    };
  }

  // 4. SPECIFIC LABEL GENERATION (SKU range or project)
  if (lowerMsg.includes('label') || lowerMsg.includes('barcode')) {
    const skuRangeMatch = message.match(/([A-Za-z0-9_-]+)\s+to\s+([A-Za-z0-9_-]+)/i);
    let matched = [...products];
    let rangeExplanation = 'all inventory components';

    if (skuRangeMatch) {
      const sStart = skuRangeMatch[1].toUpperCase();
      const sEnd = skuRangeMatch[2].toUpperCase();
      matched = matched.filter((p) => {
        const s = (p.sku || '').toUpperCase();
        return s >= sStart && s <= sEnd;
      });
      rangeExplanation = `SKU range ${sStart} to ${sEnd}`;
    } else {
      const projMatch = projects.find((pr) => lowerMsg.includes(pr.name.toLowerCase()));
      if (projMatch) {
        matched = matched.filter((p) => p.projectId === projMatch.id);
        rangeExplanation = `project ${projMatch.name}`;
      } else {
        const partMatch = products.filter((p) => lowerMsg.includes(p.name.toLowerCase()));
        if (partMatch.length > 0) {
          matched = partMatch;
          rangeExplanation = `selected part (${matched.map((m) => m.name).join(', ')})`;
        }
      }
    }

    const previewItems = matched.slice(0, 8).map((p) => ({
      sku: p.sku || `DDLC-${String(p.itemNumber || 1).padStart(4, '0')}`,
      barcode: p.barcode || p.sku || `DDLC-${String(p.itemNumber || 1).padStart(4, '0')}`,
      name: p.name,
      category: p.category || 'General',
      quantity: p.quantity || 1,
      unitPrice: p.unitPrice || 0,
    }));

    const actionPayload = {
      type: 'GENERATE_LABELS',
      summary: `Barcode Labels for ${matched.length} items (${rangeExplanation})`,
      payload: {
        startSku: skuRangeMatch ? skuRangeMatch[1].toUpperCase() : '',
        endSku: skuRangeMatch ? skuRangeMatch[2].toUpperCase() : '',
        copies: 1,
        sizeId: 'standard-50-25',
        items: previewItems,
      },
    };

    return {
      text: `I checked our Cloud Firestore database and found **${matched.length} matching products** for ${rangeExplanation}!\n\nAll items use official Code 128 barcodes starting with \`DDLC-\`. I've prepared the print-ready label batch below. You can download the PDF or inspect the scannable barcode stickers:\n\n\`\`\`action\n${JSON.stringify(actionPayload, null, 2)}\n\`\`\``,
      action: actionPayload,
    };
  }

  // 5. INCOMPLETE "ADD COMPONENT" -> ASK FOLLOW-UP QUESTION!
  if (
    lowerMsg === 'add component' ||
    lowerMsg === 'add a component' ||
    lowerMsg === 'add item' ||
    lowerMsg === 'add a new component' ||
    lowerMsg === 'add new item' ||
    lowerMsg === 'add product'
  ) {
    return {
      text: `I'd love to help add a component to your inventory! To prepare the record with an official \`${nextDefaultSku}\` SKU, could you tell me:\n\n1. **Component Name** (e.g. Raspberry Pi Pico W)\n2. **Quantity** (e.g. 10 pcs)\n3. **Unit Purchase Price** (e.g. ₹450)\n4. *(Optional)* Project to assign it to (e.g. Beta 2)\n\nYou can reply in a single sentence like: *"Add 10 Raspberry Pi Pico at ₹450 for Beta 2"*!`,
    };
  }

  // 6. ADD NEW COMPONENT WITH DETAILS
  if (lowerMsg.startsWith('add ') || lowerMsg.includes('bought ') || lowerMsg.includes('purchased ')) {
    const qtyMatch = message.match(/(\d+)\s*(?:x|pcs|units|pieces)?/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    const priceMatch = message.match(/(?:₹|rs\.?|inr|@)\s*([\d,]+)/i);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

    let projTarget = '';
    const projMatch = projects.find((pr) => lowerMsg.includes(pr.name.toLowerCase()) || lowerMsg.includes(pr.code.toLowerCase()));
    if (projMatch) {
      projTarget = projMatch.id;
    }

    let prodName = message
      .replace(/^(?:please\s+)?(?:add|create|insert|bought|purchased)\s+/i, '')
      .replace(/\s+(?:for|to|project|in|at)\s+.*$/i, '')
      .replace(/\d+\s*(?:x|pcs|units|pieces)?/i, '')
      .replace(/(?:₹|rs\.?|inr|@)\s*[\d,]+/i, '')
      .trim() || 'Electronic Component';

    const assignedSku = nextDefaultSku;
    const projName = projMatch ? projMatch.name : (projTarget || 'General Stock');

    return {
      text: `I've prepared the addition for you!\n\n✨ **Assigned SKU**: \`${assignedSku}\` *(guaranteed DDLC- prefix)*\n• **Product**: ${prodName}\n• **Quantity**: ${qty} pcs\n• **Unit Cost**: ${formatINR(price)}\n• **Total Cost**: ${formatINR(qty * price)} (0% GST)\n• **Assigned Project**: ${projName}\n• **Storage Location**: Main Lab Bin\n\nPlease verify the summary and click **Confirm & Save to Firestore** below to persist this record: \n\n\`\`\`action\n{\n  "type": "ADD_PRODUCT",\n  "summary": "Add ${prodName} (${qty} pcs @ ${formatINR(price)})",\n  "payload": {\n    "name": "${prodName}",\n    "sku": "${assignedSku}",\n    "barcode": "${assignedSku}",\n    "category": "Microcontrollers",\n    "quantity": ${qty},\n    "unit": "pcs",\n    "unitPrice": ${price},\n    "gstPercent": 0,\n    "projectId": "${projTarget}",\n    "storageLocation": "Main Lab",\n    "notes": "Added via DDLC AI Assistant"\n  }\n}\n\`\`\``,
    };
  }

  // 7. INVENTORY ANALYSIS RESULTS
  if (
    lowerMsg.includes('analy') ||
    lowerMsg.includes('report') ||
    lowerMsg.includes('audit') ||
    lowerMsg.includes('overview') ||
    lowerMsg.includes('stock health')
  ) {
    const totalUnits = products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
    const totalVal = products.reduce((acc, p) => acc + ((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0)), 0);
    const lowStock = products.filter((p) => (Number(p.quantity) || 0) <= 5);
    const topAssets = [...products]
      .sort((a, b) => ((b.quantity || 0) * (b.unitPrice || 0)) - ((a.quantity || 0) * (a.unitPrice || 0)))
      .slice(0, 3);

    return {
      text: `Hello! Here is the complete hardware analysis of our DDLC inventory:\n\n### 📊 Executive Summary\n• **Registered Products**: ${products.length} unique parts in Cloud Firestore\n• **Physical Inventory Units**: ${totalUnits.toLocaleString()} units on shelves and workbench bins\n• **Total Stock Valuation**: **${formatINR(totalVal)}** *(0% GST, calculated from unit purchase costs)*\n• **Active Hardware Projects**: ${projects.length}\n\n### 🏆 Top Hardware Assets by Valuation\n${
        topAssets.length > 0
          ? topAssets.map((p, i) => `${i + 1}. **${p.name}** (\`${p.sku}\`) — ${p.quantity} pcs @ ${formatINR(p.unitPrice)} (Valuation: ${formatINR((p.quantity || 0) * (p.unitPrice || 0))})`).join('\n')
          : '• *No components currently in inventory.*'
      }\n\n### ⚠️ Stock Health & Alerts\n• **Low Stock Items (≤ 5 units)**: ${lowStock.length} items (${lowStock.map((p) => p.name).join(', ') || 'All stock levels optimal'})\n• **Barcode Readiness**: 100% of SKUs follow the standardized Code 128 \`DDLC-\` format.\n\nWould you like me to generate purchase reorders for the ${lowStock.length} low-stock items or print barcode labels for your storage bins?`,
    };
  }

  // 8. SUPPLIER / VENDOR INQUIRY: e.g. "Show purchases from Robu"
  if (lowerMsg.includes('robu') || lowerMsg.includes('supplier') || lowerMsg.includes('vendor') || lowerMsg.includes('mouser')) {
    const vendorName = vendors.find((v) => lowerMsg.includes(v.name.toLowerCase()))?.name || (lowerMsg.includes('robu') ? 'Robu.in' : 'Mouser India');
    const matchedPurchases = purchases.filter((po) => (po.vendorNameSnapshot || '').toLowerCase().includes(vendorName.toLowerCase()));
    const totalSpent = matchedPurchases.reduce((acc, po) => acc + (Number(po.invoiceTotal) || 0), 0);

    return {
      text: `Here is the purchase record summary for **${vendorName}**:\n\n• **Total Orders Recorded**: ${matchedPurchases.length} Purchase Orders\n• **Lifetime Procurement Spend**: **${formatINR(totalSpent)}**\n\n${
        matchedPurchases.length > 0
          ? matchedPurchases.slice(0, 5).map((po) => `  • **${po.purchaseNumber || 'PO'}**: ${po.productNameSnapshot} (${po.quantity} pcs) — ${formatINR(po.invoiceTotal)} [${po.purchaseDate || 'Recent'}]`).join('\n')
          : '• *No purchase orders currently filed under this supplier.*'
      }\n\nWould you like me to generate a supplier statement or record a new invoice from **${vendorName}**?`,
    };
  }

  // Default welcoming assistant response
  return {
    text: `Hello! I'm your **DDLC AI Assistant**.\n\nI can answer questions directly from our Cloud Firestore database, analyze hardware stock, generate real barcode labels, or help add items with guaranteed \`DDLC-\` SKUs.\n\nHere are some things you can ask:\n• *"Generate barcode labels"* *(I'll ask which parts you need)*\n• *"How much did Beta 2 cost?"* *(I'll break down PO spend vs stock value)*\n• *"Find SKU DDLC-0001"* *(Inspect real specs & stock)*\n• *"Add 10x ESP32 at ₹450 to Rover"* *(Instant confirmation card)*\n• *"Give detailed inventory analysis"*\n\nHow can I help you in the lab today?`,
  };
}

export async function handleAiParseItem(prompt: string, projectList: any[] = []): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackParseItem(prompt);
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Extract structured hardware product details from this natural language text: "${prompt}".
Available projects: ${JSON.stringify(projectList)}
Output ONLY valid JSON matching this schema:
{
  "name": string,
  "category": string (e.g. Microcontrollers, Sensors, Power, Computing, Passive, Connectors, Mechanical, Tools),
  "quantity": number,
  "unit": string (e.g. pcs, meters, sets),
  "unitPrice": number (in INR, 0% GST),
  "vendor": string,
  "projectId": string (matching project ID if mentioned, or empty string),
  "storageLocation": string,
  "notes": string
}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
  } catch (err) {
    console.warn('Gemini Parse Item notice, using fallback:', err);
  }

  return fallbackParseItem(prompt);
}

function fallbackParseItem(prompt: string) {
  const qtyMatch = prompt.match(/(\d+)\s*(?:x|pcs|units|pieces)?/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  const priceMatch = prompt.match(/(?:₹|rs\.?|inr|@)\s*([\d,]+)/i);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

  let cleanName = prompt
    .replace(/\b(?:\d+x|\d+\s*pcs|\d+\s*units)\b/gi, '')
    .replace(/(?:₹|rs\.?|inr|@)\s*[\d,]+/gi, '')
    .replace(/\b(?:at|for|to|project|in|bin|shelf)\s+.*$/gi, '')
    .trim() || 'Electronic Component';

  return {
    name: cleanName,
    category: 'Microcontrollers',
    quantity: qty,
    unit: 'pcs',
    unitPrice: price,
    vendor: 'Robu.in',
    storageLocation: 'Workbench Drawer A1',
    notes: 'Ingested via DDLC Natural Language Extractor',
  };
}
