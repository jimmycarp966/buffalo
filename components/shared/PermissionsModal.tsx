"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Check, X, AlertCircle } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import {
  getAllPermissions,
  getUserEffectivePermissions,
  updateUserPermission,
} from "@/actions/permissionActions";

interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
  action: string;
}

interface EffectivePermission {
  permission_id: string;
  is_granted: boolean;
  has_override: boolean;
  permissions: Permission;
}

interface PermissionsModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    role: string;
  } | null;
}

export function PermissionsModal({ open, onClose, user }: PermissionsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [effectivePermissions, setEffectivePermissions] = useState<EffectivePermission[]>([]);
  const [saving, setSaving] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    if (open && user) {
      loadPermissions();
    }
  }, [open, user]);

  const loadPermissions = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      console.log("🔍 Loading permissions for user:", user);
      
      const [allPermsResult, effectiveResult] = await Promise.all([
        getAllPermissions(),
        getUserEffectivePermissions(user.id),
      ]);

      console.log("📋 All permissions result:", allPermsResult);
      console.log("🎯 Effective permissions result:", effectiveResult);

      if (allPermsResult.success && allPermsResult.data) {
        setPermissions(allPermsResult.data);
        console.log("✅ Permissions loaded:", allPermsResult.data.length);
      } else {
        console.error("❌ Failed to load permissions:", allPermsResult.message);
      }

      if (effectiveResult.success) {
        setEffectivePermissions(effectiveResult.data as EffectivePermission[]);
        console.log("✅ Effective permissions loaded:", effectiveResult.data.length);
      } else {
        console.error("❌ Failed to load effective permissions:", effectiveResult.message);
      }
    } catch (error) {
      console.error("❌ Error in loadPermissions:", error);
      addNotification("error", "Error al cargar permisos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePermission = async (permissionId: string, currentlyGranted: boolean, hasOverride: boolean) => {
    if (!user) return;

    setSaving(true);
    try {
      // Si ya tiene override, ciclar: granted -> denied -> inherited (null)
      // Si no tiene override, alternar entre granted y denied
      let newValue: boolean | null;

      if (hasOverride) {
        if (currentlyGranted) {
          newValue = false; // De granted a denied
        } else {
          newValue = null; // De denied a inherited (borrar override)
        }
      } else {
        newValue = !currentlyGranted; // Toggle
      }

      const result = await updateUserPermission(user.id, permissionId, newValue);

      if (result.success) {
        addNotification("success", "Permiso actualizado");
        loadPermissions(); // Recargar
      } else {
        addNotification("error", result.message || "Error al actualizar");
      }
    } catch (error) {
      addNotification("error", "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  // Agrupar permisos por módulo
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Obtener estado efectivo de un permiso
  const getPermissionState = (permissionId: string) => {
    const effective = effectivePermissions.find((p) => p.permission_id === permissionId);
    return {
      isGranted: effective?.is_granted || false,
      hasOverride: effective?.has_override || false,
    };
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case "admin": return "Administrador";
      case "supervisor": return "Supervisor";
      case "cashier": return "Cajero";
      default: return role;
    }
  };

  const getModuleName = (module: string) => {
    const names: Record<string, string> = {
      dashboard: "Inicio",
      productos: "Productos",
      inventario: "Inventario",
      ventas: "Ventas",
      cajas: "Cajas",
      gastos: "Gastos",
      reportes: "Reportes",
      empleados: "Empleados",
      proveedores: "Proveedores",
      compras: "Compras",
      configuracion: "Configuración",
    };
    return names[module] || module;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-buffalo-caramel" />
            Gestionar Permisos - {user?.name}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{getRoleName(user?.role || "")}</Badge>
            <p className="text-sm text-muted-foreground">
              Configurá qué puede ver y hacer este usuario
            </p>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-buffalo-caramel" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Leyenda */}
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <p className="font-semibold">Leyenda:</p>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>Permitido</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="h-4 w-4 text-red-600" />
                <span>Denegado</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span>Heredado del rol</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Click en un permiso para: Permitir → Denegar → Heredar del rol
              </p>
            </div>

            {/* Permisos agrupados por módulo */}
            {Object.entries(groupedPermissions).map(([module, perms]) => (
              <div key={module} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 text-buffalo-caramel">
                  {getModuleName(module)}
                </h3>
                <div className="grid gap-2">
                  {perms.map((perm) => {
                    const state = getPermissionState(perm.id);
                    return (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{perm.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {perm.name}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {state.hasOverride && (
                            <Badge variant="outline" className="text-xs">
                              Personalizado
                            </Badge>
                          )}
                          
                          <Button
                            variant={state.isGranted ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                              handleTogglePermission(
                                perm.id,
                                state.isGranted,
                                state.hasOverride
                              )
                            }
                            disabled={saving}
                            className={`w-32 ${
                              state.isGranted
                                ? "bg-green-600 hover:bg-green-700"
                                : "border-red-600 text-red-600 hover:bg-muted/30"
                            }`}
                          >
                            {state.isGranted ? (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Permitido
                              </>
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Denegado
                              </>
                            )}
                          </Button>

                          {!state.hasOverride && (
                            <AlertCircle className="h-5 w-5 text-blue-600" aria-label="Heredado del rol" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

