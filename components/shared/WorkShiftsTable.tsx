"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface WorkShift {
  id: string;
  check_in: string;
  check_out: string | null;
  user?: { name: string };
  cash_register_session?: {
    cash_register?: { name: string; type: string };
  };
}

interface WorkShiftsTableProps {
  workShifts: WorkShift[];
}

export function WorkShiftsTable({ workShifts }: WorkShiftsTableProps) {
  const [search, setSearch] = useState("");

  const filteredShifts = workShifts.filter((w) =>
    w.user?.name.toLowerCase().includes(search.toLowerCase())
  );

  const calculateDuration = (checkIn: string, checkOut: string | null) => {
    const start = new Date(checkIn);
    const end = checkOut ? new Date(checkOut) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por empleado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Empleado</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Entrada</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Salida</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Caja</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Duración</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No se encontraron turnos</p>
                  </td>
                </tr>
              ) : (
                filteredShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{shift.user?.name}</td>
                    <td className="px-4 py-3 text-sm">
                      {formatDate(new Date(shift.check_in))}
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell">
                      {shift.check_out ? formatDate(new Date(shift.check_out)) : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell">
                      {shift.cash_register_session?.cash_register?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {calculateDuration(shift.check_in, shift.check_out)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={shift.check_out ? "secondary" : "success"}>
                        {shift.check_out ? "Finalizado" : "En Turno"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

