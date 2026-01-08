import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as InAppPurchases from 'expo-in-app-purchases';
import {
  ProductId,
  PRODUCT_IDS,
  SubscriptionProduct,
  PurchaseState,
  SubscriptionStatus,
  PremiumFeatures,
  getFeaturesForProduct,
  FREE_TIER_LIMITS,
} from '../types/purchases';

interface PurchaseStore {
  // State
  isInitialized: boolean;
  purchaseState: PurchaseState;
  error: string | null;

  // Products
  products: SubscriptionProduct[];

  // Subscription status
  subscription: SubscriptionStatus;
  features: PremiumFeatures;

  // Usage tracking for free tier
  sessionsThisMonth: number;
  lastSessionCountReset: string; // ISO date string

  // Actions
  initialize: () => Promise<void>;
  loadProducts: () => Promise<void>;
  purchaseProduct: (productId: ProductId) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkSubscriptionStatus: () => Promise<void>;
  incrementSessionCount: () => boolean; // Returns false if limit reached
  canStartSession: () => boolean;
  getSessionsRemaining: () => number;
  disconnect: () => Promise<void>;
}

const defaultSubscription: SubscriptionStatus = {
  isActive: false,
  isTrialPeriod: false,
  willAutoRenew: false,
};

const defaultFeatures: PremiumFeatures = {
  unlimitedSessions: false,
  advancedAnalytics: false,
  exportData: false,
  multiPhoneSync: false,
  prioritySupport: false,
};

