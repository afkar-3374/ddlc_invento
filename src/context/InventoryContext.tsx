import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db, testConnection, handleFirestoreError, OperationType } from '../firebase';
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
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'sku'> & { sku?: string; archived?: boolean }) => Promise<Product>;
  editProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  archiveProduct: (id: string, currentArchived: boolean) => Promise<void>;
  adjustProductStock: (id: string, newQty: number, reason: string) => Promise<void>;
  addProject: (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>;
  editProject: (id: string, updates: Partial<Project>) => Promise<void>;
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'purchaseNumber' | 'createdAt'>) => Promise<Purchase>;
  addVendor: (vendorData: Omit<Vendor, 'id' | 'createdAt'>) => Promise<Vendor>;
  addCategory: (catData: Omit<Category, 'id' | 'createdAt'>) => Promise<Category>;
  clearAllData: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Direct connection & initial listeners
  useEffect(() => {
    testConnection();
    setDataLoading(true);

    // 1. Products
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const list: Product[] = [];
        snap.forEach((d) => list.push(d.data() as Product));
        setProducts(list);
        setDataLoading(false);
      },
      (error) => {
        console.warn('Products snapshot notice:', error);
        setDataLoading(false);
      }
    );

    // 2. Projects
    const unsubProjects = onSnapshot(
      collection(db, 'projects'),
      (snap) => {
        const list: Project[] = [];
        snap.forEach((d) => list.push(d.data() as Project));
        setProjects(list);
      },
      (error) => console.warn('Projects snapshot:', error)
    );

    // 3. Purchases
    const unsubPurchases = onSnapshot(
      collection(db, 'purchases'),
      (snap) => {
        const list: Purchase[] = [];
        snap.forEach((d) => list.push(d.data() as Purchase));
        list.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
        setPurchases(list);
      },
      (error) => console.warn('Purchases snapshot:', error)
    );

    // 4. Vendors
    const unsubVendors = onSnapshot(
      collection(db, 'vendors'),
      (snap) => {
        const list: Vendor[] = [];
        snap.forEach((d) => list.push(d.data() as Vendor));
        setVendors(list);
      },
      (error) => console.warn('Vendors snapshot:', error)
    );

    // 5. Categories
    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        const list: Category[] = [];
        snap.forEach((d) => list.push(d.data() as Category));
        setCategories(list);
      },
      (error) => console.warn('Categories snapshot:', error)
    );

    // 6. Stock Movements
    const unsubMovements = onSnapshot(
      collection(db, 'stockMovements'),
      (snap) => {
        const list: StockMovement[] = [];
        snap.forEach((d) => list.push(d.data() as StockMovement));
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setStockMovements(list);
      },
      (error) => console.warn('StockMovements snapshot:', error)
    );

    // 7. Audit Logs
    const unsubLogs = onSnapshot(
      collection(db, 'auditLogs'),
      (snap) => {
        const list: AuditLog[] = [];
        snap.forEach((d) => list.push(d.data() as AuditLog));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAuditLogs(list);
      },
      (error) => console.warn('AuditLogs snapshot:', error)
    );

    return () => {
      unsubProducts();
      unsubProjects();
      unsubPurchases();
      unsubVendors();
      unsubCategories();
      unsubMovements();
      unsubLogs();
    };
  }, []);

  // Calculations derived strictly from live Firestore data
  const totalInventoryValue = useMemo(() => {
    return products
      .filter((p) => !p.archived)
      .reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0), 0);
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
    return purchases.reduce((sum, p) => sum + (Number(p.invoiceTotal) || 0), 0);
  }, [purchases]);

  const totalGstRecorded = useMemo(() => {
    return purchases.reduce((sum, p) => sum + (Number(p.gstAmount) || 0), 0);
  }, [purchases]);

  const getProjectStats = (projectId: string): ProjectStats => {
    const projectPurchases = purchases.filter((p) => p.projectId === projectId);
    const totalExpenditure = projectPurchases.reduce((sum, p) => sum + (Number(p.invoiceTotal) || 0), 0);

    const projectProducts = products.filter((p) => p.projectId === projectId && !p.archived);
    const currentAllocatedStockValue = projectProducts.reduce(
      (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0),
      0
    );

    return {
      totalExpenditure,
      currentAllocatedStockValue,
      itemsCount: projectProducts.length,
      purchasesCount: projectPurchases.length,
    };
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
        addProduct: dbService.createProduct,
        editProduct: dbService.updateProduct,
        archiveProduct: dbService.toggleArchiveProduct,
        adjustProductStock: dbService.adjustStock,
        addProject: dbService.createProject,
        editProject: dbService.updateProject,
        addPurchase: dbService.recordPurchase,
        addVendor: dbService.createVendor,
        addCategory: dbService.createCategory,
        clearAllData: dbService.clearAllData,
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
