import { getAppSettings } from "@/actions/configActions";
import { getUsers } from "@/actions/userActions";
import { ConfigurationPanel } from "@/components/shared/ConfigurationPanel";
import { PrinterConfigPanel } from "@/components/shared/PrinterConfigPanel";
import { QRGenerator } from "@/components/shared/QRGenerator";
import { UsersTable } from "@/components/shared/UsersTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Users } from "lucide-react";

import { StoreSettingsPanel } from "@/components/shared/StoreSettingsPanel";

export default async function ConfiguracionPage() {
  const [{ data: settings }, { data: users }] = await Promise.all([getAppSettings(), getUsers()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Ajustes generales del sistema y permisos
        </p>
      </div>

      {/* Nueva Configuración de Tienda y Menú del Día */}
      <StoreSettingsPanel />

      {/* Configuración de Impresoras */}
      <PrinterConfigPanel />

      {/* Generador de QR para Carta Digital */}
      <QRGenerator />

      {/* Información del Negocio (Legacy/Otros datos) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-buffalo-caramel" />
            <CardTitle>Información del Negocio (Detalles Ticket)</CardTitle>
          </div>
          <CardDescription>
            Estos datos se mostrarán en los tickets impresos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigurationPanel settings={settings} section="business" />
        </CardContent>
      </Card>

      {/* Usuarios y Permisos */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-buffalo-caramel" />
            <CardTitle>Usuarios y Permisos</CardTitle>
          </div>
          <CardDescription>
            Creá usuarios del sistema y asigná sus permisos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <UsersTable users={users || []} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
