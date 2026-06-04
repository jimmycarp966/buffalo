"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useNotificationStore } from "@/store/notificationStore";
import { brand } from "@/lib/brand";
import { Loader2, Save, Store, Clock, FileText } from "lucide-react";
import { getAdminSettings, updateStoreSettings } from "@/actions/settingsActions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { storeSettingsSchema, type StoreSettingsInput } from "@/lib/validations";

export function StoreSettingsPanel() {
    const addNotification = useNotificationStore((state) => state.addNotification);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<StoreSettingsInput>({
        resolver: zodResolver(storeSettingsSchema),
        defaultValues: {
            store_name: "",
            estimated_delivery_time: 30,
            daily_menu_active: false,
            daily_menu_content: "",
            is_open: true,
        }
    });

    // Cargar configuracion al iniciar
    useEffect(() => {
        async function loadSettings() {
            try {
                const result = await getAdminSettings();
                if (result.success && result.data) {
                    form.reset({
                        store_name: result.data.store_name,
                        estimated_delivery_time: result.data.estimated_delivery_time,
                        daily_menu_active: result.data.daily_menu_active,
                        daily_menu_content: result.data.daily_menu_content || "",
                        is_open: result.data.is_open,
                    });
                }
            } catch (error) {
                console.error("Error loading settings:", error);
                addNotification("error", "No se pudo cargar la configuracion");
            } finally {
                setIsLoading(false);
            }
        }
        loadSettings();
    }, [form, addNotification]);

    const onSubmit = async (data: StoreSettingsInput) => {
        setIsSaving(true);
        try {
            const result = await updateStoreSettings(data);
            if (result.success) {
                addNotification("success", "Configuracion guardada correctamente");
            } else {
                addNotification("error", result.message || "No se pudo guardar la configuracion");
            }
        } catch (error) {
            addNotification("error", "Ocurrio un error al guardar");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-6">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* Informacion General y Menu del Dia */}
                <Card className="border-orange-200 bg-orange-50/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-800">
                            <Store className="h-5 w-5" />
                            Tienda y Menu del Dia
                        </CardTitle>
                        <CardDescription>
                            Configuracion visible en la pagina publica de pedidos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="store_name">Nombre del Negocio</Label>
                                <Input
                                    id="store_name"
                                    {...form.register("store_name")}
                                    placeholder={`Ej: ${brand.name}`}
                                    className="bg-card"
                                />
                                {form.formState.errors.store_name && (
                                    <p className="text-sm text-red-500">{form.formState.errors.store_name.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="estimated_delivery_time">Tiempo Est. de Entrega (min)</Label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        id="estimated_delivery_time"
                                        {...form.register("estimated_delivery_time", { valueAsNumber: true })}
                                        className="pl-10 bg-card"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-orange-200 pt-4 mt-4">
                            <h3 className="text-sm font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Menu del Dia
                            </h3>

                            <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-orange-100 shadow-sm mb-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-semibold">Activar Menu del Dia</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Muestra el banner especial en la pagina de pedidos.
                                    </p>
                                </div>
                                <Checkbox
                                    checked={form.watch("daily_menu_active")}
                                    onCheckedChange={(checked) => form.setValue("daily_menu_active", checked === true)}
                                    className="h-6 w-6"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="daily_menu_content">Contenido del Menu</Label>
                                <Textarea
                                    id="daily_menu_content"
                                    {...form.register("daily_menu_content")}
                                    placeholder="Ej: Milanesa a la napolitana con papas fritas + Bebida..."
                                    className="min-h-[100px] bg-card border-orange-200 focus:border-orange-400"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Guardar Configuracion Tienda
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}

