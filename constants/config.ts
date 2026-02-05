// App Configuration
export const APP_NAME = 'ExportPro';

export const INVOICE_STATUS = {
  PENDING: 'pending',
  PROCESSED: 'processed',
  ARCHIVED: 'archived',
} as const;

export const SHIPMENT_STATUS = {
  DRAFT: 'draft',
  PACKING: 'packing',
  READY: 'ready',
  SHIPPED: 'shipped',
} as const;

export const DEFAULT_BOX_TYPES = [
  { id: 'small', name: 'Small Box', length: 30, width: 25, height: 20, weight: 0.5 },
  { id: 'medium', name: 'Medium Box', length: 45, width: 35, height: 30, weight: 0.8 },
  { id: 'large', name: 'Large Box', length: 60, width: 45, height: 40, weight: 1.2 },
  { id: 'xlarge', name: 'Extra Large', length: 80, width: 60, height: 50, weight: 1.8 },
];

export const COMMON_HS_CODES = [
  { code: '6204', description: 'Women\'s suits, dresses, skirts' },
  { code: '6203', description: 'Men\'s suits, jackets, trousers' },
  { code: '6109', description: 'T-shirts, singlets, tank tops' },
  { code: '6110', description: 'Sweaters, pullovers, cardigans' },
  { code: '6205', description: 'Men\'s shirts' },
  { code: '6206', description: 'Women\'s blouses, shirts' },
  { code: '4202', description: 'Bags, cases, wallets' },
  { code: '6402', description: 'Footwear with rubber/plastic soles' },
  { code: '9403', description: 'Furniture' },
  { code: '8471', description: 'Computers and processors' },
];

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
} as const;

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY', 'JPY', 'INR', 'AUD', 'CAD'];

export const COUNTRIES = [
  'United States', 'United Kingdom', 'Germany', 'France', 'Italy', 'Spain',
  'China', 'India', 'Vietnam', 'Bangladesh', 'Thailand', 'Indonesia',
  'Canada', 'Australia', 'Japan', 'South Korea', 'Singapore', 'UAE',
];
