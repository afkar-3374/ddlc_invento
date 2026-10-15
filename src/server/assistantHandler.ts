import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

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

export async function handleAssistantQuery(reqBody: AssistantRequest): Promise<{ text: string; action?: any; toolCalls?: any[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  const { message = '', history = [], databaseSnapshot = {} } = reqBody || {};

  const safeSnapshot = {
    products: Array.isArray(databaseSnapshot?.products) ? databaseSnapshot.products : [],
    projects: Array.isArray(databaseSnapshot?.projects) ? databaseSnapshot.projects : [],
    purchases: Array.isArray(databaseSnapshot?.purchases) ? databaseSnapshot.purchases : [],
    vendors: Array.isArray(databaseSnapshot?.vendors) ? databaseSnapshot.vendors : [],
    stockMovements: Array.isArray(databaseSnapshot?.stockMovements) ? databaseSnapshot.stockMovements : [],
  };

  const systemInstruction = `You're the absolute chillest, most helpful DDLC Lab teammate and engineering colleague. You're like a senior engineer who's also a great friend—super casual, friendly, enthusiastic, and reliable.

TONE & VIBE:
- Talk like a real friend and teammate! Use casual, warm language like "Yo!", "Homie", "Gotchu covered!", "Here you go!", "Solid!", "Let's do this!", "No worries at all".
- Never talk like a robot or corporate machine. Never say "As an AI..." or "According to the verified specifications of Cloud Firestore database...".
- Be concise, fun, and immediately helpful.

BARCODES & STUDIO (CRITICAL):
- When a user asks for a barcode (e.g. "give me the barcode for DDLC-0001", "show barcode for ESP32", "barcode for servo"):
  - ALWAYS call 'get_product_details' or 'open_label_studio'.
  - If the user mentions "studio", "show in studio", "in studio", "print", or wants to see/design the label in studio: ALWAYS call 'open_label_studio'!
  - Always make sure the barcode and SKU are clearly provided so they can scan it or print it.

INVENTORY ACTIONS:
- When asked to add components, use 'add_product'.
- When asked to adjust stock, use 'adjust_stock'.
- When asked about projects, use 'create_project' or answer questions casually.
- Keep the lab moving fast and keep the good vibes rolling!`;

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

    const addProductTool: FunctionDeclaration = {
      name: 'add_product',
      description: 'Adds a new product/component to the inventory database.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Name of the component' },
          quantity: { type: Type.NUMBER, description: 'Initial stock quantity' },
          unitPrice: { type: Type.NUMBER, description: 'Price per unit in INR' },
          category: { type: Type.STRING, description: 'Component category' },
          projectId: { type: Type.STRING, description: 'Optional project assignment' },
          storageLocation: { type: Type.STRING, description: 'Storage location' },
          vendor: { type: Type.STRING, description: 'Supplier name' },
          sku: { type: Type.STRING, description: 'Optional custom SKU (starts with DDLC-)' },
          barcode: { type: Type.STRING, description: 'Optional custom barcode' },
          notes: { type: Type.STRING, description: 'Additional details' }
        },
        required: ['name', 'quantity', 'unitPrice']
      }
    };

    const adjustStockTool: FunctionDeclaration = {
      name: 'adjust_stock',
      description: 'Updates the stock level for an existing item.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING, description: 'The ID or SKU' },
          newQuantity: { type: Type.NUMBER, description: 'The new total quantity' },
          reason: { type: Type.STRING, description: 'Reason for change' }
        },
        required: ['productId', 'newQuantity']
      }
    };

    const createProjectTool: FunctionDeclaration = {
      name: 'create_project',
      description: 'Creates a new engineering project.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Project name' },
          code: { type: Type.STRING, description: 'Project code' },
          description: { type: Type.STRING, description: 'Project overview' }
        },
        required: ['name']
      }
    };

    const deleteProductTool: FunctionDeclaration = {
      name: 'delete_product',
      description: 'Permanently removes a product.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING, description: 'The ID or SKU' }
        },
        required: ['productId']
      }
    };

    const openLabelStudioTool: FunctionDeclaration = {
      name: 'open_label_studio',
      description: 'Opens the Label Studio for previewing, designing, and printing barcodes for a product or SKU.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING, description: 'Focus on a specific product ID' },
          sku: { type: Type.STRING, description: 'Focus on a specific SKU (e.g. DDLC-0001)' },
          searchTerm: { type: Type.STRING, description: 'Component name or search query' },
          projectId: { type: Type.STRING, description: 'Optional: Focus on a specific project' }
        }
      }
    };

    const getProductDetailsTool: FunctionDeclaration = {
      name: 'get_product_details',
      description: 'Shows the scannable barcode and specs for a specific component by SKU, ID, or name.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING, description: 'The unique ID of the product' },
          sku: { type: Type.STRING, description: 'The SKU of the product (e.g. DDLC-0001)' },
          searchTerm: { type: Type.STRING, description: 'Name or keyword for the product (e.g. ESP32, Servo, OLED)' },
          openInStudio: { type: Type.BOOLEAN, description: 'Set to true if user wants to see it in Label Studio' }
        },
        required: []
      }
    };

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: [addProductTool, adjustStockTool, createProjectTool, deleteProductTool, openLabelStudioTool, getProductDetailsTool] }],
          temperature: 0.8,
        },
      });

      const text = response.text || '';
      const toolCalls = response.functionCalls;

      if (toolCalls && toolCalls.length > 0) {
        const actions = toolCalls.map((tc: any) => {
          const args: any = tc.args || {};
          if (tc.name === 'add_product') {
            return {
              type: 'ADD_PRODUCT',
              summary: `Add ${args.name} (${args.quantity} units)`,
              payload: args
            };
          }
          if (tc.name === 'adjust_stock') {
            return { 
              type: 'ADJUST_STOCK',
              summary: `Adjust stock for ${args.productId} to ${args.newQuantity}`,
              payload: args
            };
          }
          if (tc.name === 'create_project') {
            return {
              type: 'CREATE_PROJECT',
              summary: `Create project ${args.name}`,
              payload: args
            };
          }
          if (tc.name === 'delete_product') {
            return {
              type: 'DELETE_PRODUCT',
              summary: `Delete item ${args.productId}`,
              payload: { productId: args.productId }
            };
          }
          if (tc.name === 'open_label_studio' || tc.name === 'get_product_details') {
            // Smart product lookup in safeSnapshot
            const resolved = findProductInSnapshot(safeSnapshot.products, args, message);
            const barcodeVal = resolved?.barcode || resolved?.sku || args.sku || 'DDLC-0001';
            const wantsStudio = tc.name === 'open_label_studio' || args.openInStudio || message.toLowerCase().includes('studio');

            if (wantsStudio) {
              return {
                type: 'OPEN_STUDIO',
                summary: `Open Label Studio for ${resolved?.name || args.sku || 'Component'}`,
                payload: {
                  productId: resolved?.id || args.productId,
                  sku: resolved?.sku || args.sku,
                  barcode: barcodeVal,
                  startSku: resolved?.sku || args.sku,
                  endSku: resolved?.sku || args.sku,
                  name: resolved?.name,
                  quantity: resolved?.quantity,
                  unitPrice: resolved?.unitPrice,
                }
              };
            }

            return {
              type: 'SHOW_PRODUCT_DETAILS',
              summary: `Barcode for ${resolved?.name || args.sku || 'Component'} (${resolved?.sku || args.sku || 'DDLC-0001'})`,
              payload: {
                productId: resolved?.id || args.productId,
                sku: resolved?.sku || args.sku,
                barcode: barcodeVal,
                name: resolved?.name,
                category: resolved?.category,
                quantity: resolved?.quantity,
                unit: resolved?.unit,
                unitPrice: resolved?.unitPrice,
                storageLocation: resolved?.storageLocation,
                projectId: resolved?.projectId,
              }
            };
          }
          return null;
        }).filter(Boolean);

        return { 
          text: text || "Yo! I've set that up for you right here, homie.", 
          action: actions.length > 0 ? actions[0] : undefined,
          toolCalls: toolCalls 
        };
      }

      return { text: text };
    } catch (err: any) {
      console.warn('Gemini generateContent error:', err);
    }
  }

  return handleAutonomousFallback(message, safeSnapshot);
}

