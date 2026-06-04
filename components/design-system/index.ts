// =============================================================================
// DESIGN SYSTEM
// =============================================================================
// Sistema de diseño unificado para toda la aplicación
// 
// Uso: import { Button, Card, ErrorState, ... } from "@/components/design-system";
// =============================================================================

// ------------------------------------------------------------------------------
// Buttons - Botones unificados
// ------------------------------------------------------------------------------
export {
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  GhostButton,
  FabButton,
  type ButtonProps,
} from "./buttons";

// ------------------------------------------------------------------------------
// Cards - Tarjetas de contenido
// ------------------------------------------------------------------------------
export {
  Card,
  StatCard,
  ActionCard,
  InfoCard,
  ListCard,
  type CardProps,
  type StatCardProps,
  type ActionCardProps,
  type InfoCardProps,
  type ListCardProps,
} from "./cards";

// ------------------------------------------------------------------------------
// Skeletons - Estados de carga
// ------------------------------------------------------------------------------
export {
  StatCardSkeleton,
  TableSkeleton,
  ListSkeleton,
  DashboardSkeleton,
  SalesPageSkeleton,
  TablesMapSkeleton,
  FormSkeleton,
  CartItemSkeleton,
  KitchenOrderSkeleton,
  LoginSkeleton,
} from "./skeletons";

// ------------------------------------------------------------------------------
// Feedback - Estados de feedback
// ------------------------------------------------------------------------------
export {
  ErrorState,
  SuccessState,
  LoadingOverlay,
  StatusBadge,
  InfoAlert,
  EmptyState,
  EmptyProducts,
  EmptySales,
  EmptySearch,
  EmptyKitchen,
} from "./feedback";

// ------------------------------------------------------------------------------
// Re-exportaciones de shadcn/ui para conveniencia
// ------------------------------------------------------------------------------
export { Button } from "@/components/ui/button";
export { CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
export { Badge } from "@/components/ui/badge";
