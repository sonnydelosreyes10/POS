// Illustrative sample data from the design handoff. Replace with the product API (spec §8).
export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  category: Category;
  price: number; // VAT-inclusive
  unit: string;
  stock: number;
  vatExempt: boolean;
  avgCost: number;
  reorder: number;
  max: number;
}

export const CATEGORIES = ['Canned', 'Staples', 'Beverages', 'Condiments', 'Household', 'Bakery'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATALOG: Product[] = [
  { id: 1042, sku: 'GRO-SRD-155', barcode: '4800016641503', name: 'Canned sardines 155 g', category: 'Canned', price: 28, unit: 'pc', stock: 145, vatExempt: false, avgCost: 21.4, reorder: 60, max: 240 },
  { id: 1088, sku: 'GRO-RIC-5KG', barcode: '4806509112235', name: 'Rice 5 kg', category: 'Staples', price: 280, unit: 'pack', stock: 38, vatExempt: true, avgCost: 244, reorder: 40, max: 60 },
  { id: 1103, sku: 'GRO-NDL-055', barcode: '4800016012341', name: 'Instant noodles 55 g', category: 'Canned', price: 12.5, unit: 'pc', stock: 240, vatExempt: false, avgCost: 9.8, reorder: 120, max: 480 },
  { id: 1121, sku: 'BEV-COF-3N1', barcode: '4800361412346', name: 'Coffee 3-in-1 sachet', category: 'Beverages', price: 8, unit: 'pc', stock: 412, vatExempt: false, avgCost: 6.2, reorder: 200, max: 600 },
  { id: 1150, sku: 'GRO-SOY-1L', barcode: '4800092771231', name: 'Soy sauce 1 L', category: 'Condiments', price: 62, unit: 'pc', stock: 26, vatExempt: false, avgCost: 48.5, reorder: 26, max: 60 },
  { id: 1166, sku: 'HHC-SOP-BAR', barcode: '4800888123456', name: 'Bar soap 90 g', category: 'Household', price: 32, unit: 'pc', stock: 88, vatExempt: false, avgCost: 24.75, reorder: 40, max: 160 },
  { id: 1180, sku: 'BEV-SFT-15L', barcode: '4801234567890', name: 'Softdrink 1.5 L', category: 'Beverages', price: 75, unit: 'pc', stock: 64, vatExempt: false, avgCost: 58, reorder: 36, max: 120 },
  { id: 1194, sku: 'GRO-OIL-1L', barcode: '4800112233445', name: 'Cooking oil 1 L', category: 'Staples', price: 98, unit: 'pc', stock: 19, vatExempt: false, avgCost: 78, reorder: 20, max: 60 },
  { id: 1201, sku: 'GRO-EGG-TRY', barcode: '4809988776655', name: 'Eggs, tray of 30', category: 'Staples', price: 245, unit: 'tray', stock: 12, vatExempt: true, avgCost: 228, reorder: 15, max: 40 },
  { id: 1215, sku: 'BKY-BRD-LOF', barcode: '4805566778899', name: 'Bread loaf 400 g', category: 'Bakery', price: 65, unit: 'pc', stock: 22, vatExempt: false, avgCost: 50.5, reorder: 30, max: 60 },
  { id: 1230, sku: 'HHC-DET-SCH', barcode: '4800778899001', name: 'Detergent sachet', category: 'Household', price: 9.5, unit: 'pc', stock: 520, vatExempt: false, avgCost: 7.1, reorder: 200, max: 700 },
  { id: 1244, sku: 'GRO-TUN-180', barcode: '4800016649999', name: 'Canned tuna 180 g', category: 'Canned', price: 34, unit: 'pc', stock: 10, vatExempt: false, avgCost: 27.5, reorder: 24, max: 96 },
];

export const productById = (id: number) => CATALOG.find((p) => p.id === id);
export const productBySku = (sku: string) => CATALOG.find((p) => p.sku === sku);

/** FR-POS-01 lookup order: exact barcode, exact SKU, then partial case-insensitive name. */
export function lookupProduct(query: string, catalog: Product[] = CATALOG): Product | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return (
    catalog.find((p) => p.barcode === q) ||
    catalog.find((p) => p.sku.toLowerCase() === q) ||
    catalog.find((p) => p.name.toLowerCase().includes(q))
  );
}
