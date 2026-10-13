import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  writeBatch,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { Product, Project, Purchase, Vendor, Category, StockMovement, AuditLog } from '../types';

/**
 * Format currency in Indian Rupee (INR)
 */
export function formatINR(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Concurrency-safe unique SKU generator using a Firestore transaction
 */
export async function generateUniqueSKU(categoryCode: string = 'GEN'): Promise<string> {
  const sanitizedPrefix = categoryCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'GEN';
  const counterDocRef = doc(db, 'skuCounters', `counter_${sanitizedPrefix}`);

  try {
    const nextSeq = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterDocRef);
      let count = 1;
      if (counterSnap.exists()) {
        const data = counterSnap.data();
        count = (data.currentCount || 0) + 1;
      }
      transaction.set(counterDocRef, {
        prefix: sanitizedPrefix,
        currentCount: count,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return count;
    });

    const padded = String(nextSeq).padStart(5, '0');
    return `DDLC-${sanitizedPrefix}-${padded}`;
  } catch (error) {
    console.warn(`Counter transaction for prefix ${sanitizedPrefix} warning:`, error);
    const fallbackSeq = Math.floor(10000 + Math.random() * 89999);
    return `DDLC-${sanitizedPrefix}-${fallbackSeq}`;
  }
}

/**
 * Concurrency-safe automatic sequential item number generator
 */
export async function generateNextItemNumber(): Promise<number> {
  const counterDocRef = doc(db, 'skuCounters', 'counter_ITEMS');
  try {
    const nextSeq = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterDocRef);
      let count = 1;
      if (counterSnap.exists()) {
        count = (counterSnap.data().currentCount || 0) + 1;
      }
      transaction.set(counterDocRef, {
        currentCount: count,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return count;
    });
    return nextSeq;
  } catch (error) {
    console.warn('Item number counter warning:', error);
    return Math.floor(1 + Math.random() * 999);
  }
}

/**
 * Generate unique Purchase Reference Number
 */
export async function generatePurchaseNumber(): Promise<string> {
  const counterDocRef = doc(db, 'skuCounters', 'counter_PURCHASE');
  try {
    const nextSeq = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterDocRef);
      let count = 1;
      if (counterSnap.exists()) {
        count = (counterSnap.data().currentCount || 0) + 1;
      }
      transaction.set(counterDocRef, {
        prefix: 'PO',
        currentCount: count,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return count;
    });
    return `PO-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;
  } catch (error) {
    console.warn('Purchase counter transaction warning:', error);
    const fallbackSeq = Math.floor(1000 + Math.random() * 8999);
    return `PO-${new Date().getFullYear()}-${fallbackSeq}`;
  }
}

/**
 * Add an audit log entry
 */
export async function logAuditEvent(action: string, entityType: string, entityId: string, details: string) {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logRef = doc(db, 'auditLogs', logId);
    await setDoc(logRef, {
      action,
      entityType,
      entityId,
      details,
      userId: 'DDLC Operator',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Audit log write error:', e);
  }
}

/**
 * Create a new Product
 * EACH ADD AUTOMATICALLY MARKS AS PURCHASE with automatic number and total cost calculated!
 */
export async function createProduct(
  productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'sku'> & { sku?: string; archived?: boolean; itemNumber?: number }
): Promise<Product> {
  const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  // 1. Automatic item number
  const itemNumber = productData.itemNumber || (await generateNextItemNumber());
  const rawSku = productData.sku?.trim();
  const sku = rawSku
    ? (rawSku.toUpperCase().startsWith('DDLC-') ? rawSku.toUpperCase() : `DDLC-${rawSku.toUpperCase()}`)
    : `DDLC-${String(itemNumber).padStart(4, '0')}`;
  const barcode = productData.barcode || sku;

  const quantity = Number(productData.quantity) || 1;
  const unitPrice = Number(productData.unitPrice) || 0;
  const totalCost = unitPrice * quantity; // Pure total cost, NO GST!

  const product: Product = {
    ...productData,
    id,
    itemNumber,
    sku,
    barcode,
    quantity,
    unitPrice,
    gstPercent: 0,
    gstAmount: 0,
    totalCost,
    archived: productData.archived ?? false,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // 2. Write Product to Firestore
    await setDoc(doc(db, 'products', id), product);
    await logAuditEvent('CREATE_PRODUCT', 'Product', id, `Created item #${itemNumber} ${product.name} (SKU: ${sku})`);

    // 3. EVERY ADD AUTOMATICALLY MARKS AS PURCHASE with total cost added!
    const purchaseId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const poNumber = `PO-${String(itemNumber).padStart(3, '0')}`;
    const purchase: Purchase = {
      id: purchaseId,
      purchaseNumber: poNumber,
      productId: id,
      productNameSnapshot: product.name,
      skuSnapshot: product.sku,
      vendorId: '',
      vendorNameSnapshot: product.vendor || 'Direct Purchase',
      projectId: product.projectId || '',
      projectNameSnapshot: product.projectId || '',
      quantity: quantity,
      unitPrice: unitPrice,
      discount: 0,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: totalCost,
      invoiceNumber: `INV-${String(itemNumber).padStart(4, '0')}`,
      purchaseDate: product.purchaseDate || now.slice(0, 10),
      paymentStatus: 'Paid',
      notes: product.notes || 'Auto-marked as purchase on item addition',
      createdAt: now,
    };

    await setDoc(doc(db, 'purchases', purchaseId), purchase);
    await logAuditEvent('AUTO_PURCHASE', 'Purchase', purchaseId, `Auto-recorded purchase for #${itemNumber} ${product.name} (Total: ₹${totalCost})`);

    return product;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `products/${id}`);
  }
}

