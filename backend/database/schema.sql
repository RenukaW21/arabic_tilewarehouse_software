-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 27, 2026 at 07:34 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `twms_test`
--

-- --------------------------------------------------------

--
-- Table structure for table `ai_chat_history`
--

CREATE TABLE `ai_chat_history` (
  `id` int(11) NOT NULL,
  `tenant_id` varchar(36) DEFAULT NULL,
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `hit_count` int(11) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ai_chat_history`
--

INSERT INTO `ai_chat_history` (`id`, `tenant_id`, `question`, `answer`, `hit_count`, `created_at`, `updated_at`) VALUES
(1, NULL, 'low stock alerts', 'Currently, there are no low stock alerts as all products in the warehouse are well-stocked. If you need assistance in tracking inventory or setting up alerts for specific products in the future, feel free to ask!', 1, '2026-03-24 15:42:28', '2026-03-24 15:42:28'),
(2, NULL, 'how to purchase order', 'To create a Purchase Order (PO) in the system, follow these steps:\n\n1. **Access the Purchase Order module**: Navigate to the Purchase Order section in your warehouse management system.\n2. **Create a new PO**: Click on the \"Create New PO\" button.\n3. **Enter vendor details**: Fill in the vendor information, including name, contact details, and address.\n4. **Add products**: Input the SKUs and quantities of the tiles you need to order.\n5. **Review and submit**: Double-check all details for accuracy, then submit the PO for processing.\n\nIf you need more specific guidance or details about your system, let me know!', 1, '2026-03-24 15:42:54', '2026-03-24 15:42:54'),
(4, 'b5664dbd-bc1b-4e96-8fbb-a7fa6a778ae6', 'Show me the top stocked items', 'Here are the top stocked items in the warehouse:\n\n- **City Scape Living** (SKU: PRD-044) – 68.00 boxes\n- **Kitchen Tile** (SKU: PRB-003) – 16.00 boxes\n- **Bathroom Tile** (SKU: PRD-001) – 15.00 boxes\n- **Home Premium Tile** (SKU: PRD-002) – 7.00 boxes\n- **Vitrified Premium** (SKU: VIT-001) – 4.00 boxes\n\nIf you need more information about any specific item, feel free to ask!', 1, '2026-03-24 16:21:15', '2026-03-24 16:21:15'),
(5, 'b5664dbd-bc1b-4e96-8fbb-a7fa6a778ae6', 'How to setup this warehouse management system?', 'To set up the Tiles Warehouse Management System, follow these steps:\n\n1. **Setup Module**: Begin by configuring your warehouses, racks, and user roles. This will help organize your inventory and assign access to different users.\n2. **Master Data**: Input your master data, including products, categories, vendors, and customers to ensure all necessary information is available for transactions.\n3. **Settings**: Adjust app and warehouse configurations according to your specific business needs, including GST configuration if applicable.\n4. **Train Users**: Ensure that all users are trained on how to navigate and utilize the system effectively.\n\nOnce these steps are completed, you can start using the system for managing purchases, inventory, sales, and accounts.', 1, '2026-03-24 19:17:51', '2026-03-24 19:17:51'),
(6, 'b5664dbd-bc1b-4e96-8fbb-a7fa6a778ae6', 'how to setup', 'To set up Tiles WMS, follow these steps:\n\n### 1. GST Config\n- Go to the **Setup** module.\n- Select **GST Config**.\n- Enter the following details:\n  - Company GSTIN\n  - Legal Name\n  - State\n  - PAN\n  - Invoice Prefix (e.g., INV)\n  - Fiscal Year Start\n- Save the changes.\n\n### 2. Warehouses\n- Navigate to **Warehouses** in the Setup module.\n- Click on **Add Warehouse**.\n- Fill in:\n  - Name\n  - Code\n  - Location\n  - Capacity in boxes\n- Save the warehouse.\n\n### 3. Racks\n- Select **Racks** under the Warehouses section.\n- Choose the warehouse where you want to add racks.\n- Click on **Add Rack**.\n- Specify:\n  - Aisle\n  - Row\n  - Column\n  - Max Capacity (boxes)\n- The rack name will auto-generate.\n- Save the rack.\n\n### 4. Users\n- Go to the **Users** section.\n- Click on **Create User**.\n- Fill in user details and assign a role (e.g., Super Admin, Admin, etc.).\n- If needed, assign a warehouse to the user.\n- Save the user.\n\nAfter completing these steps, your setup will be ready for further operations.', 1, '2026-03-24 22:17:45', '2026-03-24 22:17:45'),
(7, 'bec32c64-4e5f-420f-839e-04b5098d3598', 'which is recently saled?', 'To view recently sold items in Tiles WMS, follow these steps:\n\n1. **Go to Sales Orders (SO)**: Navigate to the Sales Orders module.\n2. **Check Confirmed Orders**: Filter or sort the list to show only \"Confirmed\" sales orders.\n3. **Review Dates**: Look for the most recent dates in the list to identify the latest sales.\n4. **View Invoices**: You can also check the Invoices section for the most recently generated invoices, which correspond to sales.\n\nThis will give you an overview of the recently sold products.', 1, '2026-03-26 12:57:18', '2026-03-26 12:57:18');

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `table_name` varchar(100) NOT NULL,
  `record_id` varchar(36) DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `barcode_labels`
--

CREATE TABLE `barcode_labels` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `grn_item_id` varchar(36) DEFAULT NULL,
  `barcode_value` varchar(255) NOT NULL,
  `barcode_type` enum('EAN13','QR','CODE128','CODE39') NOT NULL DEFAULT 'CODE128',
  `quantity_boxes` decimal(10,2) NOT NULL DEFAULT 1.00,
  `print_count` int(11) NOT NULL DEFAULT 0,
  `last_printed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `batches`
--

CREATE TABLE `batches` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_number` varchar(100) NOT NULL,
  `production_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `grade` enum('A','B','C') DEFAULT 'A',
  `vendor_id` varchar(36) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `credit_notes`
--

CREATE TABLE `credit_notes` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `cn_number` varchar(50) NOT NULL,
  `customer_id` varchar(36) NOT NULL,
  `sales_return_id` varchar(36) DEFAULT NULL,
  `invoice_id` varchar(36) DEFAULT NULL,
  `cn_date` date NOT NULL DEFAULT curdate(),
  `amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `cgst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sgst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `igst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('draft','issued','adjusted','cancelled') NOT NULL DEFAULT 'draft',
  `adjusted_against_payment_id` varchar(36) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `billing_address` text DEFAULT NULL,
  `shipping_address` text DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `state_code` varchar(5) DEFAULT NULL,
  `credit_limit` decimal(12,2) DEFAULT 0.00,
  `payment_terms_days` int(11) DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_payments`
--

CREATE TABLE `customer_payments` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `payment_number` varchar(50) NOT NULL,
  `customer_id` varchar(36) NOT NULL,
  `invoice_id` varchar(36) DEFAULT NULL,
  `credit_note_id` varchar(36) DEFAULT NULL,
  `payment_date` date NOT NULL DEFAULT curdate(),
  `amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `payment_mode` enum('cash','cheque','neft','rtgs','upi','other') NOT NULL DEFAULT 'neft',
  `reference_number` varchar(100) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `status` enum('pending','cleared','bounced','cancelled') NOT NULL DEFAULT 'cleared',
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `damage_entries`
--

CREATE TABLE `damage_entries` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `rack_id` varchar(36) DEFAULT NULL,
  `damage_date` date NOT NULL DEFAULT curdate(),
  `damaged_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `damaged_pieces` decimal(10,2) NOT NULL DEFAULT 0.00,
  `damage_reason` varchar(255) DEFAULT NULL,
  `estimated_loss` decimal(12,2) DEFAULT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `debit_notes`
--

CREATE TABLE `debit_notes` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `dn_number` varchar(50) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `purchase_return_id` varchar(36) DEFAULT NULL,
  `purchase_order_id` varchar(36) DEFAULT NULL,
  `dn_date` date NOT NULL DEFAULT curdate(),
  `amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `cgst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sgst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `igst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('draft','issued','acknowledged','settled') NOT NULL DEFAULT 'draft',
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `delivery_challans`
--

CREATE TABLE `delivery_challans` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `dc_number` varchar(50) NOT NULL,
  `sales_order_id` varchar(36) NOT NULL,
  `pick_list_id` varchar(36) DEFAULT NULL,
  `customer_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) DEFAULT NULL,
  `dispatch_date` date NOT NULL DEFAULT curdate(),
  `vehicle_number` varchar(50) DEFAULT NULL,
  `transporter_name` varchar(255) DEFAULT NULL,
  `lr_number` varchar(100) DEFAULT NULL,
  `status` enum('draft','dispatched','delivered','returned') NOT NULL DEFAULT 'draft',
  `pod_document_url` text DEFAULT NULL,
  `delivery_confirmed_at` datetime DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `delivery_challan_items`
