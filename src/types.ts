export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  createdAt: string;
}

export interface Product {
  id: string;
  itemNumber?: number;
  sku: string;
  barcode?: string;
  brand?: string;
  model?: string;
  name: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstPercent?: number;
  gstAmount?: number;
  totalCost?: number;
  vendor: string;
  purchaseDate: string;
  projectId: string; // Project ID or '' for Unassigned
  storageLocation: string;
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string;
  status: 'Planning' | 'Active' | 'Beta' | 'Completed' | 'Archived';
  startDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  vendorId: string;
  vendorNameSnapshot: string;
  projectId: string;
  projectNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  gstRate?: number;
  gstAmount?: number;
  invoiceTotal: number;
  invoiceNumber: string;
  purchaseDate: string;
  paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid';
  notes: string;
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  gstin: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  sku: string;
  type: 'PURCHASE_IN' | 'PROJECT_ALLOCATION' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceId: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  userId: string;
  timestamp: string;
}

export interface ProposedAction {
  type:
    | 'ADD_PRODUCT'
    | 'BATCH_ADD_PRODUCTS'
    | 'UPDATE_PRODUCT'
    | 'ARCHIVE_PRODUCT'
    | 'DELETE_PRODUCT'
    | 'ADD_PURCHASE'
    | 'ASSIGN_PROJECT'
    | 'CREATE_PROJECT'
    | 'ADJUST_STOCK'
    | 'ADD_VENDOR'
    | 'GENERATE_LABELS'
    | 'SHOW_PRODUCT_DETAILS'
    | 'SCAN_BARCODE'
    | 'OPEN_STUDIO';
  summary: string;
  payload: any;
}
