import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Package, User, ShoppingCart, Info, MapPin } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const BACKEND_URL = API_BASE.replace(/\/api\/v1\/?$/, '') || 'http://localhost:5000';

export default function ProductDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { data, isLoading, isError } = useQuery({
        queryKey: ["product", id],
        queryFn: () => productApi.getById(id!),
        enabled: !!id,
    });

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading product details...</div>;
    if (isError || !data?.data) return <div className="p-8 text-center text-destructive">Failed to load product.</div>;

    const product = data.data as any;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate("/master/products")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <PageHeader title="Product Details" subtitle={`Viewing full details for ${product.code}`} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Product Information */}
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center gap-2 pb-4 border-b">
                        <Info className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Product Information</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-6">
                            {(product.imageUrl || product.image_url) && (
                                <div className="shrink-0">
                                    <img
                                        src={`${BACKEND_URL}${product.imageUrl || product.image_url}`}
                                        alt={product.name}
                                        className="w-40 h-40 object-cover rounded-lg border shadow-sm"
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm flex-1">
                                <div><span className="text-muted-foreground block mb-1">Product Name</span><span className="font-medium">{product.name}</span></div>
                                <div><span className="text-muted-foreground block mb-1">Product Code</span><span className="font-medium">{product.code}</span></div>
                                <div><span className="text-muted-foreground block mb-1">Category</span><span className="font-medium">{product.category_name || "Uncategorized"}</span></div>
                                <div><span className="text-muted-foreground block mb-1">Size</span><span className="font-medium">{product.size_label}</span></div>
                                <div><span className="text-muted-foreground block mb-1">Pcs per Box</span><span className="font-medium">{product.pieces_per_box}</span></div>
                                <div><span className="text-muted-foreground block mb-1">Sqft per Box</span><span className="font-medium">{product.sqft_per_box} sqft</span></div>
                                <div><span className="text-muted-foreground block mb-1">MRP</span><span className="font-medium">₹{product.mrp || 0}</span></div>
                                <div><span className="text-muted-foreground block mb-1">GST</span><span className="font-medium">{product.gst_rate}%</span></div>
                                <div><span className="text-muted-foreground block mb-1">Status</span><StatusBadge status={product.is_active ? "active" : "inactive"} /></div>
                                <div className="col-span-2">
                                    <span className="text-muted-foreground block mb-1">Description</span>
                                    <p className="text-gray-700 whitespace-pre-wrap">{product.description || "N/A"}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Storage Information */}
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center gap-2 pb-4 border-b">
                        <Package className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Storage Information</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {product.rackAssignments && product.rackAssignments.length > 0 ? (
                            <div className="space-y-4">
                                {product.rackAssignments.map((assignment: any) => (
                                    <div key={assignment.id} className="p-3 bg-muted/30 rounded border border-border/50 text-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MapPin className="h-4 w-4 text-primary" />
                                            <span className="font-semibold text-primary">{assignment.rack_name}</span>
                                            <span className="text-muted-foreground ml-auto">{assignment.warehouse_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 bg-primary/10 rounded flex items-center justify-center text-[10px] font-bold text-primary">BX</div>
                                            <span className="text-muted-foreground">Boxes Stored:</span>
                                            <span className="font-medium">{assignment.boxes_stored}</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="pt-2 border-t mt-4 flex justify-between items-center font-bold">
                                    <span>Total Boxes</span>
                                    <span className="text-lg">{product.total_boxes_stored || 0}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded text-center border border-dashed">
                                No rack locations assigned to this product.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Purchase Information */}
                <Card className="shadow-sm flex flex-col">
                    <CardHeader className="flex flex-row items-center gap-2 pb-4 border-b">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Purchase Information</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1">
                        <span className="text-muted-foreground block mb-3 text-sm">Vendors (from whom purchased)</span>
                        {product.vendors && product.vendors.length > 0 ? (
                            <ul className="space-y-2">
                                {product.vendors.map((v: any) => (
                                    <li key={v.id} className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded border border-border/50">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{v.name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded text-center border border-dashed">
                                No purchase history found for this product.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Sales Information */}
                <Card className="shadow-sm flex flex-col">
                    <CardHeader className="flex flex-row items-center gap-2 pb-4 border-b">
                        <User className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Sales Information</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1">
                        <span className="text-muted-foreground block mb-3 text-sm">Customers (to whom sold)</span>
                        {product.customers && product.customers.length > 0 ? (
                            <ul className="space-y-2">
                                {product.customers.map((c: any) => (
                                    <li key={c.id} className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded border border-border/50">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{c.name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded text-center border border-dashed">
                                No sales history found for this product.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
