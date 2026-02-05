// Mock Data for ExportPro
import { INVOICE_STATUS, SHIPMENT_STATUS, PAYMENT_STATUS } from '../constants/config';

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  supplierId: string;
  invoiceNumber: string;
  date: string;
  status: string;
  imageUri?: string;
  images?: string[];
  totalAmount: number;
  currency: string;
  paidAmount?: number;
  paymentStatus?: string;
  customerId?: string;
}

export interface Product {
  id: string;
  invoiceId: string;
  name: string;
  hsCode: string;
  alternateNames: string[];
  quantity: number;
  availableQuantity: number;
  rate: number;
  unit: string;
}

export interface BoxType {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  isCustom: boolean;
}

export interface Box {
  id: string;
  shipmentId: string;
  boxTypeId: string;
  boxNumber: number;
  netWeight: number;
  grossWeight: number;
  products: BoxProduct[];
}

export interface BoxProduct {
  productId: string;
  quantity: number;
}

export interface Shipment {
  id: string;
  name: string;
  destination: string;
  status: string;
  createdAt: string;
  customerId?: string;
  lotNumber?: string;
  boxes: Box[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  createdAt: string;
}

export interface UserSettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  currency: string;
}

// Suppliers
export const mockSuppliers: Supplier[] = [
  { id: 's1', name: 'Shanghai Textiles Co.', contactPerson: 'Li Wei', email: 'liwei@shanghaitex.cn', phone: '+86 21 5555 1234', address: '888 Nanjing Road, Pudong', country: 'China', createdAt: '2024-01-15' },
  { id: 's2', name: 'Vietnam Garments Ltd.', contactPerson: 'Nguyen Thi', email: 'nguyen@vietgarments.vn', phone: '+84 28 3333 5678', address: '456 Le Loi Street, District 1', country: 'Vietnam', createdAt: '2024-02-20' },
  { id: 's3', name: 'Bangladesh Fashion Hub', contactPerson: 'Rahman Ahmed', email: 'rahman@bdfashion.bd', phone: '+880 2 9999 4321', address: '123 Gulshan Avenue, Dhaka', country: 'Bangladesh', createdAt: '2024-03-10' },
  { id: 's4', name: 'India Exports Pvt Ltd', contactPerson: 'Priya Sharma', email: 'priya@indiaexports.in', phone: '+91 22 4444 8765', address: '789 MG Road, Mumbai', country: 'India', createdAt: '2024-03-25' },
  { id: 's5', name: 'Thai Manufacturing Co.', contactPerson: 'Somchai Prasert', email: 'somchai@thaimfg.th', phone: '+66 2 7777 2345', address: '321 Sukhumvit Road, Bangkok', country: 'Thailand', createdAt: '2024-04-05' },
  { id: 's6', name: 'Indonesia Tekstil', contactPerson: 'Budi Santoso', email: 'budi@idtekstil.id', phone: '+62 21 8888 6543', address: '567 Jalan Sudirman, Jakarta', country: 'Indonesia', createdAt: '2024-04-18' },
];

// Invoices
export const mockInvoices: Invoice[] = [
  { id: 'inv1', supplierId: 's1', invoiceNumber: 'INV-2024-001', date: '2024-06-01', status: INVOICE_STATUS.PROCESSED, totalAmount: 15000, currency: 'USD' },
  { id: 'inv2', supplierId: 's1', invoiceNumber: 'INV-2024-002', date: '2024-06-15', status: INVOICE_STATUS.PROCESSED, totalAmount: 22500, currency: 'USD' },
  { id: 'inv3', supplierId: 's2', invoiceNumber: 'VG-2024-088', date: '2024-06-10', status: INVOICE_STATUS.PROCESSED, totalAmount: 18000, currency: 'USD' },
  { id: 'inv4', supplierId: 's3', invoiceNumber: 'BDF-24-155', date: '2024-06-20', status: INVOICE_STATUS.PENDING, totalAmount: 9500, currency: 'USD' },
  { id: 'inv5', supplierId: 's4', invoiceNumber: 'IE-2024-0456', date: '2024-06-25', status: INVOICE_STATUS.PENDING, totalAmount: 31000, currency: 'USD' },
  { id: 'inv6', supplierId: 's5', invoiceNumber: 'TM-240701', date: '2024-07-01', status: INVOICE_STATUS.PENDING, totalAmount: 12750, currency: 'USD' },
];