--

CREATE TABLE `delivery_challan_items` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `delivery_challan_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `dispatched_boxes` decimal(10,2) NOT NULL,
  `dispatched_pieces` decimal(10,2) NOT NULL DEFAULT 0.00,
  `dispatched_sqft` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `unit_price` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `document_counters`
--

CREATE TABLE `document_counters` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `doc_type` varchar(50) NOT NULL,
  `prefix` varchar(20) NOT NULL,
  `year` int(11) NOT NULL,
  `last_number` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `grn`
--

CREATE TABLE `grn` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `grn_number` varchar(50) NOT NULL,
  `purchase_order_id` varchar(36) DEFAULT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `receipt_date` date NOT NULL DEFAULT curdate(),
  `invoice_number` varchar(100) DEFAULT NULL,
  `invoice_date` date DEFAULT NULL,
  `vehicle_number` varchar(50) DEFAULT NULL,
  `grand_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` enum('draft','verified','posted') NOT NULL DEFAULT 'draft',
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `grn_items`
--

CREATE TABLE `grn_items` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `grn_id` varchar(36) NOT NULL,
  `purchase_order_item_id` varchar(36) DEFAULT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `rack_id` varchar(36) DEFAULT NULL,
  `received_boxes` decimal(10,2) NOT NULL,
  `received_pieces` decimal(10,2) NOT NULL DEFAULT 0.00,
  `damaged_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `unit_price` decimal(12,2) NOT NULL,
  `line_total` decimal(14,2) DEFAULT 0.00,
  `quality_status` enum('pass','fail','pending') NOT NULL DEFAULT 'pending',
  `quality_notes` text DEFAULT NULL,
  `barcode_printed` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `batch_number` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gst_configurations`
--

CREATE TABLE `gst_configurations` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `gstin` varchar(20) NOT NULL,
  `legal_name` varchar(255) NOT NULL,
  `trade_name` varchar(255) DEFAULT NULL,
  `state_code` varchar(5) NOT NULL,
  `state_name` varchar(100) NOT NULL,
  `pan` varchar(20) DEFAULT NULL,
  `default_gst_rate` decimal(5,2) NOT NULL DEFAULT 18.00,
  `fiscal_year_start` varchar(5) NOT NULL DEFAULT '04-01',
  `invoice_prefix` varchar(20) DEFAULT NULL,
  `is_composition_scheme` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory`