export const usePurchaseStore = create<PurchaseStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isInitialized: false,
      purchaseState: 'idle',
      error: null,
      products: [],
      subscription: defaultSubscription,
      features: defaultFeatures,
      sessionsThisMonth: 0,
      lastSessionCountReset: new Date().toISOString().slice(0, 7), // YYYY-MM

      initialize: async () => {
        try {
          set({ purchaseState: 'loading', error: null });

          // Connect to the store
          await InAppPurchases.connectAsync();

          // Set up purchase listener
          InAppPurchases.setPurchaseListener(({ responseCode, results }) => {
            if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
              for (const purchase of results) {
                if (!purchase.acknowledged) {
                  // Finish the transaction
                  InAppPurchases.finishTransactionAsync(purchase, true);
                }
              }
              // Refresh subscription status after successful purchase
              get().checkSubscriptionStatus();
            }
          });

          set({ isInitialized: true, purchaseState: 'idle' });

          // Load products and check subscription
          await get().loadProducts();
          await get().checkSubscriptionStatus();
        } catch (error) {
          console.error('Failed to initialize IAP:', error);
          set({
            purchaseState: 'error',
            error: error instanceof Error ? error.message : 'Failed to initialize',
          });
        }
      },

      loadProducts: async () => {
        try {
          const productIds = Object.values(PRODUCT_IDS);
          const { responseCode, results } = await InAppPurchases.getProductsAsync(productIds);

          if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
            const products: SubscriptionProduct[] = results.map((product) => ({
              productId: product.productId as ProductId,
              title: product.title,
              description: product.description,
              price: product.price,
              priceAmountMicros: product.priceAmountMicros,
              priceCurrencyCode: product.priceCurrencyCode,
              subscriptionPeriod: product.subscriptionPeriod,
            }));
            set({ products });
          }
        } catch (error) {
          console.error('Failed to load products:', error);
        }
      },

      purchaseProduct: async (productId: ProductId) => {
        const { isInitialized } = get();
        if (!isInitialized) {
          set({ error: 'Store not initialized' });
          return false;
        }

        try {
          set({ purchaseState: 'purchasing', error: null });

          await InAppPurchases.purchaseItemAsync(productId);

          // The purchase listener will handle the result
          set({ purchaseState: 'success' });
          return true;
        } catch (error) {
          console.error('Purchase failed:', error);
          set({
            purchaseState: 'error',
            error: error instanceof Error ? error.message : 'Purchase failed',
          });
          return false;
        }
      },

      restorePurchases: async () => {
        try {
          set({ purchaseState: 'restoring', error: null });

          const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

          if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
            // Process restored purchases
            for (const purchase of results) {
              if (!purchase.acknowledged) {
                await InAppPurchases.finishTransactionAsync(purchase, true);
              }
            }

            // Check subscription status after restore
            await get().checkSubscriptionStatus();
            set({ purchaseState: 'success' });
            return true;
          }

          set({ purchaseState: 'idle' });
          return false;
        } catch (error) {
          console.error('Restore failed:', error);
          set({
            purchaseState: 'error',
            error: error instanceof Error ? error.message : 'Restore failed',
          });
          return false;
        }
      },

      checkSubscriptionStatus: async () => {
        try {
          const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

          if (responseCode === InAppPurchases.IAPResponseCode.OK && results && results.length > 0) {
            // Find the most recent valid subscription
            const validPurchase = results.find((purchase) => {
              const productIds = Object.values(PRODUCT_IDS);
              return productIds.includes(purchase.productId as ProductId);
            });

            if (validPurchase) {
              const productId = validPurchase.productId as ProductId;
              const isLifetime = productId === PRODUCT_IDS.LIFETIME;

              // Note: transactionDate may not exist on all purchase types
              const purchaseDate = (validPurchase as { transactionDate?: number }).transactionDate || Date.now();
              set({
                subscription: {
                  isActive: true,
                  productId,
                  expirationDate: isLifetime ? undefined : new Date(purchaseDate + 365 * 24 * 60 * 60 * 1000),
                  isTrialPeriod: false,
                  willAutoRenew: !isLifetime,
                },
                features: getFeaturesForProduct(productId),
              });
              return;
            }
          }

          // No valid subscription found
          set({
            subscription: defaultSubscription,
            features: defaultFeatures,
          });
        } catch (error) {
          console.error('Failed to check subscription:', error);
        }
      },

      incrementSessionCount: () => {
        const { subscription, sessionsThisMonth, lastSessionCountReset } = get();

        // Premium users have unlimited sessions
        if (subscription.isActive) return true;

        // Check if we need to reset the monthly count
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (currentMonth !== lastSessionCountReset) {
          set({
            sessionsThisMonth: 1,
            lastSessionCountReset: currentMonth,
          });
          return true;
        }

        // Check if limit reached
        if (sessionsThisMonth >= FREE_TIER_LIMITS.sessionsPerMonth) {
          return false;
        }

        // Increment count
        set({ sessionsThisMonth: sessionsThisMonth + 1 });
        return true;
      },

      canStartSession: () => {
        const { subscription, sessionsThisMonth, lastSessionCountReset } = get();

        // Premium users can always start
        if (subscription.isActive) return true;

        // Check monthly reset
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (currentMonth !== lastSessionCountReset) return true;

        return sessionsThisMonth < FREE_TIER_LIMITS.sessionsPerMonth;
      },

      getSessionsRemaining: () => {
        const { subscription, sessionsThisMonth, lastSessionCountReset } = get();

        // Premium users have unlimited
        if (subscription.isActive) return Infinity;

        // Check monthly reset
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (currentMonth !== lastSessionCountReset) {
          return FREE_TIER_LIMITS.sessionsPerMonth;
        }

        return Math.max(0, FREE_TIER_LIMITS.sessionsPerMonth - sessionsThisMonth);
      },

      disconnect: async () => {
        try {
          await InAppPurchases.disconnectAsync();
          set({ isInitialized: false });
        } catch (error) {
          console.error('Failed to disconnect:', error);
        }
      },
    }),
    {
      name: 'track-speed-purchases',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist these fields
        subscription: state.subscription,
        features: state.features,
        sessionsThisMonth: state.sessionsThisMonth,
        lastSessionCountReset: state.lastSessionCountReset,
      }),
    }
  )
);
