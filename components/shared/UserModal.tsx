"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useNotificationStore } from "@/store/notificationStore";
import { createUser, updateUser } from "@/actions/userActions";
import { KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/database.types";

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  user: any | null;
}

const inputClassName =
  "h-11 rounded-2xl border-border bg-muted/50 text-foreground placeholder:text-muted-foreground";
const labelClassName =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground";
const selectClassName =
  "h-11 rounded-2xl border-border bg-muted/50 text-foreground data-[placeholder]:text-muted-foreground";
const selectContentClassName =
  "rounded-2xl border-border bg-popover text-popover-foreground";

export function UserModal({ open, onClose, user }: UserModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "waiter" as UserRole,
    password: "",
    is_active: true,
    dni: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        name: user.name,
        role: user.role,
        password: "",
        is_active: user.is_active,
        dni: user.dni || "",
      });
      return;
    }

    setFormData({
      email: "",
      name: "",
      role: "waiter",
      password: "",
      is_active: true,
      dni: "",
    });
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = user
        ? await updateUser(user.id, formData)
        : await createUser(formData);

      if (result.success) {
        addNotification(
          "success",
          user ? "Usuario actualizado" : "Usuario creado exitosamente"
        );
        onClose();
        router.refresh();
      } else {
        addNotification("error", result.message || "Error al guardar el usuario");
      }
    } catch (error) {
      addNotification("error", "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-border bg-muted/20 px-5 py-4">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/20 to-secondary/15 text-secondary">
            <KeyRound className="h-5 w-5" />
          </div>
          <DialogTitle className="font-brand text-2xl tracking-[0.08em]">
            {user ? "Editar Usuario" : "Nuevo Usuario"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configura acceso, rol operativo y estado del personal del sistema.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-5 px-5 py-5">
            <div className="grid gap-4 rounded-[24px] border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className={labelClassName}>
                  Nombre Completo *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Nombre y apellido"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className={labelClassName}>
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!user}
                  placeholder="correo@buffalo.com"
                  className={`${inputClassName} disabled:bg-muted/30 disabled:text-muted-foreground`}
                />
              </div>

              {!user && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="password" className={labelClassName}>
                    Contrasena *
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                    placeholder="Minimo 6 caracteres"
                    className={inputClassName}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="role" className={labelClassName}>
                  Rol *
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      role: value as UserRole,
                    })
                  }
                >
                  <SelectTrigger className={selectClassName}>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClassName}>
                    <SelectItem value="waiter">Mozo</SelectItem>
                    <SelectItem value="cashier">Cajero</SelectItem>
                    <SelectItem value="kitchen">Cocina</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dni" className={labelClassName}>
                  DNI
                </Label>
                <Input
                  id="dni"
                  value={formData.dni}
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  placeholder="Ej: 12345678"
                  className={inputClassName}
                />
                <p className="text-xs text-muted-foreground">
                  Se usa para vincular al usuario con el sistema de fichaje.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked as boolean })
                  }
                  className="border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="is_active"
                    className="cursor-pointer text-sm font-medium text-foreground"
                  >
                    Usuario activo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Los usuarios inactivos no pueden operar ni iniciar sesion.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-muted/20 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-2xl border-border bg-transparent text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="rounded-2xl bg-gradient-to-r from-primary via-pink-500 to-secondary text-[#250513]"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {user ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