--

CREATE TABLE `inventory` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `rack_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `pieces` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `invoice_number` varchar(50) NOT NULL,
  `sales_order_id` varchar(36) NOT NULL,
  `customer_id` varchar(36) NOT NULL,
  `invoice_date` date NOT NULL DEFAULT curdate(),
  `due_date` date DEFAULT NULL,
  `billing_address` text DEFAULT NULL,
  `shipping_address` text DEFAULT NULL,
  `sub_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cgst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sgst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `igst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `grand_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `payment_status` enum('pending','partial','paid') NOT NULL DEFAULT 'pending',
  `status` enum('draft','issued','cancelled') NOT NULL DEFAULT 'draft',
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoice_items`
--

CREATE TABLE `invoice_items` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `invoice_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `hsn_code` varchar(20) DEFAULT NULL,
  `quantity_boxes` decimal(10,2) NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `discount_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `taxable_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `gst_rate` decimal(5,2) NOT NULL DEFAULT 18.00,
  `cgst_pct` decimal(5,2) NOT NULL DEFAULT 9.00,
  `sgst_pct` decimal(5,2) NOT NULL DEFAULT 9.00,
  `igst_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `cgst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sgst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `igst_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(14,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `low_stock_alerts`
--

CREATE TABLE `low_stock_alerts` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `current_stock_boxes` decimal(10,2) NOT NULL,
  `reorder_level_boxes` decimal(10,2) NOT NULL,
  `status` enum('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  `alerted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `resolved_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `type` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `reference_id` varchar(36) DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pick_lists`
--

