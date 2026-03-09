'use strict';

/**
 * Production-like fixture data for Tiles WMS seed.
 * Indian business context: GSTIN, PAN, cities, tile brands/sizes.
 */

const { v4: uuidv4 } = require('uuid');

// ─── Tenants ─────────────────────────────────────────────────────────────────
const TENANTS = [
  { name: 'Tiles India Pvt Ltd', slug: 'tiles-india', plan: 'pro', status: 'active', max_warehouses: 3, max_users: 20 },
  { name: 'Ceramic World Distributors', slug: 'ceramic-world', plan: 'enterprise', status: 'active', max_warehouses: 5, max_users: 50 },
];

// ─── User roles and names (per tenant: 1 admin, 1 warehouse_manager, 1 sales, 1 accountant) ─────────────────
const USER_TEMPLATES = [
  { name: 'Rajesh Kumar', email: 'admin', role: 'admin', phone: '9876543210' },
  { name: 'Suresh Patel', email: 'warehouse', role: 'warehouse_manager', phone: '9876543211' },
  { name: 'Priya Sharma', email: 'sales', role: 'sales', phone: '9876543212' },
  { name: 'Amit Gupta', email: 'accountant', role: 'accountant', phone: '9876543213' },
];

// ─── GST configuration (state 09 = Uttar Pradesh, 27 = Maharashtra) ──────────
const GST_CONFIG = [
  { state_code: '09', state_name: 'Uttar Pradesh', legal_name: 'Tiles India Pvt Ltd', trade_name: 'Tiles India', gstin: '09AABCT1332L1ZM', pan: 'AABCT1332L' },
  { state_code: '27', state_name: 'Maharashtra', legal_name: 'Ceramic World Distributors', trade_name: 'Ceramic World', gstin: '27AABCU5678M1ZR', pan: 'AABCU5678M' },
];

