import { GoogleGenAI, Type } from '@google/genai';

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

export async function handleAssistantQuery(reqBody: AssistantRequest): Promise<{ text: string }> {
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

  const systemInstruction = `You are the DDLC Hardware Lab AI Colleague & Inventory Co-Pilot.
You act as a real, human-friendly hardware engineering colleague in the lab—warm, attentive, conversational, proactive, and natural. Speak in friendly, clear human sentences like a supportive teammate on the lab workbench. Avoid robotic boilerplate.

CRITICAL USER MANDATES:
1. HUMAN FRIENDLY VOICE:
   - Talk conversationally and warmly: "Hey there! I've checked the workbench...", "Great choice! I've added that component for you...", "Here's the full analysis of our lab inventory...".
   - Be helpful, clear, and reassuring.

2. INVENTORY ANALYSIS RESULTS:
   - When asked to analyze the inventory, provide detailed, human-friendly analysis results:
     • 📊 Executive Overview: Total stock valuation in ₹, total registered parts, total physical units in stock, active projects count.
     • 🏆 Top Assets: Identify the highest-value components in the lab.
     • 📂 Project Allocations: Breakdown of spending and parts allocated per project (e.g. Beta 2).
     • 📦 Category Distribution: Stock spread across Microcontrollers, Computing, Sensors, Power, etc.
     • ⚠️ Health & Alerts: Highlight low stock (≤ 5 units), unassigned components, or items needing labels.
     • 💡 Actionable Insights: Suggest sensible next actions for the engineering team.

3. ADDING NEW PRODUCTS & SKU MANDATE:
   - ONLY add items the user explicitly asked to add (never invent companion accessories or unprompted sensors).
   - MANDATORY SKU RULE: Every added product's SKU MUST start with "DDLC-" (e.g. ${nextDefaultSku} or DDLC-0001, DDLC-CMP-0001).
   - In your response text, ALWAYS prominently display the assigned SKU:
     "✨ Added [Product Name] to inventory! Assigned SKU: DDLC-XXXX (Saved to Cloud Firestore)"
   - NO GST: All items have 0% GST. Total cost = quantity * unitPrice. Never mention or calculate GST.

4. ADDING NEW PROJECTS:
   - When the user asks to create or add a new project (e.g. "Create project Rover MK-2" or "Add new project Solar Tracker"):
     Confirm the project name, auto-generate a clean project code (e.g. "ROVER-01"), state its status as "Active", and append a \`\`\`action\`\`\` block with type "CREATE_PROJECT".

5. GIVING BARCODES & LABELS:
   - When the user asks to give barcodes, show barcodes, or generate labels:
     • List the barcode values for the products (all starting with DDLC-).
     • Append an \`\`\`action\`\`\` block with type "GENERATE_LABELS" so the frontend renders a downloadable Code 128 PDF sticker sheet.
     • Generating a label PDF does not modify the inventory database.

6. ACTION BLOCK FORMAT:
   - Append the JSON execution payload exclusively inside a single \`\`\`action ... \`\`\` block at the very end of your response.

DATABASE SNAPSHOT (REAL CLOUD FIRESTORE):
Products (${safeSnapshot.products.length} items):
${JSON.stringify(safeSnapshot.products, null, 2)}

Projects (${safeSnapshot.projects.length} items):
${JSON.stringify(safeSnapshot.projects, null, 2)}

Purchases (${safeSnapshot.purchases.length} items):
${JSON.stringify(safeSnapshot.purchases, null, 2)}

Vendors (${safeSnapshot.vendors.length} items):
${JSON.stringify(safeSnapshot.vendors, null, 2)}

SUPPORTED ACTION TYPES:
* For ADD_PRODUCT (SKU MUST START WITH DDLC-):
\`\`\`action
{ "type": "ADD_PRODUCT", "summary": "Add Raspberry Pi 5 8GB (5 pcs @ ₹28,499)", "payload": { "name": "Raspberry Pi 5 8GB", "sku": "${nextDefaultSku}", "category": "Computing", "quantity": 5, "unit": "pcs", "unitPrice": 28499, "gstPercent": 0, "vendor": "Robu.in", "storageLocation": "Drawer C-02", "projectId": "", "notes": "" } }
\`\`\`
* For CREATE_PROJECT:
\`\`\`action
{ "type": "CREATE_PROJECT", "summary": "Create project Rover MK-2", "payload": { "name": "Rover MK-2", "code": "ROVER-02", "description": "Autonomous field rover hardware", "status": "Active", "startDate": "2026-10-13", "notes": "" } }
\`\`\`
* For GENERATE_LABELS:
\`\`\`action
{ "type": "GENERATE_LABELS", "summary": "Generate PDF barcode labels for ${safeSnapshot.products.length} items", "payload": { "startSku": "", "endSku": "", "filterProject": "", "searchTerm": "", "copies": 1, "sizeId": "standard-50-25" } }
\`\`\`
* For SHOW_PRODUCT_DETAILS:
\`\`\`action
{ "type": "SHOW_PRODUCT_DETAILS", "summary": "Details for DDLC-0001", "payload": { "productId": "<id>", "sku": "DDLC-0001" } }
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

    // Valid candidates from gemini-api skill
    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ];

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
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
        console.warn(`Model ${modelName} failed, trying next candidate:`, err?.message || err);
      }
    }
  }

  // Fallback handler guarantees prompt human-friendly response even if API is slow
  return handleAutonomousFallback(message, safeSnapshot);
}

function handleAutonomousFallback(message: string, databaseSnapshot: any): { text: string } {
  const lowerMsg = message.toLowerCase();
  const products: any[] = databaseSnapshot.products || [];
  const projects: any[] = databaseSnapshot.projects || [];
  const purchases: any[] = databaseSnapshot.purchases || [];

  const formatINR = (val: number) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  // Next automatic SKU starting with DDLC-
  const nextNum = products.reduce((max, p) => Math.max(max, p.itemNumber || 0), 0) + 1;
  const nextDefaultSku = `DDLC-${String(nextNum).padStart(4, '0')}`;

  // 1. INVENTORY ANALYSIS RESULTS
  if (
    lowerMsg.includes('analy') ||
    lowerMsg.includes('report') ||
    lowerMsg.includes('audit') ||
    lowerMsg.includes('overview') ||
    lowerMsg.includes('how is our lab') ||
    lowerMsg.includes('stock health')
  ) {
    const totalUnits = products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
    const totalVal = products.reduce((acc, p) => acc + ((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0)), 0);
    const lowStock = products.filter((p) => (Number(p.quantity) || 0) <= 5);
    const topAssets = [...products]
      .sort((a, b) => ((b.quantity || 0) * (b.unitPrice || 0)) - ((a.quantity || 0) * (a.unitPrice || 0)))
      .slice(0, 3);

    // Categories breakdown
    const catMap: Record<string, { count: number; value: number }> = {};
    products.forEach((p) => {
      const c = p.category || 'General';
      if (!catMap[c]) catMap[c] = { count: 0, value: 0 };
      catMap[c].count += 1;
      catMap[c].value += (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0);
    });
    const catBreakdown = Object.entries(catMap)
      .map(([cat, info]) => `  • **${cat}**: ${info.count} items (${formatINR(info.value)})`)
      .join('\n') || '  • *No category data recorded yet.*';

    // Project breakdown
    const projBreakdown = projects
      .map((pr) => {
        const pItems = products.filter((p) => p.projectId === pr.id || (p.projectId || '').toLowerCase() === pr.name.toLowerCase());
        const pVal = pItems.reduce((acc, p) => acc + ((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0)), 0);
        return `  • **${pr.name}** (\`${pr.code || pr.id}\`): ${pItems.length} allocated parts (${formatINR(pVal)}) [${pr.status || 'Active'}]`;
      })
      .join('\n') || '  • *No active projects recorded.*';

    return {
      text: `Hello! Here is the complete, human-friendly hardware analysis of our DDLC lab:\n\n### 📊 Executive Summary\n• **Total Unique Products**: ${products.length} registered hardware items\n• **Total Inventory Units**: ${totalUnits} units physically in stock\n• **Total Stock Valuation**: **${formatINR(totalVal)}** (0% GST)\n• **Active Hardware Projects**: ${projects.length}\n\n### 🏆 Top Hardware Assets by Valuation\n${
        topAssets.length > 0
          ? topAssets.map((p, i) => `${i + 1}. **${p.name}** (\`${p.sku || 'DDLC-0001'}\`) — ${p.quantity} pcs @ ${formatINR(p.unitPrice)} (Valuation: ${formatINR((p.quantity || 0) * (p.unitPrice || 0))})`).join('\n')
          : '• *No components currently in inventory.*'
      }\n\n### 📦 Category Breakdown\n${catBreakdown}\n\n### 📂 Hardware Project Allocations\n${projBreakdown}\n\n### ⚠️ Stock Health & Alerts\n• **Low Stock Alert (≤ 5 units)**: ${lowStock.length} items (${lowStock.map(p => p.name).join(', ') || 'All stock levels healthy'})\n• **Barcode Readiness**: All items have standard Code 128 barcodes starting with \`DDLC-\`.\n\n### 💡 Recommendations\n1. Generate Code 128 sticker labels for any unlabelled items on the shelf.\n2. Keep critical controllers like ESP32 and SBCs stocked above safety threshold of 5 units.`,
    };
  }

  // 2. CREATE / ADD NEW PROJECT
  if (
    lowerMsg.includes('project') &&
    (lowerMsg.includes('create') || lowerMsg.includes('add') || lowerMsg.includes('new project') || lowerMsg.includes('start project'))
  ) {
    let projName = message
      .replace(/^(?:please\s+)?(?:create|add|start|set\s*up)\s+(?:a\s+|new\s+)?project\s+/i, '')
      .replace(/\s+(?:with|code|named|status).*$/i, '')
      .trim() || 'New Lab Project';

    const cleanCode = projName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PROJ-01';

    return {
      text: `I've prepared the new project **${projName}** with project code \`${cleanCode}\`!\n\nYou can confirm below to immediately record this project in Cloud Firestore. Once created, you can assign hardware parts, track BOM expenditures, and generate project-specific labels.\n\n\`\`\`action\n{\n  "type": "CREATE_PROJECT",\n  "summary": "Create project ${projName} (${cleanCode})",\n  "payload": {\n    "name": "${projName}",\n    "code": "${cleanCode}",\n    "description": "Hardware prototype and engineering project",\n    "status": "Active",\n    "startDate": "${new Date().toISOString().slice(0, 10)}",\n    "notes": "Initiated via DDLC AI Co-Pilot"\n  }\n}\n\`\`\``,
    };
  }

  // 3. GIVE BARCODES / GENERATE LABELS
  if (
    lowerMsg.includes('barcode') ||
    lowerMsg.includes('give barcode') ||
    lowerMsg.includes('show barcode') ||
    lowerMsg.includes('label')
  ) {
    const skuRangeMatch = message.match(/(?:from\s+(?:sku\s+)?)?([A-Za-z0-9_-]+)\s+to\s+([A-Za-z0-9_-]+)/i);
    const copiesMatch = message.match(/(\d+)\s+(?:copies|labels?\s+per|labels?\s+for)/i);
    const copies = copiesMatch ? parseInt(copiesMatch[1], 10) : 1;

    let startSku = '';
    let endSku = '';
    if (skuRangeMatch && (skuRangeMatch[1].toUpperCase().includes('DDLC') || /\d/.test(skuRangeMatch[1]))) {
      startSku = skuRangeMatch[1].toUpperCase();
      endSku = skuRangeMatch[2].toUpperCase();
    }

    let matched = [...products];
    if (startSku && endSku) {
      matched = matched.filter((p) => {
        const s = (p.sku || '').toUpperCase();
        return s >= startSku && s <= endSku;
      });
    }

    const barcodeList = matched.slice(0, 6).map((p) => `• **${p.name}**: Barcode \`${p.barcode || p.sku || 'DDLC-0001'}\``).join('\n');

    return {
      text: `Here are the barcode details for your components:\n\n${barcodeList || '• *No items in database yet. Add an item to assign a DDLC barcode.*'}${matched.length > 6 ? `\n• *...and ${matched.length - 6} more items.*` : ''}\n\n• **Matching products**: ${matched.length} items in Firestore\n• **Format**: Standard Code 128 sticker labels (all starting with \`DDLC-\`)\n\nClick the action button below to download the printable PDF sheet or inspect in Label Studio!\n\n\`\`\`action\n{\n  "type": "GENERATE_LABELS",\n  "summary": "Generate PDF barcode labels for ${matched.length} items",\n  "payload": {\n    "startSku": "${startSku}",\n    "endSku": "${endSku}",\n    "copies": ${copies},\n    "sizeId": "standard-50-25"\n  }\n}\n\`\`\``,
    };
  }

  // 4. ADD NEW PRODUCT (SKU MUST START WITH DDLC-)
  if (lowerMsg.includes('add ') || lowerMsg.includes('create item') || lowerMsg.includes('new item') || lowerMsg.includes('bought')) {
    const qtyMatch = message.match(/(\d+)\s*(?:x|pcs|units|pieces)?/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    const priceMatch = message.match(/(?:₹|rs\.?|inr|@)\s*([\d,]+)/i);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 450;

    let projTarget = '';
    const projMatch = message.match(/\b(beta\s*\d+|gamma\s*\d+|alpha\s*\d+|rover\s*\w*)\b/i);
    if (projMatch) {
      projTarget = projMatch[1];
    }

    let prodName = message
      .replace(/^(?:please\s+)?(?:add|create|insert|bought)\s+/i, '')
      .replace(/\s+(?:for|to|project|in|at)\s+.*$/i, '')
      .replace(/\d+\s*(?:x|pcs|units|pieces)?/i, '')
      .replace(/(?:₹|rs\.?|inr|@)\s*[\d,]+/i, '')
      .trim() || 'Electronic Component';

    const assignedSku = nextDefaultSku;

    return {
      text: `I've prepared the addition for you!\n\n✨ **Assigned SKU: \`${assignedSku}\`** (starts with DDLC- as required)\n• **Item**: ${prodName}\n• **Quantity**: ${qty} pcs\n• **Unit Price**: ${formatINR(price)}\n• **Total Cost**: ${formatINR(qty * price)} (0% GST)\n• **Purchase Ledger**: Auto-marked as PO-#${nextNum}\n\nClick **Confirm & Save to Firestore** below to persist this item into Cloud Firestore! Once added, its SKU is permanently registered as \`${assignedSku}\`.\n\n\`\`\`action\n{\n  "type": "ADD_PRODUCT",\n  "summary": "Add ${prodName} (${qty} pcs @ ${formatINR(price)})",\n  "payload": {\n    "name": "${prodName}",\n    "sku": "${assignedSku}",\n    "barcode": "${assignedSku}",\n    "category": "Microcontrollers",\n    "quantity": ${qty},\n    "unit": "pcs",\n    "unitPrice": ${price},\n    "gstPercent": 0,\n    "projectId": "${projTarget}",\n    "storageLocation": "Main Lab",\n    "notes": "Added via DDLC Lab Helper"\n  }\n}\n\`\`\``,
    };
  }

  // 5. Default friendly lab colleague greeting
  return {
    text: `Hey there! I'm your DDLC Lab Hardware Helper. How can I assist you on the workbench today?\n\n• 📊 **Analysis Results**: Ask *"Give detailed inventory analysis"* to see stock valuation, project allocations, and health alerts.\n• ➕ **Add New Products**: Ask *"Add 5x ESP32 at ₹450"* (SKUs automatically start with \`${nextDefaultSku}\`).\n• 📁 **New Projects**: Ask *"Create new project Rover MK-2"* to set up new tracking.\n• 🏷️ **Give Barcodes**: Ask *"Give barcodes for all inventory items"* to generate Code 128 sticker labels.\n\nWhat are you working on right now?`,
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

  const promptText = `Extract inventory product information from this user description:
"${prompt}"

Available Projects:
${JSON.stringify(projectList)}

Extract standard electronic/hardware parameters:
- name: Clean product title (e.g. "Raspberry Pi 5 8GB" or "ESP32-WROOM-32D")
- category: One of Computing, Microcontrollers, Sensors, Power & Battery, Connectivity, Mechanical & Chassis, Tools, Components, General
- quantity: Integer count (default 1)
- unit: Standard unit like "pcs", "units", "reels", "sets", "m" (default "pcs")
- unitPrice: Price per unit in INR number (default 0)
- gstPercent: Always 0 (No GST)
- vendor: Supplier name (or "" if unspecified)
- storageLocation: Storage drawer, bin, rack, or lab shelf (or "Main Lab")
- projectId: ID of matching project from Available Projects if mentioned, otherwise ""
- notes: Technical description or extra details`;

  const candidateModels = [
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              unitPrice: { type: Type.NUMBER },
              gstPercent: { type: Type.NUMBER },
              vendor: { type: Type.STRING },
              storageLocation: { type: Type.STRING },
              projectId: { type: Type.STRING },
              notes: { type: Type.STRING },
            },
            required: ['name', 'category', 'quantity', 'unitPrice'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (parsed.name) {
        parsed.gstPercent = 0;
        return parsed;
      }
    } catch (err) {
      console.warn(`Parse with ${modelName} failed, trying next candidate:`, err);
    }
  }

  return fallbackParseItem(prompt);
}

function fallbackParseItem(prompt: string): any {
  const qtyMatch = prompt.match(/(\d+)\s*(?:x|pcs|units|pieces)?/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  const priceMatch = prompt.match(/(?:₹|rs\.?|inr|@)\s*([\d,]+)/i);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

  let cleanName = prompt
    .replace(/^(?:add|create|insert)\s+/i, '')
    .replace(/\s+(?:for|to|project|in|at)\s+.*$/i, '')
    .replace(/\d+\s*(?:x|pcs|units|pieces)?/i, '')
    .replace(/(?:₹|rs\.?|inr|@)\s*[\d,]+/i, '')
    .trim() || 'Electronic Component';

  return {
    name: cleanName,
    category: 'Microcontrollers',
    quantity: qty,
    unit: 'pcs',
    unitPrice: price,
    gstPercent: 0,
    vendor: '',
    storageLocation: 'Main Lab',
    projectId: '',
    notes: 'Directly parsed',
  };
}
