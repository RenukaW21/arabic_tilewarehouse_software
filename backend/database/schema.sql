-- ============================================================
-- TILES WMS — Complete MySQL 8.0+ Schema
-- Encoding: utf8mb4 | Engine: InnoDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS tiles_wms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tiles_wms;

SET FOREIGN_KEY_CHECKS = 0;

-- ─── TENANTS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              VARCHAR(36)  NOT NULL,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) NOT NULL,
  plan            ENUM('basic','pro','enterprise') NOT NULL DEFAULT 'basic',
  status          ENUM('active','suspended','trial') NOT NULL DEFAULT 'trial',
  max_warehouses  INT          NOT NULL DEFAULT 1,
  max_users       INT          NOT NULL DEFAULT 5,
  trial_ends_at   DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenants_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)  NOT NULL,
  tenant_id     VARCHAR(36)  NOT NULL,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('super_admin','admin','warehouse_manager','sales','accountant','user') NOT NULL DEFAULT 'sales',
  phone         VARCHAR(20)  NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_tenant_email (tenant_id, email),
  KEY idx_users_tenant (tenant_id),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── REFRESH TOKENS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         VARCHAR(36)   NOT NULL,
  user_id    VARCHAR(36)   NOT NULL,
  tenant_id  VARCHAR(36)   NOT NULL,
  token      VARCHAR(1000) NOT NULL,
  expires_at DATETIME      NOT NULL,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_user (user_id),
  KEY idx_refresh_token (token(255)),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── GST CONFIGURATION ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gst_configurations (
  id                   VARCHAR(36)  NOT NULL,
  tenant_id            VARCHAR(36)  NOT NULL,
  gstin                VARCHAR(20)  NOT NULL,
  legal_name           VARCHAR(255) NOT NULL,
  trade_name           VARCHAR(255) NULL,
  state_code           VARCHAR(5)   NOT NULL,
  state_name           VARCHAR(100) NOT NULL,
  pan                  VARCHAR(20)  NULL,
  default_gst_rate     DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  fiscal_year_start    VARCHAR(5)   NOT NULL DEFAULT '04-01',
  invoice_prefix       VARCHAR(20)  NULL,
  is_composition_scheme TINYINT(1)  NOT NULL DEFAULT 0,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gst_tenant (tenant_id),
  CONSTRAINT fk_gst_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── WAREHOUSES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id         VARCHAR(36)  NOT NULL,
  tenant_id  VARCHAR(36)  NOT NULL,
  name       VARCHAR(255) NOT NULL,
  code       VARCHAR(50)  NOT NULL,
  address    TEXT         NULL,
  city       VARCHAR(100) NULL,
  state      VARCHAR(100) NULL,
  pincode    VARCHAR(20)  NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_warehouse_tenant_code (tenant_id, code),
  KEY idx_warehouse_tenant (tenant_id),
  CONSTRAINT fk_warehouse_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── RACKS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS racks (
  id             VARCHAR(36)  NOT NULL,
  tenant_id      VARCHAR(36)  NOT NULL,
  warehouse_id   VARCHAR(36)  NOT NULL,
  name           VARCHAR(100) NOT NULL,
  aisle          VARCHAR(50)  NULL,
  `row`          VARCHAR(50)  NULL,
  level          VARCHAR(50)  NULL,
  capacity_boxes INT          NULL,
  qr_code        VARCHAR(255) NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rack_tenant_wh (tenant_id, warehouse_id),
  CONSTRAINT fk_rack_tenant    FOREIGN KEY (tenant_id)    REFERENCES tenants(id),
  CONSTRAINT fk_rack_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── VENDORS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id                 VARCHAR(36)  NOT NULL,
  tenant_id          VARCHAR(36)  NOT NULL,
  name               VARCHAR(255) NOT NULL,
  code               VARCHAR(50)  NULL,
  contact_person     VARCHAR(255) NULL,
  phone              VARCHAR(20)  NULL,
  email              VARCHAR(255) NULL,
  address            TEXT         NULL,
  gstin              VARCHAR(20)  NULL,
  pan                VARCHAR(20)  NULL,
  payment_terms_days INT          NULL DEFAULT 30,
  is_active          TINYINT(1)   NOT NULL DEFAULT 1,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vendor_tenant (tenant_id),
  CONSTRAINT fk_vendor_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── CUSTOMERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                 VARCHAR(36)   NOT NULL,
  tenant_id          VARCHAR(36)   NOT NULL,
  name               VARCHAR(255)  NOT NULL,
  code               VARCHAR(50)   NULL,
  contact_person     VARCHAR(255)  NULL,
  phone              VARCHAR(20)   NULL,
  email              VARCHAR(255)  NULL,
  billing_address    TEXT          NULL,
  shipping_address   TEXT          NULL,
  gstin              VARCHAR(20)   NULL,
  state_code         VARCHAR(5)    NULL,
  credit_limit       DECIMAL(12,2) NULL DEFAULT 0,
  payment_terms_days INT           NULL DEFAULT 0,
  is_active          TINYINT(1)    NOT NULL DEFAULT 1,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customer_tenant (tenant_id),
  CONSTRAINT fk_customer_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PRODUCT CATEGORIES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_categories (
  id         VARCHAR(36)  NOT NULL,
  tenant_id  VARCHAR(36)  NOT NULL,
  name       VARCHAR(255) NOT NULL,
  parent_id  VARCHAR(36)  NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_cat_tenant (tenant_id),
  CONSTRAINT fk_cat_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES product_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PRODUCTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                  VARCHAR(36)   NOT NULL,
  tenant_id           VARCHAR(36)   NOT NULL,
  category_id         VARCHAR(36)   NULL,
  name                VARCHAR(255)  NOT NULL,
  code                VARCHAR(100)  NOT NULL,
  description         TEXT          NULL,
  size_length_mm      DECIMAL(8,2)  NOT NULL,
  size_width_mm       DECIMAL(8,2)  NOT NULL,
  size_thickness_mm   DECIMAL(6,2)  NULL,
  size_label          VARCHAR(50)   NOT NULL,
  pieces_per_box      DECIMAL(6,2)  NOT NULL,
  sqft_per_box        DECIMAL(8,4)  NOT NULL,
  sqmt_per_box        DECIMAL(8,4)  NULL,
  weight_per_box_kg   DECIMAL(8,2)  NULL,
  finish              VARCHAR(100)  NULL,
  material            VARCHAR(100)  NULL,
  brand               VARCHAR(100)  NULL,
  hsn_code            VARCHAR(20)   NULL,
  gst_rate            DECIMAL(5,2)  NULL DEFAULT 18.00,
  mrp                 DECIMAL(12,2) NULL,
  reorder_level_boxes INT           NULL DEFAULT 0,
  barcode             VARCHAR(100)  NULL,
  image_url           TEXT          NULL,
  is_active           TINYINT(1)    NOT NULL DEFAULT 1,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_tenant_code (tenant_id, code),
  KEY idx_product_tenant (tenant_id),
  KEY idx_product_category (category_id),
  FULLTEXT KEY ft_products (name, code, brand),
  CONSTRAINT fk_product_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants(id),
  CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES product_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SHADES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shades (
  id         VARCHAR(36)  NOT NULL,
  tenant_id  VARCHAR(36)  NOT NULL,
  product_id VARCHAR(36)  NOT NULL,
  shade_code VARCHAR(50)  NOT NULL,
  shade_name VARCHAR(150) NULL,
  hex_color  VARCHAR(7)   NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_shade_tenant_product (tenant_id, product_id),
  CONSTRAINT fk_shade_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  CONSTRAINT fk_shade_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── BATCHES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batches (
  id              VARCHAR(36) NOT NULL,
  tenant_id       VARCHAR(36) NOT NULL,
  product_id      VARCHAR(36) NOT NULL,
  shade_id        VARCHAR(36) NULL,
  batch_number    VARCHAR(100) NOT NULL,
  production_date DATE         NULL,
  expiry_date     DATE         NULL,
  grade           ENUM('A','B','C') NULL DEFAULT 'A',
  vendor_id       VARCHAR(36) NULL,
  notes           TEXT        NULL,
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_batch_tenant_product (tenant_id, product_id),
  CONSTRAINT fk_batch_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  CONSTRAINT fk_batch_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_batch_vendor  FOREIGN KEY (vendor_id)  REFERENCES vendors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PURCHASE ORDERS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id              VARCHAR(36)   NOT NULL,
  tenant_id       VARCHAR(36)   NOT NULL,
  po_number       VARCHAR(50)   NOT NULL,
  vendor_id       VARCHAR(36)   NOT NULL,
  warehouse_id    VARCHAR(36)   NOT NULL,
  status          ENUM('draft','confirmed','partial','received','cancelled') NOT NULL DEFAULT 'draft',
  return_status   ENUM('none','partial','full') NOT NULL DEFAULT 'none',
  order_date      DATE          NOT NULL DEFAULT (CURRENT_DATE),
  expected_date   DATE          NULL,
  total_amount    DECIMAL(14,2) NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NULL DEFAULT 0,
  tax_amount      DECIMAL(12,2) NULL DEFAULT 0,
  grand_total     DECIMAL(14,2) NULL DEFAULT 0,
  notes           TEXT          NULL,
  created_by      VARCHAR(36)   NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_po_tenant_number (tenant_id, po_number),
  KEY idx_po_tenant_status (tenant_id, status),
  CONSTRAINT fk_po_tenant    FOREIGN KEY (tenant_id)   REFERENCES tenants(id),
  CONSTRAINT fk_po_vendor    FOREIGN KEY (vendor_id)   REFERENCES vendors(id),
  CONSTRAINT fk_po_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PURCHASE ORDER ITEMS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                VARCHAR(36)   NOT NULL,
  tenant_id         VARCHAR(36)   NOT NULL,
  purchase_order_id VARCHAR(36)   NOT NULL,
  product_id        VARCHAR(36)   NOT NULL,
  shade_id          VARCHAR(36)   NULL,
  ordered_boxes     DECIMAL(10,2) NOT NULL,
  ordered_pieces    DECIMAL(10,2) NULL,
  received_boxes    DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price        DECIMAL(12,2) NOT NULL,
  discount_pct      DECIMAL(5,2)  NULL DEFAULT 0,
  tax_pct           DECIMAL(5,2)  NULL DEFAULT 0,
  line_total        DECIMAL(14,2) NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_poi_tenant_po (tenant_id, purchase_order_id),
  CONSTRAINT fk_poi_po      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_poi_product FOREIGN KEY (product_id)        REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── GRN ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grn (
  id                VARCHAR(36)  NOT NULL,
  tenant_id         VARCHAR(36)  NOT NULL,
  grn_number        VARCHAR(50)  NOT NULL,
  purchase_order_id VARCHAR(36)  NULL,
  vendor_id         VARCHAR(36)  NOT NULL,
  warehouse_id      VARCHAR(36)  NOT NULL,
  receipt_date      DATE         NOT NULL DEFAULT (CURRENT_DATE),
  invoice_number    VARCHAR(100) NULL,
  invoice_date      DATE         NULL,
  vehicle_number    VARCHAR(50)  NULL,
  status            ENUM('draft','verified','posted') NOT NULL DEFAULT 'draft',
  notes             TEXT         NULL,
  created_by        VARCHAR(36)  NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_grn_tenant_number (tenant_id, grn_number),
  KEY idx_grn_tenant_status (tenant_id, status),
  CONSTRAINT fk_grn_tenant    FOREIGN KEY (tenant_id)         REFERENCES tenants(id),
  CONSTRAINT fk_grn_po        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_grn_vendor    FOREIGN KEY (vendor_id)         REFERENCES vendors(id),
  CONSTRAINT fk_grn_warehouse FOREIGN KEY (warehouse_id)      REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── GRN ITEMS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grn_items (
  id              VARCHAR(36)   NOT NULL,
  tenant_id       VARCHAR(36)   NOT NULL,
  grn_id          VARCHAR(36)   NOT NULL,
  product_id      VARCHAR(36)   NOT NULL,
  shade_id        VARCHAR(36)   NULL,
  batch_id        VARCHAR(36)   NULL,
  rack_id         VARCHAR(36)   NULL,
  received_boxes  DECIMAL(10,2) NOT NULL,
  received_pieces DECIMAL(10,2) NOT NULL DEFAULT 0,
  damaged_boxes   DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price      DECIMAL(12,2) NOT NULL,
  quality_status  ENUM('pass','fail','pending') NOT NULL DEFAULT 'pending',
  quality_notes   TEXT          NULL,
  barcode_printed TINYINT(1)    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_grn_items_tenant_grn (tenant_id, grn_id),
  CONSTRAINT fk_grn_item_grn     FOREIGN KEY (grn_id)     REFERENCES grn(id),
  CONSTRAINT fk_grn_item_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STOCK LEDGER ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_ledger (
  id               VARCHAR(36)   NOT NULL,
  tenant_id        VARCHAR(36)   NOT NULL,
  warehouse_id     VARCHAR(36)   NOT NULL,
  rack_id          VARCHAR(36)   NULL,
  product_id       VARCHAR(36)   NOT NULL,
  shade_id         VARCHAR(36)   NULL,
  batch_id         VARCHAR(36)   NULL,
  transaction_type ENUM('grn','sale','transfer_in','transfer_out','damage','adjustment','return','opening') NOT NULL,
  reference_id     VARCHAR(36)   NULL,
  reference_type   VARCHAR(50)   NULL,
  boxes_in         DECIMAL(10,2) NOT NULL DEFAULT 0,
  boxes_out        DECIMAL(10,2) NOT NULL DEFAULT 0,
  pieces_in        DECIMAL(10,2) NOT NULL DEFAULT 0,
  pieces_out       DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_boxes    DECIMAL(10,2) NOT NULL,
  balance_pieces   DECIMAL(10,2) NOT NULL,
  sqft_in          DECIMAL(12,4) NOT NULL DEFAULT 0,
  sqft_out         DECIMAL(12,4) NOT NULL DEFAULT 0,
  transaction_date DATE          NOT NULL DEFAULT (CURRENT_DATE),
  created_by       VARCHAR(36)   NOT NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes            TEXT          NULL,
  PRIMARY KEY (id),
  KEY idx_sl_tenant_product_wh (tenant_id, product_id, warehouse_id),
  KEY idx_sl_tenant_date (tenant_id, transaction_date),
  CONSTRAINT fk_sl_tenant    FOREIGN KEY (tenant_id)    REFERENCES tenants(id),
  CONSTRAINT fk_sl_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_sl_product   FOREIGN KEY (product_id)   REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STOCK SUMMARY ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_summary (
  id                VARCHAR(36)   NOT NULL,
  tenant_id         VARCHAR(36)   NOT NULL,
  warehouse_id      VARCHAR(36)   NOT NULL,
  rack_id           VARCHAR(36)   NULL,
  product_id        VARCHAR(36)   NOT NULL,
  shade_id          VARCHAR(36)   NULL,
  batch_id          VARCHAR(36)   NULL,
  total_boxes       DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_pieces      DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_sqft        DECIMAL(12,4) NOT NULL DEFAULT 0,
  avg_cost_per_box  DECIMAL(12,4) NULL,
  last_receipt_date DATE          NULL,
  last_issue_date   DATE          NULL,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ss_tenant_wh_prod_shade_batch_rack (tenant_id, warehouse_id, product_id, shade_id, batch_id, rack_id),
  KEY idx_ss_tenant_product_wh (tenant_id, product_id, warehouse_id),
  CONSTRAINT fk_ss_tenant    FOREIGN KEY (tenant_id)    REFERENCES tenants(id),
  CONSTRAINT fk_ss_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_ss_product   FOREIGN KEY (product_id)   REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── DAMAGE ENTRIES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS damage_entries (
  id              VARCHAR(36)   NOT NULL,
  tenant_id       VARCHAR(36)   NOT NULL,
  warehouse_id    VARCHAR(36)   NOT NULL,
  product_id      VARCHAR(36)   NOT NULL,
  shade_id        VARCHAR(36)   NULL,
  batch_id        VARCHAR(36)   NULL,
  rack_id         VARCHAR(36)   NULL,
  damage_date     DATE          NOT NULL DEFAULT (CURRENT_DATE),
  damaged_boxes   DECIMAL(10,2) NOT NULL DEFAULT 0,
  damaged_pieces  DECIMAL(10,2) NOT NULL DEFAULT 0,
  damage_reason   VARCHAR(255)  NULL,
  estimated_loss  DECIMAL(12,2) NULL,
  approved_by     VARCHAR(36)   NULL,
  created_by      VARCHAR(36)   NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes           TEXT          NULL,
  PRIMARY KEY (id),
  KEY idx_damage_tenant (tenant_id),
  CONSTRAINT fk_damage_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STOCK ADJUSTMENTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id              VARCHAR(36)  NOT NULL,
  tenant_id       VARCHAR(36)  NOT NULL,
  warehouse_id    VARCHAR(36)  NOT NULL,
  product_id      VARCHAR(36)  NOT NULL,
  shade_id        VARCHAR(36)  NULL,
  batch_id        VARCHAR(36)  NULL,
  rack_id         VARCHAR(36)  NULL,
  adjustment_type ENUM('add','deduct') NOT NULL,
  boxes           DECIMAL(10,2) NOT NULL DEFAULT 0,
  pieces          DECIMAL(10,2) NOT NULL DEFAULT 0,
  reason          VARCHAR(255)  NOT NULL,
  status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_by     VARCHAR(36)   NULL,
  approved_at     DATETIME      NULL,
  created_by      VARCHAR(36)   NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_adj_tenant_status (tenant_id, status),
  CONSTRAINT fk_adj_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STOCK TRANSFERS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transfers (
  id                VARCHAR(36)  NOT NULL,
  tenant_id         VARCHAR(36)  NOT NULL,
  transfer_number   VARCHAR(50)  NOT NULL,
  from_warehouse_id VARCHAR(36)  NOT NULL,
  to_warehouse_id   VARCHAR(36)  NOT NULL,
  status            ENUM('draft','in_transit','received','cancelled') NOT NULL DEFAULT 'draft',
  transfer_date     DATE         NOT NULL DEFAULT (CURRENT_DATE),
  received_date     DATE         NULL,
  vehicle_number    VARCHAR(50)  NULL,
  notes             TEXT         NULL,
  created_by        VARCHAR(36)  NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transfer_tenant_number (tenant_id, transfer_number),
  KEY idx_transfer_tenant (tenant_id),
  CONSTRAINT fk_transfer_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STOCK TRANSFER ITEMS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id                 VARCHAR(36)   NOT NULL,
  tenant_id          VARCHAR(36)   NOT NULL,
  transfer_id        VARCHAR(36)   NOT NULL,
  product_id         VARCHAR(36)   NOT NULL,
  shade_id           VARCHAR(36)   NULL,
  batch_id           VARCHAR(36)   NULL,
  from_rack_id       VARCHAR(36)   NULL,
  to_rack_id         VARCHAR(36)   NULL,
  transferred_boxes  DECIMAL(10,2) NOT NULL,
  transferred_pieces DECIMAL(10,2) NOT NULL DEFAULT 0,
  received_boxes     DECIMAL(10,2) NOT NULL DEFAULT 0,
  discrepancy_boxes  DECIMAL(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_sti_tenant_transfer (tenant_id, transfer_id),
  CONSTRAINT fk_sti_transfer FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id),
  CONSTRAINT fk_sti_product  FOREIGN KEY (product_id)  REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STOCK COUNTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_counts (
  id             VARCHAR(36)   NOT NULL,
  tenant_id      VARCHAR(36)   NOT NULL,
  count_number   VARCHAR(50)   NOT NULL,
  warehouse_id   VARCHAR(36)   NOT NULL,
  count_type     ENUM('full','cycle','spot') NOT NULL DEFAULT 'full',
  status         ENUM('draft','in_progress','completed','posted') NOT NULL DEFAULT 'draft',
  count_date     DATE          NOT NULL DEFAULT (CURRENT_DATE),
  started_at     DATETIME      NULL,
  completed_at   DATETIME      NULL,
  assigned_to    VARCHAR(36)   NULL,
  variance_boxes DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes          TEXT          NULL,
  created_by     VARCHAR(36)   NOT NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sc_tenant_number (tenant_id, count_number),
  KEY idx_sc_tenant (tenant_id),
  CONSTRAINT fk_sc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STOCK COUNT ITEMS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_count_items (
  id              VARCHAR(36)   NOT NULL,
  tenant_id       VARCHAR(36)   NOT NULL,
  stock_count_id  VARCHAR(36)   NOT NULL,
  product_id      VARCHAR(36)   NOT NULL,
  shade_id        VARCHAR(36)   NULL,
  batch_id        VARCHAR(36)   NULL,
  rack_id         VARCHAR(36)   NULL,
  system_boxes    DECIMAL(10,2) NOT NULL DEFAULT 0,
  counted_boxes   DECIMAL(10,2) NULL,
  variance_boxes  DECIMAL(10,2) NOT NULL DEFAULT 0,
  scanned_barcode VARCHAR(255)  NULL,
  status          ENUM('pending','counted','verified') NOT NULL DEFAULT 'pending',
  counted_at      DATETIME      NULL,
  PRIMARY KEY (id),
  KEY idx_sci_tenant_count (tenant_id, stock_count_id),
  CONSTRAINT fk_sci_count   FOREIGN KEY (stock_count_id) REFERENCES stock_counts(id),
  CONSTRAINT fk_sci_product FOREIGN KEY (product_id)     REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PURCHASE RETURNS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_returns (
  id                VARCHAR(36)   NOT NULL,
  tenant_id         VARCHAR(36)   NOT NULL,
  return_number     VARCHAR(50)   NOT NULL,
  purchase_order_id VARCHAR(36)   NULL,
  grn_id            VARCHAR(36)   NULL,
  vendor_id         VARCHAR(36)   NOT NULL,
  warehouse_id      VARCHAR(36)   NOT NULL,
  return_date       DATE          NOT NULL DEFAULT (CURRENT_DATE),
  reason            VARCHAR(255)  NOT NULL,
  status            ENUM('draft','dispatched','acknowledged','cancelled') NOT NULL DEFAULT 'draft',
  total_boxes       DECIMAL(10,2) NOT NULL DEFAULT 0,
  debit_note_id     VARCHAR(36)   NULL,
  vehicle_number    VARCHAR(50)   NULL,
  notes             TEXT          NULL,
  created_by        VARCHAR(36)   NOT NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pr_tenant_number (tenant_id, return_number),
  KEY idx_pr_tenant (tenant_id),
  CONSTRAINT fk_pr_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  CONSTRAINT fk_pr_vendor  FOREIGN KEY (vendor_id)  REFERENCES vendors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PURCHASE RETURN ITEMS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_return_items (
  id                VARCHAR(36)   NOT NULL,
  tenant_id         VARCHAR(36)   NOT NULL,
  purchase_return_id VARCHAR(36)  NOT NULL,
  grn_item_id       VARCHAR(36)   NULL,
  product_id        VARCHAR(36)   NOT NULL,
  shade_id          VARCHAR(36)   NULL,
  batch_id          VARCHAR(36)   NULL,
  returned_boxes    DECIMAL(10,2) NOT NULL,
  returned_pieces   DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price        DECIMAL(12,2) NOT NULL,
  return_reason     VARCHAR(255)  NULL,
  line_total        DECIMAL(14,2) NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_pri_tenant (tenant_id, purchase_return_id),
  CONSTRAINT fk_pri_return  FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id),
  CONSTRAINT fk_pri_product FOREIGN KEY (product_id)         REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SALES ORDERS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_orders (
  id                    VARCHAR(36)   NOT NULL,
  tenant_id             VARCHAR(36)   NOT NULL,
  so_number             VARCHAR(50)   NOT NULL,
  customer_id           VARCHAR(36)   NOT NULL,
  warehouse_id          VARCHAR(36)   NOT NULL,
  invoice_id            VARCHAR(36)   NULL,
  status                ENUM('draft','confirmed','pick_ready','dispatched','delivered','cancelled') NOT NULL DEFAULT 'draft',
  order_date            DATE          NOT NULL DEFAULT (CURRENT_DATE),
  expected_delivery_date DATE         NULL,
  delivery_address      TEXT          NULL,
  sub_total             DECIMAL(14,2) NULL DEFAULT 0,
  discount_amount       DECIMAL(12,2) NULL DEFAULT 0,
  tax_amount            DECIMAL(12,2) NULL DEFAULT 0,
  grand_total           DECIMAL(14,2) NULL DEFAULT 0,
  payment_status        ENUM('pending','partial','paid') NOT NULL DEFAULT 'pending',
  notes                 TEXT          NULL,
  created_by            VARCHAR(36)   NOT NULL,
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_so_tenant_number (tenant_id, so_number),
  KEY idx_so_tenant_status (tenant_id, status),
  KEY idx_so_tenant_payment (tenant_id, payment_status),
  CONSTRAINT fk_so_tenant    FOREIGN KEY (tenant_id)    REFERENCES tenants(id),
  CONSTRAINT fk_so_customer  FOREIGN KEY (customer_id)  REFERENCES customers(id),
  CONSTRAINT fk_so_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SALES ORDER ITEMS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_order_items (
  id               VARCHAR(36)   NOT NULL,
  tenant_id        VARCHAR(36)   NOT NULL,
  sales_order_id   VARCHAR(36)   NOT NULL,
  product_id       VARCHAR(36)   NOT NULL,
  shade_id         VARCHAR(36)   NULL,
  batch_id         VARCHAR(36)   NULL,
  ordered_boxes    DECIMAL(10,2) NOT NULL,
  ordered_pieces   DECIMAL(10,2) NULL DEFAULT 0,
  dispatched_boxes DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price       DECIMAL(12,2) NOT NULL,
  discount_pct     DECIMAL(5,2)  NULL DEFAULT 0,
  tax_pct          DECIMAL(5,2)  NULL DEFAULT 0,
  line_total       DECIMAL(14,2) NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_soi_tenant_so (tenant_id, sales_order_id),
  CONSTRAINT fk_soi_so      FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_soi_product FOREIGN KEY (product_id)     REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PICK LISTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pick_lists (
  id             VARCHAR(36) NOT NULL,
  tenant_id      VARCHAR(36) NOT NULL,
  sales_order_id VARCHAR(36) NOT NULL,
  pick_number    VARCHAR(50) NOT NULL,
  warehouse_id   VARCHAR(36) NOT NULL,
  status         ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  assigned_to    VARCHAR(36) NULL,
  started_at     DATETIME    NULL,
  completed_at   DATETIME    NULL,
  created_by     VARCHAR(36) NOT NULL,
  created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pick_tenant_number (tenant_id, pick_number),
  KEY idx_pick_tenant_status (tenant_id, status),
  CONSTRAINT fk_pick_tenant FOREIGN KEY (tenant_id)      REFERENCES tenants(id),
  CONSTRAINT fk_pick_so     FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PICK LIST ITEMS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pick_list_items (
  id                  VARCHAR(36)   NOT NULL,
  tenant_id           VARCHAR(36)   NOT NULL,
  pick_list_id        VARCHAR(36)   NOT NULL,
  sales_order_item_id VARCHAR(36)   NOT NULL,
  product_id          VARCHAR(36)   NOT NULL,
  shade_id            VARCHAR(36)   NULL,
  batch_id            VARCHAR(36)   NULL,
  rack_id             VARCHAR(36)   NULL,
  requested_boxes     DECIMAL(10,2) NOT NULL,
  picked_boxes        DECIMAL(10,2) NOT NULL DEFAULT 0,
  picked_at           DATETIME      NULL,
  scanned_barcode     VARCHAR(255)  NULL,
  status              ENUM('pending','picked','short') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (id),
  KEY idx_pli_tenant_pick (tenant_id, pick_list_id),
  CONSTRAINT fk_pli_pick    FOREIGN KEY (pick_list_id) REFERENCES pick_lists(id),
  CONSTRAINT fk_pli_product FOREIGN KEY (product_id)   REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── INVOICES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              VARCHAR(36)   NOT NULL,
  tenant_id       VARCHAR(36)   NOT NULL,
  invoice_number  VARCHAR(50)   NOT NULL,
  sales_order_id  VARCHAR(36)   NOT NULL,
  customer_id     VARCHAR(36)   NOT NULL,
  invoice_date    DATE          NOT NULL DEFAULT (CURRENT_DATE),
  due_date        DATE          NULL,
  billing_address TEXT          NULL,
  shipping_address TEXT         NULL,
  sub_total       DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  cgst_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  igst_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total     DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_status  ENUM('pending','partial','paid') NOT NULL DEFAULT 'pending',
  status          ENUM('draft','issued','cancelled') NOT NULL DEFAULT 'draft',
  notes           TEXT          NULL,
  created_by      VARCHAR(36)   NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inv_tenant_number (tenant_id, invoice_number),
  KEY idx_inv_tenant_payment (tenant_id, payment_status),
  KEY idx_inv_tenant_status (tenant_id, status),
  CONSTRAINT fk_inv_tenant   FOREIGN KEY (tenant_id)    REFERENCES tenants(id),
  CONSTRAINT fk_inv_so       FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_inv_customer FOREIGN KEY (customer_id)  REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── INVOICE ITEMS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id             VARCHAR(36)   NOT NULL,
  tenant_id      VARCHAR(36)   NOT NULL,
  invoice_id     VARCHAR(36)   NOT NULL,
  product_id     VARCHAR(36)   NOT NULL,
  shade_id       VARCHAR(36)   NULL,
  hsn_code       VARCHAR(20)   NULL,
  quantity_boxes DECIMAL(10,2) NOT NULL,
  unit_price     DECIMAL(12,2) NOT NULL,
  discount_pct   DECIMAL(5,2)  NOT NULL DEFAULT 0,
  taxable_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  gst_rate       DECIMAL(5,2)  NOT NULL DEFAULT 18.00,
  cgst_pct       DECIMAL(5,2)  NOT NULL DEFAULT 9.00,
  sgst_pct       DECIMAL(5,2)  NOT NULL DEFAULT 9.00,
  igst_pct       DECIMAL(5,2)  NOT NULL DEFAULT 0,
  cgst_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  igst_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total     DECIMAL(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_ii_tenant_inv (tenant_id, invoice_id),
  CONSTRAINT fk_ii_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_ii_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── DELIVERY CHALLANS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_challans (
  id                   VARCHAR(36)  NOT NULL,
  tenant_id            VARCHAR(36)  NOT NULL,
  dc_number            VARCHAR(50)  NOT NULL,
  sales_order_id       VARCHAR(36)  NOT NULL,
  pick_list_id         VARCHAR(36)  NULL,
  customer_id          VARCHAR(36)  NOT NULL,
  dispatch_date        DATE         NOT NULL DEFAULT (CURRENT_DATE),
  vehicle_number       VARCHAR(50)  NULL,
  transporter_name     VARCHAR(255) NULL,
  lr_number            VARCHAR(100) NULL,
  status               ENUM('draft','dispatched','delivered','returned') NOT NULL DEFAULT 'draft',
  pod_document_url     TEXT         NULL,
  delivery_confirmed_at DATETIME    NULL,
  created_by           VARCHAR(36)  NOT NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dc_tenant_number (tenant_id, dc_number),
  KEY idx_dc_tenant (tenant_id),
  CONSTRAINT fk_something_tenant FOREIGN KEY (tenant_id)      REFERENCES tenants(id),
  CONSTRAINT fk_dc_so     FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── DELIVERY CHALLAN ITEMS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_challan_items (
  id                  VARCHAR(36)   NOT NULL,
  tenant_id           VARCHAR(36)   NOT NULL,
  delivery_challan_id VARCHAR(36)   NOT NULL,
  product_id          VARCHAR(36)   NOT NULL,
  shade_id            VARCHAR(36)   NULL,
  batch_id            VARCHAR(36)   NULL,
  dispatched_boxes    DECIMAL(10,2) NOT NULL,
  dispatched_pieces   DECIMAL(10,2) NOT NULL DEFAULT 0,
  dispatched_sqft     DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_price          DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_dci_tenant (tenant_id, delivery_challan_id),
  CONSTRAINT fk_dci_dc      FOREIGN KEY (delivery_challan_id) REFERENCES delivery_challans(id),
  CONSTRAINT fk_dci_product FOREIGN KEY (product_id)           REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SALES RETURNS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_returns (
  id             VARCHAR(36)   NOT NULL,
  tenant_id      VARCHAR(36)   NOT NULL,
  return_number  VARCHAR(50)   NOT NULL,
  sales_order_id VARCHAR(36)   NULL,
  invoice_id     VARCHAR(36)   NULL,
  customer_id    VARCHAR(36)   NOT NULL,
  warehouse_id   VARCHAR(36)   NOT NULL,
  return_date    DATE          NOT NULL DEFAULT (CURRENT_DATE),
  return_reason  VARCHAR(255)  NOT NULL,
  status         ENUM('draft','received','inspected','completed','cancelled') NOT NULL DEFAULT 'draft',
  credit_note_id VARCHAR(36)   NULL,
  total_boxes    DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes          TEXT          NULL,
  created_by     VARCHAR(36)   NOT NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sr_tenant_number (tenant_id, return_number),
  KEY idx_sr_tenant (tenant_id),
  CONSTRAINT fk_sr_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants(id),
  CONSTRAINT fk_sr_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SALES RETURN ITEMS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_return_items (
  id                   VARCHAR(36)   NOT NULL,
  tenant_id            VARCHAR(36)   NOT NULL,
  sales_return_id      VARCHAR(36)   NOT NULL,
  sales_order_item_id  VARCHAR(36)   NULL,
  product_id           VARCHAR(36)   NOT NULL,
  shade_id             VARCHAR(36)   NULL,
  batch_id             VARCHAR(36)   NULL,
  returned_boxes       DECIMAL(10,2) NOT NULL,
  returned_pieces      DECIMAL(10,2) NOT NULL DEFAULT 0,
  inspection_result    ENUM('good','damaged','partial') NULL,
  good_boxes           DECIMAL(10,2) NOT NULL DEFAULT 0,
  damaged_boxes        DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price           DECIMAL(12,2) NOT NULL,
  line_total           DECIMAL(14,2) NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_sri_tenant (tenant_id, sales_return_id),
  CONSTRAINT fk_sri_return  FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id),
  CONSTRAINT fk_sri_product FOREIGN KEY (product_id)      REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── CREDIT NOTES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_notes (
  id                          VARCHAR(36)   NOT NULL,
  tenant_id                   VARCHAR(36)   NOT NULL,
  cn_number                   VARCHAR(50)   NOT NULL,
  customer_id                 VARCHAR(36)   NOT NULL,
  sales_return_id             VARCHAR(36)   NULL,
  invoice_id                  VARCHAR(36)   NULL,
  cn_date                     DATE          NOT NULL DEFAULT (CURRENT_DATE),
  amount                      DECIMAL(14,2) NOT NULL DEFAULT 0,
  cgst_amount                 DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst_amount                 DECIMAL(12,2) NOT NULL DEFAULT 0,
  igst_amount                 DECIMAL(12,2) NOT NULL DEFAULT 0,
  status                      ENUM('draft','issued','adjusted','cancelled') NOT NULL DEFAULT 'draft',
  adjusted_against_payment_id VARCHAR(36)   NULL,
  notes                       TEXT          NULL,
  created_by                  VARCHAR(36)   NOT NULL,
  created_at                  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cn_tenant_number (tenant_id, cn_number),
  KEY idx_cn_tenant (tenant_id),
  CONSTRAINT fk_cn_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants(id),
  CONSTRAINT fk_cn_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── DEBIT NOTES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debit_notes (
  id                VARCHAR(36)   NOT NULL,
  tenant_id         VARCHAR(36)   NOT NULL,
  dn_number         VARCHAR(50)   NOT NULL,
  vendor_id         VARCHAR(36)   NOT NULL,
  purchase_return_id VARCHAR(36)  NULL,
  purchase_order_id VARCHAR(36)   NULL,
  dn_date           DATE          NOT NULL DEFAULT (CURRENT_DATE),
  amount            DECIMAL(14,2) NOT NULL DEFAULT 0,
  cgst_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  igst_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  status            ENUM('draft','issued','acknowledged','settled') NOT NULL DEFAULT 'draft',
  notes             TEXT          NULL,
  created_by        VARCHAR(36)   NOT NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dn_tenant_number (tenant_id, dn_number),
  KEY idx_dn_tenant (tenant_id),
  CONSTRAINT fk_dn_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_dn_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── CUSTOMER PAYMENTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_payments (
  id               VARCHAR(36)   NOT NULL,
  tenant_id        VARCHAR(36)   NOT NULL,
  payment_number   VARCHAR(50)   NOT NULL,
  customer_id      VARCHAR(36)   NOT NULL,
  invoice_id       VARCHAR(36)   NULL,
  credit_note_id   VARCHAR(36)   NULL,
  payment_date     DATE          NOT NULL DEFAULT (CURRENT_DATE),
  amount           DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_mode     ENUM('cash','cheque','neft','rtgs','upi','other') NOT NULL DEFAULT 'neft',
  reference_number VARCHAR(100)  NULL,
  bank_name        VARCHAR(100)  NULL,
  status           ENUM('pending','cleared','bounced','cancelled') NOT NULL DEFAULT 'cleared',
  notes            TEXT          NULL,
  created_by       VARCHAR(36)   NOT NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cp_tenant_number (tenant_id, payment_number),
  KEY idx_cp_tenant_customer (tenant_id, customer_id),
  CONSTRAINT fk_cp_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants(id),
  CONSTRAINT fk_cp_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── VENDOR PAYMENTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_payments (
  id                VARCHAR(36)   NOT NULL,
  tenant_id         VARCHAR(36)   NOT NULL,
  payment_number    VARCHAR(50)   NOT NULL,
  vendor_id         VARCHAR(36)   NOT NULL,
  purchase_order_id VARCHAR(36)   NULL,
  debit_note_id     VARCHAR(36)   NULL,
  payment_date      DATE          NOT NULL DEFAULT (CURRENT_DATE),
  amount            DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_mode      ENUM('cash','cheque','neft','rtgs','upi','other') NOT NULL DEFAULT 'neft',
  reference_number  VARCHAR(100)  NULL,
  bank_name         VARCHAR(100)  NULL,
  status            ENUM('pending','cleared','cancelled') NOT NULL DEFAULT 'cleared',
  notes             TEXT          NULL,
  created_by        VARCHAR(36)   NOT NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vp_tenant_number (tenant_id, payment_number),
  KEY idx_vp_tenant_vendor (tenant_id, vendor_id),
  CONSTRAINT fk_vp_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_vp_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── BARCODE LABELS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barcode_labels (
  id              VARCHAR(36)   NOT NULL,
  tenant_id       VARCHAR(36)   NOT NULL,
  product_id      VARCHAR(36)   NOT NULL,
  shade_id        VARCHAR(36)   NULL,
  batch_id        VARCHAR(36)   NULL,
  grn_item_id     VARCHAR(36)   NULL,
  barcode_value   VARCHAR(255)  NOT NULL,
  barcode_type    ENUM('EAN13','QR','CODE128','CODE39') NOT NULL DEFAULT 'CODE128',
  quantity_boxes  DECIMAL(10,2) NOT NULL DEFAULT 1,
  print_count     INT           NOT NULL DEFAULT 0,
  last_printed_at DATETIME      NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_barcode_value (barcode_value),
  KEY idx_bl_tenant (tenant_id),
  CONSTRAINT fk_bl_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  CONSTRAINT fk_bl_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── LOW STOCK ALERTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id                  VARCHAR(36)   NOT NULL,
  tenant_id           VARCHAR(36)   NOT NULL,
  warehouse_id        VARCHAR(36)   NOT NULL,
  product_id          VARCHAR(36)   NOT NULL,
  shade_id            VARCHAR(36)   NULL,
  current_stock_boxes DECIMAL(10,2) NOT NULL,
  reorder_level_boxes DECIMAL(10,2) NOT NULL,
  status              ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  alerted_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at         DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_alert_tenant_wh_product_shade (tenant_id, warehouse_id, product_id, shade_id),
  KEY idx_la_tenant_status (tenant_id, status),
  CONSTRAINT fk_la_tenant    FOREIGN KEY (tenant_id)    REFERENCES tenants(id),
  CONSTRAINT fk_la_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_la_product   FOREIGN KEY (product_id)   REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id             VARCHAR(36)  NOT NULL,
  tenant_id      VARCHAR(36)  NOT NULL,
  user_id        VARCHAR(36)  NULL,
  type           VARCHAR(100) NOT NULL,
  title          VARCHAR(255) NOT NULL,
  message        TEXT         NOT NULL,
  reference_id   VARCHAR(36)  NULL,
  reference_type VARCHAR(50)  NULL,
  is_read        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_tenant_user_read (tenant_id, user_id, is_read),
  CONSTRAINT fk_notif_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id         VARCHAR(36)  NOT NULL,
  tenant_id  VARCHAR(36)  NOT NULL,
  user_id    VARCHAR(36)  NULL,
  action     VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id  VARCHAR(36)  NULL,
  old_values JSON         NULL,
  new_values JSON         NULL,
  ip_address VARCHAR(45)  NULL,
  user_agent TEXT         NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_al_tenant_table (tenant_id, table_name),
  KEY idx_al_tenant_date  (tenant_id, created_at),
  CONSTRAINT fk_al_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── DOCUMENT COUNTERS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_counters (
  id          VARCHAR(36) NOT NULL,
  tenant_id   VARCHAR(36) NOT NULL,
  doc_type    VARCHAR(50) NOT NULL,
  prefix      VARCHAR(20) NOT NULL,
  year        INT         NOT NULL,
  last_number INT         NOT NULL DEFAULT 0,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dc_tenant_type_year (tenant_id, doc_type, year),
  CONSTRAINT fk_doc_counter_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── RECOMMENDED INDEXES ──────────────────────────────────────────────────────
-- Already created above. Additional composite indexes for common queries:
CREATE INDEX idx_sl_product_date   ON stock_ledger(tenant_id, product_id, transaction_date);
CREATE INDEX idx_ss_low_stock      ON stock_summary(tenant_id, total_boxes);
CREATE INDEX idx_inv_due_date      ON invoices(tenant_id, due_date, payment_status);
CREATE INDEX idx_cp_payment_date   ON customer_payments(tenant_id, payment_date);
CREATE INDEX idx_vp_payment_date   ON vendor_payments(tenant_id, payment_date);

-- Missing FK join column indexes (audit fix)
CREATE INDEX idx_grn_items_grn        ON grn_items(grn_id);
CREATE INDEX idx_soi_sales_order      ON sales_order_items(sales_order_id);
CREATE INDEX idx_ii_invoice           ON invoice_items(invoice_id);
CREATE INDEX idx_pli_pick_list        ON pick_list_items(pick_list_id);
CREATE INDEX idx_grn_purchase_order   ON grn(purchase_order_id);

SELECT 'Schema created successfully!' AS message;
