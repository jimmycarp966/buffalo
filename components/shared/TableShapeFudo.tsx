"use client";

import React, { memo, type CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface TableShapeFudoProps {
  tableNumber: number;
  status: "available" | "occupied" | "partial" | "printed";
  isSelected: boolean;
  isEditMode: boolean;
  onClick: () => void;
  data?: any;
  shape?: "square" | "circle" | "rectangle";
  customName?: string;
  scale?: number;
  width?: number;
  height?: number;
  baseSize?: number;
  onResize?: (width: number, height: number) => void;
}

export function TableShapeFudo({
  tableNumber,
  status,
  isSelected,
  isEditMode,
  onClick,
  data,
  shape = "square",
  customName,
  scale = 1,
  width = 1,
  height = 1,
  baseSize = 80,
}: TableShapeFudoProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tableNumber.toString(),
    disabled: !isEditMode,
  });

  const translateTransform = transform ? CSS.Translate.toString(transform) : undefined;

  const style: CSSProperties = {
    transform: translateTransform,
    zIndex: transform ? 50 : 20,
  };

  const getShapeStyles = () => {
    const scaleFactor = scale ?? 1;
    const w = baseSize * width * scaleFactor;
    const h = baseSize * height * scaleFactor;

    switch (shape) {
      case "circle":
        return {
          width: `${w}px`,
          height: `${h}px`,
          borderRadius: "50%",
        };
      case "rectangle":
        return {
          width: `${w * 1.2}px`,
          height: `${h}px`,
          borderRadius: "14px",
        };
      case "square":
      default:
        return {
          width: `${w}px`,
          height: `${h}px`,
          borderRadius: "16px",
        };
    }
  };

  const getStatusStyles = () => {
    let baseStyles;

    switch (status) {
      case "available":
        baseStyles = {
          border: "border-emerald-300/85",
          bg: "bg-[linear-gradient(135deg,#119c72_0%,#1dc28f_56%,#34d7a2_100%)]",
          shadow:
            "shadow-[0_16px_36px_rgba(10,165,111,0.3)] hover:shadow-[0_22px_44px_rgba(10,165,111,0.44)]",
          text: "text-white",
        };
        break;
      case "occupied":
        baseStyles = {
          border: "border-rose-300/80",
          bg: "bg-[linear-gradient(135deg,#a91d53_0%,#de3f70_55%,#ff8b7b_100%)]",
          shadow:
            "shadow-[0_16px_36px_rgba(169,29,83,0.28)] hover:shadow-[0_22px_44px_rgba(169,29,83,0.42)]",
          text: "text-white",
        };
        break;
      case "partial":
        baseStyles = {
          border: "border-amber-200/80",
          bg: "bg-[linear-gradient(135deg,#e48b18_0%,#f5b73c_45%,#ffe08a_100%)]",
          shadow:
            "shadow-[0_16px_34px_rgba(228,139,24,0.26)] hover:shadow-[0_22px_44px_rgba(228,139,24,0.36)]",
          text: "text-[#311600]",
        };
        break;
      case "printed":
        baseStyles = {
          border: "border-cyan-200/80",
          bg: "bg-[linear-gradient(135deg,#1182c5_0%,#2fb6ea_55%,#8ce8ff_100%)]",
          shadow:
            "shadow-[0_16px_36px_rgba(17,130,197,0.3)] hover:shadow-[0_22px_44px_rgba(17,130,197,0.42)]",
          text: "text-white",
        };
        break;
      default:
        baseStyles = {
          border: "border-gray-300",
          bg: "bg-gradient-to-br from-gray-100 to-gray-50",
          shadow: "",
          text: "text-gray-700",
        };
    }

    if (isSelected) {
      return {
        ...baseStyles,
        ring: "ring-4 ring-secondary ring-offset-4 ring-offset-[#16040f]",
      };
    }

    return {
      ...baseStyles,
      ring: "",
    };
  };

  const statusStyles = getStatusStyles();
  const isClickable = !isEditMode;
  const canDrag = isEditMode;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        ...getShapeStyles(),
      }}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      onClick={isClickable ? onClick : undefined}
      className={cn(
        "relative flex items-center justify-center border-[3px] p-3 transition-all duration-200 before:absolute before:inset-[3px] before:rounded-[12px] before:bg-white/6 before:content-['']",
        statusStyles.border,
        statusStyles.bg,
        statusStyles.ring,
        statusStyles.shadow,
        statusStyles.text,
        isClickable && "cursor-pointer hover:-translate-y-1 hover:scale-105 active:scale-95",
        canDrag && "cursor-move hover:scale-105",
        !isClickable && !canDrag && "cursor-not-allowed opacity-60",
        isDragging && "z-50 rotate-2 scale-110 opacity-50"
      )}
    >
      {isEditMode && canDrag && (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background shadow-lg ring-2 ring-secondary/60">
          <span className="text-xs font-bold">E</span>
        </div>
      )}

      <div
        className="relative z-10 font-black leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.18)]"
        style={{ fontSize: `${Math.max(1.2, 1.8 * Math.min(width, height))}rem` }}
      >
        {customName || tableNumber}
      </div>

      {isSelected && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 border-4 border-secondary",
            shape === "circle" ? "rounded-full" : "rounded-2xl"
          )}
        />
      )}

      {isEditMode && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border bg-foreground/90 px-2 py-0.5 text-[10px] font-medium text-background/80 shadow-sm backdrop-blur-sm">
          {shape === "circle" && "O"}
          {shape === "square" && "S"}
          {shape === "rectangle" && "R"}
        </div>
      )}
    </div>
  );
}

function arePropsEqual(prevProps: TableShapeFudoProps, nextProps: TableShapeFudoProps): boolean {
  return (
    prevProps.tableNumber === nextProps.tableNumber &&
    prevProps.status === nextProps.status &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isEditMode === nextProps.isEditMode &&
    prevProps.shape === nextProps.shape &&
    prevProps.scale === nextProps.scale &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.customName === nextProps.customName &&
    prevProps.data?.total === nextProps.data?.total
  );
}

export const MemoizedTableShapeFudo = memo(TableShapeFudo, arePropsEqual);
