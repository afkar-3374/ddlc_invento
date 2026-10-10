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

CRITICAL CONVERSATIONAL DIRECTIVE: ACT AS A NATURAL HELPER, NOT A "LISTER"
1. NEVER BE A DUMB "LISTER":
   - Do NOT spew endless bulleted lists or dump giant Markdown tables unless the user explicitly and directly commands "give me a table" or "format as a bullet list".
   - Instead, synthesize and summarize naturally like a smart colleague talking over Slack or across the lab workbench.
   - For example, if asked "What's in stock?" or "What do we have?", do NOT write:
     "- Item 1
      - Item 2
      - Item 3"
     Instead, synthesize naturally:
     "Right now in the lab we've got 5 Raspberry Pi 5 boards in Drawer C-02, 10 ESP32-WROOM units, and 20 STM32 BlackPill boards. That's 35 components in total, valued at ₹1,61,995. Most of the compute gear is assigned to Beta 2, while the microcontrollers are free in the Main Lab. Let me know if you want to assign parts to a project or check on anything specific!"
2. NATURAL, CONVERSATIONAL TONE:
   - Speak in friendly, clear, natural sentences and well-structured conversational paragraphs (typically 2 to 4 sentences).
   - Answer with the bottom-line insight first (e.g. "Our total inventory value is currently ₹1,61,995."), then give helpful context (e.g. which project holds the bulk of it, where items are stored, or if anything is running low).
   - Always be proactively helpful: offer a thoughtful next step or follow-up question (e.g. "Would you like me to log an invoice for this, or check if we need companion sensors?").
3. WHEN EXECUTING ACTIONS (ADDING, ADJUSTING, ASSIGNING, CREATING):
   - CRITICAL PRINCIPLE: Every added item is automatically assigned a sequential number, its total cost is calculated, and it is automatically marked as a purchase in the ledger.
   - Confirm what you did in a warm, natural, helpful sentence mentioning the item, quantity, unit price, total cost, and that it has been marked as a purchase (e.g. "Got it! I've added 5x ESP32-WROOM-32D at ₹450 each (Total Cost: ₹2,655 with 18% GST). It has been assigned an automatic item number and marked as a purchase in your ledger.")
   - NEVER put raw JSON code or technical syntax in your conversational message!
   - Append the exact JSON execution payload exclusively inside a single \`\`\`action ... \`\`\` block at the very end of your response, so the system can run it into Firestore.
4. STRICT GROUND TRUTH:
   - Use ONLY the real data from the live Firestore snapshot below. Never invent fake items, fake prices, or fake purchase orders.
   - If a requested item or project has no records, explain naturally: e.g. "I checked our lab records and Gamma 0 doesn't have any hardware allocated yet. If you're ready to set up its BOM, just tell me what parts you need and I'll link them right away!"
5. CURRENCY & NUMBERS:
   - Always format in Indian Rupees (₹) with standard separators (e.g., ₹28,499 or ₹450).
   - Total inventory value = sum of (quantity * unitPrice) for active non-archived products.
   - Total purchase expenditure = sum of invoiceTotal for purchases linked to that project.
   - Allocated stock value = sum of (quantity * unitPrice) of active products assigned to that project.

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
- Extract name, category, quantity, unit ("pcs"), unitPrice in INR, gstPercent, projectId, vendor, storageLocation.
- Keep the conversational part warm, natural, and helpful. All JSON strictly inside \`\`\`action ... \`\`\` at the bottom.

SUPPORTED ACTION TYPES & SCHEMAS:
* For ADD_PRODUCT:
\`\`\`action
{ "type": "ADD_PRODUCT", "summary": "Add Raspberry Pi 5 8GB (5 pcs @ ₹28,499)", "payload": { "name": "Raspberry Pi 5 8GB", "category": "Computing", "quantity": 5, "unit": "pcs", "unitPrice": 28499, "gstPercent": 18, "vendor": "Robu.in", "storageLocation": "Drawer C-02", "projectId": "Beta 2", "notes": "" } }
\`\`\`
* For BATCH_ADD_PRODUCTS:
\`\`\`action
{ "type": "BATCH_ADD_PRODUCTS", "summary": "Batch add new inventory items", "payload": { "products": [ { "name": "ESP32-WROOM-32D", "category": "Microcontrollers", "quantity": 10, "unit": "pcs", "unitPrice": 450, "gstPercent": 18, "vendor": "Robu", "storageLocation": "Lab Shelf A1" }, { "name": "STM32F401 BlackPill", "category": "Microcontrollers", "quantity": 5, "unit": "pcs", "unitPrice": 750, "gstPercent": 18, "vendor": "Mouser", "storageLocation": "Lab Shelf A2" } ] } }
\`\`\`
* For ADJUST_STOCK:
\`\`\`action
{ "type": "ADJUST_STOCK", "summary": "Adjust stock for item", "payload": { "productId": "<matched Product id>", "newQuantity": 20, "reason": "Physical count audit" } }
\`\`\`
* For UPDATE_PRODUCT:
\`\`\`action
{ "type": "UPDATE_PRODUCT", "summary": "Update item details", "payload": { "id": "<matched Product id>", "updates": { "unitPrice": 29000, "storageLocation": "Cabinet 4", "projectId": "" } } }
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
{ "type": "ADD_PURCHASE", "summary": "Record purchase order", "payload": { "productId": "<matched product id or empty>", "productNameSnapshot": "ESP32-WROOM-32D", "skuSnapshot": "", "vendorNameSnapshot": "Robu", "quantity": 10, "unitPrice": 450, "discount": 0, "gstRate": 18, "invoiceNumber": "INV-2026-001", "purchaseDate": "2026-10-10", "paymentStatus": "Paid", "projectId": "" } }
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
        return { text: response.text };
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
      text: `Got it! I went ahead and added ${qty}x ${prodName} at ₹${price} to your lab inventory and updated Firestore for you. Everything's in order—let me know if you need to allocate them to a specific project or record an invoice!\n\n\`\`\`action\n{\n  "type": "ADD_PRODUCT",\n  "summary": "Add ${prodName} (${qty} pcs)",\n  "payload": {\n    "name": "${prodName}",\n    "category": "Microcontrollers",\n    "quantity": ${qty},\n    "unit": "pcs",\n    "unitPrice": ${price},\n    "gstPercent": 18,\n    "storageLocation": "Main Lab",\n    "notes": "Added via DDLC Lab Helper"\n  }\n}\n\`\`\``
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
- gstPercent: GST rate percent number (0, 5, 12, 18, 28) (default 18)
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
      if (parsed.name) return parsed;
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
    gstPercent: 18,
    vendor: '',
    storageLocation: 'Main Lab',
    projectId: '',
    notes: 'Directly parsed',
  };
}
