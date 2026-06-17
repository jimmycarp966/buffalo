import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
  Plus,
  Trash2,
  ChefHat,
} from "lucide-react";
import { createProduct, updateProduct } from "@/actions/productActions";
import { getIngredients, getProductRecipe } from "@/actions/ingredientActions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useNotificationStore } from "@/store/notificationStore";
import { formatCurrency } from "@/lib/utils";
import { ingredientLineCost, recipeTotalCost, recipeUnitLabel } from "@/lib/recipeCost";

interface Product {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  cost_price: number;
  sale_price: number;
  profit_margin: number | null;
  use_auto_price: boolean;
  stock: number;
  min_stock: number;
  unlimited_stock: boolean;
  cocina_only?: boolean | null;
  image_url?: string | null;
  category_id?: string | null;
}

interface ProductModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}

function normalizeKitchenOnlyValue(unlimitedStock: boolean, cocinaOnly: boolean | null) {
  if (!unlimitedStock) return false;
  return Boolean(cocinaOnly);
}

export function ProductModal({ open, onClose, product }: ProductModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [ingredients, setIngredients] = useState<Array<{ id: string; name: string; unit: string; cost: number }>>([]);
  const [recipe, setRecipe] = useState<Array<{ ingredient_id: string; quantity: string }>>([]);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    cost_price: "",
    sale_price: "",
    profit_margin: "30",
    use_auto_price: false,
    stock: "",
    min_stock: "",
    unlimited_stock: false,
    cocina_only: false,
    image_url: "",
    category_id: "",
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        code: product.code || "",
        description: product.description || "",
        cost_price: product.cost_price.toString(),
        sale_price: product.sale_price.toString(),
        profit_margin: (product.profit_margin || 30).toString(),
        use_auto_price: product.use_auto_price,
        stock: product.stock.toString(),
        min_stock: product.min_stock.toString(),
        unlimited_stock: product.unlimited_stock || false,
        cocina_only: product.cocina_only ?? false,
        image_url: product.image_url || "",
        category_id: product.category_id || "",
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        cost_price: "",
        sale_price: "",
        profit_margin: "30",
        use_auto_price: false,
        stock: "",
        min_stock: "",
        unlimited_stock: false,
        cocina_only: false,
        image_url: "",
        category_id: "",
      });
    }
  }, [product, open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order");
      if (active && data) setCategories(data as Array<{ id: string; name: string }>);
      const ing = await getIngredients();
      if (active && ing.success) {
        setIngredients(ing.data as Array<{ id: string; name: string; unit: string; cost: number }>);
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  // Cargar la receta del producto en edición (o limpiarla en alta)
  useEffect(() => {
    if (!open) return;
    if (!product) {
      setRecipe([]);
      return;
    }
    let active = true;
    (async () => {
      const res = await getProductRecipe(product.id);
      if (active && res.success) {
        setRecipe(
          (res.data || []).map((r: any) => ({
            ingredient_id: r.ingredient_id,
            quantity: (r.quantity ?? "").toString(),
          }))
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [product, open]);

  // Receta -> costo de producción -> autocompleta el Precio Costo (igual editable)
  useEffect(() => {
    if (ingredients.length === 0) return;
    if (!recipe || recipe.length === 0) return;
    const items = recipe
      .filter((r) => r.ingredient_id)
      .map((r) => {
        const ing = ingredients.find((i) => i.id === r.ingredient_id);
        return { unit: ing?.unit || "unidad", cost: ing?.cost || 0, quantity: parseFloat(r.quantity) || 0 };
      });
    if (items.length === 0) return;
    const total = recipeTotalCost(items);
    setFormData((prev) => ({ ...prev, cost_price: total.toFixed(2) }));
  }, [recipe, ingredients]);

  useEffect(() => {
    const costPrice = parseFloat(formData.cost_price) || 0;
    const margin = parseFloat(formData.profit_margin) || 0;

    if (formData.use_auto_price && costPrice > 0) {
      const calculatedPrice = costPrice * (1 + margin / 100);
      setFormData((prev) => ({ ...prev, sale_price: calculatedPrice.toFixed(2) }));
    }
  }, [formData.cost_price, formData.profit_margin, formData.use_auto_price]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const dataToSubmit = {
        name: formData.name,
        code: formData.code || null,
        description: formData.description,
        cost_price: parseFloat(formData.cost_price) || 0,
        sale_price: parseFloat(formData.sale_price) || 0,
        profit_margin: parseFloat(formData.profit_margin) || 0,
        use_auto_price: formData.use_auto_price,
        stock: parseInt(formData.stock) || 0,
        min_stock: parseInt(formData.min_stock) || 0,
        unlimited_stock: formData.unlimited_stock,
        cocina_only: normalizeKitchenOnlyValue(
          formData.unlimited_stock,
          formData.cocina_only
        ),
        image_url: formData.image_url || null,
        category_id: formData.category_id || null,
      };

      const recipePayload = recipe
        .filter((r) => r.ingredient_id)
        .map((r) => ({ ingredient_id: r.ingredient_id, quantity: parseFloat(r.quantity) || 0 }));

      const result = product
        ? await updateProduct(product.id, dataToSubmit, recipePayload)
        : await createProduct(dataToSubmit, recipePayload);

      if (result.success) {
        addNotification(
          "success",
          product ? "Producto actualizado" : "Producto creado exitosamente"
        );
        onClose();
      } else {
        addNotification("error", result.message || "Error al guardar el producto");
      }
    } catch (error: any) {
      console.error("Error creating/updating product:", error);
      addNotification("error", error.message || "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("products").getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, image_url: publicUrl }));
      addNotification("success", "Imagen subida correctamente");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      addNotification("error", "Error al subir la imagen");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const inputClassName =
    "h-11 rounded-2xl border-border bg-background text-foreground placeholder:text-muted-foreground";
  const sectionTitleClassName =
    "border-b border-border pb-2 font-brand text-lg tracking-[0.08em] text-foreground";
  const labelClassName =
    "text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent manualScroll className="w-[95vw] max-w-4xl flex-col gap-0 border border-border p-0 shadow-[0_30px_90px_rgba(0,0,0,0.12)]">
        <DialogHeader className="shrink-0 border-b border-border bg-muted/30 px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="font-brand text-2xl tracking-[0.08em] text-foreground sm:text-3xl">
            {product ? "Editar Producto" : "Nuevo Producto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="space-y-3">
              <h3 className={sectionTitleClassName}>Informacion Basica</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className={labelClassName}>
                    Nombre *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Cafe con leche"
                    required
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="code" className={labelClassName}>
                    Codigo de Producto
                  </Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ej: CAF-001"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category_id" className={labelClassName}>
                  Categoría
                </Label>
                <select
                  id="category_id"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className={`${inputClassName} w-full border px-3 text-sm`}
                >
                  <option value="">Sin categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className={labelClassName}>Imagen del Producto</Label>
                <div className="flex items-start gap-3">
                  {formData.image_url ? (
                    <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-border bg-muted/30">
                      <Image
                        src={formData.image_url}
                        alt="Preview"
                        fill
                        sizes="96px"
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_url: "" })}
                        className="absolute right-0 top-0 rounded-bl-xl bg-red-500 p-1 text-white hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-muted/30 text-muted-foreground">
                      <ImageIcon className="h-9 w-9" />
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="https://ejemplo.com/imagen.jpg"
                        className={`${inputClassName} text-xs`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-11 rounded-2xl border-border bg-muted/30 px-3 text-foreground hover:bg-muted/60"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Pega una URL o sube una imagen desde tu dispositivo.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className={sectionTitleClassName}>Precios</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cost_price" className={labelClassName}>
                    Precio Costo *
                  </Label>
                  <Input
                    id="cost_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="0.00"
                    required
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sale_price" className={labelClassName}>
                    Precio de Venta *
                  </Label>
                  <Input
                    id="sale_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sale_price}
                    onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                    disabled={formData.use_auto_price}
                    placeholder="0.00"
                    required
                    className={`${inputClassName} disabled:bg-muted/20 disabled:text-muted-foreground`}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profit_margin" className={labelClassName}>
                    Margen (%)
                  </Label>
                  <Input
                    id="profit_margin"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.profit_margin}
                    onChange={(e) => setFormData({ ...formData, profit_margin: e.target.value })}
                    placeholder="30"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/20 px-3 py-3">
                <input
                  type="checkbox"
                  id="use_auto_price"
                  checked={formData.use_auto_price}
                  onChange={(e) =>
                    setFormData({ ...formData, use_auto_price: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border bg-background"
                />
                <Label htmlFor="use_auto_price" className="cursor-pointer text-sm text-foreground">
                  Calcular precio automaticamente
                </Label>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className={sectionTitleClassName}>
                <span className="inline-flex items-center gap-2">
                  <ChefHat className="h-4 w-4" /> Receta / Costo de producción
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Cargá los insumos que lleva el producto. El costo se calcula solo y completa el{" "}
                <b>Precio Costo</b> de arriba (igual lo podés ajustar a mano).
              </p>

              {ingredients.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Todavía no cargaste insumos. Andá a la pestaña <b>Insumos</b> (arriba, en Productos) y
                  cargá jamón, pan, queso, etc. con su costo. Después volvé acá a armar la receta.
                </p>
              ) : (
                <div className="space-y-2">
                  {recipe.map((row, index) => {
                    const ing = ingredients.find((i) => i.id === row.ingredient_id);
                    const lineCost = ing
                      ? ingredientLineCost(ing.unit, ing.cost, parseFloat(row.quantity) || 0)
                      : 0;
                    return (
                      <div
                        key={index}
                        className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-muted/20 p-2 sm:flex-nowrap"
                      >
                        <div className="min-w-[140px] flex-1 space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Insumo
                          </Label>
                          <select
                            value={row.ingredient_id}
                            onChange={(e) => {
                              const next = [...recipe];
                              next[index] = { ...next[index], ingredient_id: e.target.value };
                              setRecipe(next);
                            }}
                            className="h-9 w-full rounded-xl border border-border bg-background px-2 text-sm"
                          >
                            <option value="">Elegí un insumo…</option>
                            {ingredients.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Cant. ({ing ? recipeUnitLabel(ing.unit) : "—"})
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.quantity}
                            onChange={(e) => {
                              const next = [...recipe];
                              next[index] = { ...next[index], quantity: e.target.value };
                              setRecipe(next);
                            }}
                            placeholder="0"
                            className="h-9 rounded-xl"
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Costo
                          </Label>
                          <div className="flex h-9 items-center justify-end px-2 text-sm font-medium tabular-nums text-foreground">
                            {formatCurrency(lineCost)}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => setRecipe(recipe.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setRecipe([...recipe, { ingredient_id: "", quantity: "" }])}
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> Agregar insumo
                    </Button>
                    {recipe.some((r) => r.ingredient_id) && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Costo de producción
                        </span>
                        <p className="text-lg font-bold tabular-nums text-foreground">
                          {formatCurrency(
                            recipeTotalCost(
                              recipe
                                .filter((r) => r.ingredient_id)
                                .map((r) => {
                                  const ing = ingredients.find((i) => i.id === r.ingredient_id);
                                  return {
                                    unit: ing?.unit || "unidad",
                                    cost: ing?.cost || 0,
                                    quantity: parseFloat(r.quantity) || 0,
                                  };
                                })
                            )
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className={sectionTitleClassName}>Inventario</h3>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stock" className={labelClassName}>
                    Stock Actual
                    {formData.unlimited_stock && (
                      <span className="ml-1 text-xs text-muted-foreground">(No aplica)</span>
                    )}
                  </Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    disabled={formData.unlimited_stock}
                    placeholder="0"
                    required={!formData.unlimited_stock}
                    className={`${inputClassName} disabled:bg-muted/20 disabled:text-muted-foreground`}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="min_stock" className={labelClassName}>
                    Stock Minimo
                    {formData.unlimited_stock && (
                      <span className="ml-1 text-xs text-muted-foreground">(No aplica)</span>
                    )}
                  </Label>
                  <Input
                    id="min_stock"
                    type="number"
                    min="0"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    disabled={formData.unlimited_stock}
                    placeholder="0"
                    required={!formData.unlimited_stock}
                    className={`${inputClassName} disabled:bg-muted/20 disabled:text-muted-foreground`}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/20 px-3 py-3">
                    <input
                      type="checkbox"
                      id="unlimited_stock"
                      checked={formData.unlimited_stock}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          unlimited_stock: e.target.checked,
                          cocina_only: e.target.checked ? formData.cocina_only : false,
                        })
                      }
                      className="h-4 w-4 rounded border-border bg-background"
                    />
                    <Label htmlFor="unlimited_stock" className="cursor-pointer text-sm text-foreground">
                      Stock Ilimitado
                    </Label>
                  </div>
                </div>
              </div>

              {formData.unlimited_stock && (
                <p className="rounded-2xl border border-orange-300/20 bg-orange-300/10 p-3 text-xs text-orange-100">
                  Este producto no validara ni descontara stock en las ventas.
                </p>
              )}

              {formData.unlimited_stock && (
                <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="cocina_only"
                      checked={formData.cocina_only || false}
                      onChange={(e) =>
                        setFormData({ ...formData, cocina_only: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-border bg-background"
                    />
                    <Label htmlFor="cocina_only" className="text-sm font-medium text-foreground">
                      Solo se prepara en cocina
                    </Label>
                  </div>

                  {formData.cocina_only && (
                    <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-700">
                      Se enviara a impresion en cocina.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className={labelClassName}>
                Descripcion
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descripcion opcional del producto"
                className={inputClassName}
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                size="sm"
                className="rounded-2xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isUploading}
                size="sm"
                className="rounded-2xl bg-gradient-to-r from-primary via-pink-500 to-secondary text-[#250513] hover:opacity-95"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {product ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
