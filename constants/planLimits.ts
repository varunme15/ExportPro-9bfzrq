// Plan Limits Configuration - Single source of truth
export type SubscriptionStatus = 'FREE' | 'PAID';

export interface PlanLimits {
  maxSuppliers: number;
  maxProducts: number;
  maxShipmentsPerMonth: number;
  maxInvoicesPerMonth: number;
  allowOCR: boolean;
  allowQRLabels: boolean;
  allowDataExport: boolean;
}

export const FREE_PLAN_LIMITS: PlanLimits = {
  maxSuppliers: 3,
  maxProducts: 50,
  maxShipmentsPerMonth: 3,
  maxInvoicesPerMonth: 10,
  allowOCR: false,
  allowQRLabels: false,
  allowDataExport: false,
};

export const PAID_PLAN_LIMITS: PlanLimits = {
  maxSuppliers: Infinity,
  maxProducts: Infinity,
  maxShipmentsPerMonth: Infinity,
  maxInvoicesPerMonth: Infinity,
  allowOCR: true,
  allowQRLabels: true,
  allowDataExport: true,
};

export function getPlanLimits(status: SubscriptionStatus): PlanLimits {
  return status === 'PAID' ? PAID_PLAN_LIMITS : FREE_PLAN_LIMITS;
}

// Get current month boundaries in UTC
export function getCurrentMonthBoundaries(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export interface LimitCheckResult {
  allowed: boolean;
  errorCode?: string;
  message?: string;
  metadata?: {
    limit: number;
    current: number;
    resourceType: string;
  };
}