// Products
export const mockProducts: Product[] = [
  { id: 'p1', invoiceId: 'inv1', name: 'Cotton T-Shirts (White)', hsCode: '6109', alternateNames: ['White Tee', 'Basic Cotton T'], quantity: 500, availableQuantity: 420, rate: 4.50, unit: 'pcs' },
  { id: 'p2', invoiceId: 'inv1', name: 'Cotton T-Shirts (Black)', hsCode: '6109', alternateNames: ['Black Tee'], quantity: 500, availableQuantity: 380, rate: 4.50, unit: 'pcs' },
  { id: 'p3', invoiceId: 'inv1', name: 'Polo Shirts (Navy)', hsCode: '6105', alternateNames: ['Navy Polo'], quantity: 300, availableQuantity: 300, rate: 8.00, unit: 'pcs' },
  { id: 'p4', invoiceId: 'inv2', name: 'Denim Jeans (Blue)', hsCode: '6203', alternateNames: ['Blue Jeans', 'Denim Pants'], quantity: 400, availableQuantity: 250, rate: 12.50, unit: 'pcs' },
  { id: 'p5', invoiceId: 'inv2', name: 'Casual Shorts', hsCode: '6203', alternateNames: ['Summer Shorts'], quantity: 350, availableQuantity: 350, rate: 7.00, unit: 'pcs' },
  { id: 'p6', invoiceId: 'inv3', name: 'Women\'s Blouse (Floral)', hsCode: '6206', alternateNames: ['Floral Top'], quantity: 600, availableQuantity: 450, rate: 9.50, unit: 'pcs' },
  { id: 'p7', invoiceId: 'inv3', name: 'Women\'s Skirt (A-Line)', hsCode: '6204', alternateNames: ['A-Line Skirt'], quantity: 400, availableQuantity: 400, rate: 11.00, unit: 'pcs' },
  { id: 'p8', invoiceId: 'inv4', name: 'Men\'s Dress Shirt', hsCode: '6205', alternateNames: ['Formal Shirt'], quantity: 250, availableQuantity: 250, rate: 14.00, unit: 'pcs' },
  { id: 'p9', invoiceId: 'inv4', name: 'Sweater (Wool Blend)', hsCode: '6110', alternateNames: ['Wool Sweater'], quantity: 200, availableQuantity: 200, rate: 18.50, unit: 'pcs' },
  { id: 'p10', invoiceId: 'inv5', name: 'Leather Handbag', hsCode: '4202', alternateNames: ['Leather Bag', 'Ladies Purse'], quantity: 150, availableQuantity: 150, rate: 45.00, unit: 'pcs' },
  { id: 'p11', invoiceId: 'inv5', name: 'Canvas Tote Bag', hsCode: '4202', alternateNames: ['Tote', 'Shopping Bag'], quantity: 300, availableQuantity: 300, rate: 12.00, unit: 'pcs' },
  { id: 'p12', invoiceId: 'inv5', name: 'Wallet (Bifold)', hsCode: '4202', alternateNames: ['Leather Wallet'], quantity: 500, availableQuantity: 500, rate: 8.50, unit: 'pcs' },
  { id: 'p13', invoiceId: 'inv6', name: 'Running Shoes', hsCode: '6402', alternateNames: ['Sports Shoes', 'Sneakers'], quantity: 200, availableQuantity: 200, rate: 28.00, unit: 'pairs' },
  { id: 'p14', invoiceId: 'inv6', name: 'Sandals (Leather)', hsCode: '6403', alternateNames: ['Leather Sandals'], quantity: 250, availableQuantity: 250, rate: 15.00, unit: 'pairs' },
  { id: 'p15', invoiceId: 'inv1', name: 'Tank Tops (Assorted)', hsCode: '6109', alternateNames: ['Singlets', 'Sleeveless Tops'], quantity: 400, availableQuantity: 400, rate: 3.50, unit: 'pcs' },
  { id: 'p16', invoiceId: 'inv2', name: 'Cargo Pants', hsCode: '6203', alternateNames: ['Work Pants'], quantity: 200, availableQuantity: 200, rate: 15.00, unit: 'pcs' },
  { id: 'p17', invoiceId: 'inv3', name: 'Maxi Dress', hsCode: '6204', alternateNames: ['Long Dress', 'Summer Dress'], quantity: 180, availableQuantity: 180, rate: 22.00, unit: 'pcs' },
  { id: 'p18', invoiceId: 'inv4', name: 'Cardigan (Cotton)', hsCode: '6110', alternateNames: ['Cotton Cardigan'], quantity: 150, availableQuantity: 150, rate: 16.00, unit: 'pcs' },
  { id: 'p19', invoiceId: 'inv5', name: 'Backpack (Nylon)', hsCode: '4202', alternateNames: ['Travel Backpack'], quantity: 120, availableQuantity: 120, rate: 25.00, unit: 'pcs' },
  { id: 'p20', invoiceId: 'inv6', name: 'Flip Flops', hsCode: '6402', alternateNames: ['Beach Sandals', 'Thongs'], quantity: 500, availableQuantity: 500, rate: 4.00, unit: 'pairs' },
];