function findProductInSnapshot(products: any[], args: any, message: string) {
  const query = (args?.sku || args?.productId || args?.searchTerm || '').trim().toLowerCase();
  
  // 1. Direct SKU or ID match
  let found = products.find((p: any) => 
    (args?.productId && p.id === args.productId) ||
    (args?.sku && (p.sku || '').toUpperCase() === args.sku.toUpperCase()) ||
    (query && (p.sku || '').toLowerCase() === query) ||
    (query && (p.barcode || '').toLowerCase() === query)
  );

  // 2. Query in name
  if (!found && query) {
    found = products.find((p: any) => (p.name || '').toLowerCase().includes(query));
  }

  // 3. Message contains SKU
  if (!found) {
    const skuMatch = message.match(/\b(DDLC-[A-Za-z0-9_-]+)\b/i);
    if (skuMatch) {
      const s = skuMatch[1].toUpperCase();
      found = products.find((p: any) => (p.sku || '').toUpperCase() === s || p.id === s);
    }
  }

  // 4. Message contains product name
  if (!found) {
    const lower = message.toLowerCase();
    found = products.find((p: any) => p.name && lower.includes(p.name.toLowerCase()));
  }

  return found || products[0];
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

  // 1. BARCODE OR STUDIO REQUEST (Friendly, Casual, Direct!)
  const isBarcodeOrStudio = 
    lowerMsg.includes('barcode') || 
    lowerMsg.includes('studio') || 
    lowerMsg.includes('label') ||
    lowerMsg.includes('scan');

  if (isBarcodeOrStudio) {
    // Check if user wants scanner
    if (lowerMsg.includes('scan') && !lowerMsg.includes('barcode in studio') && !lowerMsg.includes('show')) {
      return {
        text: `Yo! Ready to scan some hardware? 📸 Just click below and your camera will pop right up!`,
        action: {
          type: 'SCAN_BARCODE',
          summary: 'Open Live Barcode Scanner',
        }
      };
    }

    // Identify target product
    const skuMatch = message.match(/\b(DDLC-[A-Za-z0-9_-]+)\b/i);
    let matchedProd: any = null;
    if (skuMatch) {
      const s = skuMatch[1].toUpperCase();
      matchedProd = products.find((p) => (p.sku || '').toUpperCase() === s || p.id === s);
    }
    if (!matchedProd) {
      matchedProd = products.find((p) => p.name && lowerMsg.includes(p.name.toLowerCase()));
    }
    if (!matchedProd && products.length > 0) {
      // Check for partial keyword matches
      const tokens = lowerMsg.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !['barcode', 'studio', 'show', 'give', 'want', 'need', 'chat', 'please', 'label', 'print', 'the', 'for'].includes(t));
      for (const t of tokens) {
        const found = products.find((p) => (p.name || '').toLowerCase().includes(t) || (p.category || '').toLowerCase().includes(t));
        if (found) {
          matchedProd = found;
          break;
        }
      }
    }

    // Default to first product if none matched specifically
    if (!matchedProd && products.length > 0) {
      matchedProd = products[0];
    }

    const wantsStudio = lowerMsg.includes('studio') || lowerMsg.includes('print');

    if (matchedProd) {
      const barcodeValue = matchedProd.barcode || matchedProd.sku;

      if (wantsStudio) {
        return {
          text: `Yo, gotchu covered! 🎉 Opening **${matchedProd.name}** (\`${matchedProd.sku}\`) in the Label Studio right now so you can preview, adjust dimensions, and print the stickers. Here's your barcode below too!`,
          action: {
            type: 'OPEN_STUDIO',
            summary: `Open Label Studio for ${matchedProd.name} (${matchedProd.sku})`,
            payload: {
              productId: matchedProd.id,
              sku: matchedProd.sku,
              barcode: barcodeValue,
              startSku: matchedProd.sku,
              endSku: matchedProd.sku,
              name: matchedProd.name,
              quantity: matchedProd.quantity,
              unitPrice: matchedProd.unitPrice,
            }
          }
        };
      }

      return {
        text: `Yo! Here's the official scannable barcode for **${matchedProd.name}** (\`${matchedProd.sku}\`). You can scan it right off your screen or click **Open in Studio** below to print high-res stickers! 🏷️✨`,
        action: {
          type: 'SHOW_PRODUCT_DETAILS',
          summary: `Barcode for ${matchedProd.name} (${matchedProd.sku})`,
          payload: {
            productId: matchedProd.id,
            sku: matchedProd.sku,
            barcode: barcodeValue,
            name: matchedProd.name,
            category: matchedProd.category || 'General',
            quantity: matchedProd.quantity || 1,
            unit: matchedProd.unit || 'pcs',
            unitPrice: matchedProd.unitPrice || 0,
            storageLocation: matchedProd.storageLocation || 'Main Lab',
            projectId: matchedProd.projectId || '',
          }
        }
      };
    } else {
      return {
        text: `Yo homie! I can open up the Label Studio for you right away. What SKU or component do you need labels for? Drop me a name like *"barcode for DDLC-0001"* or click below to browse!`,
        action: {
          type: 'OPEN_STUDIO',
          summary: 'Open Label Studio',
          payload: {}
        }
      };
    }
  }

  // 2. SPECIFIC SKU LOOKUP: e.g. "Find SKU DDLC-0001"
  const skuQueryMatch = message.match(/\b(DDLC-[A-Za-z0-9_-]+)\b/i);
  if (skuQueryMatch || lowerMsg.startsWith('find sku') || lowerMsg.startsWith('show sku') || lowerMsg.startsWith('lookup')) {
    const targetSku = skuQueryMatch ? skuQueryMatch[1].toUpperCase() : '';
    const found = products.find((p) => (p.sku || '').toUpperCase() === targetSku || p.id === targetSku);

    if (found) {
      const projName = projects.find((pr) => pr.id === found.projectId)?.name || 'General Stock';
      return {
        text: `Found it, homie! Here's the lowdown on **${found.name}** (\`${found.sku}\`):\n\n• **Stock**: ${found.quantity} ${found.unit || 'pcs'} in ${found.storageLocation || 'Main Lab'}\n• **Cost**: ${formatINR(found.unitPrice)} each (Total: ${formatINR((found.quantity || 0) * (found.unitPrice || 0))})\n• **Project**: ${projName}\n• **Barcode**: \`${found.barcode || found.sku}\`\n\nI've got the barcode ready for you below—you can view specs or open it right up in the studio!`,
        action: {
          type: 'SHOW_PRODUCT_DETAILS',
          summary: `Barcode & details for ${found.name} (${found.sku})`,
          payload: {
            productId: found.id,
            sku: found.sku,
            barcode: found.barcode || found.sku,
            name: found.name,
            category: found.category,
            quantity: found.quantity,
            unit: found.unit,
            unitPrice: found.unitPrice,
            storageLocation: found.storageLocation,
            projectId: found.projectId,
          },
        },
      };
    } else if (targetSku) {
      return {
        text: `Hey, I checked our Firestore records and didn't spot SKU **${targetSku}** yet.\n\nWant me to add it as a new component? Just tell me what it is, like: *"Add 10x Raspberry Pi Pico at ₹450 as ${targetSku}"*!`,
      };
    }
  }

  // 3. PROJECT COST INQUIRY
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
        text: `Here's what we've got invested in **${targetProj.name}** (\`${targetProj.code}\`), homie:\n\n1. 🧾 **Total Purchase Invoices**: **${formatINR(totalPoSpend)}** (${projPurchases.length} supplier orders)\n2. 📦 **Current Parts on Shelf**: **${formatINR(allocatedStockVal)}** (${allocatedParts.length} components assigned)\n\nWant me to show you the components for this project or generate their barcode labels?`,
      };
    }
  }

  // 4. ADD NEW COMPONENT WITH DETAILS
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
      text: `Boom! Prepared that addition for you, homie:\n\n✨ **${prodName}** (${qty} pcs @ ${formatINR(price)})\n🏷️ **SKU & Barcode**: \`${assignedSku}\`\n📁 **Project**: ${projName}\n\nClick **Confirm & Save to Firestore** below to make it official:`,
      action: {
        type: 'ADD_PRODUCT',
        summary: `Add ${prodName} (${qty} pcs @ ${formatINR(price)})`,
        payload: {
          name: prodName,
          sku: assignedSku,
          barcode: assignedSku,
          category: 'Microcontrollers',
          quantity: qty,
          unit: 'pcs',
          unitPrice: price,
          gstPercent: 0,
          projectId: projTarget,
          storageLocation: 'Main Lab',
          notes: 'Added via DDLC AI Assistant',
        },
      },
    };
  }

  // 5. INVENTORY ANALYSIS RESULTS
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

    return {
      text: `Here's our lab stock snapshot, homie! 🚀\n\n• **Total Unique Parts**: ${products.length} components registered\n• **Total Physical Units**: ${totalUnits.toLocaleString()} units on shelves\n• **Inventory Valuation**: **${formatINR(totalVal)}**\n• **Active Projects**: ${projects.length}\n• **Low Stock Notice (≤5 units)**: ${lowStock.length > 0 ? lowStock.map(p => `${p.name} (${p.quantity} left)`).join(', ') : 'All stock levels looking healthy!'}\n\nNeed me to whip up barcode labels or help reorder any parts?`,
    };
  }

  // 6. Default welcoming assistant response
  return {
    text: `Yo! I'm your DDLC Lab assistant. 👋

I'm here to keep our workbench organized and running smooth. You can ask me to:
• "Give me the barcode for DDLC-0001 in studio"
• "Show barcode for ESP32"
• "Add 10x Raspberry Pi Pico at ₹450 to Rover"
• "How much did Beta 2 cost?"
• "Give detailed inventory analysis"

What can I grab for you, homie?`,
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

  const candidateModels = [
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
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
      console.warn(`Gemini Parse Item notice for ${modelName}, checking next:`, err);
    }
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
