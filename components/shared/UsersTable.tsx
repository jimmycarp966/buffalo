"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Edit, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { UserModal } from "./UserModal";
import { PermissionsModal } from "./PermissionsModal";
import { getUserNavigationPermissions } from "@/actions/permissionActions";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  dni?: string | null;
}

interface UsersTableProps {
  users: User[];
}

export function UsersTable({ users }: UsersTableProps) {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const itemsPerPage = 20;

  const filteredUsers = useMemo(() => {
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  // Obtener permisos del usuario actual
  useEffect(() => {
    const loadUserPermissions = async () => {
      try {
        // Obtener el usuario actual
        const response = await fetch('/api/auth/user');
        if (!response.ok) {
          console.error('No se pudo obtener el usuario actual');
          return;
        }
        const { user } = await response.json();

        if (user?.id) {
          const { success, data } = await getUserNavigationPermissions(user.id);
          if (success) {
            setUserPermissions(data);
          }
        }
      } catch (error) {
        console.error('Error cargando permisos:', error);
      }
    };

    loadUserPermissions();
  }, []);

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: "destructive",
      waiter: "default",
      kitchen: "secondary",
    };
    return colors[role as keyof typeof colors] || "secondary";
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      admin: "Administrador",
      waiter: "Mozo",
      kitchen: "Cocina",
    };
    return labels[role as keyof typeof labels] || role;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {userPermissions['users.create'] && (
          <Button onClick={() => setIsModalOpen(true)} size="sm" className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            <span className="ml-2">Nuevo Usuario</span>
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium">DNI</th>
              <th className="px-4 py-3 text-center text-sm font-medium">Rol</th>
              <th className="px-4 py-3 text-center text-sm font-medium">Estado</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No se encontraron usuarios</p>
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.dni || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={getRoleBadge(user.role) as any}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={user.is_active ? "success" : "secondary"}>
                      {user.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {userPermissions['users.edit'] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsModalOpen(true);
                          }}
                          title="Editar usuario"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {userPermissions['users.edit'] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsPermissionsModalOpen(true);
                          }}
                          title="Gestionar permisos"
                          className="text-buffalo-caramel hover:text-buffalo-espresso"
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Controles de paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
            {Math.min(currentPage * itemsPerPage, filteredUsers.length)} de{" "}
            {filteredUsers.length} usuarios
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <UserModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />

      <PermissionsModal
        open={isPermissionsModalOpen}
        onClose={() => {
          setIsPermissionsModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />
    </div>
  );
}

