import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, testConnection } from '../firebase';
import { Product, Project, Purchase, Vendor, Category, StockMovement, AuditLog } from '../types';
import * as dbService from '../services/dbService';

interface ProjectStats {
  totalExpenditure: number;
  currentAllocatedStockValue: number;
  itemsCount: number;
  purchasesCount: number;
}

interface InventoryContextType {
  products: Product[];
  projects: Project[];
  purchases: Purchase[];
  vendors: Vendor[];
  categories: Category[];
  stockMovements: StockMovement[];
  auditLogs: AuditLog[];
  dataLoading: boolean;
  dbError: string | null;

  // Computed metrics
  totalInventoryValue: number;
  totalProductsCount: number;
  totalStockQuantity: number;
  activeProjectsCount: number;
  totalPurchasesValue: number;
  totalGstRecorded: number;

  getProjectStats: (projectId: string) => ProjectStats;

  // Actions
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'sku'> & { sku?: string; archived?: boolean; itemNumber?: number }) => Promise<Product>;
  editProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  archiveProduct: (id: string, currentArchived: boolean) => Promise<void>;
  adjustProductStock: (id: string, newQty: number, reason?: string) => Promise<void>;
  addProject: (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>;
  editProject: (id: string, updates: Partial<Project>) => Promise<void>;
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'purchaseNumber' | 'createdAt'>) => Promise<Purchase>;
  addVendor: (vendorData: Omit<Vendor, 'id' | 'createdAt'>) => Promise<Vendor>;
  addCategory: (catData: Omit<Category, 'id' | 'createdAt'>) => Promise<Category>;
  clearAllData: () => Promise<void>;
  resetToSampleData: () => void;
}

const DEFAULT_INITIAL_PRODUCTS: Product[] = [];

const DEFAULT_INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj_beta2',
    name: 'Beta 2 Telemetry Unit',
    code: 'BETA-02',
    description: 'Field telemetry and motor speed monitoring unit',
    status: 'Active',
    startDate: new Date().toISOString().slice(0, 10),
    notes: 'Active hardware prototype',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_INITIAL_PURCHASES: Purchase[] = [];

