import type { Product, PurchaseOrder, SalesOrder, StockItem, LowStockAlert, RecentActivity } from '@/types';

export const mockProducts: Product[] = [
  { id: '1', code: 'VTF-001', name: 'Vitrified Floor Tile 600x600', category: 'Floor Tiles', sizeLabel: '600x600mm', piecesPerBox: 4, sqftPerBox: 15.5, mrp: 850, gstRate: 18, stock: 245, reorderLevel: 50, isActive: true },
  { id: '2', code: 'VTF-002', name: 'Vitrified Floor Tile 800x800', category: 'Floor Tiles', sizeLabel: '800x800mm', piecesPerBox: 3, sqftPerBox: 18.84, mrp: 1200, gstRate: 18, stock: 12, reorderLevel: 30, isActive: true },
  { id: '3', code: 'CWT-001', name: 'Ceramic Wall Tile 300x600', category: 'Wall Tiles', sizeLabel: '300x600mm', piecesPerBox: 6, sqftPerBox: 10.76, mrp: 420, gstRate: 18, stock: 530, reorderLevel: 100, isActive: true },
  { id: '4', code: 'PGT-001', name: 'Porcelain GVT 1200x600', category: 'Porcelain', sizeLabel: '1200x600mm', piecesPerBox: 2, sqftPerBox: 15.07, mrp: 1850, gstRate: 18, stock: 78, reorderLevel: 20, isActive: true },
  { id: '5', code: 'MTL-001', name: 'Mosaic Tile Hexagon', category: 'Mosaic', sizeLabel: '300x300mm', piecesPerBox: 10, sqftPerBox: 9.69, mrp: 680, gstRate: 18, stock: 0, reorderLevel: 25, isActive: false },
  { id: '6', code: 'VTF-003', name: 'Vitrified Double Charge 600x600', category: 'Floor Tiles', sizeLabel: '600x600mm', piecesPerBox: 4, sqftPerBox: 15.5, mrp: 950, gstRate: 18, stock: 189, reorderLevel: 40, isActive: true },
  { id: '7', code: 'CWT-002', name: 'Ceramic Glossy Wall 250x375', category: 'Wall Tiles', sizeLabel: '250x375mm', piecesPerBox: 8, sqftPerBox: 8.07, mrp: 320, gstRate: 18, stock: 415, reorderLevel: 80, isActive: true },
  { id: '8', code: 'PGT-002', name: 'Porcelain Slab 1200x2400', category: 'Porcelain', sizeLabel: '1200x2400mm', piecesPerBox: 1, sqftPerBox: 30.14, mrp: 4500, gstRate: 18, stock: 22, reorderLevel: 10, isActive: true },
];

export const mockPurchaseOrders: PurchaseOrder[] = [
  { id: '1', poNumber: 'PO-2024-0001', vendor: 'Kajaria Ceramics Ltd', warehouse: 'Main Warehouse', status: 'received', orderDate: '2024-12-10', totalAmount: 285000, grandTotal: 336300, itemCount: 5 },
  { id: '2', poNumber: 'PO-2024-0002', vendor: 'Somany Ceramics', warehouse: 'Main Warehouse', status: 'confirmed', orderDate: '2024-12-15', totalAmount: 142000, grandTotal: 167560, itemCount: 3 },
  { id: '3', poNumber: 'PO-2024-0003', vendor: 'Asian Granito', warehouse: 'Branch Godown', status: 'draft', orderDate: '2024-12-20', totalAmount: 89000, grandTotal: 105020, itemCount: 2 },
  { id: '4', poNumber: 'PO-2024-0004', vendor: 'Orient Bell Tiles', warehouse: 'Main Warehouse', status: 'partial', orderDate: '2024-12-22', totalAmount: 215000, grandTotal: 253700, itemCount: 4 },
  { id: '5', poNumber: 'PO-2024-0005', vendor: 'RAK Ceramics', warehouse: 'Main Warehouse', status: 'cancelled', orderDate: '2024-12-18', totalAmount: 56000, grandTotal: 66080, itemCount: 1 },
];

export const mockSalesOrders: SalesOrder[] = [
  { id: '1', soNumber: 'SO-2024-0012', customer: 'Shree Builders & Developers', warehouse: 'Main Warehouse', status: 'delivered', orderDate: '2024-12-08', grandTotal: 125400, paymentStatus: 'paid', itemCount: 4 },
  { id: '2', soNumber: 'SO-2024-0013', customer: 'Royal Interiors Pvt Ltd', warehouse: 'Main Warehouse', status: 'dispatched', orderDate: '2024-12-12', grandTotal: 89200, paymentStatus: 'pending', itemCount: 2 },
  { id: '3', soNumber: 'SO-2024-0014', customer: 'Amit Patel Construction', warehouse: 'Branch Godown', status: 'confirmed', orderDate: '2024-12-19', grandTotal: 245000, paymentStatus: 'partial', itemCount: 6 },
  { id: '4', soNumber: 'SO-2024-0015', customer: 'Green Valley Homes', warehouse: 'Main Warehouse', status: 'draft', orderDate: '2024-12-25', grandTotal: 67800, paymentStatus: 'pending', itemCount: 3 },
  { id: '5', soNumber: 'SO-2024-0016', customer: 'Metro Tiles Showroom', warehouse: 'Main Warehouse', status: 'pick_ready', orderDate: '2024-12-24', grandTotal: 178500, paymentStatus: 'pending', itemCount: 5 },
];

