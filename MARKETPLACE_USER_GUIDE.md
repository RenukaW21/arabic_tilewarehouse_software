# Marketplace Integration — User Guide

**For:** Store Admins & Warehouse Managers  
**Module location in app:** Sidebar → Marketplace

---

## What is the Marketplace Module?

The Marketplace module lets you manage your Amazon, Flipkart, and Meesho stores **directly from your Tiles WMS** — without switching between three different seller panels.

From one screen you can:
- See all incoming orders from all three platforms
- Set different prices per platform for each product
- Track shipments and mark orders as dispatched
- Handle customer returns
- Monitor whether each platform is syncing correctly

---

## Before You Start — What You Need

Before using the marketplace features, you need to collect the following from each platform's seller panel. You only need to do this once.

### For Amazon

Go to **Amazon Seller Central → Apps & Services → Develop Apps** and collect:

| What you need | Where to find it |
|---|---|
| **Client ID** (API Key) | Seller Central → Apps & Services → Your Apps |
| **Client Secret** | Same page as Client ID |
| **Refresh Token** | Generated when you authorize the WMS app on your Amazon account |
| **Marketplace ID** | For India it is always `A21TJRUUN4KGV` |
| **Fulfillment Type** | Go to Inventory — if your products show "FBA" you are FBA, otherwise FBM |

> **FBM vs FBA in simple terms:**
> - **FBM (Fulfilled by Merchant)** — You pack and ship orders yourself from your warehouse.
> - **FBA (Fulfilled by Amazon)** — You send bulk stock to Amazon's warehouse. Amazon packs and ships to customers on your behalf.

### For Flipkart

Go to **Flipkart Seller Hub → Account Settings → API Access**:

| What you need | Where to find it |
|---|---|
| **App ID** (API Key) | Seller Hub → API Access |
| **App Secret** | Same page as App ID |
| **Seller ID** | Seller Hub → Profile → Seller ID |

### For Meesho

Go to **Meesho Supplier Panel → Settings → API**:

| What you need | Where to find it |
|---|---|
| **API Key** | Supplier Panel → Settings → API |
| **Supplier ID** | Supplier Panel → Profile |

---

## Step 1 — Connect Your Platforms

**Who can do this:** Admin only  
**Where:** Sidebar → Marketplace → Credentials

This is the first thing you must do before anything else works.

1. Go to **Marketplace → Credentials**
2. You will see three cards — Amazon, Flipkart, and Meesho
3. Click **Connect** on each platform you want to activate
4. Fill in the credentials you collected in the step above
5. For Amazon, also select your **Fulfillment Type** (FBM or FBA)
6. Toggle **Active** to ON
7. Click **Save**

Once saved, the card will show a **Connected** badge.

> You do not need to connect all three at once. You can start with just Amazon and add Flipkart and Meesho later.

---

## Step 2 — Set Prices Per Platform

**Who can do this:** Admin, Warehouse Manager  
**Where:** Sidebar → Marketplace → Pricing

Each product can have a different price on each platform. For example:
- Amazon: ₹1,260
- Flipkart: ₹1,200
- Meesho: ₹1,140

### How to set a price

1. Go to **Marketplace → Pricing**
2. Click **+ Set Price** (top right)
3. Enter the **Product ID** (copy this from the Products page)
4. Select the **Platform** (Amazon / Flipkart / Meesho)
5. Enter the **Price**
6. Click **Save Price**

The price is saved immediately. It will be pushed to the platform the next time a sync runs.

### How to update an existing price

1. Find the product in the pricing table
2. Click **Edit** on that row
3. Change the price and click **Save Price**

> **Important:** All price changes go through admin approval before they are sent to the marketplace. The admin will receive a notification to review and approve the change in **Admin Approvals**.

---

## Step 3 — Managing Orders

**Who can do this:** Admin, Warehouse Manager, Supervisor  
**Where:** Sidebar → Marketplace → Orders

This is your **unified order inbox**. Orders from Amazon, Flipkart, and Meesho all appear here in one table — you do not need to log into each seller panel separately.

### Order Statuses

| Status | What it means |
|---|---|
| **Pending** | Order received from marketplace, not yet acknowledged |
| **Confirmed** | Order acknowledged, being prepared for dispatch |
| **Shipped** | Order dispatched, tracking number entered |
| **Delivered** | Order delivered to the customer |
| **Cancelled** | Order cancelled (by customer or seller) |
| **Returned** | Customer has returned the order |

### Processing an Order — Step by Step

**1. New order arrives (Pending)**
- The order appears automatically in the inbox with status **Pending**
- You can see the platform it came from, the customer name, the amount, and the items ordered

**2. Confirm the order**
- Click **Confirm** on the order row
- Status moves to **Confirmed**
- This tells the platform that you have acknowledged the order

**3. Pack and dispatch — Mark as Shipped**
- After packing, click **Ship** on the order row
- A small window opens asking for the **Tracking Number**
- Enter the courier tracking number (e.g. Delhivery, BlueDart, EKART)
- Click **Mark Shipped**
- Status moves to **Shipped** and the tracking number is sent back to the platform automatically

**4. Order reaches customer**
- Once the customer receives the order, the platform updates the status to **Delivered**
- This happens automatically via sync

