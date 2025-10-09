// From Supabase schema, assuming standard fields
type Base = {
  id: string;
  created_at: string;
};

// Unit Type
export type Unit = Base & {
  name: string;
  abbreviation: string;
};
export type UnitInsert = Omit<Unit, 'id' | 'created_at'>;
export type UnitUpdate = Partial<UnitInsert>;

// Category Type
export type Category = Base & {
  name: string;
  description: string | null;
};
export type CategoryInsert = Omit<Category, 'id' | 'created_at'>;
export type CategoryUpdate = Partial<CategoryInsert>;

// Based on ProductForm.tsx and ProductsPage.tsx
export type Product = Base & {
  name: string;
  description: string | null;
  hsn_code: string | null;
  sku: string | null;
  stock_quantity: number;
  tax_rate: number; // Stored as decimal, e.g., 0.18 for 18%
  unit_price: number;
  unit_id: string | null;
  category_id: string | null;
  units?: Pick<Unit, 'abbreviation'> | null;
  categories?: Pick<Category, 'name'> | null;
};
export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'units' | 'categories'>;
export type ProductUpdate = Partial<ProductInsert>;

// Based on CustomerForm.tsx and CustomersPage.tsx
export type Customer = Base & {
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  billing_address: string | null;
  is_guest: boolean;
};
export type CustomerInsert = Omit<Customer, 'id' | 'created_at'>;
export type CustomerUpdate = Partial<CustomerInsert>;

// Based on PurchaseForm.tsx and PurchasesPage.tsx
export type Purchase = Base & {
  product_id: string;
  purchase_date: string;
  reference_invoice: string | null;
  quantity: number;
};
export type PurchaseWithProduct = Purchase & {
  products: { name: string } | null;
};
export type PurchaseInsert = Omit<Purchase, 'id' | 'created_at'>;
export type PurchaseUpdate = Partial<PurchaseInsert>;

// For InvoicesPage.tsx
export type InvoiceItem = Base & {
    invoice_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    // Fix: Widened the type of products to include 'units' for display on the invoice template.
    products?: Pick<Product, 'name' | 'units'>; // Optional relation
};

export type Invoice = Base & {
    customer_id: string;
    invoice_number: string;
    invoice_date: string;
    total_amount: number;
    customers?: Pick<Customer, 'name'>; // Optional relation
    invoice_items?: InvoiceItem[]; // Optional relation
};

export type InvoiceWithDetails = Invoice & {
    customers: Pick<Customer, 'name'> | null;
};

export type InvoiceInsert = Omit<Invoice, 'id' | 'created_at' | 'customers' | 'invoice_items'>;
export type InvoiceUpdate = Partial<InvoiceInsert>;