// ─── Warehouses (2 per tenant) ──────────────────────────────────────────────
const WAREHOUSE_NAMES = [
  { name: 'Main Warehouse', code: 'WH-MAIN', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301' },
  { name: 'Secondary Store', code: 'WH-SEC', city: 'Ghaziabad', state: 'Uttar Pradesh', pincode: '201001' },
  { name: 'Mumbai Central', code: 'WH-MUM', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
  { name: 'Pune Distribution', code: 'WH-PUN', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
];

// ─── Rack naming (aisle-row-level) ────────────────────────────────────────────
function getRackNames(warehouseIndex) {
  const aisles = ['A', 'B', 'C'];
  const rows = ['1', '2', '3', '4', '5'];
  const names = [];
  for (const a of aisles) {
    for (const r of rows) {
      names.push({ name: `${a}-${r}`, aisle: a, row: r, level: '1', capacity_boxes: 100 });
      if (names.length >= 15) return names;
    }
  }
  return names;
}

// ─── Vendors (10 per tenant) – realistic tile/ceramic suppliers ───────────────
const VENDOR_NAMES = [
  { name: 'Kajaria Ceramics Ltd', code: 'KAJ-001', contact: 'Vikram Mehta', phone: '9812345001', email: 'sales@kajariaceramics.com', city: 'Morbi', gstin: '24AACCK1234A1Z1', pan: 'AACCK1234A' },
  { name: 'Somany Ceramics', code: 'SOM-002', contact: 'Anil Joshi', phone: '9812345002', email: 'orders@somany.com', city: 'Kadi', gstin: '24AABCS5678B1Z2', pan: 'AABCS5678B' },
  { name: 'NITCO Tiles', code: 'NIT-003', contact: 'Sanjay Reddy', phone: '9812345003', email: 'trade@nitco.in', city: 'Mumbai', gstin: '27AABCN9012C1Z3', pan: 'AABCN9012C' },
  { name: 'Orient Bell Ltd', code: 'ORI-004', contact: 'Ramesh Agarwal', phone: '9812345004', email: 'info@orientbell.com', city: 'Ghaziabad', gstin: '09AABCO3456D1Z4', pan: 'AABCO3456D' },
  { name: 'H & R Johnson', code: 'HRJ-005', contact: 'Deepak Singh', phone: '9812345005', email: 'enquiry@hrjohnsonindia.com', city: 'Mumbai', gstin: '27AABCH7890E1Z5', pan: 'AABCH7890E' },
  { name: 'Asian Granito', code: 'AGR-006', contact: 'Manoj Patel', phone: '9812345006', email: 'sales@asiangranito.com', city: 'Ahmedabad', gstin: '24AABCA2345F1Z6', pan: 'AABCA2345F' },
  { name: 'Cera Sanitaryware', code: 'CER-007', contact: 'Kiran Nair', phone: '9812345007', email: 'tiles@cera.in', city: 'Kadi', gstin: '24AABCC6789G1Z7', pan: 'AABCC6789G' },
  { name: 'Regency Ceramics', code: 'REG-008', contact: 'Srinivas Rao', phone: '9812345008', email: 'export@regencyceramics.com', city: 'Yanam', gstin: '35AABCR0123H1Z8', pan: 'AABCR0123H' },
  { name: 'Simpolo Vitrified', code: 'SIM-009', contact: 'Pradeep Bhatt', phone: '9812345009', email: 'info@simpolo.com', city: 'Morbi', gstin: '24AABCS4567I1Z9', pan: 'AABCS4567I' },
  { name: 'Murudeshwar Ceramics', code: 'MUR-010', contact: 'Venkat Iyer', phone: '9812345010', email: 'sales@murudeshwar.com', city: 'Hubli', gstin: '29AABCM8901J1Z0', pan: 'AABCM8901J' },
];

// ─── Customers (10 per tenant) – builders, contractors, retailers ─────────────
const CUSTOMER_NAMES = [
  { name: 'Dream Home Builders', code: 'CUST-001', contact: 'Arun Kumar', phone: '9823456001', email: 'purchase@dreamhome.in', city: 'Noida', state_code: '09', gstin: '09AABCD1234K1Z1' },
  { name: 'Metro Contractors Pvt Ltd', code: 'CUST-002', contact: 'Sunita Nair', phone: '9823456002', email: 'accounts@metrocontractors.com', city: 'Ghaziabad', state_code: '09', gstin: '09AABCM5678L1Z2' },
  { name: 'Elite Tiles & Sanitary', code: 'CUST-003', contact: 'Rahul Verma', phone: '9823456003', email: 'elite.tiles@gmail.com', city: 'Delhi', state_code: '07', gstin: '07AABCE9012M1Z3' },
  { name: 'Prime Interiors', code: 'CUST-004', contact: 'Neha Desai', phone: '9823456004', email: 'prime@interiors.co.in', city: 'Mumbai', state_code: '27', gstin: '27AABCP3456N1Z4' },
  { name: 'Green Space Developers', code: 'CUST-005', contact: 'Karthik Pillai', phone: '9823456005', email: 'procurement@greenspace.in', city: 'Pune', state_code: '27', gstin: '27AABCG7890O1Z5' },
  { name: 'Classic Marble House', code: 'CUST-006', contact: 'Meera Iyer', phone: '9823456006', email: 'classic@marblehouse.com', city: 'Chennai', state_code: '33', gstin: '33AABCC2345P1Z6' },
  { name: 'Shri Krishna Builders', code: 'CUST-007', contact: 'Suresh Yadav', phone: '9823456007', email: 'krishna.builders@gmail.com', city: 'Lucknow', state_code: '09', gstin: '09AABCS6789Q1Z7' },
  { name: 'Urban Design Studio', code: 'CUST-008', contact: 'Anita Rao', phone: '9823456008', email: 'studio@urbandesign.in', city: 'Bangalore', state_code: '29', gstin: '29AABCU0123R1Z8' },
  { name: 'Royal Housing Project', code: 'CUST-009', contact: 'Vijay Malhotra', phone: '9823456009', email: 'royal@housing.co.in', city: 'Gurgaon', state_code: '06', gstin: '06AABCR4567S1Z9' },
  { name: 'Pacific Tiles Retail', code: 'CUST-010', contact: 'Lakshmi Menon', phone: '9823456010', email: 'retail@pacifictiles.com', city: 'Kochi', state_code: '32', gstin: '32AABCP8901T1Z0' },
];

// ─── Product categories (4: Floor, Wall, Outdoor, Premium) ─────────────────────
const CATEGORIES = [
  { name: 'Floor Tiles' },
  { name: 'Wall Tiles' },
  { name: 'Outdoor Tiles' },
  { name: 'Premium Tiles' },
];

// ─── Product templates (20 products: sizes in mm, sqft per box, HSN 6908) ─────
const PRODUCT_TEMPLATES = [
  { name: 'Glossy Vitrified Floor Tile', sizeL: 600, sizeW: 600, sizeT: 9, sizeLabel: '600x600mm', pieces: 4, sqft: 13.38, brand: 'Kajaria', finish: 'Glossy', material: 'Vitrified', hsn: '6908', gst: 18, mrp: 42 },
  { name: 'Matt Wood Look Tile', sizeL: 600, sizeW: 1200, sizeT: 9, sizeLabel: '600x1200mm', pieces: 2, sqft: 7.74, brand: 'Somany', finish: 'Matt', material: 'Vitrified', hsn: '6908', gst: 18, mrp: 85 },
  { name: 'Marble Look Vitrified', sizeL: 800, sizeW: 800, sizeT: 10, sizeLabel: '800x800mm', pieces: 2, sqft: 11.11, brand: 'NITCO', finish: 'Polished', material: 'Vitrified', hsn: '6908', gst: 18, mrp: 95 },
  { name: 'Anti-Skid Floor Tile', sizeL: 300, sizeW: 300, sizeT: 8, sizeLabel: '300x300mm', pieces: 10, sqft: 9.69, brand: 'Orient Bell', finish: 'Matt', material: 'Ceramic', hsn: '6908', gst: 18, mrp: 28 },
  { name: 'Bathroom Wall Tile', sizeL: 300, sizeW: 450, sizeT: 7, sizeLabel: '300x450mm', pieces: 8, sqft: 11.61, brand: 'H & R Johnson', finish: 'Glossy', material: 'Ceramic', hsn: '6908', gst: 18, mrp: 35 },
  { name: 'Kitchen Backsplash Tile', sizeL: 200, sizeW: 200, sizeT: 6, sizeLabel: '200x200mm', pieces: 15, sqft: 6.46, brand: 'Asian Granito', finish: 'Glossy', material: 'Ceramic', hsn: '6908', gst: 18, mrp: 18 },
  { name: 'Outdoor Porcelain Tile', sizeL: 600, sizeW: 600, sizeT: 12, sizeLabel: '600x600mm', pieces: 4, sqft: 13.38, brand: 'Cera', finish: 'Rustic', material: 'Porcelain', hsn: '6908', gst: 18, mrp: 55 },
  { name: 'Digital Print Floor Tile', sizeL: 600, sizeW: 600, sizeT: 9, sizeLabel: '600x600mm', pieces: 4, sqft: 13.38, brand: 'Regency', finish: 'Glossy', material: 'Vitrified', hsn: '6908', gst: 18, mrp: 48 },
  { name: 'Subway Wall Tile', sizeL: 75, sizeW: 150, sizeT: 5, sizeLabel: '75x150mm', pieces: 40, sqft: 4.84, brand: 'Simpolo', finish: 'Matt', material: 'Ceramic', hsn: '6908', gst: 18, mrp: 22 },
  { name: 'Large Format Slab', sizeL: 1200, sizeW: 600, sizeT: 10, sizeLabel: '1200x600mm', pieces: 1, sqft: 7.74, brand: 'Murudeshwar', finish: 'Polished', material: 'Vitrified', hsn: '6908', gst: 18, mrp: 120 },
  { name: 'Terrazzo Look Tile', sizeL: 600, sizeW: 600, sizeT: 9, sizeLabel: '600x600mm', pieces: 4, sqft: 13.38, brand: 'Kajaria', finish: 'Matt', material: 'Vitrified', hsn: '6908', gst: 18, mrp: 52 },
  { name: 'Concrete Look Tile', sizeL: 600, sizeW: 1200, sizeT: 9, sizeLabel: '600x1200mm', pieces: 2, sqft: 7.74, brand: 'Somany', finish: 'Matt', material: 'Vitrified', hsn: '6908', gst: 18, mrp: 78 },
  { name: 'Stone Look Porcelain', sizeL: 800, sizeW: 800, sizeT: 11, sizeLabel: '800x800mm', pieces: 2, sqft: 11.11, brand: 'NITCO', finish: 'Lappato', material: 'Porcelain', hsn: '6908', gst: 18, mrp: 105 },
  { name: 'Mosaic Sheet', sizeL: 300, sizeW: 300, sizeT: 6, sizeLabel: '300x300mm', pieces: 9, sqft: 8.72, brand: 'Orient Bell', finish: 'Glossy', material: 'Glass', hsn: '7016', gst: 18, mrp: 65 },
  { name: 'Border Tile', sizeL: 75, sizeW: 300, sizeT: 6, sizeLabel: '75x300mm', pieces: 20, sqft: 4.84, brand: 'H & R Johnson', finish: 'Glossy', material: 'Ceramic', hsn: '6908', gst: 18, mrp: 25 },
  { name: 'Elevation Tile', sizeL: 300, sizeW: 600, sizeT: 9, sizeLabel: '300x600mm', pieces: 5, sqft: 9.69, brand: 'Asian Granito', finish: 'Matt', material: 'Vitrified', hsn: '6908', gst: 18, mrp: 45 },
  { name: 'Parking Tile', sizeL: 300, sizeW: 300, sizeT: 10, sizeLabel: '300x300mm', pieces: 10, sqft: 9.69, brand: 'Cera', finish: 'Anti-Skid', material: 'Ceramic', hsn: '6908', gst: 18, mrp: 22 },
  { name: 'Designer Floor Tile', sizeL: 600, sizeW: 600, sizeT: 9, sizeLabel: '600x600mm', pieces: 4, sqft: 13.38, brand: 'Regency', finish: 'Glossy', material: 'Vitrified', hsn: '6908', gst: 18, mrp: 58 },
  { name: 'Premium Marble Tile', sizeL: 800, sizeW: 800, sizeT: 12, sizeLabel: '800x800mm', pieces: 2, sqft: 11.11, brand: 'Simpolo', finish: 'Polished', material: 'Vitrified', hsn: '6908', gst: 18, mrp: 135 },
  { name: 'Rustic Wall Cladding', sizeL: 300, sizeW: 600, sizeT: 10, sizeLabel: '300x600mm', pieces: 5, sqft: 9.69, brand: 'Murudeshwar', finish: 'Rustic', material: 'Porcelain', hsn: '6908', gst: 18, mrp: 72 },
];

// ─── Shade names (used per product) ──────────────────────────────────────────
const SHADE_NAMES = ['White', 'Ivory', 'Grey', 'Beige', 'Brown', 'Black', 'Cream', 'Off-White', 'Charcoal', 'Sand'];
const SHADE_HEX = ['#FFFFFF', '#FFFFF0', '#808080', '#F5F5DC', '#8B4513', '#000000', '#FFFDD0', '#FAF0E6', '#36454F', '#C2B280'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uuid() {
  return uuidv4();
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x.toISOString().slice(0, 10);
}

module.exports = {
  TENANTS,
  USER_TEMPLATES,
  GST_CONFIG,
  WAREHOUSE_NAMES,
  getRackNames,
  VENDOR_NAMES,
  CUSTOMER_NAMES,
  CATEGORIES,
  PRODUCT_TEMPLATES,
  SHADE_NAMES,
  SHADE_HEX,
  uuid,
  today,
  addDays,
};
