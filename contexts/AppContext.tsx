import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';
import { SubscriptionStatus, PlanLimits, getPlanLimits, getCurrentMonthBoundaries, LimitCheckResult } from '../constants/planLimits';

// Types
export interface Supplier {
  id: string;
  user_id?: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  created_at?: string;
}

export interface Invoice {
  id: string;
  user_id?: string;
  supplier_id: string;
  customer_id?: string;
  invoice_number: string;
  date: string;
  amount: number;
  payment_status: string;
  image_uri?: string;
  created_at?: string;
}

export interface ProductInvoice {
  id: string;
  product_id: string;
  invoice_id: string;
  quantity: number;
  rate: number;
  created_at?: string;
}

export interface Product {
  id: string;
  user_id?: string;
  name: string;
  hs_code: string;
  quantity: number;
  available_quantity: number;
  unit: string;
  alternate_names: string[];
  invoices?: ProductInvoice[];
}

export interface BoxType {
  id: string;
  user_id?: string;
  name: string;
  dimensions: string;
  max_weight: number;
  empty_weight?: number;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface Box {
  id: string;
  user_id?: string;
  shipment_id: string;
  box_type_id: string;
  box_number: number;
  weight?: number;
  dimensions?: string;
  products: BoxProduct[];
}

export interface BoxProduct {
  product_id: string;
  quantity: number;
}

export interface Shipment {
  id: string;
  user_id?: string;
  customer_id?: string;
  name: string;
  lot_number?: string;
  destination: string;
  created_at?: string;
  boxes: Box[];
}

export interface Customer {
  id: string;
  user_id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  created_at?: string;
}

export interface Payment {
  id: string;
  user_id?: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
  created_at?: string;
}

export interface UserSettings {
  name: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  currency: string;
  subscription_status: SubscriptionStatus;
}

interface AppContextType {
  // User Settings
  userSettings: UserSettings;
  updateUserSettings: (updates: Partial<UserSettings>) => Promise<void>;

  // Subscription / Plan
  subscriptionStatus: SubscriptionStatus;
  planLimits: PlanLimits;
  checkSupplierLimit: () => LimitCheckResult;
  checkProductLimit: () => LimitCheckResult;
  checkShipmentLimit: () => LimitCheckResult;
  checkInvoiceLimit: () => LimitCheckResult;

  // Customers
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'created_at' | 'user_id'>) => Promise<void>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  getCustomerById: (id: string) => Customer | undefined;

