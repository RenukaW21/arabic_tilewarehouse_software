import type { PaginationParams } from "./api.types";

export interface LoyaltyTier {
  name: string;
  min_points: number;
  benefit?: string;
}

export interface LoyaltySettings {
  earn_rate_amount: number;
  earn_rate_points: number;
  point_value_amount: number;
  min_redeem_points: number;
  max_redeem_percent: number;
  cashback_percent: number;
  referral_reward_points: number;
  tiers: LoyaltyTier[];
}

export interface LoyaltyCustomer {
  id: string;
  name: string;
  code?: string | null;
  phone?: string | null;
  email?: string | null;
  points_balance: number;
  cashback_balance: number;
  tier: LoyaltyTier;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  customer_name?: string;
  sales_order_id?: string | null;
  so_number?: string | null;
  type: "earn" | "redeem" | "cashback" | "referral" | "adjustment" | "promotion";
  points_delta: number;
  cashback_delta: number;
  description?: string | null;
  sales_channel: string;
  status: "pending" | "posted" | "cancelled";
  created_at: string;
}

export interface LoyaltyPromotion {
  id: string;
  name: string;
  description?: string | null;
  offer_type: "points_multiplier" | "cashback" | "member_benefit" | "discount";
  points_multiplier: number;
  cashback_percent: number;
  start_date: string;
  end_date?: string | null;
  is_active: boolean | number;
}

export interface LoyaltyReferral {
  id: string;
  referrer_customer_id: string;
  referred_customer_id?: string | null;
  referrer_name?: string;
  referred_customer_name?: string | null;
  referral_code: string;
  status: "pending" | "converted" | "rewarded" | "cancelled";
  reward_points: number;
  rewarded_at?: string | null;
  notes?: string | null;
}

export interface LoyaltyOverview {
  settings: LoyaltySettings;
  summary: {
    active_points: number;
    active_cashback: number;
    enrolled_customers: number;
    active_promotions: number;
    referral_count: number;
  };
  recent_transactions: LoyaltyTransaction[];
}

export type LoyaltyListParams = PaginationParams & {
  customer_id?: string;
  type?: string;
};