/**
 * Update an existing Product
 */
export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  try {
    const prodRef = doc(db, 'products', id);
    const updatedPayload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(prodRef, updatedPayload);
    await logAuditEvent('UPDATE_PRODUCT', 'Product', id, `Updated fields: ${Object.keys(updates).join(', ')}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
  }
}

/**
 * Adjust stock manually with audit movement record
 */
export async function adjustStock(productId: string, newQuantity: number, reason: string): Promise<void> {
  try {
    const prodRef = doc(db, 'products', productId);
    await runTransaction(db, async (tx) => {
      const prodSnap = await tx.get(prodRef);
      if (!prodSnap.exists()) throw new Error(`Product ${productId} not found`);
      const prodData = prodSnap.data() as Product;
      const prevQty = prodData.quantity;
      const diff = newQuantity - prevQty;

      tx.update(prodRef, {
        quantity: newQuantity,
        updatedAt: new Date().toISOString(),
      });

      const movementId = `sm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const movementRef = doc(db, 'stockMovements', movementId);
      const movement: StockMovement = {
        id: movementId,
        productId,
        sku: prodData.sku,
        type: diff >= 0 ? 'ADJUSTMENT' : 'RETURN',
        quantity: Math.abs(diff),
        previousStock: prevQty,
        newStock: newQuantity,
        referenceId: 'MANUAL_ADJUSTMENT',
        notes: reason,
        createdBy: 'DDLC Operator',
        createdAt: new Date().toISOString(),
      };
      tx.set(movementRef, movement);
    });
    await logAuditEvent('ADJUST_STOCK', 'Product', productId, `Stock set to ${newQuantity}. Reason: ${reason}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `products/${productId}`);
  }
}

/**
 * Archive or Unarchive a product
 */
export async function toggleArchiveProduct(id: string, currentArchived: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'products', id), {
      archived: !currentArchived,
      updatedAt: new Date().toISOString(),
    });
    await logAuditEvent(
      !currentArchived ? 'ARCHIVE_PRODUCT' : 'RESTORE_PRODUCT',
      'Product',
      id,
      `Product archived status set to ${!currentArchived}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
  }
}

/**
 * Create a new Project
 */
export async function createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const project: Project = {
    ...projectData,
    id,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'projects', id), project);
    await logAuditEvent('CREATE_PROJECT', 'Project', id, `Created project ${project.name} (${project.code})`);
    return project;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `projects/${id}`);
  }
}

/**
 * Update Project
 */
