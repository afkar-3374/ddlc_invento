import { GoogleGenAI, Type } from '@google/genai';

export interface AssistantRequest {
  message: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  databaseSnapshot: {
    products: any[];
    projects: any[];
    purchases: any[];
    vendors: any[];
    stockMovements: any[];
  };
}

export async function handleAssistantQuery(reqBody: AssistantRequest): Promise<{ text: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  const { message, history = [], databaseSnapshot } = reqBody;

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
Products (${databaseSnapshot.products?.length || 0} items):
${JSON.stringify(databaseSnapshot.products || [], null, 2)}

Projects (${databaseSnapshot.projects?.length || 0} items):
${JSON.stringify(databaseSnapshot.projects || [], null, 2)}

Purchases (${databaseSnapshot.purchases?.length || 0} items):
${JSON.stringify(databaseSnapshot.purchases || [], null, 2)}

Vendors (${databaseSnapshot.vendors?.length || 0} items):
${JSON.stringify(databaseSnapshot.vendors || [], null, 2)}

Recent Stock Movements:
${JSON.stringify((databaseSnapshot.stockMovements || []).slice(0, 30), null, 2)}

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
When the user asks to generate labels (e.g. "Generate barcode labels from SKU DDLC-CMP-00010 to DDLC-CMP-00025", "Create PDF labels for all Raspberry Pi boards", "Generate two labels for every item in Beta 2"):
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
      contents.push({
        role: h.role,
        parts: [{ text: h.text }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const candidateModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
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

  // Autonomous fallback handler (guarantees responses even if Gemini API key is absent)
  return handleAutonomousFallback(message, databaseSnapshot);
}

function handleAutonomousFallback(message: string, databaseSnapshot: any): { text: string } {
  const lowerMsg = message.toLowerCase();
  const products = databaseSnapshot.products || [];

  // Pattern 1: Generate Labels
  if (lowerMsg.includes('label') || lowerMsg.includes('barcode label')) {
    // Check for SKU range pattern: from SKU X to Y or X to Y
    const skuRangeMatch = message.match(/(?:from\s+(?:sku\s+)?)?([A-Za-z0-9_-]+)\s+to\s+([A-Za-z0-9_-]+)/i);
    const copiesMatch = message.match(/(\d+)\s+(?:copies|labels?\s+per|labels?\s+for\s+every)/i);
    const copies = copiesMatch ? parseInt(copiesMatch[1], 10) : 1;

    let startSku = '';
    let endSku = '';
    let filterProject = '';
    let searchTerm = '';

    if (skuRangeMatch && (skuRangeMatch[1].toUpperCase().includes('DDLC') || skuRangeMatch[1].toUpperCase().includes('ITEM') || /\d/.test(skuRangeMatch[1]))) {
      startSku = skuRangeMatch[1].toUpperCase();
      endSku = skuRangeMatch[2].toUpperCase();
    }

    // Check project match (e.g. Beta 2, Gamma 0)
    const projMatch = message.match(/\b(beta\s*\d+|gamma\s*\d+|alpha\s*\d+)\b/i);
    if (projMatch) {
      filterProject = projMatch[1];
    }

    // Check keyword search (e.g. Raspberry Pi)
    if (lowerMsg.includes('raspberry pi')) searchTerm = 'Raspberry Pi';
    else if (lowerMsg.includes('esp32')) searchTerm = 'ESP32';

    // Calculate actual matching products
    let matchingProds = [...products];
    if (filterProject) {
      matchingProds = matchingProds.filter((p: any) =>
        (p.projectId || '').toLowerCase().includes(filterProject.toLowerCase())
      );
    }
    if (searchTerm) {
      matchingProds = matchingProds.filter((p: any) =>
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
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
      text: `I've prepared the real barcode label generation for your selection!\n\n• **Matching products found**: ${matchingProds.length} items in Firestore\n• **Copies per product**: ${copies}\n• **Total labels to be generated**: ${totalLabels} Code 128 stickers\n\nClick the action button below to trigger the real PDF download immediately or preview your labels in the Label Studio.\n\n\`\`\`action\n{\n  "type": "GENERATE_LABELS",\n  "summary": "Generate PDF labels for ${matchingProds.length} items (${totalLabels} labels)",\n  "payload": {\n    "startSku": "${startSku}",\n    "endSku": "${endSku}",\n    "filterProject": "${filterProject}",\n    "searchTerm": "${searchTerm}",\n    "copies": ${copies},\n    "sizeId": "standard-50-25"\n  }\n}\n\`\`\``,
    };
  }

  // Pattern 2: Find Product or Show Details of SKU
  if (lowerMsg.includes('find') || lowerMsg.includes('show details') || lowerMsg.includes('details of') || lowerMsg.includes('sku')) {
    const skuMatch = message.match(/(?:sku|item|code)?\s*([A-Za-z0-9_-]*(?:DDLC|ITEM)[A-Za-z0-9_-]*|\bITEM-\d+\b|\bDDLC-[A-Za-z0-9-]+\b)/i);
    const targetSku = skuMatch ? skuMatch[1].toUpperCase() : '';

    const found = products.find((p: any) =>
      (targetSku && (p.sku || '').toUpperCase() === targetSku) ||
      (targetSku && (p.barcode || '').toUpperCase() === targetSku) ||
      lowerMsg.includes((p.name || '').toLowerCase())
    );

    if (found) {
      const stockValuation = (found.quantity || 0) * (found.unitPrice || 0);
      return {
        text: `Here are the complete live details for **${found.name}** (\`${found.sku}\`):\n\n• **Current Stock**: ${found.quantity} ${found.unit || 'pcs'}\n• **Unit Cost**: ₹${found.unitPrice}\n• **Total Valuation**: ₹${stockValuation}\n• **Category**: ${found.category || 'General'}\n• **Project**: ${found.projectId || 'Unassigned'}\n• **Storage Location**: ${found.storageLocation || 'Main Lab'}\n• **Supplier**: ${found.vendor || 'Not recorded'}\n• **Barcode**: ${found.barcode || 'Not recorded'}\n\nYou can inspect the full historical movements and purchase orders using the card below.\n\n\`\`\`action\n{\n  "type": "SHOW_PRODUCT_DETAILS",\n  "summary": "Details for ${found.sku}",\n  "payload": {\n    "productId": "${found.id}",\n    "sku": "${found.sku}"\n  }\n}\n\`\`\``,
      };
    }
  }

  // Pattern 3: Add Item
  if (lowerMsg.includes('add ') || lowerMsg.includes('create item') || lowerMsg.includes('new item')) {
    const qtyMatch = message.match(/(\d+)\s*(?:x|pcs|units|pieces)?/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    const priceMatch = message.match(/(?:₹|rs\.?|inr|@)\s*([\d,]+)/i);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 450;

    let prodName = message
      .replace(/^(?:please\s+)?(?:add|create|insert)\s+/i, '')
      .replace(/\s+(?:for|to|project|in|at)\s+.*$/i, '')
      .replace(/\d+\s*(?:x|pcs|units|pieces)?/i, '')
      .replace(/(?:₹|rs\.?|inr|@)\s*[\d,]+/i, '')
      .trim() || 'Electronic Component';

    return {
      text: `Got it! I went ahead and added ${qty}x ${prodName} at ₹${price} to your lab inventory (Total: ₹${qty * price}). It has been assigned an automatic item number and marked as a purchase in your ledger.\n\n\`\`\`action\n{\n  "type": "ADD_PRODUCT",\n  "summary": "Add ${prodName} (${qty} pcs)",\n  "payload": {\n    "name": "${prodName}",\n    "category": "Microcontrollers",\n    "quantity": ${qty},\n    "unit": "pcs",\n    "unitPrice": ${price},\n    "gstPercent": 0,\n    "storageLocation": "Main Lab",\n    "notes": "Added via DDLC Lab Helper"\n  }\n}\n\`\`\``,
    };
  }

  return {
    text: `I'm standing by to help with your lab inventory! You can ask me to generate barcode labels (e.g. *"Generate barcode labels from SKU DDLC-CMP-00010 to DDLC-CMP-00025"* or *"Create PDF labels for Beta 2"*), look up product records (*"Show details of ITEM-001"*), or add incoming components (*"Add 5x ESP32 at ₹450"*).`,
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

  const candidateModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
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