CREATE TABLE `pick_lists` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `sales_order_id` varchar(36) NOT NULL,
  `pick_number` varchar(50) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `status` enum('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  `assigned_to` varchar(36) DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pick_list_items`
--

CREATE TABLE `pick_list_items` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `pick_list_id` varchar(36) NOT NULL,
  `sales_order_item_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `rack_id` varchar(36) DEFAULT NULL,
  `requested_boxes` decimal(10,2) NOT NULL,
  `picked_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `picked_at` datetime DEFAULT NULL,
  `scanned_barcode` varchar(255) DEFAULT NULL,
  `status` enum('pending','picked','short') NOT NULL DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `category_id` varchar(36) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `size_length_mm` decimal(8,2) NOT NULL,
  `size_width_mm` decimal(8,2) NOT NULL,
  `size_thickness_mm` decimal(6,2) DEFAULT NULL,
  `size_label` varchar(50) NOT NULL,
  `pieces_per_box` decimal(6,2) NOT NULL,
  `sqft_per_box` decimal(8,4) NOT NULL,
  `sqmt_per_box` decimal(8,4) DEFAULT NULL,
  `weight_per_box_kg` decimal(8,2) DEFAULT NULL,
  `finish` varchar(100) DEFAULT NULL,
  `material` varchar(100) DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `hsn_code` varchar(20) DEFAULT NULL,
  `gst_rate` decimal(5,2) DEFAULT 18.00,
  `mrp` decimal(12,2) DEFAULT NULL,
  `reorder_level_boxes` int(11) DEFAULT 0,
  `barcode` varchar(100) DEFAULT NULL,
  `image_url` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product_categories`
--

CREATE TABLE `product_categories` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `parent_id` varchar(36) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product_racks`
--

CREATE TABLE `product_racks` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `rack_id` varchar(36) NOT NULL,
  `boxes_stored` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_orders`
--

CREATE TABLE `purchase_orders` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `po_number` varchar(50) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `status` enum('draft','confirmed','partial','received','cancelled') DEFAULT 'draft',
  `return_status` enum('none','partial','full') DEFAULT 'none',
  `payment_status` enum('pending','partial','paid') DEFAULT 'pending',
  `order_date` date DEFAULT curdate(),
  `expected_date` date DEFAULT NULL,
  `received_date` date DEFAULT NULL,
  `total_amount` decimal(14,2) DEFAULT 0.00,
  `discount_amount` decimal(12,2) DEFAULT 0.00,
  `additional_discount` decimal(12,2) DEFAULT 0.00,
  `tax_amount` decimal(12,2) DEFAULT 0.00,
  `grand_total` decimal(14,2) DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_order_items`
--

CREATE TABLE `purchase_order_items` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `purchase_order_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `ordered_boxes` decimal(10,2) NOT NULL,
  `ordered_pieces` decimal(10,2) DEFAULT NULL,
  `received_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `unit_price` decimal(12,2) NOT NULL,
  `discount_pct` decimal(5,2) DEFAULT 0.00,
  `tax_pct` decimal(5,2) DEFAULT 0.00,
  `line_total` decimal(14,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_returns`
--

CREATE TABLE `purchase_returns` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `return_number` varchar(50) NOT NULL,
  `purchase_order_id` varchar(36) DEFAULT NULL,
  `grn_id` varchar(36) DEFAULT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `return_date` date NOT NULL DEFAULT curdate(),
  `reason` varchar(255) NOT NULL,
  `status` enum('draft','dispatched','acknowledged','cancelled') NOT NULL DEFAULT 'draft',
  `total_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `debit_note_id` varchar(36) DEFAULT NULL,
  `vehicle_number` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_return_items`
--

CREATE TABLE `purchase_return_items` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `purchase_return_id` varchar(36) NOT NULL,
  `grn_item_id` varchar(36) DEFAULT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `returned_boxes` decimal(10,2) NOT NULL,
  `returned_pieces` decimal(10,2) NOT NULL DEFAULT 0.00,
  `unit_price` decimal(12,2) NOT NULL,
  `return_reason` varchar(255) DEFAULT NULL,
  `line_total` decimal(14,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `racks`
--

CREATE TABLE `racks` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `zone` varchar(50) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `aisle` varchar(50) DEFAULT NULL,
  `row` varchar(50) DEFAULT NULL,
  `column` varchar(50) DEFAULT NULL,
  `level` varchar(50) DEFAULT NULL,
  `rack_type` enum('PALLET','SHELF','FLOOR') DEFAULT 'PALLET',
  `capacity_boxes` int(11) DEFAULT NULL,
  `occupied_boxes` int(11) DEFAULT 0,
  `available_boxes` int(11) DEFAULT NULL,
  `max_weight` decimal(10,2) DEFAULT NULL,
  `rack_status` enum('ACTIVE','BLOCKED','MAINTENANCE','FULL') DEFAULT 'ACTIVE',
  `qr_code` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `token` varchar(1000) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sales_orders`
--

CREATE TABLE `sales_orders` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `so_number` varchar(50) NOT NULL,
  `customer_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `invoice_id` varchar(36) DEFAULT NULL,
  `status` enum('draft','confirmed','pick_ready','dispatched','delivered','cancelled') NOT NULL DEFAULT 'draft',
  `order_date` date NOT NULL DEFAULT curdate(),
  `expected_delivery_date` date DEFAULT NULL,
  `delivery_address` text DEFAULT NULL,
  `sub_total` decimal(14,2) DEFAULT 0.00,
  `discount_amount` decimal(12,2) DEFAULT 0.00,
  `tax_amount` decimal(12,2) DEFAULT 0.00,
  `grand_total` decimal(14,2) DEFAULT 0.00,
  `payment_status` enum('pending','partial','paid') NOT NULL DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sales_order_items`
--

CREATE TABLE `sales_order_items` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `sales_order_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `ordered_boxes` decimal(10,2) NOT NULL,
  `ordered_pieces` decimal(10,2) DEFAULT 0.00,
  `dispatched_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `unit_price` decimal(12,2) NOT NULL,
  `discount_pct` decimal(5,2) DEFAULT 0.00,
  `tax_pct` decimal(5,2) DEFAULT 0.00,
  `line_total` decimal(14,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sales_returns`
--

CREATE TABLE `sales_returns` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `return_number` varchar(50) NOT NULL,
  `sales_order_id` varchar(36) DEFAULT NULL,
  `invoice_id` varchar(36) DEFAULT NULL,
  `customer_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `return_date` date NOT NULL DEFAULT curdate(),
  `return_reason` varchar(255) NOT NULL,
  `status` enum('draft','received','inspected','completed','cancelled') NOT NULL DEFAULT 'draft',
  `credit_note_id` varchar(36) DEFAULT NULL,
  `total_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sales_return_items`
--

CREATE TABLE `sales_return_items` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `sales_return_id` varchar(36) NOT NULL,
  `sales_order_item_id` varchar(36) DEFAULT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `returned_boxes` decimal(10,2) NOT NULL,
  `returned_pieces` decimal(10,2) NOT NULL DEFAULT 0.00,
  `inspection_result` enum('good','damaged','partial') DEFAULT NULL,
  `good_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `damaged_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `unit_price` decimal(12,2) NOT NULL,
  `line_total` decimal(14,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shades`
--

CREATE TABLE `shades` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_code` varchar(50) NOT NULL,
  `shade_name` varchar(150) DEFAULT NULL,
  `hex_color` varchar(7) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_adjustments`
--

CREATE TABLE `stock_adjustments` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `rack_id` varchar(36) DEFAULT NULL,
  `adjustment_type` enum('add','deduct') NOT NULL,
  `boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `pieces` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reason` varchar(255) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_counts`
--

CREATE TABLE `stock_counts` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `count_number` varchar(50) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `count_type` enum('full','cycle','spot') NOT NULL DEFAULT 'full',
  `status` enum('draft','in_progress','completed','posted') NOT NULL DEFAULT 'draft',
  `count_date` date NOT NULL DEFAULT curdate(),
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `assigned_to` varchar(36) DEFAULT NULL,
  `variance_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_count_items`
--

CREATE TABLE `stock_count_items` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `stock_count_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `rack_id` varchar(36) DEFAULT NULL,
  `system_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `counted_boxes` decimal(10,2) DEFAULT NULL,
  `variance_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `scanned_barcode` varchar(255) DEFAULT NULL,
  `status` enum('pending','counted','verified') NOT NULL DEFAULT 'pending',
  `counted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_ledger`
--

CREATE TABLE `stock_ledger` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `rack_id` varchar(36) DEFAULT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `transaction_type` enum('grn','sale','transfer_in','transfer_out','damage','adjustment','return','opening','rack_assignment') NOT NULL,
  `reference_id` varchar(36) DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `boxes_in` decimal(10,2) NOT NULL DEFAULT 0.00,
  `boxes_out` decimal(10,2) NOT NULL DEFAULT 0.00,
  `pieces_in` decimal(10,2) NOT NULL DEFAULT 0.00,
  `pieces_out` decimal(10,2) NOT NULL DEFAULT 0.00,
  `balance_boxes` decimal(10,2) NOT NULL,
  `balance_pieces` decimal(10,2) NOT NULL,
  `sqft_in` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `sqft_out` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `transaction_date` date NOT NULL DEFAULT curdate(),
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL,
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `rack_id` varchar(36) DEFAULT NULL,
  `movement_type` varchar(50) NOT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reference_id` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_summary`
--

CREATE TABLE `stock_summary` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `rack_id` varchar(36) DEFAULT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `total_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_pieces` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_sqft` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `avg_cost_per_box` decimal(12,4) DEFAULT NULL,
  `last_receipt_date` date DEFAULT NULL,
  `last_issue_date` date DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_reservations`
--

CREATE TABLE IF NOT EXISTS `stock_reservations` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `sales_order_id` varchar(36) DEFAULT NULL,
  `sales_order_item_id` varchar(36) DEFAULT NULL,
  `boxes_reserved` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('active','released','fulfilled') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_reservations_tenant` (`tenant_id`),
  KEY `idx_reservations_product` (`product_id`),
  KEY `idx_reservations_warehouse` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_transfers`
--

CREATE TABLE `stock_transfers` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `transfer_number` varchar(50) NOT NULL,
  `from_warehouse_id` varchar(36) NOT NULL,
  `to_warehouse_id` varchar(36) NOT NULL,
  `status` enum('draft','in_transit','received','cancelled') NOT NULL DEFAULT 'draft',
  `transfer_date` date NOT NULL DEFAULT curdate(),
  `received_date` date DEFAULT NULL,
  `vehicle_number` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_transfer_items`
--

CREATE TABLE `stock_transfer_items` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `transfer_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `shade_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `from_rack_id` varchar(36) DEFAULT NULL,
  `to_rack_id` varchar(36) DEFAULT NULL,
  `transferred_boxes` decimal(10,2) NOT NULL,
  `transferred_pieces` decimal(10,2) NOT NULL DEFAULT 0.00,
  `received_boxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discrepancy_boxes` decimal(10,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tenants`
--

CREATE TABLE `tenants` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `plan` enum('basic','pro','enterprise') NOT NULL DEFAULT 'basic',
  `status` enum('active','suspended','trial') NOT NULL DEFAULT 'trial',
  `max_warehouses` int(11) NOT NULL DEFAULT 1,
  `max_users` int(11) NOT NULL DEFAULT 5,
  `trial_ends_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('super_admin','admin','warehouse_manager','sales','accountant','user') NOT NULL DEFAULT 'sales',
  `phone` varchar(20) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

CREATE TABLE `vendors` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `pan` varchar(20) DEFAULT NULL,
  `payment_terms_days` int(11) DEFAULT 30,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `vendor_payments`
--

CREATE TABLE `vendor_payments` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `payment_number` varchar(50) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `purchase_order_id` varchar(36) DEFAULT NULL,
  `debit_note_id` varchar(36) DEFAULT NULL,
  `payment_date` date NOT NULL DEFAULT curdate(),
  `amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `payment_mode` enum('cash','cheque','neft','rtgs','upi','other') NOT NULL DEFAULT 'neft',
  `reference_number` varchar(100) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `status` enum('pending','cleared','cancelled') NOT NULL DEFAULT 'cleared',
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouses`
--

CREATE TABLE `warehouses` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) NOT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `pincode` varchar(20) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_dummy` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `ai_chat_history`
--
ALTER TABLE `ai_chat_history`
  ADD PRIMARY KEY (`id`);
ALTER TABLE `ai_chat_history` ADD FULLTEXT KEY `ft_question` (`question`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_al_tenant_table` (`tenant_id`,`table_name`),
  ADD KEY `idx_al_tenant_date` (`tenant_id`,`created_at`);

--
-- Indexes for table `barcode_labels`
--
ALTER TABLE `barcode_labels`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_barcode_value` (`barcode_value`),
  ADD KEY `idx_bl_tenant` (`tenant_id`),
  ADD KEY `fk_bl_product` (`product_id`);

--
-- Indexes for table `batches`
--
ALTER TABLE `batches`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_batch_tenant_product` (`tenant_id`,`product_id`),
  ADD KEY `fk_batch_product` (`product_id`),
  ADD KEY `fk_batch_vendor` (`vendor_id`);

--
-- Indexes for table `credit_notes`
--
ALTER TABLE `credit_notes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_cn_tenant_number` (`tenant_id`,`cn_number`),
  ADD KEY `idx_cn_tenant` (`tenant_id`),
  ADD KEY `fk_cn_customer` (`customer_id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customer_tenant` (`tenant_id`);

--
-- Indexes for table `customer_payments`
--
ALTER TABLE `customer_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_cp_tenant_number` (`tenant_id`,`payment_number`),
  ADD KEY `idx_cp_tenant_customer` (`tenant_id`,`customer_id`),
  ADD KEY `fk_cp_customer` (`customer_id`),
  ADD KEY `idx_cp_payment_date` (`tenant_id`,`payment_date`);

--
-- Indexes for table `damage_entries`
--
ALTER TABLE `damage_entries`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_damage_tenant` (`tenant_id`);

--
-- Indexes for table `debit_notes`
--
ALTER TABLE `debit_notes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_dn_tenant_number` (`tenant_id`,`dn_number`),
  ADD KEY `idx_dn_tenant` (`tenant_id`),
  ADD KEY `fk_dn_vendor` (`vendor_id`);

--
-- Indexes for table `delivery_challans`
--
ALTER TABLE `delivery_challans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_dc_tenant_number` (`tenant_id`,`dc_number`),
  ADD KEY `idx_dc_tenant` (`tenant_id`),
  ADD KEY `fk_dc_so` (`sales_order_id`);

--
-- Indexes for table `delivery_challan_items`
--
ALTER TABLE `delivery_challan_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_dci_tenant` (`tenant_id`,`delivery_challan_id`),
  ADD KEY `fk_dci_dc` (`delivery_challan_id`),
  ADD KEY `fk_dci_product` (`product_id`);

--
-- Indexes for table `document_counters`
--
ALTER TABLE `document_counters`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_dc_tenant_type_year` (`tenant_id`,`doc_type`,`year`);

--
-- Indexes for table `grn`
--
ALTER TABLE `grn`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_grn_tenant_number` (`tenant_id`,`grn_number`),
  ADD KEY `idx_grn_po` (`purchase_order_id`),
  ADD KEY `idx_grn_tenant_status` (`tenant_id`,`status`),
  ADD KEY `fk_grn_vendor` (`vendor_id`),
  ADD KEY `fk_grn_warehouse` (`warehouse_id`),
  ADD KEY `idx_grn_purchase_order` (`purchase_order_id`);

--
-- Indexes for table `grn_items`
--
ALTER TABLE `grn_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_grn_items_grn` (`grn_id`),
  ADD KEY `idx_grn_items_poi` (`purchase_order_item_id`),
  ADD KEY `idx_grn_items_product` (`product_id`);

--
-- Indexes for table `gst_configurations`
--
ALTER TABLE `gst_configurations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_gst_tenant` (`tenant_id`);

--
-- Indexes for table `inventory`
--
ALTER TABLE `inventory`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_inv_tenant_number` (`tenant_id`,`invoice_number`),
  ADD KEY `idx_inv_tenant_payment` (`tenant_id`,`payment_status`),
  ADD KEY `idx_inv_tenant_status` (`tenant_id`,`status`),
  ADD KEY `fk_inv_so` (`sales_order_id`),
  ADD KEY `fk_inv_customer` (`customer_id`),
  ADD KEY `idx_inv_due_date` (`tenant_id`,`due_date`,`payment_status`);

--
-- Indexes for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ii_tenant_inv` (`tenant_id`,`invoice_id`),
  ADD KEY `fk_ii_product` (`product_id`),
  ADD KEY `idx_ii_invoice` (`invoice_id`);

--
-- Indexes for table `low_stock_alerts`
--
ALTER TABLE `low_stock_alerts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_alert_tenant_wh_product_shade` (`tenant_id`,`warehouse_id`,`product_id`,`shade_id`),
  ADD KEY `idx_la_tenant_status` (`tenant_id`,`status`),
  ADD KEY `fk_la_warehouse` (`warehouse_id`),
  ADD KEY `fk_la_product` (`product_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notif_tenant_user_read` (`tenant_id`,`user_id`,`is_read`);

--
-- Indexes for table `pick_lists`
--
ALTER TABLE `pick_lists`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_pick_tenant_number` (`tenant_id`,`pick_number`),
  ADD KEY `idx_pick_tenant_status` (`tenant_id`,`status`),
  ADD KEY `fk_pick_so` (`sales_order_id`);

--
-- Indexes for table `pick_list_items`
--
ALTER TABLE `pick_list_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pli_tenant_pick` (`tenant_id`,`pick_list_id`),
  ADD KEY `fk_pli_product` (`product_id`),
  ADD KEY `idx_pli_pick_list` (`pick_list_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_product_tenant_code` (`tenant_id`,`code`),
  ADD KEY `idx_product_tenant` (`tenant_id`),
  ADD KEY `idx_product_category` (`category_id`);
ALTER TABLE `products` ADD FULLTEXT KEY `ft_products` (`name`,`code`,`brand`);

--
-- Indexes for table `product_categories`
--
ALTER TABLE `product_categories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_cat_tenant` (`tenant_id`),
  ADD KEY `fk_cat_parent` (`parent_id`);

--
-- Indexes for table `product_racks`
--
ALTER TABLE `product_racks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_product_rack` (`product_id`,`rack_id`),
  ADD KEY `idx_pr_tenant` (`tenant_id`),
  ADD KEY `fk_pr_rack` (`rack_id`);

--
-- Indexes for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_poi_tenant_po` (`tenant_id`,`purchase_order_id`),
  ADD KEY `fk_poi_po` (`purchase_order_id`),
  ADD KEY `fk_poi_product` (`product_id`);

--
-- Indexes for table `purchase_returns`
--
ALTER TABLE `purchase_returns`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_pr_tenant_number` (`tenant_id`,`return_number`),
  ADD KEY `idx_pr_tenant` (`tenant_id`),
  ADD KEY `fk_purchret_vendor` (`vendor_id`);

--
-- Indexes for table `purchase_return_items`
--
ALTER TABLE `purchase_return_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pri_tenant` (`tenant_id`,`purchase_return_id`),
  ADD KEY `fk_pri_return` (`purchase_return_id`),
  ADD KEY `fk_pri_product` (`product_id`);

--
-- Indexes for table `racks`
--
ALTER TABLE `racks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_rack_per_warehouse` (`warehouse_id`,`name`),
  ADD KEY `idx_racks_tenant` (`tenant_id`),
  ADD KEY `idx_racks_warehouse` (`warehouse_id`),
  ADD KEY `idx_racks_created_by` (`created_by`);

--
-- Indexes for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_refresh_user` (`user_id`),
  ADD KEY `idx_refresh_token` (`token`(255));

--
-- Indexes for table `sales_orders`
--
ALTER TABLE `sales_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_so_tenant_number` (`tenant_id`,`so_number`),
  ADD KEY `idx_so_tenant_status` (`tenant_id`,`status`),
  ADD KEY `idx_so_tenant_payment` (`tenant_id`,`payment_status`),
  ADD KEY `fk_so_customer` (`customer_id`),
  ADD KEY `fk_so_warehouse` (`warehouse_id`);

--
-- Indexes for table `sales_order_items`
--
ALTER TABLE `sales_order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_soi_tenant_so` (`tenant_id`,`sales_order_id`),
  ADD KEY `fk_soi_product` (`product_id`),
  ADD KEY `idx_soi_sales_order` (`sales_order_id`);

--
-- Indexes for table `sales_returns`
--
ALTER TABLE `sales_returns`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_sr_tenant_number` (`tenant_id`,`return_number`),
  ADD KEY `idx_sr_tenant` (`tenant_id`),
  ADD KEY `fk_sr_customer` (`customer_id`);

--
-- Indexes for table `sales_return_items`
--
ALTER TABLE `sales_return_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sri_tenant` (`tenant_id`,`sales_return_id`),
  ADD KEY `fk_sri_return` (`sales_return_id`),
  ADD KEY `fk_sri_product` (`product_id`);

--
-- Indexes for table `shades`
--
ALTER TABLE `shades`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_shade_tenant_product` (`tenant_id`,`product_id`),
  ADD KEY `fk_shade_product` (`product_id`);

--
-- Indexes for table `stock_adjustments`
--
ALTER TABLE `stock_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_adj_tenant_status` (`tenant_id`,`status`);

--
-- Indexes for table `stock_counts`
--
ALTER TABLE `stock_counts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_sc_tenant_number` (`tenant_id`,`count_number`),
  ADD KEY `idx_sc_tenant` (`tenant_id`);

--
-- Indexes for table `stock_count_items`
--
ALTER TABLE `stock_count_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sci_tenant_count` (`tenant_id`,`stock_count_id`),
  ADD KEY `fk_sci_count` (`stock_count_id`),
  ADD KEY `fk_sci_product` (`product_id`);

--
-- Indexes for table `stock_ledger`
--
ALTER TABLE `stock_ledger`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sl_tenant_product_wh` (`tenant_id`,`product_id`,`warehouse_id`),
  ADD KEY `idx_sl_tenant_date` (`tenant_id`,`transaction_date`),
  ADD KEY `fk_sl_warehouse` (`warehouse_id`),
  ADD KEY `fk_sl_product` (`product_id`),
  ADD KEY `idx_sl_product_date` (`tenant_id`,`product_id`,`transaction_date`);

--
-- Indexes for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `stock_summary`
--
ALTER TABLE `stock_summary`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ss_tenant_wh_prod_shade_batch_rack` (`tenant_id`,`warehouse_id`,`product_id`,`shade_id`,`batch_id`,`rack_id`),
  ADD KEY `idx_ss_tenant_product_wh` (`tenant_id`,`product_id`,`warehouse_id`),
  ADD KEY `fk_ss_warehouse` (`warehouse_id`),
  ADD KEY `fk_ss_product` (`product_id`),
  ADD KEY `idx_ss_low_stock` (`tenant_id`,`total_boxes`);

--
-- Indexes for table `stock_transfers`
--
ALTER TABLE `stock_transfers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_transfer_tenant_number` (`tenant_id`,`transfer_number`),
  ADD KEY `idx_transfer_tenant` (`tenant_id`);

--
-- Indexes for table `stock_transfer_items`
--
ALTER TABLE `stock_transfer_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sti_tenant_transfer` (`tenant_id`,`transfer_id`),
  ADD KEY `fk_sti_transfer` (`transfer_id`),
  ADD KEY `fk_sti_product` (`product_id`);

--
-- Indexes for table `tenants`
--
ALTER TABLE `tenants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tenants_slug` (`slug`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_tenant_email` (`tenant_id`,`email`),
  ADD KEY `idx_users_tenant` (`tenant_id`),
  ADD KEY `idx_users_warehouse` (`warehouse_id`);

--
-- Indexes for table `vendors`
--
ALTER TABLE `vendors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_vendor_tenant` (`tenant_id`);

--
-- Indexes for table `vendor_payments`
--
ALTER TABLE `vendor_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_vp_tenant_number` (`tenant_id`,`payment_number`),
  ADD KEY `idx_vp_tenant_vendor` (`tenant_id`,`vendor_id`),
  ADD KEY `fk_vp_vendor` (`vendor_id`),
  ADD KEY `idx_vp_payment_date` (`tenant_id`,`payment_date`);

--
-- Indexes for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_warehouse_tenant_code` (`tenant_id`,`code`),
  ADD KEY `idx_warehouse_tenant` (`tenant_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ai_chat_history`
--
ALTER TABLE `ai_chat_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `fk_al_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `barcode_labels`
--
ALTER TABLE `barcode_labels`
  ADD CONSTRAINT `fk_bl_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_bl_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `batches`
--
ALTER TABLE `batches`
  ADD CONSTRAINT `fk_batch_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_batch_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_batch_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`);

--
-- Constraints for table `credit_notes`
--
ALTER TABLE `credit_notes`
  ADD CONSTRAINT `fk_cn_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_cn_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `fk_customer_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `customer_payments`
--
ALTER TABLE `customer_payments`
  ADD CONSTRAINT `fk_cp_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_cp_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `damage_entries`
--
ALTER TABLE `damage_entries`
  ADD CONSTRAINT `fk_damage_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `debit_notes`
--
ALTER TABLE `debit_notes`
  ADD CONSTRAINT `fk_dn_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_dn_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`);

--
-- Constraints for table `delivery_challans`
--
ALTER TABLE `delivery_challans`
  ADD CONSTRAINT `fk_dc_so` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`),
  ADD CONSTRAINT `fk_something_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `delivery_challan_items`
--
ALTER TABLE `delivery_challan_items`
  ADD CONSTRAINT `fk_dci_dc` FOREIGN KEY (`delivery_challan_id`) REFERENCES `delivery_challans` (`id`),
  ADD CONSTRAINT `fk_dci_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `document_counters`
--
ALTER TABLE `document_counters`
  ADD CONSTRAINT `fk_doc_counter_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `grn`
--
ALTER TABLE `grn`
  ADD CONSTRAINT `fk_grn_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_grn_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_grn_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  ADD CONSTRAINT `fk_grn_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `grn_items`
--
ALTER TABLE `grn_items`
  ADD CONSTRAINT `fk_grn_item_grn` FOREIGN KEY (`grn_id`) REFERENCES `grn` (`id`),
  ADD CONSTRAINT `fk_grn_item_poi` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_grn_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `gst_configurations`
--
ALTER TABLE `gst_configurations`
  ADD CONSTRAINT `fk_gst_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `fk_inv_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_inv_so` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`),
  ADD CONSTRAINT `fk_inv_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD CONSTRAINT `fk_ii_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`),
  ADD CONSTRAINT `fk_ii_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `low_stock_alerts`
--
ALTER TABLE `low_stock_alerts`
  ADD CONSTRAINT `fk_la_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_la_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_la_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notif_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `pick_lists`
--
ALTER TABLE `pick_lists`
  ADD CONSTRAINT `fk_pick_so` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`),
  ADD CONSTRAINT `fk_pick_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `pick_list_items`
--
ALTER TABLE `pick_list_items`
  ADD CONSTRAINT `fk_pli_pick` FOREIGN KEY (`pick_list_id`) REFERENCES `pick_lists` (`id`),
  ADD CONSTRAINT `fk_pli_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_product_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`),
  ADD CONSTRAINT `fk_product_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `product_categories`
--
ALTER TABLE `product_categories`
  ADD CONSTRAINT `fk_cat_parent` FOREIGN KEY (`parent_id`) REFERENCES `product_categories` (`id`),
  ADD CONSTRAINT `fk_cat_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `product_racks`
--
ALTER TABLE `product_racks`
  ADD CONSTRAINT `fk_pr_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_pr_rack` FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`),
  ADD CONSTRAINT `fk_pr_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  ADD CONSTRAINT `fk_poi_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`),
  ADD CONSTRAINT `fk_poi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `purchase_returns`
--
ALTER TABLE `purchase_returns`
  ADD CONSTRAINT `fk_purchret_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_purchret_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`);