  // Suppliers
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'created_at' | 'user_id'>) => Promise<string>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  checkSimilarSupplier: (name: string) => Supplier | null;
  
  // Invoices
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id' | 'user_id'>) => Promise<void>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  getInvoicesByCustomer: (customerId: string) => Invoice[];
  
  // Products
  products: Product[];
  addProduct: (product: { invoice_id: string; name: string; hs_code: string; quantity: number; rate: number; unit: string; alternate_names?: string[] }) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateProductQuantity: (id: string, quantityChange: number) => Promise<void>;
  
  // Box Types
  boxTypes: BoxType[];
  addBoxType: (boxType: Omit<BoxType, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  updateBoxType: (id: string, updates: Partial<BoxType>) => Promise<void>;
  deleteBoxType: (id: string) => Promise<void>;
  
  // Shipments
  shipments: Shipment[];
  addShipment: (shipment: Omit<Shipment, 'id' | 'created_at' | 'boxes' | 'user_id'>) => Promise<void>;
  updateShipment: (id: string, updates: Partial<Shipment>) => Promise<void>;
  deleteShipment: (id: string) => Promise<void>;
  addBoxToShipment: (shipmentId: string, box: Omit<Box, 'id' | 'shipment_id' | 'box_number' | 'user_id'>) => Promise<void>;
  removeBoxFromShipment: (shipmentId: string, boxId: string) => Promise<void>;
  updateBoxProducts: (shipmentId: string, boxId: string, products: Box['products']) => Promise<void>;
  getShipmentsByCustomer: (customerId: string) => Shipment[];
  getBoxById: (shipmentId: string, boxId: string) => Box | undefined;
  
  // Payments
  payments: Payment[];
  addPayment: (payment: Omit<Payment, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  getPaymentsByInvoice: (invoiceId: string) => Payment[];
  getInvoicePaidAmount: (invoiceId: string) => number;
  getInvoicePaymentStatus: (invoiceId: string, invoiceAmount: number) => 'unpaid' | 'partial' | 'paid';

  // Helpers
  getSupplierById: (id: string) => Supplier | undefined;
  getInvoicesBySupplier: (supplierId: string) => Invoice[];
  getProductsByInvoice: (invoiceId: string) => Product[];
  getProductById: (id: string) => Product | undefined;
  getBoxTypeById: (id: string) => BoxType | undefined;

  // Loading state
  loading: boolean;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultUserSettings: UserSettings = {
  name: '',
  email: '',
  address: '',
  city: '',
  state: '',
  country: '',
  currency: 'USD',
  subscription_status: 'FREE',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [userSettings, setUserSettings] = useState<UserSettings>(defaultUserSettings);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [boxTypes, setBoxTypes] = useState<BoxType[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Derived subscription state
  const subscriptionStatus: SubscriptionStatus = userSettings.subscription_status || 'FREE';
  const planLimits = getPlanLimits(subscriptionStatus);

  // Plan limit checks
  const checkSupplierLimit = (): LimitCheckResult => {
    if (subscriptionStatus === 'PAID') return { allowed: true };
    const current = suppliers.length;
    if (current >= planLimits.maxSuppliers) {
      return {
        allowed: false,
        errorCode: 'SUPPLIER_LIMIT_REACHED',
        message: `Free plan allows up to ${planLimits.maxSuppliers} suppliers. Upgrade to add more.`,
        metadata: { limit: planLimits.maxSuppliers, current, resourceType: 'suppliers' },
      };
    }
    return { allowed: true };
  };

  const checkProductLimit = (): LimitCheckResult => {
    if (subscriptionStatus === 'PAID') return { allowed: true };
    const current = products.length;
    if (current >= planLimits.maxProducts) {
      return {
        allowed: false,
        errorCode: 'PRODUCT_LIMIT_REACHED',
        message: `Free plan allows up to ${planLimits.maxProducts} products. Upgrade to add more.`,
        metadata: { limit: planLimits.maxProducts, current, resourceType: 'products' },
      };
    }
    return { allowed: true };
  };

  const checkShipmentLimit = (): LimitCheckResult => {
    if (subscriptionStatus === 'PAID') return { allowed: true };
    const { start, end } = getCurrentMonthBoundaries();
    const thisMonthCount = shipments.filter(s => {
      const created = s.created_at || '';
      return created >= start && created <= end;
    }).length;
    if (thisMonthCount >= planLimits.maxShipmentsPerMonth) {
      return {
        allowed: false,
        errorCode: 'SHIPMENT_LIMIT_REACHED',
        message: `Free plan allows up to ${planLimits.maxShipmentsPerMonth} shipments per month. Upgrade for unlimited.`,
        metadata: { limit: planLimits.maxShipmentsPerMonth, current: thisMonthCount, resourceType: 'shipments this month' },
      };
    }
    return { allowed: true };
  };

  const checkInvoiceLimit = (): LimitCheckResult => {
    if (subscriptionStatus === 'PAID') return { allowed: true };
    const { start, end } = getCurrentMonthBoundaries();
    const thisMonthCount = invoices.filter(inv => {
      const created = inv.created_at || '';
      return created >= start && created <= end;
    }).length;
    if (thisMonthCount >= planLimits.maxInvoicesPerMonth) {
      return {
        allowed: false,
        errorCode: 'INVOICE_LIMIT_REACHED',
        message: `Free plan allows up to ${planLimits.maxInvoicesPerMonth} invoices per month. Upgrade for unlimited.`,
        metadata: { limit: planLimits.maxInvoicesPerMonth, current: thisMonthCount, resourceType: 'invoices this month' },
      };
    }
    return { allowed: true };
  };

  // Load all data when user changes
  useEffect(() => {
    if (user?.id) {
      refreshData();
    } else {
      // Clear data when logged out
      setUserSettings(defaultUserSettings);
      setCustomers([]);
      setSuppliers([]);
      setInvoices([]);
      setProducts([]);
      setBoxTypes([]);
      setShipments([]);
      setPayments([]);
      setLoading(false);
    }
  }, [user?.id]);

  const refreshData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      await Promise.all([
        loadUserSettings(),
        loadCustomers(),
        loadSuppliers(),
        loadInvoices(),
        loadProducts(),
        loadBoxTypes(),
        loadShipments(),
        loadPayments(),
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load User Settings
  const loadUserSettings = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading user settings:', error);
      return;
    }

    if (data) {
      setUserSettings({
        name: data.name || '',
        email: data.email || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || '',
        currency: data.currency || 'USD',
        subscription_status: data.subscription_status || 'FREE',
      });
    } else {
      // Create default settings for new user
      const { data: newSettings, error: createError } = await supabase
        .from('user_settings')
        .insert([{ user_id: user.id, ...defaultUserSettings }])
        .select()
        .single();

      if (!createError && newSettings) {
        setUserSettings(defaultUserSettings);
      }
    }
  };

  const updateUserSettings = async (updates: Partial<UserSettings>) => {
    if (!user?.id) return;

    const newSettings = { ...userSettings, ...updates };
    const oldSettings = { ...userSettings };
    setUserSettings(newSettings);

    // Only send editable fields to the database (exclude subscription_status)
    const { subscription_status, ...editableFields } = newSettings;

    const { error } = await supabase
      .from('user_settings')
      .update({
        ...editableFields,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating user settings:', error);
      // Revert on error
      setUserSettings(oldSettings);
    }
  };

  // Load Customers
  const loadCustomers = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading customers:', error);
      return;
    }

    setCustomers(data || []);
  };

  const addCustomer = async (customer: Omit<Customer, 'id' | 'created_at' | 'user_id'>) => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('customers')
      .insert([{ ...customer, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('Error adding customer:', error);
      return;
    }

    if (data) {
      setCustomers(prev => [data, ...prev]);
    }
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const { error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating customer:', error);
      return;
    }

    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      return;
    }

    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const getCustomerById = (id: string) => customers.find(c => c.id === id);

  // Load Suppliers
  const loadSuppliers = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading suppliers:', error);
      return;
    }

    setSuppliers(data || []);
  };

  const checkSimilarSupplier = (name: string): Supplier | null => {
    const nameLower = name.toLowerCase().trim();
    const similar = suppliers.find(s => {
      const supplierNameLower = s.name.toLowerCase().trim();
      return supplierNameLower === nameLower || 
             supplierNameLower.includes(nameLower) || 
             nameLower.includes(supplierNameLower);
    });
    return similar || null;
  };

  const addSupplier = async (supplier: Omit<Supplier, 'id' | 'created_at' | 'user_id'>): Promise<string> => {
    if (!user?.id) return '';

    const { data, error } = await supabase
      .from('suppliers')
      .insert([{ ...supplier, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('Error adding supplier:', error);
      return '';
    }

    if (data) {
      setSuppliers(prev => [data, ...prev]);
      return data.id;
    }

    return '';
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    const { error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating supplier:', error);
      return;
    }

    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSupplier = async (id: string) => {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting supplier:', error);
      return;
    }

    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  // Load Invoices
  const loadInvoices = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error loading invoices:', error);
      return;
    }

    setInvoices(data || []);
  };

  const addInvoice = async (invoice: Omit<Invoice, 'id' | 'user_id'>) => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('invoices')
      .insert([{ ...invoice, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('Error adding invoice:', error);
      return;
    }

    if (data) {
      setInvoices(prev => [data, ...prev]);
    }
  };

  const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
    const { error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating invoice:', error);
      return;
    }

    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
  };

  const deleteInvoice = async (id: string) => {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting invoice:', error);
      return;
    }

    setInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  // Load Products with invoice relationships
  const loadProducts = async () => {
    if (!user?.id) return;

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id);

    if (productsError) {
      console.error('Error loading products:', productsError);
      return;
    }

    if (!productsData || productsData.length === 0) {
      setProducts([]);
      return;
    }

    // Load product-invoice relationships
    const productIds = productsData.map(p => p.id);
    const { data: productInvoicesData, error: piError } = await supabase
      .from('product_invoices')
      .select('*')
      .in('product_id', productIds);

    if (piError) {
      console.error('Error loading product invoices:', piError);
      return;
    }

    // Map invoices to products
    const productsWithInvoices = productsData.map(product => ({
      ...product,
      invoices: (productInvoicesData || []).filter(pi => pi.product_id === product.id),
    }));

    setProducts(productsWithInvoices);
  };

  const addProduct = async (product: { 
    invoice_id: string; 
    name: string; 
    hs_code: string; 
    quantity: number; 
    rate: number; 
    unit: string; 
    alternate_names?: string[] 
  }) => {
    if (!user?.id) return;

    try {
      // Check if product already exists (by name and HS code)
      const nameLower = product.name.toLowerCase().trim();
      const existingProduct = products.find(p => 
        p.name.toLowerCase().trim() === nameLower && 
        p.hs_code === product.hs_code
      );

      if (existingProduct) {
        // Check if this invoice is already linked
        const alreadyLinked = existingProduct.invoices?.some(pi => pi.invoice_id === product.invoice_id);
        
        if (alreadyLinked) {
          console.log('Product already added from this invoice, skipping duplicate');
          return;
        }

        // Link to existing product
        const { data: piData, error: piError } = await supabase
          .from('product_invoices')
          .insert([{
            product_id: existingProduct.id,
            invoice_id: product.invoice_id,
            quantity: product.quantity,
            rate: product.rate,
          }])
          .select()
          .single();

        if (piError) {
          console.error('Error linking product to invoice:', piError);
          return;
        }

        // Update product total quantity
        const newTotalQuantity = existingProduct.quantity + product.quantity;
        const newAvailableQuantity = existingProduct.available_quantity + product.quantity;

        await supabase
          .from('products')
          .update({
            quantity: newTotalQuantity,
            available_quantity: newAvailableQuantity,
          })
          .eq('id', existingProduct.id);

        // Refresh products to get updated data
        await loadProducts();
        return;
      }

      // Create new product
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert([{
          user_id: user.id,
          name: product.name,
          hs_code: product.hs_code,
          quantity: product.quantity,
          available_quantity: product.quantity,
          unit: product.unit,
          alternate_names: product.alternate_names || [],
        }])
        .select()
        .single();

      if (productError || !newProduct) {
        console.error('Error creating product:', productError);
        return;
      }

      // Link to invoice
      const { error: piError } = await supabase
        .from('product_invoices')
        .insert([{
          product_id: newProduct.id,
          invoice_id: product.invoice_id,
          quantity: product.quantity,
          rate: product.rate,
        }]);

      if (piError) {
        console.error('Error linking product to invoice:', piError);
        return;
      }

      // Refresh products
      await loadProducts();
    } catch (error) {
      console.error('Error in addProduct:', error);
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating product:', error);
      return;
    }

    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      return;
    }

    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const updateProductQuantity = async (id: string, quantityChange: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const newAvailable = Math.max(0, product.available_quantity + quantityChange);

    await updateProduct(id, { available_quantity: newAvailable });
  };

  // Load Box Types
  const loadBoxTypes = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('box_types')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading box types:', error);
      return;
    }

    setBoxTypes(data || []);
  };

  const addBoxType = async (boxType: Omit<BoxType, 'id' | 'user_id' | 'created_at'>) => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('box_types')
      .insert([{ ...boxType, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('Error adding box type:', error);
      return;
    }

    if (data) {
      setBoxTypes(prev => [data, ...prev]);
    }
  };

  const updateBoxType = async (id: string, updates: Partial<BoxType>) => {
    const { error } = await supabase
      .from('box_types')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating box type:', error);
      return;
    }

    setBoxTypes(prev => prev.map(bt => bt.id === id ? { ...bt, ...updates } : bt));
  };

  const deleteBoxType = async (id: string) => {
    const { error } = await supabase
      .from('box_types')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting box type:', error);
      return;
    }

    setBoxTypes(prev => prev.filter(bt => bt.id !== id));
  };

  // Load Shipments (with boxes and box_products)
  const loadShipments = async () => {
    if (!user?.id) return;

    const { data: shipmentsData, error: shipmentsError } = await supabase
      .from('shipments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (shipmentsError) {
      console.error('Error loading shipments:', shipmentsError);
      return;
    }

    if (!shipmentsData || shipmentsData.length === 0) {
      setShipments([]);
      return;
    }

    // Load boxes for all shipments
    const shipmentIds = shipmentsData.map(s => s.id);
    const { data: boxesData, error: boxesError } = await supabase
      .from('boxes')
      .select('*')
      .in('shipment_id', shipmentIds)
      .order('box_number', { ascending: true });

    if (boxesError) {
      console.error('Error loading boxes:', boxesError);
      return;
    }

    // Load box products
    const boxIds = (boxesData || []).map(b => b.id);
    let boxProductsData: any[] = [];
    if (boxIds.length > 0) {
      const { data: bpData, error: boxProductsError } = await supabase
        .from('box_products')
        .select('*')
        .in('box_id', boxIds);

      if (boxProductsError) {
        console.error('Error loading box products:', boxProductsError);
      } else {
        boxProductsData = bpData || [];
      }
    }

    // Organize data
    const boxesMap = new Map<string, Box[]>();
    (boxesData || []).forEach(box => {
      const products = boxProductsData
        .filter(bp => bp.box_id === box.id)
        .map(bp => ({
          product_id: bp.product_id,
          quantity: bp.quantity,
        }));

      const boxWithProducts: Box = {
        id: box.id,
        user_id: box.user_id,
        shipment_id: box.shipment_id,
        box_type_id: box.box_type_id,
        box_number: box.box_number,
        weight: box.weight,
        dimensions: box.dimensions,
        products,
      };

      if (!boxesMap.has(box.shipment_id)) {
        boxesMap.set(box.shipment_id, []);
      }
      boxesMap.get(box.shipment_id)!.push(boxWithProducts);
    });

    const shipmentsWithBoxes = shipmentsData.map(shipment => ({
      ...shipment,
      boxes: boxesMap.get(shipment.id) || [],
    }));

    setShipments(shipmentsWithBoxes);
  };

  const addShipment = async (shipment: Omit<Shipment, 'id' | 'created_at' | 'boxes' | 'user_id'>) => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('shipments')
      .insert([{ ...shipment, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('Error adding shipment:', error);
      return;
    }

    if (data) {
      setShipments(prev => [{ ...data, boxes: [] }, ...prev]);
    }
  };

  const updateShipment = async (id: string, updates: Partial<Shipment>) => {
    const { error } = await supabase
      .from('shipments')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating shipment:', error);
      return;
    }

    setShipments(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteShipment = async (id: string) => {
    // Return products to inventory
    const shipment = shipments.find(s => s.id === id);
    if (shipment) {
      for (const box of shipment.boxes) {
        for (const bp of box.products) {
          await updateProductQuantity(bp.product_id, bp.quantity);
        }
      }
    }

    const { error } = await supabase
      .from('shipments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting shipment:', error);
      return;
    }

    setShipments(prev => prev.filter(s => s.id !== id));
  };

  const addBoxToShipment = async (shipmentId: string, box: Omit<Box, 'id' | 'shipment_id' | 'box_number' | 'user_id'>) => {
    if (!user?.id) return;

    const shipment = shipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    const boxNumber = shipment.boxes.length + 1;

    const { data: newBox, error: boxError } = await supabase
      .from('boxes')
      .insert([{
        user_id: user.id,
        shipment_id: shipmentId,
        box_type_id: box.box_type_id,
        box_number: boxNumber,
        weight: box.weight,
        dimensions: box.dimensions,
      }])
      .select()
      .single();

    if (boxError) {
      console.error('Error adding box:', boxError);
      return;
    }

    if (newBox && box.products.length > 0) {
      const boxProducts = box.products.map(p => ({
        box_id: newBox.id,
        product_id: p.product_id,
        quantity: p.quantity,
      }));

      const { error: productsError } = await supabase
        .from('box_products')
        .insert(boxProducts);

      if (productsError) {
        console.error('Error adding box products:', productsError);
        return;
      }
    }

    await loadShipments();
  };

  const removeBoxFromShipment = async (shipmentId: string, boxId: string) => {
    const shipment = shipments.find(s => s.id === shipmentId);
    const box = shipment?.boxes.find(b => b.id === boxId);
    
    // Return products to inventory
    if (box) {
      for (const bp of box.products) {
        await updateProductQuantity(bp.product_id, bp.quantity);
      }
    }

    const { error } = await supabase
      .from('boxes')
      .delete()
      .eq('id', boxId);

    if (error) {
      console.error('Error removing box:', error);
      return;
    }

    await loadShipments();
  };

  const updateBoxProducts = async (shipmentId: string, boxId: string, newProducts: Box['products']) => {
    const shipment = shipments.find(s => s.id === shipmentId);
    const box = shipment?.boxes.find(b => b.id === boxId);
    
    if (box) {
      // Calculate differences and update inventory
      const oldProductMap = new Map(box.products.map(p => [p.product_id, p.quantity]));
      const newProductMap = new Map(newProducts.map(p => [p.product_id, p.quantity]));
      
      for (const [productId, oldQty] of oldProductMap) {
        const newQty = newProductMap.get(productId) || 0;
        if (newQty < oldQty) {
          await updateProductQuantity(productId, oldQty - newQty);
        }
      }
      
      for (const [productId, newQty] of newProductMap) {
        const oldQty = oldProductMap.get(productId) || 0;
        if (newQty > oldQty) {
          await updateProductQuantity(productId, -(newQty - oldQty));
        }
      }
    }

    await supabase
      .from('box_products')
      .delete()
      .eq('box_id', boxId);

    if (newProducts.length > 0) {
      const boxProducts = newProducts.map(p => ({
        box_id: boxId,
        product_id: p.product_id,
        quantity: p.quantity,
      }));

      await supabase
        .from('box_products')
        .insert(boxProducts);
    }

    await loadShipments();
  };

  const getShipmentsByCustomer = (customerId: string) => 
    shipments.filter(s => s.customer_id === customerId);

  const getBoxById = (shipmentId: string, boxId: string) => {
    const shipment = shipments.find(s => s.id === shipmentId);
    return shipment?.boxes.find(b => b.id === boxId);
  };

  // Helper functions
  const getSupplierById = (id: string) => suppliers.find(s => s.id === id);
  const getInvoicesBySupplier = (supplierId: string) => invoices.filter(inv => inv.supplier_id === supplierId);
  const getInvoicesByCustomer = (customerId: string) => invoices.filter(inv => inv.customer_id === customerId);
  const getProductsByInvoice = (invoiceId: string) => {
    return products.filter(p => p.invoices?.some(pi => pi.invoice_id === invoiceId));
  };
  const getProductById = (id: string) => products.find(p => p.id === id);
  const getBoxTypeById = (id: string) => boxTypes.find(bt => bt.id === id);

  // Load Payments
  const loadPayments = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error loading payments:', error);
      return;
    }

    setPayments(data || []);
  };

  const addPayment = async (payment: Omit<Payment, 'id' | 'user_id' | 'created_at'>) => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('payments')
      .insert([{ ...payment, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('Error adding payment:', error);
      return;
    }

    if (data) {
      setPayments(prev => [data, ...prev]);

      const invoice = invoices.find(inv => inv.id === payment.invoice_id);
      if (invoice) {
        const totalPaid = getPaymentsByInvoice(payment.invoice_id).reduce((sum, p) => sum + p.amount, 0) + payment.amount;
        const newStatus = totalPaid >= invoice.amount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
        if (newStatus !== invoice.payment_status) {
          await updateInvoice(invoice.id, { payment_status: newStatus });
        }
      }
    }
  };

  const deletePayment = async (id: string) => {
    const payment = payments.find(p => p.id === id);
    
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting payment:', error);
      return;
    }

    setPayments(prev => prev.filter(p => p.id !== id));

    if (payment) {
      const invoice = invoices.find(inv => inv.id === payment.invoice_id);
      if (invoice) {
        const remainingPayments = payments.filter(p => p.id !== id && p.invoice_id === payment.invoice_id);
        const totalPaid = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
        const newStatus = totalPaid >= invoice.amount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
        if (newStatus !== invoice.payment_status) {
          await updateInvoice(invoice.id, { payment_status: newStatus });
        }
      }
    }
  };

  const getPaymentsByInvoice = (invoiceId: string) => 
    payments.filter(p => p.invoice_id === invoiceId);

  const getInvoicePaidAmount = (invoiceId: string) => 
    payments.filter(p => p.invoice_id === invoiceId).reduce((sum, p) => sum + p.amount, 0);

  const getInvoicePaymentStatus = (invoiceId: string, invoiceAmount: number): 'unpaid' | 'partial' | 'paid' => {
    const paidAmount = getInvoicePaidAmount(invoiceId);
    if (paidAmount >= invoiceAmount) return 'paid';
    if (paidAmount > 0) return 'partial';
    return 'unpaid';
  };

  return (
    <AppContext.Provider value={{
      userSettings,
      updateUserSettings,
      subscriptionStatus,
      planLimits,
      checkSupplierLimit,
      checkProductLimit,
      checkShipmentLimit,
      checkInvoiceLimit,
      customers,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      getCustomerById,
      suppliers,
      addSupplier,
      updateSupplier,
      deleteSupplier,
      checkSimilarSupplier,
      invoices,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      getInvoicesByCustomer,
      products,
      addProduct,
      updateProduct,
      deleteProduct,
      updateProductQuantity,
      boxTypes,
      addBoxType,
      updateBoxType,
      deleteBoxType,
      shipments,
      addShipment,
      updateShipment,
      deleteShipment,
      addBoxToShipment,
      removeBoxFromShipment,
      updateBoxProducts,
      getShipmentsByCustomer,
      getBoxById,
      payments,
      addPayment,
      deletePayment,
      getPaymentsByInvoice,
      getInvoicePaidAmount,
      getInvoicePaymentStatus,
      getSupplierById,
      getInvoicesBySupplier,
      getProductsByInvoice,
      getProductById,
      getBoxTypeById,
      loading,
      refreshData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