// Box Types
export const mockBoxTypes: BoxType[] = [
  { id: 'bt1', name: 'Small Carton', length: 30, width: 25, height: 20, weight: 0.5, isCustom: false },
  { id: 'bt2', name: 'Medium Carton', length: 45, width: 35, height: 30, weight: 0.8, isCustom: false },
  { id: 'bt3', name: 'Large Carton', length: 60, width: 45, height: 40, weight: 1.2, isCustom: false },
  { id: 'bt4', name: 'Extra Large', length: 80, width: 60, height: 50, weight: 1.8, isCustom: false },
  { id: 'bt5', name: 'Shoe Box Standard', length: 35, width: 22, height: 15, weight: 0.3, isCustom: true },
  { id: 'bt6', name: 'Garment Box', length: 70, width: 50, height: 25, weight: 1.0, isCustom: true },
];

// Shipments
// Customers
export const mockCustomers: Customer[] = [
  { id: 'c1', name: 'American Fashion Retail Inc', email: 'orders@amfashion.com', phone: '+1 212 555 0100', address: '1234 Broadway', city: 'New York', state: 'NY', country: 'United States', createdAt: '2024-01-10' },
  { id: 'c2', name: 'Euro Style GmbH', email: 'purchasing@eurostyle.de', phone: '+49 40 1234 5678', address: 'Hafenstraße 88', city: 'Hamburg', state: 'Hamburg', country: 'Germany', createdAt: '2024-02-15' },
  { id: 'c3', name: 'Sydney Fashion House Pty', email: 'info@sydneyfashion.com.au', phone: '+61 2 9999 8888', address: '456 George Street', city: 'Sydney', state: 'NSW', country: 'Australia', createdAt: '2024-03-01' },
  { id: 'c4', name: 'Toronto Retail Group', email: 'supply@torontoretail.ca', phone: '+1 416 777 9999', address: '789 Yonge Street', city: 'Toronto', state: 'ON', country: 'Canada', createdAt: '2024-04-05' },
];

// Default User Settings
export const defaultUserSettings: UserSettings = {
  name: 'Your Company Name',
  email: 'contact@yourcompany.com',
  phone: '+1 000 000 0000',
  address: '123 Export Street',
  city: 'Export City',
  state: 'State',
  country: 'Country',
  currency: 'USD',
};

