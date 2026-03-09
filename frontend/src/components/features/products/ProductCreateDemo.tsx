import React, { useState } from 'react';
import { productApi } from '../../../api/productApi';
import { CreateProductDto } from '../../../types/product.types';
import { toast } from 'sonner';

export const ProductCreateDemo: React.FC = () => {
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
            // 4. API Call using the Service Layer
            // Axios interceptors will handle 400/500 errors globally
            const response = await productApi.create(formData);

            // 5. Connect response properly
            if (response.success) {
                // Show success message
                toast.success(`Product "${response.data.name}" created successfully!`);

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
                <h2 className="text-2xl font-bold text-gray-800">Create New Product Flow</h2>
                <p className="text-sm text-gray-500">
                    Demonstrates how the form submission, API service layer, and Axios instance work together.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">Product Name *</label>
                        <input
                            type="text"
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="E.g. Marble Tile"
                        />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">Product Code *</label>
                        <input
                            type="text"
                            name="code"
                            required
                            value={formData.code}
                            onChange={handleChange}
                            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="PRD-001"
                        />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">Size Length (mm) *</label>
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
                        <label className="text-sm font-medium text-gray-700">Size Width (mm) *</label>
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
                        <label className="text-sm font-medium text-gray-700">Size Label *</label>
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
                        <label className="text-sm font-medium text-gray-700">Pieces Per Box *</label>
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
                        <label className="text-sm font-medium text-gray-700">SqFt per Box *</label>
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
                        {isLoading ? 'Creating...' : 'Create Product'}
                    </button>
                </div>
            </form>
        </div>
    );
};
