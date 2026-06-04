"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Clock, DollarSign } from "lucide-react";

interface TableShapeModernProps {
  tableNumber: number;
  status: "available" | "occupied" | "partial";
  isSelected: boolean;
  isEditMode: boolean;
  onClick: () => void;
  data?: any;
  layout: any;
}

export function TableShapeModern({
  tableNumber,
  status,
  isSelected,
  isEditMode,
  onClick,
  data,
  layout,
}: TableShapeModernProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tableNumber,
    disabled: !isEditMode,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  // Colores modernos según estado
  const getStatusStyles = () => {
    // Obtener estilos base según el estado
    let baseStyles;
    switch (status) {
      case "available":
        baseStyles = {
          border: "border-green-400",
          bg: "bg-gradient-to-br from-green-50 via-green-100 to-emerald-50",
          shadow: "hover:shadow-xl hover:shadow-green-200 hover:-translate-y-1",
          text: "text-green-900",
        };
        break;
      case "occupied":
        baseStyles = {
          border: "border-red-400",
          bg: "bg-gradient-to-br from-red-50 via-red-100 to-rose-50",
          shadow: "hover:shadow-xl hover:shadow-red-200 hover:-translate-y-1",
          text: "text-red-900",
        };
        break;
      case "partial":
        baseStyles = {
          border: "border-orange-400",
          bg: "bg-gradient-to-br from-orange-50 via-orange-100 to-amber-50",
          shadow: "hover:shadow-xl hover:shadow-orange-200 hover:-translate-y-1",
          text: "text-orange-900",
        };
        break;
      default:
        baseStyles = {
          border: "border-gray-300",
          bg: "bg-gradient-to-br from-gray-50 to-gray-100",
          shadow: "",
          text: "text-gray-700",
        };
    }

    // Si está seleccionada, solo agregar el ring dorado sin cambiar el fondo
    if (isSelected) {
      return {
        ...baseStyles,
        ring: "ring-4 ring-yellow-400",
      };
    }

    return {
      ...baseStyles,
      ring: "",
    };
  };

  const statusStyles = getStatusStyles();
  const isClickable = !isEditMode; // Todas las mesas son clickeables cuando no está en modo edición

  const getTimeOpen = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  // Determinar icono según tipo de mesa
  const getTableIcon = () => {
    return null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={isClickable ? onClick : undefined}
      className={cn(
        "relative rounded-2xl border-3 transition-all duration-300",
        "p-4 min-h-[140px]",
        statusStyles.border,
        statusStyles.bg,
        statusStyles.ring,
        statusStyles.shadow,
        statusStyles.text,
        isClickable && "cursor-pointer hover:scale-105 active:scale-95",
        !isClickable && isEditMode && "cursor-move hover:scale-105",
        !isClickable && !isEditMode && "cursor-not-allowed opacity-60",
        isDragging && "opacity-50 scale-110 z-50 rotate-3"
      )}
    >
      {/* Indicador de modo edición */}
      {isEditMode && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1.5 shadow-lg animate-pulse">
          <span className="text-xs font-bold">✏️</span>
        </div>
      )}

      {/* Contenido de la mesa */}
      <div className="flex flex-col items-center justify-center space-y-3 h-full">
        {/* Número de mesa con icono según tipo */}
        <div className="flex items-center gap-2">
          {getTableIcon()}
          <span className="text-3xl font-black">
            {tableNumber}
          </span>
        </div>


        {/* Info adicional si está ocupada */}
        {data && (
          <div className="w-full space-y-2">
            {/* Total */}
            <div className="flex items-center justify-center gap-1 text-sm font-bold">
              <DollarSign className="h-3 w-3" />
              {formatCurrency(data.total_amount)}
            </div>

            {/* Tiempo y cantidad de items */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getTimeOpen(data.created_at)}
              </div>
              <Badge variant="secondary" className="text-xs px-2 py-0">
                {data.sale_items?.length || 0} items
              </Badge>
            </div>
          </div>
        )}

        {/* Nombre personalizado (si existe) */}
        {layout.custom_name && (
          <p className="text-xs font-medium text-center truncate w-full">
            {layout.custom_name}
          </p>
        )}
      </div>

      {/* Borde dorado para mesa seleccionada - sin animación */}
      {isSelected && (
        <div className="absolute inset-0 rounded-2xl border-4 border-yellow-400 pointer-events-none" />
      )}
    </div>
  );
}


