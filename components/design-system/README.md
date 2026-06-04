# 🎨 Design System - Febrero Tostadores de Café

Sistema de diseño unificado para la aplicación Febrero.

## 📁 Estructura

```
components/design-system/
├── buttons/           # Botones unificados
├── cards/            # Tarjetas y contenedores
├── feedback/         # Estados vacíos, errores, éxito
├── skeletons/        # Estados de carga
└── index.ts          # Barrel exports
```

## 🚀 Uso

### Botones

```tsx
import { PrimaryButton, SecondaryButton, DangerButton } from "@/components/design-system";

// Botón primario - Acciones principales
<PrimaryButton onClick={handleSave}>
  Guardar
</PrimaryButton>

// Con iconos
<PrimaryButton leftIcon={<Save className="h-4 w-4" />}>
  Guardar
</PrimaryButton>

// Loading state
<PrimaryButton isLoading loadingText="Guardando...">
  Guardar
</PrimaryButton>

// Botón secundario - Acciones secundarias
<SecondaryButton onClick={handleCancel}>
  Cancelar
</SecondaryButton>

// Botón de peligro - Acciones destructivas
<DangerButton onClick={handleDelete}>
  Eliminar
</DangerButton>
```

### Cards

```tsx
import { StatCard, ActionCard, InfoCard } from "@/components/design-system";

// Card de estadísticas
<StatCard
  title="Ventas de Hoy"
  value="$15,230"
  subtitle="23 ventas"
  icon={<ShoppingCart className="h-4 w-4" />}
  trend={{ value: 12, isPositive: true }}
/>

// Card de acción (clickable)
<ActionCard
  title="Caja Bar"
  description="Abrir punto de venta"
  icon={<ShoppingBag className="h-6 w-6" />}
  onClick={() => router.push('/caja-bar')}
/>

// Card de información
<InfoCard variant="warning" title="Stock Bajo">
  5 productos necesitan reposición.
</InfoCard>
```

### Skeletons

```tsx
import { DashboardSkeleton, TableSkeleton, StatCardSkeleton } from "@/components/design-system";

// Skeleton completo del dashboard
{isLoading && <DashboardSkeleton />}

// Skeleton de tabla
{isLoading && <TableSkeleton rows={10} columns={5} />}

// Skeleton individual
<div className="grid grid-cols-4">
  <StatCardSkeleton />
  <StatCardSkeleton />
  <StatCardSkeleton />
  <StatCardSkeleton />
</div>
```

### Feedback

```tsx
import { EmptyState, ErrorState, SuccessState, StatusBadge } from "@/components/design-system";

// Estado vacío
<EmptyState
  icon={<Package className="h-16 w-16" />}
  title="No hay productos"
  description="Aún no has agregado productos."
  action={{ label: "Agregar Producto", href: "/productos/nuevo" }}
/>

// Predefinidos
<EmptySales />
<EmptyProducts />
<EmptySearch searchTerm="coca" onClear={() => setSearch('')} />

// Estado de error
<ErrorState
  title="Error de conexión"
  message="No se pudieron cargar los datos."
  onRetry={() => refetch()}
/>

// Badge de estado
<StatusBadge status="success">Completada</StatusBadge>
<StatusBadge status="pending" pulse>En progreso</StatusBadge>
```

## 🎯 Características

### ✅ Accesibilidad (A11Y)

- Focus indicators consistentes en todo el sistema
- Skip links para navegación por teclado
- Estados de carga anunciados a screen readers
- Contraste adecuado

### 🎬 Microinteracciones

- Animaciones suaves con Framer Motion
- Estados hover y active
- Loading states animados
- Transiciones consistentes

### 📱 Responsive

- Mobile-first
- Touch targets de 44px mínimo
- Skeletons adaptativos
- Cards que se reordenan en móvil

### 🎨 Consistencia

- Colores del tema Febrero
- Espaciado de 8pt grid
- Tipografía consistente
- Sombras y bordes uniformes

## 🆕 Migración desde componentes antiguos

### Antes:
```tsx
<Card className="border-4 border-febrero-caramel hover:border-febrero-espresso">
  <CardContent className="p-10 text-center">
    <h3 className="text-4xl font-black">BAR</h3>
  </CardContent>
</Card>
```

### Después:
```tsx
<ActionCard
  title="Caja Bar"
  icon={<ShoppingBag className="h-10 w-10" />}
  className="border-2 border-febrero-caramel/50"
/>
```

## 📝 Reglas de uso

1. **Siempre usar los botones del design system** en lugar de los de shadcn directamente
2. **Usar skeletons** para estados de carga en lugar de spinners genéricos
3. **Usar EmptyState** cuando no hay datos en lugar de mensajes de texto simples
4. **Mantener consistencia** en espaciado usando las utilidades del sistema