export const mockStock: StockItem[] = [
  { id: '1', productCode: 'VTF-001', productName: 'Vitrified Floor Tile 600x600', warehouse: 'Main Warehouse', shade: 'Ivory White', batch: 'B-2024-101', totalBoxes: 245, totalPieces: 980, totalSqft: 3797.5, reorderLevel: 50 },
  { id: '2', productCode: 'VTF-002', productName: 'Vitrified Floor Tile 800x800', warehouse: 'Main Warehouse', shade: 'Marble Grey', batch: 'B-2024-088', totalBoxes: 12, totalPieces: 36, totalSqft: 226.08, reorderLevel: 30 },
  { id: '3', productCode: 'CWT-001', productName: 'Ceramic Wall Tile 300x600', warehouse: 'Main Warehouse', shade: 'Snow White', batch: 'B-2024-095', totalBoxes: 530, totalPieces: 3180, totalSqft: 5702.8, reorderLevel: 100 },
  { id: '4', productCode: 'PGT-001', productName: 'Porcelain GVT 1200x600', warehouse: 'Branch Godown', shade: 'Calacatta Gold', batch: 'B-2024-110', totalBoxes: 78, totalPieces: 156, totalSqft: 1175.46, reorderLevel: 20 },
  { id: '5', productCode: 'VTF-003', productName: 'Vitrified Double Charge 600x600', warehouse: 'Main Warehouse', shade: 'Beige Travertine', batch: 'B-2024-112', totalBoxes: 189, totalPieces: 756, totalSqft: 2929.5, reorderLevel: 40 },
  { id: '6', productCode: 'CWT-002', productName: 'Ceramic Glossy Wall 250x375', warehouse: 'Main Warehouse', shade: 'Ocean Blue', batch: 'B-2024-098', totalBoxes: 415, totalPieces: 3320, totalSqft: 3349.05, reorderLevel: 80 },
];

export const mockLowStockAlerts: LowStockAlert[] = [
  { id: '1', productName: 'Vitrified Floor Tile 800x800', productCode: 'VTF-002', warehouse: 'Main Warehouse', currentStock: 12, reorderLevel: 30, status: 'open' },
  { id: '2', productName: 'Mosaic Tile Hexagon', productCode: 'MTL-001', warehouse: 'Main Warehouse', currentStock: 0, reorderLevel: 25, status: 'open' },
  { id: '3', productName: 'Porcelain Slab 1200x2400', productCode: 'PGT-002', warehouse: 'Branch Godown', currentStock: 22, reorderLevel: 10, status: 'acknowledged' },
];

export const mockRecentActivity: RecentActivity[] = [
  { id: '1', action: 'GRN Posted', description: 'GRN-2024-0089 verified and posted — 120 boxes received', user: 'Ravi Kumar', timestamp: '10 min ago', type: 'purchase' },
  { id: '2', action: 'Sales Order Created', description: 'SO-2024-0016 — Metro Tiles Showroom — ₹1,78,500', user: 'Priya Sharma', timestamp: '25 min ago', type: 'sale' },
  { id: '3', action: 'Low Stock Alert', description: 'VTF-002 dropped below reorder level (12 boxes)', user: 'System', timestamp: '1 hr ago', type: 'alert' },
  { id: '4', action: 'Pick List Completed', description: 'PL-2024-0034 — 45 boxes picked for SO-2024-0013', user: 'Mahesh Patil', timestamp: '2 hr ago', type: 'stock' },
  { id: '5', action: 'Invoice Generated', description: 'INV-2024-0056 — Shree Builders — ₹1,25,400', user: 'Priya Sharma', timestamp: '3 hr ago', type: 'sale' },
  { id: '6', action: 'Stock Transfer', description: 'ST-2024-0012 — 80 boxes from Main → Branch', user: 'Ravi Kumar', timestamp: '5 hr ago', type: 'stock' },
];

export const monthlyRevenueData = [
  { month: 'Jul', revenue: 1850000, orders: 42 },
  { month: 'Aug', revenue: 2100000, orders: 48 },
  { month: 'Sep', revenue: 1920000, orders: 45 },
  { month: 'Oct', revenue: 2450000, orders: 56 },
  { month: 'Nov', revenue: 2280000, orders: 52 },
  { month: 'Dec', revenue: 2680000, orders: 61 },
];

export const stockByCategoryData = [
  { category: 'Floor Tiles', boxes: 446, value: 4250000 },
  { category: 'Wall Tiles', boxes: 945, value: 2820000 },
  { category: 'Porcelain', boxes: 100, value: 3150000 },
  { category: 'Mosaic', boxes: 0, value: 0 },
];
