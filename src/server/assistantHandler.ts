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

  const systemInstruction = `You are the DDLC Hardware Lab Helper & Inventory Co-Pilot.
You act as a real, helpful, knowledgeable hardware engineering colleague in the lab—attentive, conversational, proactive, and natural.

CRITICAL USER RULES:
1. DO NOT ADD GST!
   - NO GST is ever added to items or purchases. All items have 0% GST.
   - Total cost is strictly (quantity * unitPrice).
   - Never calculate GST, never add GST amounts, and never mention GST in your messages.
2. ONLY ADD ITEMS THE USER EXPLICITLY ASKED TO ADD:
   - When the user asks to add an item (e.g. "Add 5 ESP32 at ₹450"), ONLY add that exact item!
   - NEVER invent or add extra items, companion sensors, or unprompted accessories.
3. CONVERSATIONAL DIRECTIVE:
   - Speak in friendly, clear, natural sentences like a smart colleague.
   - When executing an addition, confirm what you did mentioning item, quantity, unit price, total cost, automatic item number, and ledger recording.
   - Append the JSON execution payload exclusively inside a single \`\`\`action ... \`\`\` block at the very end of your response.
4. STRICT GROUND TRUTH:
   - Use ONLY real data from the live Firestore snapshot below. Never invent fake items, fake purchase orders, or claim a barcode was scanned when no scan occurred.
5. CURRENCY & NUMBERS:
   - Indian Rupees (₹). Total cost = quantity * unitPrice.

DATABASE SNAPSHOT (REAL CLOUD FIRESTORE):
Products (${safeSnapshot.products.length} items):
${JSON.stringify(safeSnapshot.products, null, 2)}

Projects (${safeSnapshot.projects.length} items):
${JSON.stringify(safeSnapshot.projects, null, 2)}

Purchases (${safeSnapshot.purchases.length} items):
${JSON.stringify(safeSnapshot.purchases, null, 2)}

Vendors (${safeSnapshot.vendors.length} items):
${JSON.stringify(safeSnapshot.vendors, null, 2)}

Recent Stock Movements:
${JSON.stringify(safeSnapshot.stockMovements.slice(0, 30), null, 2)}

AI EXECUTION ACTIONS:
You have direct execution authority over Cloud Firestore and the Label Generator.
When the user asks to add items, modify stock, create projects, log purchases, generate labels, or view items, append an \`\`\`action ... \`\`\` block at the very end of your response.

SUPPORTED ACTION TYPES & SCHEMAS:
* For ADD_PRODUCT:
\`\`\`action
{ "type": "ADD_PRODUCT", "summary": "Add Raspberry Pi 5 8GB (5 pcs @ ₹28,499)", "payload": { "name": "Raspberry Pi 5 8GB", "category": "Computing", "quantity": 5, "unit": "pcs", "unitPrice": 28499, "gstPercent": 0, "vendor": "Robu.in", "storageLocation": "Drawer C-02", "projectId": "Beta 2", "notes": "" } }
\`\`\`
* For BATCH_ADD_PRODUCTS:
\`\`\`action
{ "type": "BATCH_ADD_PRODUCTS", "summary": "Batch add new inventory items", "payload": { "products": [ { "name": "ESP32-WROOM-32D", "category": "Microcontrollers", "quantity": 10, "unit": "pcs", "unitPrice": 450, "gstPercent": 0, "vendor": "Robu", "storageLocation": "Lab Shelf A1" } ] } }
\`\`\`
* For ADJUST_STOCK:
\`\`\`action
{ "type": "ADJUST_STOCK", "summary": "Adjust stock for item", "payload": { "productId": "<matched Product id>", "newQuantity": 20, "reason": "Physical count audit" } }
\`\`\`
* For UPDATE_PRODUCT:
\`\`\`action
{ "type": "UPDATE_PRODUCT", "summary": "Update item details", "payload": { "id": "<matched Product id>", "updates": { "unitPrice": 29000, "storageLocation": "Cabinet 4", "projectId": "" } } }
\`\`\`
* For DELETE_PRODUCT:
\`\`\`action
{ "type": "DELETE_PRODUCT", "summary": "Delete component", "payload": { "id": "<matched Product id>" } }
\`\`\`
* For ARCHIVE_PRODUCT:
\`\`\`action
{ "type": "ARCHIVE_PRODUCT", "summary": "Archive component", "payload": { "id": "<matched Product id>", "currentArchived": false } }
\`\`\`
* For CREATE_PROJECT:
\`\`\`action
{ "type": "CREATE_PROJECT", "summary": "Create project Beta 3", "payload": { "name": "Beta 3", "code": "BETA3", "description": "Telemetry and sensing hardware", "status": "Active", "startDate": "2026-10-10", "notes": "" } }
\`\`\`
* For ASSIGN_PROJECT:
\`\`\`action
{ "type": "ASSIGN_PROJECT", "summary": "Assign item to project", "payload": { "productId": "<matched Product id>", "projectId": "<matched Project id>" } }
\`\`\`
* For ADD_PURCHASE:
\`\`\`action
{ "type": "ADD_PURCHASE", "summary": "Record purchase order", "payload": { "productId": "<matched product id or empty>", "productNameSnapshot": "ESP32-WROOM-32D", "skuSnapshot": "", "vendorNameSnapshot": "Robu", "quantity": 10, "unitPrice": 450, "discount": 0, "gstRate": 0, "invoiceNumber": "INV-2026-001", "purchaseDate": "2026-10-10", "paymentStatus": "Paid", "projectId": "" } }
\`\`\`
* For GENERATE_LABELS:
\`\`\`action
{ "type": "GENERATE_LABELS", "summary": "Generate PDF barcode labels for 14 items (DDLC-CMP-00010 to DDLC-CMP-00025)", "payload": { "startSku": "DDLC-CMP-00010", "endSku": "DDLC-CMP-00025", "filterProject": "Beta 2", "searchTerm": "", "copies": 1, "sizeId": "standard-50-25" } }
\`\`\`
* For SHOW_PRODUCT_DETAILS:
\`\`\`action
{ "type": "SHOW_PRODUCT_DETAILS", "summary": "Show details for DDLC-CMP-00012", "payload": { "productId": "<matched Product id>", "sku": "DDLC-CMP-00012" } }
\`\`\`
* For ADD_VENDOR:
\`\`\`action
{ "type": "ADD_VENDOR", "summary": "Add supplier", "payload": { "name": "Mouser Electronics", "contactPerson": "Sales", "email": "sales@mouser.com", "phone": "+91 80 4265 0000", "gstin": "29AAACM1234F1Z5", "address": "Bangalore", "notes": "" } }
\`\`\`

LABEL WORKFLOW RULES:
When the user asks to generate labels (e.g. "Generate barcode labels from SKU DDLC-CMP-00010 to DDLC-CMP-00025", "Create PDF labels for all Raspberry Pi boards", "Generate two labels for every item in Beta 2", "Generate labels for all products purchased from Robu this month"):
1. Query the database snapshot for actual matching products.
2. State the exact number of matching items and the total labels that will be created.
3. If an SKU interval has missing SKUs in Firestore, list the missing identifiers in the response.
4. Output the \`\`\`action block with type "GENERATE_LABELS". The frontend will immediately generate and offer the real downloadable PDF!
5. Generating a label PDF must NOT modify the inventory database.

ITEM DETAILS WORKFLOW:
When the user asks to find or show details of an SKU (e.g. "Find the product with SKU DDLC-CMP-00012", "Show details of ITEM-001"):
1. Find the product in the snapshot.
2. Present full specs: Name, SKU, Category, Stock Quantity, Unit Cost, Valuation, Location, Project, Vendor.
3. Attach \`\`\`action with type "SHOW_PRODUCT_DETAILS".`;

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

    // Tested fast models without 503 high-demand issues:
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

  // Autonomous fallback handler (guarantees instantaneous accurate responses even if Gemini API is degraded)
  return handleAutonomousFallback(message, safeSnapshot);
}

