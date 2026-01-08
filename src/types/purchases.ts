// ============================================
// In-App Purchase Types
// ============================================

/**
 * Track Speed Premium Features:
 * - Unlimited sessions (free tier limited to 10/month)
 * - Advanced analytics & velocity graphs
 * - Export to CSV/PDF
 * - Multi-phone sync (unlimited devices)
 * - Priority support
 */

/** Product identifiers - must match App Store Connect */
export const PRODUCT_IDS = {
  // Subscriptions
  PRO_MONTHLY: 'trackspeed.pro.monthly',
  PRO_YEARLY: 'trackspeed.pro.yearly',
  // One-time purchases
  LIFETIME: 'trackspeed.lifetime',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

/** Subscription product details */
export interface SubscriptionProduct {
  productId: ProductId;
  title: string;
  description: string;
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  subscriptionPeriod?: string;
  freeTrialPeriod?: string;
}

/** Purchase state */
export type PurchaseState =
  | 'idle'
  | 'loading'
  | 'purchasing'
  | 'restoring'
  | 'success'
  | 'error';

/** Purchase result */
export interface PurchaseResult {
  success: boolean;
  productId?: ProductId;
  transactionId?: string;
  error?: string;
}

/** Subscription status */
export interface SubscriptionStatus {
  isActive: boolean;
  productId?: ProductId;
  expirationDate?: Date;
  isTrialPeriod: boolean;
  willAutoRenew: boolean;
}

/** Premium feature flags */
export interface PremiumFeatures {
  unlimitedSessions: boolean;
  advancedAnalytics: boolean;
  exportData: boolean;
  multiPhoneSync: boolean;
  prioritySupport: boolean;
}

/** Get features for a subscription tier */
export function getFeaturesForProduct(productId?: ProductId): PremiumFeatures {
  const freeFeatures: PremiumFeatures = {
    unlimitedSessions: false,
    advancedAnalytics: false,
    exportData: false,
    multiPhoneSync: false,
    prioritySupport: false,
  };

  if (!productId) return freeFeatures;

  // All paid tiers get full features
  return {
    unlimitedSessions: true,
    advancedAnalytics: true,
    exportData: true,
    multiPhoneSync: true,
    prioritySupport: productId === PRODUCT_IDS.LIFETIME,
  };
}

/** Free tier limits */
export const FREE_TIER_LIMITS = {
  sessionsPerMonth: 10,
  maxAthletes: 3,
  historyDays: 30,
} as const;