### Filtering Orders

Use the filter bar at the top to narrow down what you see:

- **All Platforms / Amazon / Flipkart / Meesho** — View orders from one platform only
- **All Statuses / Pending / Shipped** etc. — View by order stage
- **Search bar** — Search by order ID or customer name

### Stats Bar

At the top of the orders page you will see a row of numbers:

```
Total    Pending    Confirmed    Shipped    Delivered    Cancelled    Returned
  12        3           2           2           4            1           0
```

This gives you a quick count of where all your orders currently stand.

---

## Step 4 — Handling Returns

**Who can do this:** Admin, Warehouse Manager, Supervisor  
**Where:** Sidebar → Marketplace → Orders (returns appear here with status "Returned")

When a customer initiates a return on Amazon, Flipkart, or Meesho, it will automatically appear in your returns list.

### Return Statuses

| Status | What it means |
|---|---|
| **Initiated** | Customer requested a return on the platform |
| **Received** | Your warehouse has received the returned item |
| **Restocked** | Item checked and put back in stock |
| **Rejected** | Item failed quality check — not restocked |

### How to Process a Return

1. When a return arrives, it shows as **Initiated**
2. When your team physically receives the item at the warehouse, update status to **Received**
3. After quality check:
   - If item is in good condition → mark **Restocked** — the system automatically adds the quantity back to your WMS stock
   - If item is damaged or cannot be resold → mark **Rejected** — no stock is added back

---

## Step 5 — Monitoring Sync Health

**Who can do this:** Admin, Warehouse Manager  
**Where:** Sidebar → Marketplace → Sync Health

This page tells you whether each platform is connected and syncing correctly.

### Platform Health Cards

At the top you will see three cards — one per platform. Each shows:
- **Connected / Not Connected** — whether credentials are active
- **Last sync time** — when the last sync ran
- **Per-sync-type status** — whether Orders, Stock, Pricing, Returns are syncing successfully

### Status Badges

| Badge | Meaning |
|---|---|
| **Success** (green) | Sync completed without any issues |
| **Partial** (yellow) | Sync ran but some items had issues (e.g. a product SKU not found on the platform) |
| **Error** (red) | Sync failed — see the error message for details |

### What to do if a sync shows Error

1. Check the error message shown on the card or in the log table below
2. Common causes:
   - **Token expired** → Go to Credentials, re-enter the Refresh Token for that platform
   - **Rate limit exceeded** → The platform rejected the request because too many calls were made — the next sync will retry automatically
   - **SKU not found** → A product in your WMS does not have a matching listing on that platform yet
3. If you are unsure, contact your system administrator with the error message shown

### Sync Log Table

Below the health cards is a full history table showing every sync that has run, with:
- Which platform and what type of sync (Orders / Stock / Pricing / Returns)
- How many records were pulled in or pushed out
- Exact start and finish time
- Error message (if any)

---

## Frequently Asked Questions

**Q: I connected a platform but no orders are showing. What do I check?**  
A: First check **Sync Health** — if the Orders sync shows an error, that is the cause. Also confirm the platform credentials are saved correctly in **Credentials**. Try toggling the platform inactive and then active again to trigger a fresh sync.

---

**Q: Can I have different prices on Amazon and Flipkart for the same product?**  
A: Yes, that is exactly what the Pricing page is for. Set a separate price for each platform and each will sync independently.

---

**Q: Who approves price changes before they go live on the platform?**  
A: The admin receives a notification in the **Approvals** section (sidebar → Approvals). Until the admin approves, the old price remains on the platform.

---

**Q: What happens to my WMS stock when an Amazon order comes in?**  
A: When you mark an order as **Shipped**, the stock is deducted from your WMS warehouse — the same way a regular sales order works. If a return comes in and is marked **Restocked**, the quantity is added back automatically.

---

**Q: What is FBM and FBA? Which one should I select?**  
A: 
- **FBM** — You store the products in your own warehouse and ship each order yourself. Most tile businesses use FBM.
- **FBA** — You ship a large quantity of stock to Amazon's fulfilment centre. Amazon stores it and ships individual orders to customers.

To confirm which one your account uses, log into Amazon Seller Central, go to **Inventory**, and check whether your product listings say "FBA" or "FBM" next to them.

---

**Q: Do I need to log into Amazon / Flipkart / Meesho separately anymore?**  
A: For day-to-day order management, pricing, and shipment — no. Everything is handled from this app. You may still need to log into the seller panels occasionally for account-level settings, advertising, or dispute resolution.

---

**Q: What if a customer returns a damaged product? Does the stock still come back?**  
A: No. If you mark the return as **Rejected** after quality check, no stock is added back to your WMS. Only returns marked **Restocked** add quantity back.

---

## Quick Reference — Who Does What

| Task | Who can do it |
|---|---|
| Connect / edit platform credentials | Admin only |
| Set or change platform prices | Admin, Warehouse Manager |
| Confirm and ship orders | Admin, Warehouse Manager, Supervisor |
| Process returns (receive / restock / reject) | Admin, Warehouse Manager, Supervisor |
| View orders and returns (read only) | Viewer |
| Monitor sync health | Admin, Warehouse Manager |

---

*Guide prepared 2026-06-02 — Tiles WMS Marketplace Integration*