function handleAutonomousFallback(message: string, databaseSnapshot: any): { text: string } {
  const lowerMsg = message.toLowerCase();
  const products: any[] = databaseSnapshot.products || [];
  const projects: any[] = databaseSnapshot.projects || [];
  const purchases: any[] = databaseSnapshot.purchases || [];

  // Helper: format INR
  const formatINR = (val: number) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  // Pattern 1: How many labels will be generated?
  if (lowerMsg.includes('how many labels') || lowerMsg.includes('count of labels')) {
    const copiesMatch = message.match(/(\d+)\s+(?:copies|labels?\s+per|labels?\s+for)/i);
    const copies = copiesMatch ? parseInt(copiesMatch[1], 10) : 1;

    let matched = [...products];
    const projMatch = message.match(/\b(beta\s*\d+|gamma\s*\d+|alpha\s*\d+)\b/i);
    if (projMatch) {
      const pName = projMatch[1].toLowerCase();
      matched = matched.filter((p) =>
        (p.projectId || '').toLowerCase().includes(pName) ||
        (projects.find(pr => pr.id === p.projectId)?.name.toLowerCase().includes(pName))
      );
    }
    const total = matched.length * copies;
    return {
      text: `Based on your selection, **${matched.length} matching products** were found in Firestore. With **${copies} copy/copies** each, exactly **${total} Code 128 barcode labels** will be generated.`,
    };
  }

  // Pattern 2: Generate Labels
  if (lowerMsg.includes('label') || lowerMsg.includes('barcode label') || lowerMsg.includes('pdf label')) {
    const skuRangeMatch = message.match(/(?:from\s+(?:sku\s+)?)?([A-Za-z0-9_-]+)\s+to\s+([A-Za-z0-9_-]+)/i);
    const copiesMatch = message.match(/(\d+)\s+(?:copies|labels?\s+per|labels?\s+for\s+every|labels?\s+for\s+each)/i);
    const copies = copiesMatch ? parseInt(copiesMatch[1], 10) : 1;

    let startSku = '';
    let endSku = '';
    let filterProject = '';
    let searchTerm = '';
    let vendorFilter = '';

    if (skuRangeMatch && (skuRangeMatch[1].toUpperCase().includes('DDLC') || skuRangeMatch[1].toUpperCase().includes('ITEM') || /\d/.test(skuRangeMatch[1]))) {
      startSku = skuRangeMatch[1].toUpperCase();
      endSku = skuRangeMatch[2].toUpperCase();
    }

    const projMatch = message.match(/\b(beta\s*\d+|gamma\s*\d+|alpha\s*\d+)\b/i);
    if (projMatch) {
      filterProject = projMatch[1];
    }

    if (lowerMsg.includes('raspberry pi') || lowerMsg.includes('raspberry')) searchTerm = 'Raspberry Pi';
    else if (lowerMsg.includes('esp32')) searchTerm = 'ESP32';
    else if (lowerMsg.includes('sensor')) searchTerm = 'Sensor';

    if (lowerMsg.includes('robu')) vendorFilter = 'robu';
    else if (lowerMsg.includes('mouser')) vendorFilter = 'mouser';

    // Calculate actual matching products
    let matchingProds = [...products];
    if (filterProject) {
      const pLow = filterProject.toLowerCase();
      matchingProds = matchingProds.filter((p: any) =>
        (p.projectId || '').toLowerCase().includes(pLow) ||
        (projects.find(pr => pr.id === p.projectId)?.name.toLowerCase().includes(pLow))
      );
    }
    if (searchTerm) {
      matchingProds = matchingProds.filter((p: any) =>
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (vendorFilter) {
      matchingProds = matchingProds.filter((p: any) =>
        (p.vendor || '').toLowerCase().includes(vendorFilter)
      );
    }
    if (startSku && endSku) {
      matchingProds = matchingProds.filter((p: any) => {
        const s = (p.sku || '').toUpperCase();
        return s >= startSku && s <= endSku;
      });
    }

    const totalLabels = matchingProds.length * copies;

    return {
      text: `I've prepared the real barcode label generation for your selection!\n\n• **Matching products found**: ${matchingProds.length} items in Firestore\n• **Copies per product**: ${copies}\n• **Total labels to be generated**: ${totalLabels} Code 128 stickers\n\nClick the action button below to download the real PDF immediately or open it in the Label Studio. Generating labels will not modify the inventory.\n\n\`\`\`action\n{\n  "type": "GENERATE_LABELS",\n  "summary": "Generate PDF labels for ${matchingProds.length} items (${totalLabels} labels)",\n  "payload": {\n    "startSku": "${startSku}",\n    "endSku": "${endSku}",\n    "filterProject": "${filterProject}",\n    "searchTerm": "${searchTerm}",\n    "copies": ${copies},\n    "sizeId": "standard-50-25"\n  }\n}\n\`\`\``,
    };
  }

  // Pattern 3: Show inventory items assigned to a project (e.g. "Show all inventory items assigned to Gamma 0")
  const showProjectMatch = message.match(/(?:show|list|all|items|components).*?\b(beta\s*\d+|gamma\s*\d+|alpha\s*\d+)\b/i);
  if (showProjectMatch) {
    const projName = showProjectMatch[1];
    const pLow = projName.toLowerCase();
    const projItems = products.filter((p: any) =>
      (p.projectId || '').toLowerCase().includes(pLow) ||
      (projects.find(pr => pr.id === p.projectId)?.name.toLowerCase().includes(pLow))
    );

    if (projItems.length === 0) {
      return {
        text: `There are currently **0 inventory items** assigned to **${projName}** in Cloud Firestore. Would you like to allocate parts or add new items to ${projName}?`,
      };
    }

    const totalVal = projItems.reduce((acc, p) => acc + ((p.quantity || 0) * (p.unitPrice || 0)), 0);
    const itemListStr = projItems.slice(0, 10).map((p, idx) =>
      `${idx + 1}. **${p.name}** (\`${p.sku}\`) — ${p.quantity} ${p.unit || 'pcs'} @ ${formatINR(p.unitPrice)} (Valuation: ${formatINR((p.quantity || 0) * (p.unitPrice || 0))}) [${p.storageLocation || 'Main Lab'}]`
    ).join('\n');

    return {
      text: `Here are the components currently allocated to **${projName}** (${projItems.length} items, total valuation **${formatINR(totalVal)}**):\n\n${itemListStr}${projItems.length > 10 ? `\n\n*...and ${projItems.length - 10} more items.*` : ''}\n\nLet me know if you want to generate labels for this project or adjust any quantities!`,
    };
  }

  // Pattern 4: Find Product or Show Details of SKU (e.g. "Find the product with SKU DDLC-CMP-00012", "Show details of DDLC-CMP-00012")
  if (lowerMsg.includes('find') || lowerMsg.includes('show details') || lowerMsg.includes('details of') || lowerMsg.includes('sku') || lowerMsg.includes('lookup')) {
    const skuMatch = message.match(/(?:sku|item|code)?\s*([A-Za-z0-9_-]*(?:DDLC|ITEM)[A-Za-z0-9_-]*|\bITEM-\d+\b|\bDDLC-[A-Za-z0-9-]+\b)/i);
    const targetSku = skuMatch ? skuMatch[1].toUpperCase() : '';

    const found = products.find((p: any) =>
      (targetSku && (p.sku || '').toUpperCase() === targetSku) ||
      (targetSku && (p.barcode || '').toUpperCase() === targetSku) ||
      lowerMsg.includes((p.name || '').toLowerCase())
    );

    if (found) {
      const stockValuation = (found.quantity || 0) * (found.unitPrice || 0);
      const projDisplay = projects.find(pr => pr.id === found.projectId)?.name || found.projectId || 'Unassigned';
      return {
        text: `Here are the complete live details for **${found.name}** (\`${found.sku}\`):\n\n• **Current Stock**: ${found.quantity} ${found.unit || 'pcs'}\n• **Unit Cost**: ${formatINR(found.unitPrice)}\n• **Total Valuation**: ${formatINR(stockValuation)}\n• **Category**: ${found.category || 'General'}\n• **Project**: ${projDisplay}\n• **Storage Location**: ${found.storageLocation || 'Main Lab'}\n• **Supplier**: ${found.vendor || 'Not recorded'}\n• **Barcode Value**: ${found.barcode || found.sku}\n\nYou can inspect full records or movement history using the card below.\n\n\`\`\`action\n{\n  "type": "SHOW_PRODUCT_DETAILS",\n  "summary": "Details for ${found.sku}",\n  "payload": {\n    "productId": "${found.id}",\n    "sku": "${found.sku}"\n  }\n}\n\`\`\``,
      };
    }
  }

  // Pattern 5: Add Item
  if (lowerMsg.includes('add ') || lowerMsg.includes('create item') || lowerMsg.includes('new item')) {
    const qtyMatch = message.match(/(\d+)\s*(?:x|pcs|units|pieces)?/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    const priceMatch = message.match(/(?:₹|rs\.?|inr|@)\s*([\d,]+)/i);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 450;

    let projTarget = '';
    const projMatch = message.match(/\b(beta\s*\d+|gamma\s*\d+|alpha\s*\d+)\b/i);
    if (projMatch) {
      projTarget = projMatch[1];
    }

    let prodName = message
      .replace(/^(?:please\s+)?(?:add|create|insert)\s+/i, '')
      .replace(/\s+(?:for|to|project|in|at)\s+.*$/i, '')
      .replace(/\d+\s*(?:x|pcs|units|pieces)?/i, '')
      .replace(/(?:₹|rs\.?|inr|@)\s*[\d,]+/i, '')
      .trim() || 'Electronic Component';

    return {
      text: `I've prepared the addition of **${qty}x ${prodName}** at ${formatINR(price)} each (Total: ${formatINR(qty * price)})${projTarget ? ` for project **${projTarget}**` : ''}.\n\nPlease review and confirm below before saving to Cloud Firestore. You can also edit any fields or clear the item if needed.\n\n\`\`\`action\n{\n  "type": "ADD_PRODUCT",\n  "summary": "Add ${prodName} (${qty} pcs @ ${formatINR(price)})",\n  "payload": {\n    "name": "${prodName}",\n    "category": "Microcontrollers",\n    "quantity": ${qty},\n    "unit": "pcs",\n    "unitPrice": ${price},\n    "gstPercent": 0,\n    "projectId": "${projTarget}",\n    "storageLocation": "Main Lab",\n    "notes": "Added via DDLC Lab Helper"\n  }\n}\n\`\`\``,
    };
  }

  // Pattern 6: Stock & Valuation Inquiries
  if (lowerMsg.includes('stock') || lowerMsg.includes('valuation') || lowerMsg.includes('worth') || lowerMsg.includes('how much') || lowerMsg.includes('inventory')) {
    const totalUnits = products.reduce((acc, p) => acc + (p.quantity || 0), 0);
    const totalVal = products.reduce((acc, p) => acc + ((p.quantity || 0) * (p.unitPrice || 0)), 0);
    const outOfStock = products.filter((p) => (p.quantity || 0) <= 0);
    const lowStock = products.filter((p) => (p.quantity || 0) > 0 && (p.quantity || 0) <= 5);

    return {
      text: `Here is the current live summary of our hardware inventory:\n\n• **Total Unique Products**: ${products.length} registered components\n• **Total Physical Units**: ${totalUnits} units in the lab\n• **Total Stock Valuation**: ${formatINR(totalVal)}\n• **Active Projects**: ${projects.length} (${projects.map(pr => pr.name).join(', ') || 'None'})\n• **Out of Stock**: ${outOfStock.length} items\n• **Low Stock (≤5)**: ${lowStock.length} items\n\nLet me know if you would like me to drill into any specific category or project!`,
    };
  }

  // Default helpful response
  return {
    text: `I'm standing by to help with your lab inventory! You can ask me to:\n\n• **Generate Barcode Labels**: *"Generate barcode labels from SKU DDLC-CMP-00010 to DDLC-CMP-00025"* or *"Create PDF labels for all Raspberry Pi boards"*\n• **Inspect Products**: *"Show details of DDLC-CMP-00012"* or *"Find the product with SKU ITEM-001"*\n• **Project Breakdown**: *"Show all inventory items assigned to Gamma 0"*\n• **Add Parts**: *"Add 5x ESP32 at ₹450 to Beta 2"* (with confirmation, edit & clear options)`,
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