const InventoryContext = createContext<InventoryContextType | null>(null);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initially from localStorage if present so index.html opens with persisted items
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const stored = localStorage.getItem('ddlc_products');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Normalize: no GST, totalCost = quantity * unitPrice
          return parsed.map((p, idx) => ({
            ...p,
            itemNumber: p.itemNumber || (idx + 1),
            gstPercent: 0,
            gstAmount: 0,
            totalCost: (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0),
          }));
        }
      }
    } catch {}
    return DEFAULT_INITIAL_PRODUCTS;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const stored = localStorage.getItem('ddlc_projects');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_INITIAL_PROJECTS;
  });

  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    try {
      const stored = localStorage.getItem('ddlc_purchases');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.map((pu) => ({
            ...pu,
            gstRate: 0,
            gstAmount: 0,
            invoiceTotal: (Number(pu.quantity) || 0) * (Number(pu.unitPrice) || 0),
          }));
        }
      }
    } catch {}
    return DEFAULT_INITIAL_PURCHASES;
  });

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem('ddlc_products', JSON.stringify(products));
    } catch {}
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('ddlc_projects', JSON.stringify(projects));
    } catch {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem('ddlc_purchases', JSON.stringify(purchases));
    } catch {}
  }, [purchases]);

  // Firestore background listeners (syncs real cloud data if connected)
  useEffect(() => {
    testConnection();

    // 1. Products
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        if (!snap.empty) {
          const list: Product[] = [];
          snap.forEach((d) => list.push(d.data() as Product));
          // Ensure every product has itemNumber & totalCost without GST
          const normalized = list.map((p, idx) => {
            const itemNum = p.itemNumber || (idx + 1);
            const q = Number(p.quantity) || 0;
            const up = Number(p.unitPrice) || 0;
            const total = q * up;
            return { ...p, itemNumber: itemNum, gstPercent: 0, gstAmount: 0, totalCost: total };
          });
          setProducts(normalized);
        }
      },
      (error) => {
        console.warn('Firestore products notice (using local cache):', error);
      }
    );

    // 2. Projects
    const unsubProjects = onSnapshot(
      collection(db, 'projects'),
      (snap) => {
        if (!snap.empty) {
          const list: Project[] = [];
          snap.forEach((d) => list.push(d.data() as Project));
          setProjects(list);
        }
      },
      (error) => console.warn('Firestore projects notice:', error)
    );

    // 3. Purchases
    const unsubPurchases = onSnapshot(
      collection(db, 'purchases'),
      (snap) => {
        if (!snap.empty) {
          const list: Purchase[] = [];
          snap.forEach((d) => {
            const pu = d.data() as Purchase;
            const q = Number(pu.quantity) || 0;
            const up = Number(pu.unitPrice) || 0;
            const total = q * up;
            list.push({ ...pu, gstRate: 0, gstAmount: 0, invoiceTotal: total });
          });
          list.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
          setPurchases(list);
        }
      },
      (error) => console.warn('Firestore purchases notice:', error)
    );

    return () => {
      unsubProducts();
      unsubProjects();
      unsubPurchases();
    };
  }, []);

  // Total Calculations derived automatically (No GST)
  const totalInventoryValue = useMemo(() => {
    return products
      .filter((p) => !p.archived)
      .reduce((sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0)), 0);
  }, [products]);

  const totalProductsCount = useMemo(() => {
    return products.filter((p) => !p.archived).length;
  }, [products]);

  const totalStockQuantity = useMemo(() => {
    return products
      .filter((p) => !p.archived)
      .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  }, [products]);

  const activeProjectsCount = useMemo(() => {
    return projects.filter((p) => p.status === 'Active' || p.status === 'Beta' || p.status === 'Planning').length;
  }, [projects]);

  const totalPurchasesValue = useMemo(() => {
    if (purchases.length > 0) {
      return purchases.reduce((sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0)), 0);
    }
    return totalInventoryValue;
  }, [purchases, totalInventoryValue]);

  const totalGstRecorded = useMemo(() => 0, []);

  const getProjectStats = (projectId: string): ProjectStats => {
    const projectPurchases = purchases.filter((p) => p.projectId === projectId);
    const totalExpenditure = projectPurchases.reduce((sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0)), 0);
    const projectProducts = products.filter((p) => p.projectId === projectId && !p.archived);
    const currentAllocatedStockValue = projectProducts.reduce(
      (sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0)),
      0
    );

    return {
      totalExpenditure,
      currentAllocatedStockValue,
      itemsCount: projectProducts.length,
      purchasesCount: projectPurchases.length,
    };
  };

  /**
   * ADD PRODUCT:
   * - Automatic sequential number for each item
   * - Each add is automatically marked as purchase
   * - Total cost is calculated and added (No GST)
   */
  const addProduct = async (
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'sku'> & { sku?: string; archived?: boolean; itemNumber?: number }
  ): Promise<Product> => {
    const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    // 1. Automatic sequential number for item
    const highestExistingNum = products.reduce((max, p) => Math.max(max, p.itemNumber || 0), 0);
    const itemNumber = productData.itemNumber || (highestExistingNum + 1);
    const sku = productData.sku || `ITEM-${String(itemNumber).padStart(3, '0')}`;

    const quantity = Number(productData.quantity) || 1;
    const unitPrice = Number(productData.unitPrice) || 0;
    const totalCost = unitPrice * quantity; // Pure total cost, NO GST!

    const newProduct: Product = {
      ...productData,
      id,
      itemNumber,
      sku,
      quantity,
      unitPrice,
      gstPercent: 0,
      gstAmount: 0,
      totalCost,
      archived: productData.archived ?? false,
      createdAt: now,
      updatedAt: now,
    };

    // 2. Automatically mark as purchase
    const purchaseId = `po_${id}`;
    const poNumber = `PO-#${itemNumber}`;
    const newPurchase: Purchase = {
      id: purchaseId,
      purchaseNumber: poNumber,
      productId: id,
      productNameSnapshot: newProduct.name,
      skuSnapshot: newProduct.sku,
      vendorId: '',
      vendorNameSnapshot: newProduct.vendor || 'Direct Vendor',
      projectId: newProduct.projectId || '',
      projectNameSnapshot: newProduct.projectId || '',
      quantity: quantity,
      unitPrice: unitPrice,
      discount: 0,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: totalCost,
      invoiceNumber: `INV-${String(itemNumber).padStart(4, '0')}`,
      purchaseDate: newProduct.purchaseDate || now.slice(0, 10),
      paymentStatus: 'Paid',
      notes: newProduct.notes || 'Auto-marked as purchase on item addition',
      createdAt: now,
    };

    // Update state immediately (optimistic & instant)
    setProducts((prev) => [newProduct, ...prev]);
    setPurchases((prev) => [newPurchase, ...prev]);

    // Also persist in Firestore in background
    try {
      await setDoc(doc(db, 'products', id), newProduct);
      await setDoc(doc(db, 'purchases', purchaseId), newPurchase);
    } catch (e) {
      console.warn('Firestore background write notice:', e);
    }

    return newProduct;
  };

  /**
   * Edit product
   */
  const editProduct = async (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, ...updates, updatedAt: new Date().toISOString() };
        const q = Number(updated.quantity) || 0;
        const up = Number(updated.unitPrice) || 0;
        updated.gstPercent = 0;
        updated.gstAmount = 0;
        updated.totalCost = q * up;
        return updated;
      })
    );

    try {
      await updateDoc(doc(db, 'products', id), { ...updates, gstPercent: 0, gstAmount: 0, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.warn('Firestore update warning:', e);
    }
  };

  /**
   * Delete product permanently
   */
  const deleteProduct = async (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setPurchases((prev) => prev.filter((pu) => pu.productId !== id));

    try {
      await deleteDoc(doc(db, 'products', id));
      await deleteDoc(doc(db, 'purchases', `po_${id}`));
    } catch (e) {
      console.warn('Firestore delete warning:', e);
    }
  };

  /**
   * Toggle archive product
   */
  const archiveProduct = async (id: string, currentArchived: boolean) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, archived: !currentArchived, updatedAt: new Date().toISOString() } : p))
    );

    try {
      await updateDoc(doc(db, 'products', id), { archived: !currentArchived, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.warn('Firestore archive warning:', e);
    }
  };

  /**
   * Adjust stock (+ or -)
   */
  const adjustProductStock = async (id: string, newQty: number, reason?: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const q = Math.max(0, newQty);
        const up = Number(p.unitPrice) || 0;
        const total = q * up;
        return { ...p, quantity: q, totalCost: total, gstPercent: 0, gstAmount: 0, updatedAt: new Date().toISOString() };
      })
    );

    try {
      await updateDoc(doc(db, 'products', id), { quantity: Math.max(0, newQty), gstPercent: 0, gstAmount: 0, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.warn('Firestore adjust stock warning:', e);
    }
  };

  /**
   * Reset / reseed sample data
   */
  const resetToSampleData = () => {
    setProducts(DEFAULT_INITIAL_PRODUCTS);
    setProjects(DEFAULT_INITIAL_PROJECTS);
    setPurchases(DEFAULT_INITIAL_PURCHASES);
    localStorage.setItem('ddlc_products', JSON.stringify(DEFAULT_INITIAL_PRODUCTS));
    localStorage.setItem('ddlc_projects', JSON.stringify(DEFAULT_INITIAL_PROJECTS));
    localStorage.setItem('ddlc_purchases', JSON.stringify(DEFAULT_INITIAL_PURCHASES));
  };

  return (
    <InventoryContext.Provider
      value={{
        products,
        projects,
        purchases,
        vendors,
        categories,
        stockMovements,
        auditLogs,
        dataLoading,
        dbError,
        totalInventoryValue,
        totalProductsCount,
        totalStockQuantity,
        activeProjectsCount,
        totalPurchasesValue,
        totalGstRecorded,
        getProjectStats,
        addProduct,
        editProduct,
        deleteProduct,
        archiveProduct,
        adjustProductStock,
        addProject: dbService.createProject,
        editProject: dbService.updateProject,
        addPurchase: dbService.recordPurchase,
        addVendor: dbService.createVendor,
        addCategory: dbService.createCategory,
        clearAllData: async () => {
          setProducts([]);
          setPurchases([]);
          localStorage.removeItem('ddlc_products');
          localStorage.removeItem('ddlc_purchases');
          await dbService.clearAllData();
        },
        resetToSampleData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