export const mockShipments: Shipment[] = [
  {
    id: 'sh1',
    name: 'US Summer Collection',
    destination: 'New York, USA',
    status: SHIPMENT_STATUS.PACKING,
    createdAt: '2024-07-01',
    customerId: 'c1',
    lotNumber: 'LOT-2024-001',
    boxes: [
      { id: 'b1', shipmentId: 'sh1', boxTypeId: 'bt2', boxNumber: 1, netWeight: 12.5, grossWeight: 13.3, products: [{ productId: 'p1', quantity: 50 }, { productId: 'p2', quantity: 50 }] },
      { id: 'b2', shipmentId: 'sh1', boxTypeId: 'bt2', boxNumber: 2, netWeight: 15.0, grossWeight: 15.8, products: [{ productId: 'p4', quantity: 40 }] },
      { id: 'b3', shipmentId: 'sh1', boxTypeId: 'bt3', boxNumber: 3, netWeight: 18.5, grossWeight: 19.7, products: [{ productId: 'p6', quantity: 80 }] },
    ],
  },
  {
    id: 'sh2',
    name: 'EU Fashion Order',
    destination: 'Hamburg, Germany',
    status: SHIPMENT_STATUS.DRAFT,
    createdAt: '2024-07-05',
    customerId: 'c2',
    lotNumber: 'LOT-2024-002',
    boxes: [],
  },
  {
    id: 'sh3',
    name: 'Australia Retail',
    destination: 'Sydney, Australia',
    status: SHIPMENT_STATUS.READY,
    createdAt: '2024-06-20',
    customerId: 'c3',
    lotNumber: 'LOT-2024-003',
    boxes: [
      { id: 'b4', shipmentId: 'sh3', boxTypeId: 'bt3', boxNumber: 1, netWeight: 22.0, grossWeight: 23.2, products: [{ productId: 'p1', quantity: 30 }, { productId: 'p2', quantity: 40 }, { productId: 'p15', quantity: 60 }] },
      { id: 'b5', shipmentId: 'sh3', boxTypeId: 'bt2', boxNumber: 2, netWeight: 14.5, grossWeight: 15.3, products: [{ productId: 'p4', quantity: 60 }] },
      { id: 'b6', shipmentId: 'sh3', boxTypeId: 'bt2', boxNumber: 3, netWeight: 11.0, grossWeight: 11.8, products: [{ productId: 'p5', quantity: 50 }] },
      { id: 'b7', shipmentId: 'sh3', boxTypeId: 'bt6', boxNumber: 4, netWeight: 8.5, grossWeight: 9.5, products: [{ productId: 'p6', quantity: 70 }] },
    ],
  },
  {
    id: 'sh4',
    name: 'Canada Winter Stock',
    destination: 'Toronto, Canada',
    status: SHIPMENT_STATUS.SHIPPED,
    createdAt: '2024-06-01',
    customerId: 'c4',
    lotNumber: 'LOT-2024-004',
    boxes: [
      { id: 'b8', shipmentId: 'sh4', boxTypeId: 'bt3', boxNumber: 1, netWeight: 25.0, grossWeight: 26.2, products: [{ productId: 'p9', quantity: 50 }] },
    ],
  },
];

// Helper functions
export function getSupplierById(id: string): Supplier | undefined {
  return mockSuppliers.find(s => s.id === id);
}

export function getInvoicesBySupplier(supplierId: string): Invoice[] {
  return mockInvoices.filter(inv => inv.supplierId === supplierId);
}

export function getProductsByInvoice(invoiceId: string): Product[] {
  return mockProducts.filter(p => p.invoiceId === invoiceId);
}

export function getBoxTypeById(id: string): BoxType | undefined {
  return mockBoxTypes.find(bt => bt.id === id);
}

export function getProductById(id: string): Product | undefined {
  return mockProducts.find(p => p.id === id);
}

export function calculateCBM(length: number, width: number, height: number): number {
  return (length * width * height) / 1000000;
}

export function getTotalInventoryValue(): number {
  return mockProducts.reduce((sum, p) => sum + (p.availableQuantity * p.rate), 0);
}

export function getTotalInventoryItems(): number {
  return mockProducts.reduce((sum, p) => sum + p.availableQuantity, 0);
}