export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
  try {
    await updateDoc(doc(db, 'projects', id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await logAuditEvent('UPDATE_PROJECT', 'Project', id, `Updated project fields`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${id}`);
  }
}

/**
 * Record a Purchase
 * Updates product stock atomically through an inventory movement and stores immutable purchase entry
 */
export async function recordPurchase(
  purchaseData: Omit<Purchase, 'id' | 'purchaseNumber' | 'createdAt'>
): Promise<Purchase> {
  const purchaseId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const purchaseNumber = await generatePurchaseNumber();
  const now = new Date().toISOString();

  const purchase: Purchase = {
    ...purchaseData,
    id: purchaseId,
    purchaseNumber,
    createdAt: now,
  };

  try {
    await runTransaction(db, async (tx) => {
      // 1. Fetch or create product
      let prodData: Product | null = null;
      let productRef = purchase.productId ? doc(db, 'products', purchase.productId) : null;
      let prevQty = 0;
      let newQty = purchase.quantity || 1;

      if (productRef) {
        const productSnap = await tx.get(productRef);
        if (productSnap.exists()) {
          prodData = productSnap.data() as Product;
          prevQty = prodData.quantity || 0;
          newQty = prevQty + purchase.quantity;
          tx.update(productRef, {
            quantity: newQty,
            updatedAt: now,
          });
        }
      }

      if (!prodData) {
        const newProdId = purchase.productId || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        productRef = doc(db, 'products', newProdId);
        const sku = purchase.skuSnapshot || `DDLC-GEN-${Math.floor(10000 + Math.random() * 89999)}`;
        prodData = {
          id: newProdId,
          sku: sku,
          name: purchase.productNameSnapshot || 'Procured Item',
          category: 'General',
          description: `Created from purchase #${purchaseNumber}`,
          quantity: purchase.quantity || 1,
          unit: 'pcs',
          unitPrice: purchase.unitPrice || 0,
          gstPercent: purchase.gstRate || 0,
          gstAmount: purchase.gstAmount || 0,
          vendor: purchase.vendorNameSnapshot || '',
          purchaseDate: purchase.purchaseDate || now.slice(0, 10),
          projectId: purchase.projectId || '',
          storageLocation: 'Main Lab',
          notes: purchase.notes || '',
          archived: false,
          createdAt: now,
          updatedAt: now,
        };
        tx.set(productRef, prodData);
        purchase.productId = newProdId;
      }

      // 2. Save immutable purchase document
      const purchaseRef = doc(db, 'purchases', purchaseId);
      tx.set(purchaseRef, purchase);

      // 3. Create stock movement audit record
      const movementId = `sm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const movementRef = doc(db, 'stockMovements', movementId);
      const movement: StockMovement = {
        id: movementId,
        productId: purchase.productId,
        sku: prodData.sku,
        type: 'PURCHASE_IN',
        quantity: purchase.quantity,
        previousStock: prevQty,
        newStock: newQty,
        referenceId: purchaseNumber,
        notes: `Purchase from ${purchase.vendorNameSnapshot}. Invoice #${purchase.invoiceNumber}`,
        createdBy: 'DDLC Operator',
        createdAt: now,
      };
      tx.set(movementRef, movement);
    });

    await logAuditEvent(
      'RECORD_PURCHASE',
      'Purchase',
      purchaseId,
      `Recorded ${purchaseNumber}: ${purchase.quantity}x ${purchase.productNameSnapshot} (Total: ${formatINR(purchase.invoiceTotal)})`
    );

    return purchase;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `purchases/${purchaseId}`);
  }
}

/**
 * Create or get Vendor
 */
export async function createVendor(vendorData: Omit<Vendor, 'id' | 'createdAt'>): Promise<Vendor> {
  const id = `vnd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const vendor: Vendor = {
    ...vendorData,
    id,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'vendors', id), vendor);
    await logAuditEvent('CREATE_VENDOR', 'Vendor', id, `Added supplier ${vendor.name}`);
    return vendor;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `vendors/${id}`);
  }
}

/**
 * Create Category
 */
export async function createCategory(catData: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
  const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const cat: Category = {
    ...catData,
    id,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'categories', id), cat);
    return cat;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `categories/${id}`);
  }
}

/**
 * Delete a product permanently
 */
export async function deleteProduct(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', id));
    await logAuditEvent('DELETE_PRODUCT', 'Product', id, `Deleted product ${id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
  }
}

/**
 * Wipe all records from Firestore collections to start completely clean with a real database
 */
export async function clearAllData(): Promise<void> {
  const collectionsToClear = [
    'products',
    'purchases',
    'projects',
    'vendors',
    'categories',
    'stockMovements',
    'auditLogs',
    'skuCounters',
  ];

  for (const colName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn(`Error clearing collection ${colName}:`, e);
      try {
        const snap = await getDocs(collection(db, colName));
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, colName, docSnap.id));
        }
      } catch (innerErr) {
        console.error(`Fallback deletion failed for ${colName}:`, innerErr);
      }
    }
  }

  console.log('All previous database records cleared from Cloud Firestore.');
}

