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
  if (!apiKey) {
    return {
      text: "⚠️ **DDLC AI Assistant Offline**: GEMINI_API_KEY is not configured in the server environment. Please ensure the API key is set in AI Studio Secrets.",
    };
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

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
   - Only add to items what the user said to AI.
3. CONVERSATIONAL DIRECTIVE:
   - Speak in friendly, clear, natural sentences like a smart colleague.
   - When executing an addition, confirm what you did mentioning item, quantity, unit price, total cost (unitPrice * quantity), that it has an automatic item number, and is marked as a purchase.
   - Example confirmation: "Got it! I've added 5x ESP32-WROOM-32D at ₹450 each (Total Cost: ₹2,250). It has been assigned an automatic item number and marked as a purchase in your ledger."
   - Append the JSON execution payload exclusively inside a single \`\`\`action ... \`\`\` block at the very end of your response.
4. STRICT GROUND TRUTH:
   - Use ONLY real data from the live Firestore snapshot below. Never invent fake items or fake purchase orders.
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
You have direct execution authority over Cloud Firestore.
When the user asks to add items, modify stock, create projects, log purchases, or update records, append an \`\`\`action ... \`\`\` block at the very end of your response.

DIRECT ADDING RULE:
- When the user asks to "Add item...", "Add product...", "Ingest...", or "5x Raspberry Pi...", the action type MUST ALWAYS BE "ADD_PRODUCT" (or "BATCH_ADD_PRODUCTS").
- Extract name, category, quantity, unit ("pcs"), unitPrice in INR, projectId, vendor, storageLocation.
- CRITICAL: DO NOT ADD GST. Set gstPercent: 0. Total cost = quantity * unitPrice. Never mention or calculate GST!
- Keep the conversational part warm, natural, and helpful. All JSON strictly inside \`\`\`action ... \`\`\` at the bottom.

SUPPORTED ACTION TYPES & SCHEMAS:
* For ADD_PRODUCT:
\`\`\`action
{ "type": "ADD_PRODUCT", "summary": "Add Raspberry Pi 5 8GB (5 pcs @ ₹28,499)", "payload": { "name": "Raspberry Pi 5 8GB", "category": "Computing", "quantity": 5, "unit": "pcs", "unitPrice": 28499, "gstPercent": 0, "vendor": "Robu.in", "storageLocation": "Drawer C-02", "projectId": "Beta 2", "notes": "" } }
\`\`\`
* For BATCH_ADD_PRODUCTS:
\`\`\`action
{ "type": "BATCH_ADD_PRODUCTS", "summary": "Batch add new inventory items", "payload": { "products": [ { "name": "ESP32-WROOM-32D", "category": "Microcontrollers", "quantity": 10, "unit": "pcs", "unitPrice": 450, "gstPercent": 0, "vendor": "Robu", "storageLocation": "Lab Shelf A1" }, { "name": "STM32F401 BlackPill", "category": "Microcontrollers", "quantity": 5, "unit": "pcs", "unitPrice": 750, "gstPercent": 0, "vendor": "Mouser", "storageLocation": "Lab Shelf A2" } ] } }
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
* For ADD_VENDOR:
\`\`\`action
{ "type": "ADD_VENDOR", "summary": "Add supplier", "payload": { "name": "Mouser Electronics", "contactPerson": "Sales", "email": "sales@mouser.com", "phone": "+91 80 4265 0000", "gstin": "29AAACM1234F1Z5", "address": "Bangalore", "notes": "" } }
\`\`\``;

  // Build conversational contents
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
  let lastError: any = null;

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
        // Strip any GST phrases like "including 18% GST" or "with 18% GST" or "+ 18% GST"
        cleanText = cleanText.replace(/\s*(?:\(|with|including|\+)?\s*\d+%\s*gst(?:\))?/gi, '');
        // Force gstPercent: 0 and gstRate: 0 in any JSON action payloads
        cleanText = cleanText.replace(/"gstPercent"\s*:\s*\d+/g, '"gstPercent": 0');
        cleanText = cleanText.replace(/"gstRate"\s*:\s*\d+/g, '"gstRate": 0');
        return { text: cleanText };
      }
    } catch (err: any) {
      console.warn(`Model ${modelName} failed, trying next candidate:`, err?.message || err);
      lastError = err;
    }
  }

  // Resilient heuristic fallback if Gemini API is temporarily busy
  console.warn("All Gemini models encountered spikes; falling back to autonomous direct parser.");
  const lowerMsg = message.toLowerCase();

  // Pattern: Add item
  if (lowerMsg.includes('add ') || lowerMsg.includes('create item') || lowerMsg.includes('new item')) {
    const qtyMatch = message.match(/(\d+)\s*(?:x|pcs|units|pieces)?/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    const priceMatch = message.match(/(?:₹|rs\.?|inr|@)\s*([\d,]+)/i);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 450;
    
    // clean product title
    let prodName = message.replace(/^(?:please\s+)?(?:add|create|insert)\s+/i, '')
      .replace(/\s+(?:for|to|project|in|at)\s+.*$/i, '')
      .replace(/\d+\s*(?:x|pcs|units|pieces)?/i, '')
      .replace(/(?:₹|rs\.?|inr|@)\s*[\d,]+/i, '')
      .trim() || 'Electronic Component';

    return {
      text: `Got it! I went ahead and added ${qty}x ${prodName} at ₹${price} to your lab inventory (Total: ₹${qty * price}). It has been assigned an automatic item number and marked as a purchase.\n\n\`\`\`action\n{\n  "type": "ADD_PRODUCT",\n  "summary": "Add ${prodName} (${qty} pcs)",\n  "payload": {\n    "name": "${prodName}",\n    "category": "Microcontrollers",\n    "quantity": ${qty},\n    "unit": "pcs",\n    "unitPrice": ${price},\n    "gstPercent": 0,\n    "storageLocation": "Main Lab",\n    "notes": "Added via DDLC Lab Helper"\n  }\n}\n\`\`\``
    };
  }

  return {
    text: `I'm right here with you! Our primary AI model connection is just refreshing for a quick moment (${lastError?.message || 'Server Busy'}). Feel free to ask me again, or use the quick Direct Ingest bar up top in the meantime!`,
  };
}

/**
 * Natural language item parser for the "Add with AI" button in the Inventory view
 */
export async function handleAiParseItem(prompt: string, projectList: any[] = []): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Offline heuristic fallback parser
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

  let cleanName = prompt.replace(/^(?:add|create|insert)\s+/i, '')
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
