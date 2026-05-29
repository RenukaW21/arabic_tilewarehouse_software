# Loyalty Module Understanding

## Client Requirement

The Loyalty Module is intended to improve customer retention by rewarding customers for purchases and engagement. It should support reward points, cashback, membership benefits, referral programs, and promotional offers across different sales channels.

The business goal is to increase repeat purchases, improve customer satisfaction, and encourage long-term customer engagement.

## Functional Understanding

The module should allow customers to earn loyalty points when they purchase products or participate in eligible engagement activities. These points should be stored against the customer account and should be available for future redemption.

Customers should also be able to redeem available loyalty points during sales transactions. The redeemed points can reduce the payable order amount based on configured redemption rules.

The module should support cashback rewards where configured. Cashback should be tracked separately from loyalty points so the business can monitor cashback liability.

Membership benefits should be handled through customer tiers such as Bronze, Silver, and Gold. A customer's tier can be determined by their loyalty points balance or lifetime engagement value.

Referral functionality should allow an existing customer to refer another customer. Once the referral is converted or approved, the referrer can receive reward points.

Promotional offers should allow the business to create special campaigns such as bonus points, cashback offers, member benefits, or discount-oriented promotions.

The loyalty system should work across sales channels such as offline, POS, online, marketplace, or any future channel supported by the application.

## Expected Components

- Loyalty settings and rule configuration
- Customer loyalty point balance
- Customer cashback balance
- Earn and redeem transaction history
- Membership tier tracking
- Manual loyalty adjustments
- Referral tracking and reward posting
- Promotional offer management
- Sales order integration for earning and redeeming points
- Admin/reporting view for loyalty performance

## Implemented Scope

The implementation adds a dedicated loyalty module with backend APIs, database tables, and a frontend management page.

Backend support includes:

- Loyalty settings
- Customer loyalty summaries
- Loyalty transaction ledger
- Promotions
- Referrals
- Manual adjustments
- Sales order reward posting

Sales order support includes:

- Optional loyalty points redemption on draft sales orders
- Loyalty discount calculation
- Loyalty points earned when a sales order is confirmed
- Cashback posting when configured
- Sales channel tracking

Frontend support includes:

- Loyalty dashboard summary
- Customer loyalty balance list
- Transaction history
- Loyalty settings form
- Promotion management
- Referral management
- Manual adjustment form

## Rules Assumption

The default rule assumption is:

- Customers earn points based on order value.
- Points can be redeemed only if the customer has enough available balance.
- Redemption can be capped by a maximum percentage of the order value.
- Cashback is calculated as a percentage of confirmed order value when configured.
- Referral rewards are posted when a referral is marked as rewarded.
- Membership tier is calculated from current points balance.

## Non-Breaking Approach

The loyalty module is designed as an additive feature. Existing customer, sales order, inventory, pick list, invoice, and payment flows remain unchanged unless loyalty fields are explicitly used.

If no loyalty points are redeemed and no cashback is configured, existing sales order behavior should continue as before.

