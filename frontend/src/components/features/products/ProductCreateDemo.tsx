import React, { useState } from 'react';
import { productApi } from '../../../api/productApi';
import { CreateProductDto } from '../../../types/product.types';
import { toast } from 'sonner';
import { useTranslation } from "react-i18next";

export const ProductCreateDemo: React.FC = () => {
    const { t } = useTranslation();
    // 1. Setup loading state
    const [isLoading, setIsLoading] = useState(false);

    // 2. Form state (just the necessary fields for this demo based on backend schema)
    const [formData, setFormData] = useState<CreateProductDto>({
        name: '',
        code: '',
        description: '',
        sizeLengthMm: 0,
        sizeWidthMm: 0,
        sizeLabel: '',
        piecesPerBox: 0,
        sqftPerBox: 0,
        gstRate: 18,
        reorderLevelBoxes: 0,
        isActive: true,
    });

    // Handle Input Changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        // Quick coercion for numbers
        let finalValue: any = value;
        if (type === 'number') {
            finalValue = value ? Number(value) : '';
        }

        setFormData((prev) => ({
            ...prev,
            [name]: finalValue,
        }));
    };

    // 3. Form Submit Handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Convert to FormData as expected by API
            const fd = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    fd.append(key, String(value));
                }
            });

            // 4. API Call using the Service Layer
            const response = await productApi.create(fd);

            // 5. Connect response properly
            if (response.success) {
                // Show success message
                toast.success(t('products.productCreated'));

                // Update UI or emit event to refresh lists here
                // e.g., onProductCreated(response.data)

                // Reset form
                setFormData({
                    name: '',
                    code: '',
                    description: '',
                    sizeLengthMm: 0,
                    sizeWidthMm: 0,
                    sizeLabel: '',
                    piecesPerBox: 0,
                    sqftPerBox: 0,
                    gstRate: 18,
                    reorderLevelBoxes: 0,
                    isActive: true,
                });
            }
        } catch (error) {
            // Axios already handled the error visually via interceptor toast
            // For local handling or form field highlighting, you can interact with error object here
            console.error('Failed to create product:', error);
        } finally {
            // 6. Handle loading off
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-md space-y-4">
            <div className="flex flex-col mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{t('products.newProduct')}</h2>
                <p className="text-sm text-gray-500">
                    {t('sampleData.importProductsDesc')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('products.productName')} *</label>
                        <input
                            type="text"
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={t('sampleData.marbleTile')}
                        />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('products.productCode')} *</label>
                        <input
                            type="text"
                            name="code"
                            required
                            value={formData.code}
                            onChange={handleChange}
                            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={t('sampleData.prd001')}
                        />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('products.lengthMm')} *</label>
                        <input
                            type="number"
                            name="sizeLengthMm"
                            required
                            value={formData.sizeLengthMm}
                            onChange={handleChange}
                            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('products.widthMm')} *</label>
                        <input
                            type="number"
                            name="sizeWidthMm"
                            required
                            value={formData.sizeWidthMm}
                            onChange={handleChange}
                            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('products.sizeLabel')} *</label>
                        <input
                            type="text"
                            name="sizeLabel"
                            required
                            value={formData.sizeLabel}
                            onChange={handleChange}
                            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. 600x600"
                        />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('products.piecesPerBox')} *</label>
                        <input
                            type="number"
                            name="piecesPerBox"
                            required
                            value={formData.piecesPerBox}
                            onChange={handleChange}
                            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('products.sqftPerBox')} *</label>
                        <input
                            type="number"
                            name="sqftPerBox"
                            required
                            value={formData.sqftPerBox}
                            onChange={handleChange}
                            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? t('common.saving') : t('products.addProduct')}
                    </button>
                </div>
            </form>
        </div>
    );
};