--
-- Constraints for table `purchase_return_items`
--
ALTER TABLE `purchase_return_items`
  ADD CONSTRAINT `fk_pri_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_pri_return` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns` (`id`);

--
-- Constraints for table `racks`
--
ALTER TABLE `racks`
  ADD CONSTRAINT `fk_racks_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_racks_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_racks_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sales_orders`
--
ALTER TABLE `sales_orders`
  ADD CONSTRAINT `fk_so_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_so_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_so_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `sales_order_items`
--
ALTER TABLE `sales_order_items`
  ADD CONSTRAINT `fk_soi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_soi_so` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`);

--
-- Constraints for table `sales_returns`
--
ALTER TABLE `sales_returns`
  ADD CONSTRAINT `fk_sr_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_sr_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `sales_return_items`
--
ALTER TABLE `sales_return_items`
  ADD CONSTRAINT `fk_sri_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_sri_return` FOREIGN KEY (`sales_return_id`) REFERENCES `sales_returns` (`id`);

--
-- Constraints for table `shades`
--
ALTER TABLE `shades`
  ADD CONSTRAINT `fk_shade_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_shade_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `stock_adjustments`
--
ALTER TABLE `stock_adjustments`
  ADD CONSTRAINT `fk_adj_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `stock_counts`
--
ALTER TABLE `stock_counts`
  ADD CONSTRAINT `fk_sc_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `stock_count_items`
--
ALTER TABLE `stock_count_items`
  ADD CONSTRAINT `fk_sci_count` FOREIGN KEY (`stock_count_id`) REFERENCES `stock_counts` (`id`),
  ADD CONSTRAINT `fk_sci_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `stock_ledger`
--
ALTER TABLE `stock_ledger`
  ADD CONSTRAINT `fk_sl_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_sl_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_sl_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `stock_summary`
--
ALTER TABLE `stock_summary`
  ADD CONSTRAINT `fk_ss_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_ss_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_ss_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `stock_transfers`
--
ALTER TABLE `stock_transfers`
  ADD CONSTRAINT `fk_transfer_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `stock_transfer_items`
--
ALTER TABLE `stock_transfer_items`
  ADD CONSTRAINT `fk_sti_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_sti_transfer` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers` (`id`);

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_users_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `vendors`
--
ALTER TABLE `vendors`
  ADD CONSTRAINT `fk_vendor_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);

--
-- Constraints for table `vendor_payments`
--
ALTER TABLE `vendor_payments`
  ADD CONSTRAINT `fk_vp_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_vp_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`);

--
-- Constraints for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD CONSTRAINT `fk_warehouse_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
