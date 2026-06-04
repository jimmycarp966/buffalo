"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAppSetting } from "@/actions/configActions";
import { brand } from "@/lib/brand";
import { useNotificationStore } from "@/store/notificationStore";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";

interface ConfigurationPanelProps {
  settings: { [key: string]: string };
  section: "business";
}

export function ConfigurationPanel({ settings, section }: ConfigurationPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [values, setValues] = useState(settings);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const router = useRouter();

  const sectionFields = {
    business: [
      { key: "business_name", label: "Nombre del Negocio", type: "text", placeholder: brand.defaultStoreName },
      { key: "business_address", label: "Dirección", type: "text", placeholder: "Calle Principal 123" },
      { key: "business_phone", label: "Teléfono", type: "text", placeholder: "+54 9 11 1234-5678" },
      { key: "business_cuit", label: "CUIT/RUC", type: "text", placeholder: "20-12345678-9" },
      { key: "ticket_footer_message", label: "Mensaje en Ticket", type: "text", placeholder: "¡Gracias por su compra!" },
    ],
  };

  const fields = sectionFields[section] || [];

  const handleSave = async () => {
    setIsLoading(true);

    try {
      // Guardar cada campo que cambió
      for (const field of fields) {
        if (values[field.key] !== settings[field.key]) {
          const result = await updateAppSetting(field.key, values[field.key]);
          if (!result.success) {
            addNotification("error", result.message || "Error al guardar configuración");
            setIsLoading(false);
            return;
          }
        }
      }

      addNotification("success", "Configuración guardada exitosamente");
      router.refresh();
    } catch (error) {
      addNotification("error", "Error al guardar configuración");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          {field.type === "boolean" ? (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={field.key}
                checked={values[field.key] === "true"}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: e.target.checked ? "true" : "false" })
                }
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor={field.key} className="cursor-pointer font-normal">
                {values[field.key] === "true" ? "Activado" : "Desactivado"}
              </Label>
            </div>
          ) : (
            <Input
              id={field.key}
              type={field.type}
              value={values[field.key] || ""}
              onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
              placeholder={(field as any).placeholder || ""}
            />
          )}
        </div>
      ))}

      <Button onClick={handleSave} disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Guardar Cambios
          </>
        )}
      </Button>
    </div>
  );
}

