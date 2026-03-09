export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      credit_notes: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          credit_note_number: string
          customer_id: string
          id: string
          invoice_id: string | null
          issue_date: string | null
          notes: string | null
          reason: string | null
          sales_return_id: string | null
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          credit_note_number: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          issue_date?: string | null
          notes?: string | null
          reason?: string | null
          sales_return_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          credit_note_number?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          issue_date?: string | null
          notes?: string | null
          reason?: string | null
          sales_return_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_sales_return_id_fkey"
            columns: ["sales_return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address: string | null
          code: string | null
          contact_person: string | null
          created_at: string | null
          credit_limit: number | null
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms_days: number | null
          phone: string | null
          shipping_address: string | null
          updated_at: string | null
        }
        Insert: {
          billing_address?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms_days?: number | null
          phone?: string | null
          shipping_address?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_address?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms_days?: number | null
          phone?: string | null
          shipping_address?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      damage_entries: {
        Row: {
          created_at: string | null
          created_by: string | null
          damage_date: string | null
          damage_reason: string | null
          damaged_boxes: number | null
          damaged_pieces: number | null
          estimated_loss: number | null
          id: string
          notes: string | null
          product_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          damage_date?: string | null
          damage_reason?: string | null
          damaged_boxes?: number | null
          damaged_pieces?: number | null
          estimated_loss?: number | null
          id?: string
          notes?: string | null
          product_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          damage_date?: string | null
          damage_reason?: string | null
          damaged_boxes?: number | null
          damaged_pieces?: number | null
          estimated_loss?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_entries_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      debit_notes: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          debit_note_number: string
          id: string
          issue_date: string | null
          notes: string | null
          purchase_return_id: string | null
          reason: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          debit_note_number: string
          id?: string
          issue_date?: string | null
          notes?: string | null
          purchase_return_id?: string | null
          reason?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          debit_note_number?: string
          id?: string
          issue_date?: string | null
          notes?: string | null
          purchase_return_id?: string | null
          reason?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debit_notes_purchase_return_id_fkey"
            columns: ["purchase_return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_challans: {
        Row: {
          challan_date: string | null
          challan_number: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          notes: string | null
          sales_order_id: string | null
          status: string
          vehicle_number: string | null
          warehouse_id: string
        }
        Insert: {
          challan_date?: string | null
          challan_number: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          notes?: string | null
          sales_order_id?: string | null
          status?: string
          vehicle_number?: string | null
          warehouse_id: string
        }
        Update: {
          challan_date?: string | null
          challan_number?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          notes?: string | null
          sales_order_id?: string | null
          status?: string
          vehicle_number?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      document_counters: {
        Row: {
          created_at: string | null
          doc_type: string
          id: string
          last_number: number
          prefix: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          doc_type: string
          id?: string
          last_number?: number
          prefix: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          doc_type?: string
          id?: string
          last_number?: number
          prefix?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      grn: {
        Row: {
          created_at: string | null
          created_by: string | null
          grn_number: string
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          purchase_order_id: string | null
          receipt_date: string | null
          status: Database["public"]["Enums"]["grn_status"]
          vehicle_number: string | null
          vendor_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          grn_number: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          receipt_date?: string | null
          status?: Database["public"]["Enums"]["grn_status"]
          vehicle_number?: string | null
          vendor_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          grn_number?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          receipt_date?: string | null
          status?: Database["public"]["Enums"]["grn_status"]
          vehicle_number?: string | null
          vendor_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grn_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_items: {
        Row: {
          damaged_boxes: number | null
          grn_id: string
          id: string
          product_id: string
          received_boxes: number
          received_pieces: number | null
          unit_price: number
        }
        Insert: {
          damaged_boxes?: number | null
          grn_id: string
          id?: string
          product_id: string
          received_boxes?: number
          received_pieces?: number | null
          unit_price?: number
        }
        Update: {
          damaged_boxes?: number | null
          grn_id?: string
          id?: string
          product_id?: string
          received_boxes?: number
          received_pieces?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grn"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          cgst_amount: number | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          discount_amount: number | null
          due_date: string | null
          grand_total: number | null
          id: string
          igst_amount: number | null
          invoice_date: string | null
          invoice_number: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          sales_order_id: string | null
          sgst_amount: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          sub_total: number | null
          updated_at: string | null
        }
        Insert: {
          cgst_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          discount_amount?: number | null
          due_date?: string | null
          grand_total?: number | null
          id?: string
          igst_amount?: number | null
          invoice_date?: string | null
          invoice_number: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          sales_order_id?: string | null
          sgst_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          sub_total?: number | null
          updated_at?: string | null
        }
        Update: {
          cgst_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          discount_amount?: number | null
          due_date?: string | null
          grand_total?: number | null
          id?: string
          igst_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          sales_order_id?: string | null
          sgst_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          sub_total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_alerts: {
        Row: {
          alerted_at: string | null
          current_stock_boxes: number
          id: string
          product_id: string
          reorder_level_boxes: number
          resolved_at: string | null
          status: Database["public"]["Enums"]["alert_status"]
          warehouse_id: string
        }
        Insert: {
          alerted_at?: string | null
          current_stock_boxes: number
          id?: string
          product_id: string
          reorder_level_boxes: number
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          warehouse_id: string
        }
        Update: {
          alerted_at?: string | null
          current_stock_boxes?: number
          id?: string
          product_id?: string
          reorder_level_boxes?: number
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "low_stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_alerts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments_made: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_mode: string | null
          payment_number: string
          purchase_order_id: string | null
          reference_number: string | null
          vendor_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          payment_number: string
          purchase_order_id?: string | null
          reference_number?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          payment_number?: string
          purchase_order_id?: string | null
          reference_number?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_made_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_made_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payments_received: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string | null
          payment_mode: string | null
          payment_number: string
          reference_number: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          payment_number: string
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          payment_number?: string
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_received_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_received_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_lists: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          pick_date: string | null
          pick_number: string
          sales_order_id: string | null
          status: string
          warehouse_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          pick_date?: string | null
          pick_number: string
          sales_order_id?: string | null
          status?: string
          warehouse_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          pick_date?: string | null
          pick_number?: string
          sales_order_id?: string | null
          status?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_lists_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          code: string
          created_at: string | null
          description: string | null
          gst_rate: number
          hsn_code: string | null
          id: string
          is_active: boolean | null
          mrp: number | null
          name: string
          pieces_per_box: number
          reorder_level_boxes: number
          size_label: string
          sqft_per_box: number
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          is_active?: boolean | null
          mrp?: number | null
          name: string
          pieces_per_box?: number
          reorder_level_boxes?: number
          size_label?: string
          sqft_per_box?: number
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          is_active?: boolean | null
          mrp?: number | null
          name?: string
          pieces_per_box?: number
          reorder_level_boxes?: number
          size_label?: string
          sqft_per_box?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string
          id: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          discount_pct: number | null
          id: string
          line_total: number | null
          ordered_boxes: number
          product_id: string
          purchase_order_id: string
          received_boxes: number | null
          tax_pct: number | null
          unit_price: number
        }
        Insert: {
          discount_pct?: number | null
          id?: string
          line_total?: number | null
          ordered_boxes?: number
          product_id: string
          purchase_order_id: string
          received_boxes?: number | null
          tax_pct?: number | null
          unit_price?: number
        }
        Update: {
          discount_pct?: number | null
          id?: string
          line_total?: number | null
          ordered_boxes?: number
          product_id?: string
          purchase_order_id?: string
          received_boxes?: number | null
          tax_pct?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          expected_date: string | null
          grand_total: number | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          status: Database["public"]["Enums"]["po_status"]
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
          vendor_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          expected_date?: string | null
          grand_total?: number | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          status?: Database["public"]["Enums"]["po_status"]
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
          vendor_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          expected_date?: string | null
          grand_total?: number | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          status?: Database["public"]["Enums"]["po_status"]
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
          vendor_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          purchase_order_id: string | null
          reason: string | null
          return_date: string | null
          return_number: string
          status: string
          total_amount: number | null
          total_boxes: number | null
          vendor_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          reason?: string | null
          return_date?: string | null
          return_number: string
          status?: string
          total_amount?: number | null
          total_boxes?: number | null
          vendor_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          reason?: string | null
          return_date?: string | null
          return_number?: string
          status?: string
          total_amount?: number | null
          total_boxes?: number | null
          vendor_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          discount_pct: number | null
          dispatched_boxes: number | null
          id: string
          line_total: number | null
          ordered_boxes: number
          product_id: string
          sales_order_id: string
          tax_pct: number | null
          unit_price: number
        }
        Insert: {
          discount_pct?: number | null
          dispatched_boxes?: number | null
          id?: string
          line_total?: number | null
          ordered_boxes?: number
          product_id: string
          sales_order_id: string
          tax_pct?: number | null
          unit_price?: number
        }
        Update: {
          discount_pct?: number | null
          dispatched_boxes?: number | null
          id?: string
          line_total?: number | null
          ordered_boxes?: number
          product_id?: string
          sales_order_id?: string
          tax_pct?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string
          delivery_address: string | null
          discount_amount: number | null
          expected_delivery_date: string | null
          grand_total: number | null
          id: string
          notes: string | null
          order_date: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          so_number: string
          status: Database["public"]["Enums"]["so_status"]
          sub_total: number | null
          tax_amount: number | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          delivery_address?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          grand_total?: number | null
          id?: string
          notes?: string | null
          order_date?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          so_number: string
          status?: Database["public"]["Enums"]["so_status"]
          sub_total?: number | null
          tax_amount?: number | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          delivery_address?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          grand_total?: number | null
          id?: string
          notes?: string | null
          order_date?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          so_number?: string
          status?: Database["public"]["Enums"]["so_status"]
          sub_total?: number | null
          tax_amount?: number | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          reason: string | null
          return_date: string | null
          return_number: string
          sales_order_id: string | null
          status: string
          total_amount: number | null
          total_boxes: number | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          reason?: string | null
          return_date?: string | null
          return_number: string
          sales_order_id?: string | null
          status?: string
          total_amount?: number | null
          total_boxes?: number | null
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          reason?: string | null
          return_date?: string | null
          return_number?: string
          sales_order_id?: string | null
          status?: string
          total_amount?: number | null
          total_boxes?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          approved_at: string | null
          approved_by: string | null
          boxes: number | null
          created_at: string | null
          created_by: string | null
          id: string
          pieces: number | null
          product_id: string
          reason: string
          status: Database["public"]["Enums"]["adjustment_status"]
          warehouse_id: string
        }
        Insert: {
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          approved_at?: string | null
          approved_by?: string | null
          boxes?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          pieces?: number | null
          product_id: string
          reason: string
          status?: Database["public"]["Enums"]["adjustment_status"]
          warehouse_id: string
        }
        Update: {
          adjustment_type?: Database["public"]["Enums"]["adjustment_type"]
          approved_at?: string | null
          approved_by?: string | null
          boxes?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          pieces?: number | null
          product_id?: string
          reason?: string
          status?: Database["public"]["Enums"]["adjustment_status"]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger: {
        Row: {
          balance_boxes: number
          balance_pieces: number
          boxes_in: number | null
          boxes_out: number | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          pieces_in: number | null
          pieces_out: number | null
          product_id: string
          reference_id: string | null
          reference_type: string | null
          sqft_in: number | null
          sqft_out: number | null
          transaction_date: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          warehouse_id: string
        }
        Insert: {
          balance_boxes?: number
          balance_pieces?: number
          boxes_in?: number | null
          boxes_out?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          pieces_in?: number | null
          pieces_out?: number | null
          product_id: string
          reference_id?: string | null
          reference_type?: string | null
          sqft_in?: number | null
          sqft_out?: number | null
          transaction_date?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          warehouse_id: string
        }
        Update: {
          balance_boxes?: number
          balance_pieces?: number
          boxes_in?: number | null
          boxes_out?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          pieces_in?: number | null
          pieces_out?: number | null
          product_id?: string
          reference_id?: string | null
          reference_type?: string | null
          sqft_in?: number | null
          sqft_out?: number | null
          transaction_date?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_summary: {
        Row: {
          avg_cost_per_box: number | null
          id: string
          last_issue_date: string | null
          last_receipt_date: string | null
          product_id: string
          total_boxes: number | null
          total_pieces: number | null
          total_sqft: number | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          avg_cost_per_box?: number | null
          id?: string
          last_issue_date?: string | null
          last_receipt_date?: string | null
          product_id: string
          total_boxes?: number | null
          total_pieces?: number | null
          total_sqft?: number | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          avg_cost_per_box?: number | null
          id?: string
          last_issue_date?: string | null
          last_receipt_date?: string | null
          product_id?: string
          total_boxes?: number | null
          total_pieces?: number | null
          total_sqft?: number | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_summary_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_summary_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          discrepancy_boxes: number | null
          id: string
          product_id: string
          received_boxes: number | null
          transfer_id: string
          transferred_boxes: number
          transferred_pieces: number | null
        }
        Insert: {
          discrepancy_boxes?: number | null
          id?: string
          product_id: string
          received_boxes?: number | null
          transfer_id: string
          transferred_boxes?: number
          transferred_pieces?: number | null
        }
        Update: {
          discrepancy_boxes?: number | null
          id?: string
          product_id?: string
          received_boxes?: number | null
          transfer_id?: string
          transferred_boxes?: number
          transferred_pieces?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string | null
          created_by: string | null
          from_warehouse_id: string
          id: string
          notes: string | null
          received_date: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_warehouse_id: string
          transfer_date: string | null
          transfer_number: string
          vehicle_number: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          from_warehouse_id: string
          id?: string
          notes?: string | null
          received_date?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_warehouse_id: string
          transfer_date?: string | null
          transfer_number: string
          vehicle_number?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          received_date?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_warehouse_id?: string
          transfer_date?: string | null
          transfer_number?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          code: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms_days: number | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms_days?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms_days?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          address: string | null
          city: string | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          pincode: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          pincode?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          pincode?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: { Args: never; Returns: boolean }
      next_doc_number: { Args: { p_doc_type: string }; Returns: string }
    }
    Enums: {
      adjustment_status: "pending" | "approved" | "rejected"
      adjustment_type: "add" | "deduct"
      alert_status: "open" | "acknowledged" | "resolved"
      app_role:
        | "super_admin"
        | "admin"
        | "warehouse_manager"
        | "sales"
        | "accountant"
        | "user"
      grn_status: "draft" | "verified" | "posted"
      invoice_status: "draft" | "issued" | "cancelled"
      payment_status: "pending" | "partial" | "paid"
      po_status: "draft" | "confirmed" | "partial" | "received" | "cancelled"
      so_status:
        | "draft"
        | "confirmed"
        | "pick_ready"
        | "dispatched"
        | "delivered"
        | "cancelled"
      transaction_type:
        | "grn"
        | "sale"
        | "transfer_in"
        | "transfer_out"
        | "damage"
        | "adjustment"
        | "return"
        | "opening"
      transfer_status: "draft" | "in_transit" | "received" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      adjustment_status: ["pending", "approved", "rejected"],
      adjustment_type: ["add", "deduct"],
      alert_status: ["open", "acknowledged", "resolved"],
      app_role: [
        "super_admin",
        "admin",
        "warehouse_manager",
        "sales",
        "accountant",
        "user",
      ],
      grn_status: ["draft", "verified", "posted"],
      invoice_status: ["draft", "issued", "cancelled"],
      payment_status: ["pending", "partial", "paid"],
      po_status: ["draft", "confirmed", "partial", "received", "cancelled"],
      so_status: [
        "draft",
        "confirmed",
        "pick_ready",
        "dispatched",
        "delivered",
        "cancelled",
      ],
      transaction_type: [
        "grn",
        "sale",
        "transfer_in",
        "transfer_out",
        "damage",
        "adjustment",
        "return",
        "opening",
      ],
      transfer_status: ["draft", "in_transit", "received", "cancelled"],
    },
  },
} as const
