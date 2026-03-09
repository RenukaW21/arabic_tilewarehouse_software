export interface Product {
    id: string; // Assuming UUID from database
    tenant_id?: string;
    categoryId?: string | null;
    name: string;
    code: string;
    description?: string | null;
    sizeLengthMm: number;
    sizeWidthMm: number;
    sizeThicknessMm?: number | null;
    sizeLabel: string;
    piecesPerBox: number;
    sqftPerBox: number;
    sqmtPerBox?: number | null;
    weightPerBoxKg?: number | null;
    finish?: string | null;
    material?: string | null;
    brand?: string | null;
    hsnCode?: string | null;
    gstRate: number;
    mrp?: number | null;
    reorderLevelBoxes: number;
    barcode?: string | null;
    imageUrl?: string | null;
    isActive: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CreateProductDto extends Omit<Product, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> { }

export interface UpdateProductDto extends Partial<CreateProductDto> { }
