// Status types
export type POStatus = 'draft' | 'confirmed' | 'partial' | 'received' | 'cancelled';
export type SOStatus = 'draft' | 'confirmed' | 'pick_ready' | 'dispatched' | 'delivered' | 'cancelled';
export type GRNStatus = 'draft' | 'verified' | 'posted';
export type PaymentStatus = 'pending' | 'partial' | 'paid';
export type InvoiceStatus = 'draft' | 'issued' | 'cancelled';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';
export type TransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled';
export type UserRole = 'super_admin' | 'admin' | 'warehouse_manager' | 'sales' | 'accountant' | 'user';

export interface KPIData {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  sizeLabel: string;
  piecesPerBox: number;
  sqftPerBox: number;
  mrp: number;
  gstRate: number;
  stock: number;
  reorderLevel: number;
  isActive: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstin: string;
  isActive: boolean;
}

export interface Customer {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstin: string;
  creditLimit: number;
  isActive: boolean;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  warehouse: string;
  status: POStatus;
  orderDate: string;
  totalAmount: number;
  grandTotal: number;
  itemCount: number;
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customer: string;
  warehouse: string;
  status: SOStatus;
  orderDate: string;
  grandTotal: number;
  paymentStatus: PaymentStatus;
  itemCount: number;
}

export interface StockItem {
  id: string;
  productCode: string;
  productName: string;
  warehouse: string;
  shade: string;
  batch: string;
  totalBoxes: number;
  totalPieces: number;
  totalSqft: number;
  reorderLevel: number;
}

export interface LowStockAlert {
  id: string;
  productName: string;
  productCode: string;
  warehouse: string;
  currentStock: number;
  reorderLevel: number;
  status: AlertStatus;
}

export interface RecentActivity {
  id: string;
  action: string;
  description: string;
  user: string;
  timestamp: string;
  type: 'purchase' | 'sale' | 'stock' | 'alert' | 'system';
}
