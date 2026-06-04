# 📋 PRD - Almendra POS System
## Documento de Requisitos del Producto para TestSprite

> **Versión:** 1.0.0  
> **Sistema:** Almendra - Sistema POS Profesional v3.3.0  
> **Propósito:** Documentar todos los flujos y funcionalidades del bar para pruebas automatizadas con TestSprite  
> **URL Base Local:** `http://localhost:3000` (desarrollo) | Puerto dev: `5173` o `3000`

---

## 🎯 Resumen Ejecutivo

**Almendra** es un sistema POS (Point of Sale) completo para un bar/restaurante que incluye:
- Gestión de ventas por mesas, mostrador y delivery
- Sistema visual de mesas estilo canvas con drag & drop
- Impresión térmica automática en cocina
- Sistema de cajas con turnos y arqueos
- Gestión de productos e inventario
- Sistema de permisos granulares por rol
- Reportes y dashboards en tiempo real
- Módulo de RRHH con fichaje de empleados

---

## 👥 Roles de Usuario

### 1. Administrador (Admin)
- **Credenciales de prueba:** `juan@almendra.com` / `juan123`
- **Permisos:** Acceso total a todas las funcionalidades
- **Capacidades:**
  - Gestionar usuarios y permisos
  - Abrir/cerrar cajas
  - Todas las operaciones de ventas
  - Ver reportes y exportar datos
  - Gestionar productos e inventario
  - Configurar el sistema

### 2. Mozo/Cajero (Waiter)
- **Credenciales de prueba:** (consultar con admin)
- **Permisos:** Operaciones de ventas y mesas
- **Capacidades:**
  - Abrir mesas y tomar pedidos
  - Procesar ventas de mostrador
  - Ver productos y precios
  - No puede acceder a reportes administrativos

### 3. Cocina (Kitchen)
- **Credenciales de prueba:** (consultar con admin)
- **Permisos:** Solo vista de cocina
- **Capacidades:**
  - Ver pedidos pendientes
  - Marcar pedidos como listos
  - No puede acceder a otras secciones

---

## 🔐 Flujo de Autenticación

### F-AUTH-01: Login de Usuario
**Precondiciones:** Usuario no autenticado  
**Ruta:** `/login`

**Pasos:**
1. Navegar a `/login`
2. Ingresar email en campo "Email"
3. Ingresar contraseña en campo "Contraseña"
4. Hacer clic en botón "Iniciar Sesión"

**Resultado esperado:**
- Usuario redirigido a `/dashboard`
- Navbar muestra nombre del usuario
- Toast de bienvenida aparece

**Validaciones:**
- Campo email requerido y formato válido
- Campo contraseña requerido (mínimo 6 caracteres)
- Error si credenciales incorrectas: "Credenciales inválidas"

### F-AUTH-02: Logout de Usuario
**Precondiciones:** Usuario autenticado  
**Ubicación:** Navbar (esquina superior derecha)

**Pasos:**
1. Hacer clic en el nombre de usuario en navbar
2. Seleccionar "Cerrar Sesión"

**Resultado esperado:**
- Usuario redirigido a `/login`
- Sesión eliminada
- No puede acceder a rutas protegidas

---

## 💰 Sistema de Cajas

### F-CASH-01: Abrir Caja
**Precondiciones:** 
- Usuario autenticado con permiso `cash.open`
- No hay caja abierta para el turno actual

**Ruta:** `/caja-bar`

**Pasos:**
1. Navegar a `/caja-bar`
2. Si no hay caja abierta, aparece modal "Abrir Caja"
3. Ingresar monto inicial en "Fondo de Caja" (ej: 5000)
4. Seleccionar turno: "Mañana", "Tarde" o "Noche"
5. (Opcional) Agregar notas de apertura
6. Hacer clic en botón "Abrir Caja"

**Resultado esperado:**
- Modal se cierra
- Vista de caja-bar se habilita
- Status bar muestra "Caja Abierta - Turno: [seleccionado]"
- Toast confirma: "Caja abierta correctamente"

**Validaciones:**
- Monto inicial debe ser >= 0
- Solo un turno puede estar abierto por caja

### F-CASH-02: Cerrar Caja
**Precondiciones:**
- Usuario autenticado con permiso `cash.close`
- Hay caja abierta para el área
- No hay mesas con ventas pendientes

**Ruta:** `/caja-bar`

**Pasos:**
1. Hacer clic en botón "Cerrar Caja" (icono candado en header)
2. Modal de cierre muestra resumen automático:
   - Ventas del turno (efectivo + transferencia)
   - Gastos registrados
   - Ingresos adicionales
   - Total esperado en caja
3. Ingresar "Efectivo Contado" (arqueo real)
4. Sistema calcula diferencia automáticamente
5. (Opcional) Agregar notas de cierre
6. Hacer clic en "Cerrar Caja"

**Resultado esperado:**
- Caja cerrada
- Registro en historial de sesiones
- Usuario redirigido o modal de apertura aparece
- Toast confirma: "Caja cerrada correctamente"

**Validaciones:**
- No puede cerrar si hay mesas abiertas con pedidos pendientes
- Efectivo contado debe ser >= 0
- Diferencia (faltante/sobrante) se registra

---

## 🪑 Sistema de Mesas (Canvas Visual)

### F-TABLE-01: Ver Mapa de Mesas
**Precondiciones:** Caja abierta  
**Ruta:** `/caja-bar` → Pestaña "Mesas"

**Elementos visibles:**
- Canvas visual con mesas posicionadas (1200x700px)
- Pestañas: "Salón" (18 mesas) y "Vereda" (28 mesas)
- Colores de mesas:
  - 🟢 Verde: Mesa libre
  - 🔴 Rojo: Mesa ocupada
  - 🟠 Naranja: Mesa con pago parcial
- Panel lateral derecho (aparece al seleccionar mesa)

### F-TABLE-02: Abrir Mesa Nueva
**Precondiciones:** 
- Caja abierta
- Mesa seleccionada está libre (verde)

**Pasos:**
1. Hacer clic en una mesa verde (libre)
2. Panel lateral se abre mostrando:
   - Número de mesa
   - Campo de búsqueda de productos
   - Área de carrito vacía
3. Buscar producto en campo de búsqueda (por nombre o código)
4. Seleccionar producto de la lista (click o Enter)
5. Producto se agrega al carrito
6. Repetir para más productos
7. (Opcional) Agregar notas de personalización por producto
8. Hacer clic en "Abrir Mesa"

**Resultado esperado:**
- Mesa cambia a color rojo (ocupada)
- Venta creada con status "pending"
- Panel lateral muestra detalles de mesa abierta
- Ticket impreso automáticamente en cocina (si hay productos de cocina)
- Toast confirma: "Mesa abierta correctamente"

**Validaciones:**
- Al menos un producto debe estar en carrito
- Productos con stock limitado validan disponibilidad
- Navegación por teclado: ↑↓ para navegar, Enter para seleccionar, Esc para cerrar

### F-TABLE-03: Agregar Productos a Mesa Abierta
**Precondiciones:** Mesa ya abierta (roja)

**Pasos:**
1. Hacer clic en mesa roja ocupada
2. Panel lateral muestra pedido actual
3. Buscar producto adicional
4. Seleccionar producto
5. Hacer clic en "Agregar a Mesa"

**Resultado esperado:**
- Producto agregado al pedido
- Total actualizado
- Si es producto de cocina, se imprime ticket adicional
- Toast confirma: "Producto agregado"

### F-TABLE-04: Modificar Cantidad de Producto
**Precondiciones:** Mesa abierta con productos

**Pasos:**
1. En panel lateral, localizar producto
2. Usar botones +/- para ajustar cantidad
3. O eliminar con botón X

**Resultado esperado:**
- Cantidad actualizada
- Total recalculado inmediatamente
- Si cantidad llega a 0, producto se elimina

### F-TABLE-05: Personalizar Producto
**Precondiciones:** Mesa abierta con productos

**Pasos:**
1. En panel lateral, hacer clic en icono de personalización del producto
2. Ingresar nota (ej: "sin cebolla", "bien cocido")
3. Confirmar

**Resultado esperado:**
- Nota visible junto al producto
- Nota aparece en ticket de cocina
- Cada producto tiene personalización independiente

### F-TABLE-06: Pago Completo de Mesa
**Precondiciones:** Mesa abierta con productos

**Pasos:**
1. Hacer clic en botón "Cobrar" o "Cerrar Mesa"
2. Modal de pago aparece mostrando:
   - Detalle de productos
   - Total a pagar
   - Métodos de pago: Efectivo | Transferencia
3. Seleccionar método de pago
4. (Si efectivo) Ingresar monto recibido
5. Sistema calcula vuelto automáticamente
6. Hacer clic en "Confirmar Pago"

**Resultado esperado:**
- Mesa cerrada y liberada (vuelve a verde)
- Venta con status "completed"
- Ticket de caja impreso (para cliente)
- Toast confirma: "Venta completada"

**Métodos de pago disponibles:**
- Efectivo
- Transferencia

### F-TABLE-07: Pago Parcial de Mesa
**Precondiciones:** Mesa abierta con productos

**Pasos:**
1. Hacer clic en "Pago Parcial"
2. Modal muestra productos de la mesa
3. Seleccionar productos a pagar (checkbox)
4. O ingresar monto parcial
5. Seleccionar método de pago
6. Confirmar pago parcial

**Resultado esperado:**
- Pago registrado
- Mesa cambia a naranja (pago parcial)
- Monto restante visible en panel
- Mesa sigue abierta hasta pago total

### F-TABLE-08: Cambiar Mesa
**Precondiciones:** Mesa abierta

**Pasos:**
1. Hacer clic en "Cambiar Mesa"
2. Modal muestra mesas disponibles de:
   - Salón (🏠)
   - Vereda (🌳)
3. Seleccionar mesa destino
4. Confirmar cambio

**Resultado esperado:**
- Pedido transferido a nueva mesa
- Mesa original liberada (verde)
- Mesa destino ocupada (roja)
- Toast confirma: "Mesa cambiada"

### F-TABLE-09: Unir Mesas
**Precondiciones:** Al menos 2 mesas abiertas

**Pasos:**
1. Seleccionar primera mesa
2. Hacer clic en "Unir Mesa"
3. Seleccionar mesa a unir
4. Confirmar unión

**Resultado esperado:**
- Productos combinados en una mesa
- Segunda mesa liberada
- Total combinado en mesa principal

### F-TABLE-10: Imprimir Cuenta (Pre-cuenta)
**Precondiciones:** Mesa abierta con productos

**Pasos:**
1. Hacer clic en "Imprimir Cuenta"

**Resultado esperado:**
- Ticket impreso en impresora de caja
- Muestra detalle y total
- Mesa sigue abierta

---

## 🛒 Ventas de Mostrador

### F-COUNTER-01: Crear Venta de Mostrador
**Precondiciones:** Caja abierta  
**Ruta:** `/caja-bar` → Pestaña "Mostrador"

**Pasos:**
1. Hacer clic en "Nuevo Pedido" (o panel lateral vacío)
2. Formulario aparece en panel lateral:
   - Campo "Nombre Cliente" (opcional)
   - Buscador de productos
   - Área de carrito
3. Buscar y agregar productos
4. Hacer clic en "Crear Pedido"

**Resultado esperado:**
- Pedido creado con status "pending" (si tiene productos cocina)
- O status "completed" (si no tiene productos cocina)
- Aparece en listado de mostrador
- Ticket impreso en cocina (si aplica)
- Toast confirma: "Pedido creado"

### F-COUNTER-02: Cerrar Venta de Mostrador
**Precondiciones:** Venta de mostrador pendiente

**Pasos:**
1. Seleccionar venta en listado
2. Panel lateral muestra detalles
3. Hacer clic en "Cobrar"
4. Seleccionar método de pago
5. Confirmar

**Resultado esperado:**
- Venta completada
- Badge cambia a "Completado" (verde)
- Ticket de caja impreso

---

## 🚚 Ventas de Delivery

### F-DELIVERY-01: Crear Pedido de Delivery
**Precondiciones:** Caja abierta  
**Ruta:** `/caja-bar` → Pestaña "Delivery"

**Pasos:**
1. Hacer clic en "Nuevo Pedido"
2. Formulario en panel lateral:
   - **Nombre** (requerido)
   - **Teléfono** (requerido)
   - **Dirección** (requerido)
   - Notas (opcional)
   - Buscador de productos
3. Completar datos del cliente
4. Agregar productos
5. Hacer clic en "Crear Pedido"

**Resultado esperado:**
- Pedido creado con status "pending"
- Ticket impreso en cocina con datos del cliente
- Aparece en listado de delivery
- Badge "Preparando" visible

**Validaciones:**
- Nombre, teléfono y dirección son obligatorios
- Al menos un producto requerido

### F-DELIVERY-02: Cerrar Pedido de Delivery
**Precondiciones:** Pedido de delivery existente

**Pasos:**
1. Seleccionar pedido en listado
2. Ver detalles en panel lateral
3. (Opcional) Esperar que cocina marque como listo
4. Hacer clic en "Cobrar"
5. Seleccionar método de pago
6. Confirmar

**Resultado esperado:**
- Pedido completado
- Ticket de caja impreso
- Badge cambia a "Completado"

---

## 🍳 Vista de Cocina

### F-KITCHEN-01: Ver Pedidos Pendientes
**Precondiciones:** Usuario con rol Kitchen o Admin  
**Ruta:** `/cocina`

**Elementos visibles:**
- Grid de tarjetas de pedidos
- Cada tarjeta muestra:
  - Tipo: "MESA X" / "MOSTRADOR" / "DELIVERY"
  - Tiempo transcurrido (con colores de urgencia)
  - Lista de productos
  - Personalizaciones destacadas
  - Botón "Marcar Listo"

**Sistema de urgencia (colores):**
- 🟢 Verde: < 10 minutos
- 🟡 Amarillo: 10-20 minutos
- 🔴 Rojo: > 20 minutos

### F-KITCHEN-02: Marcar Pedido como Listo
**Precondiciones:** Pedido visible en cocina

**Pasos:**
1. Localizar pedido en el grid
2. Hacer clic en "Marcar Listo" (✓)

**Resultado esperado:**
- Pedido desaparece de la vista de cocina
- En caja-bar, badge cambia a "Listo en cocina"
- Sonido de confirmación (si está activo)

### F-KITCHEN-03: Activar Sonido de Alarma
**Pasos:**
1. Hacer clic en botón de sonido (🔔)
2. Permitir permisos de audio del navegador

**Resultado esperado:**
- Cuando llega nuevo pedido: 3 beeps consecutivos
- Indicador visual de nuevo pedido

### F-KITCHEN-04: Reimprimir Ticket
**Pasos:**
1. Localizar pedido
2. Hacer clic en botón "Reimprimir" (🖨️)

**Resultado esperado:**
- Ticket impreso nuevamente en cocina
- Pedido sigue visible (no se marca como listo)

---

## 📦 Gestión de Productos

### F-PROD-01: Ver Lista de Productos
**Ruta:** `/productos`

**Elementos visibles:**
- Tabla con columnas: Código, Nombre, Categoría, Precio, Stock, Acciones
- Filtros: Por categoría, búsqueda por nombre/código
- Botón "Nuevo Producto"

### F-PROD-02: Crear Producto
**Pasos:**
1. Hacer clic en "Nuevo Producto"
2. Modal con formulario:
   - **Nombre** (requerido)
   - **Código** (único)
   - **Categoría** (selector)
   - **Precio de Venta** (requerido, > 0)
   - **Costo** (opcional)
   - **Stock Inicial**
   - **Stock Mínimo** (para alertas)
   - **Stock Ilimitado** (checkbox para productos preparados)
3. Completar datos
4. Hacer clic en "Guardar"

**Resultado esperado:**
- Producto creado
- Aparece en listado
- Toast confirma: "Producto creado"

**Validaciones:**
- Nombre requerido
- Código único
- Precio > 0

### F-PROD-03: Editar Producto
**Pasos:**
1. Localizar producto en tabla
2. Hacer clic en menú de acciones (⋮)
3. Seleccionar "Editar"
4. Modificar campos
5. Guardar

**Resultado esperado:**
- Producto actualizado
- Historial de precios registra cambio (si precio cambió)

### F-PROD-04: Eliminar Producto
**Pasos:**
1. Localizar producto
2. Menú de acciones → "Eliminar"
3. Confirmar en diálogo

**Resultado esperado:**
- Producto eliminado (soft delete)
- No aparece en listado
- Datos históricos preservados

### F-PROD-05: Buscar Producto
**Pasos:**
1. Escribir en campo de búsqueda
2. Tabla filtra automáticamente

**Criterios de búsqueda:**
- Por nombre (parcial)
- Por código (exacto o parcial)
- Por categoría

---

## 📊 Reportes y Dashboard

### F-REPORT-01: Ver Dashboard Principal
**Ruta:** `/dashboard`

**KPIs visibles:**
- Ventas del día
- Ventas de la semana
- Ticket promedio
- Productos más vendidos

### F-REPORT-02: Ver Reportes de Ventas
**Ruta:** `/reportes`

**Filtros disponibles:**
- Fecha inicio / Fecha fin
- Turno
- Método de pago
- Tipo de venta (mesa/mostrador/delivery)
- Usuario

**Datos mostrados:**
- Total de ventas
- Desglose por método de pago
- Gráficos de tendencia
- Top 10 productos

### F-REPORT-03: Exportar a Excel
**Pasos:**
1. Configurar filtros deseados
2. Hacer clic en "Exportar Excel"

**Resultado esperado:**
- Archivo .xlsx descargado
- Incluye todos los datos filtrados

### F-REPORT-04: Exportar a PDF
**Pasos:**
1. Configurar filtros
2. Hacer clic en "Exportar PDF"

**Resultado esperado:**
- Archivo .pdf descargado
- Formato profesional con logo

---

## 👥 Gestión de Usuarios

### F-USER-01: Ver Lista de Usuarios
**Ruta:** `/usuarios`  
**Permiso requerido:** `users.view`

### F-USER-02: Crear Usuario
**Permiso requerido:** `users.create`

**Pasos:**
1. Hacer clic en "Nuevo Usuario"
2. Completar:
   - Email
   - Nombre
   - Contraseña
   - Rol
3. Guardar

### F-USER-03: Gestionar Permisos
**Permiso requerido:** `users.permissions`

**Pasos:**
1. Seleccionar usuario
2. Hacer clic en "Permisos"
3. Modal muestra checkboxes por módulo
4. Marcar/desmarcar permisos individuales
5. Guardar

---

## ⏰ Módulo RRHH

### F-RRHH-01: Fichaje de Empleado
**Ruta:** `/rrhh/fichar` (pública, sin autenticación)

**Pasos:**
1. Empleado ingresa DNI
2. Hacer clic en "Marcar"
3. Sistema detecta automáticamente:
   - Si no hay entrada: registra ENTRADA
   - Si hay entrada sin salida: registra SALIDA

**Validaciones:**
- DNI debe estar registrado
- Teléfono/dispositivo debe coincidir (antifraude)

### F-RRHH-02: Ver Reportes de Asistencia
**Ruta:** `/rrhh`  
**Permiso requerido:** Admin

**Datos visibles:**
- Resumen semanal/mensual
- Horas trabajadas por empleado
- Selectores de período personalizados

### F-RRHH-03: Registrar Pago a Empleado
**Ruta:** `/rrhh` → Sección Pagos

**Pasos:**
1. Seleccionar empleado
2. Seleccionar tipo: "Pago" o "Adelanto"
3. Ingresar monto
4. Seleccionar método de pago
5. (Opcional) Agregar notas
6. Confirmar

---

## 💸 Gestión de Gastos

### F-EXP-01: Registrar Gasto
**Ruta:** `/gastos`  
**Precondición:** Caja abierta

**Pasos:**
1. Hacer clic en "Nuevo Gasto"
2. Completar:
   - Descripción
   - Categoría (servicios/suministros/mantenimiento/otros)
   - Monto
3. Guardar

**Resultado esperado:**
- Gasto registrado
- Asociado a sesión de caja actual
- Aparece en arqueo de cierre

---

## 🏪 Proveedores y Compras

### F-SUPP-01: Registrar Compra
**Ruta:** `/proveedores`

**Pasos:**
1. Seleccionar proveedor (o crear nuevo)
2. Hacer clic en "Nueva Compra"
3. Agregar productos con cantidades
4. Ingresar precio de compra por unidad
5. Confirmar

**Resultado esperado:**
- Compra registrada
- Stock incrementado automáticamente
- Costo de producto actualizado (si aplica)

---

## 🖨️ Sistema de Impresión

### Configuración Requerida
- Servidor Node.js local en `localhost:3001`
- Impresora de cocina: TCP o compartida (\\\\almendra\\Cocina)
- Impresora de caja: USB local

### Tickets que se imprimen automáticamente
1. **Al crear venta con productos de cocina** → Impresora cocina
2. **Al cerrar/cobrar mesa** → Impresora caja
3. **Al agregar productos a mesa abierta** → Impresora cocina

### Formato de tickets
- **Mesa:** "MESA: X" + "Mozo: [nombre]" + productos
- **Mostrador:** "MOSTRADOR" + productos
- **Delivery:** "DELIVERY" + cliente + teléfono + dirección + productos

---

## 🔒 Rutas y Permisos

| Ruta | Permiso Requerido | Roles con Acceso |
|------|-------------------|------------------|
| `/dashboard` | `dashboard.view` | Admin, Waiter |
| `/caja-bar` | `cash.view` | Admin, Waiter |
| `/cocina` | `kitchen.view` | Admin, Kitchen |
| `/productos` | `products.view` | Admin, Waiter |
| `/reportes` | `reports.view` | Admin |
| `/usuarios` | `users.view` | Admin |
| `/rrhh` | `rrhh.view` | Admin |
| `/gastos` | `expenses.view` | Admin |
| `/proveedores` | `suppliers.view` | Admin |
| `/rrhh/fichar` | (público) | Todos |
| `/menu` | (público) | Todos |

---

## 📱 Comportamiento Responsive

### Mobile (< 768px)
- Navbar con menú hamburguesa
- Mapa de mesas: scroll horizontal
- Panel lateral: modal a pantalla completa
- Tablas: scroll horizontal

### Tablet (768px - 1024px)
- Navbar completa pero compacta
- Mapa de mesas visible
- Panel lateral: sidebar

### Desktop (> 1024px)
- Interfaz completa
- Panel lateral fijo a la derecha
- Todas las funciones visibles

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `↑` / `↓` | Navegar lista de productos |
| `Enter` | Seleccionar producto |
| `Escape` | Cerrar modal/panel |
| `F1-F6` | Navegación rápida entre secciones |
| `Ctrl+S` | Guardar formulario |

---

## 🧪 Escenarios de Prueba Críticos

### Escenario 1: Flujo Completo de Mesa
1. Login como Admin
2. Abrir caja
3. Abrir mesa 1 con 2 productos
4. Verificar impresión en cocina
5. Agregar 1 producto más
6. Hacer pago parcial de 1 producto
7. Cerrar mesa con pago completo
8. Verificar en reportes

### Escenario 2: Delivery Completo
1. Crear pedido delivery
2. Verificar en cocina
3. Marcar como listo en cocina
4. Cobrar delivery
5. Verificar datos de cliente en ticket

### Escenario 3: Mostrador Rápido
1. Crear venta mostrador
2. Cobrar inmediatamente
3. Verificar que no aparece en cocina (si no tiene productos cocina)

### Escenario 4: Cambio de Mesa
1. Abrir mesa 5
2. Cambiar a mesa 10
3. Verificar que mesa 5 quedó libre
4. Verificar productos en mesa 10

### Escenario 5: Arqueo de Caja
1. Hacer 3 ventas (2 efectivo, 1 transferencia)
2. Registrar 1 gasto
3. Cerrar caja
4. Verificar que totales coinciden

---

## 📋 Validaciones Importantes

### Ventas
- Stock suficiente para productos con stock limitado
- Monto >= 0
- Al menos un producto por venta
- Método de pago seleccionado

### Usuarios
- Email único y válido
- Contraseña mínimo 6 caracteres
- Rol obligatorio

### Productos
- Nombre único
- Código único
- Precio > 0

### RRHH
- DNI único por empleado
- Dispositivo vinculado correcto

---

## 🔧 Datos de Prueba Recomendados

### Productos de ejemplo
| Código | Nombre | Precio | Stock | Cocina |
|--------|--------|--------|-------|--------|
| CERV01 | Cerveza Artesanal | 1500 | 100 | ❌ |
| SAND01 | Sandwich de Lomo | 3500 | ∞ | ✅ |
| PIZZ01 | Pizza Muzzarella | 4500 | ∞ | ✅ |
| GASE01 | Gaseosa 500ml | 800 | 50 | ❌ |
| CAFE01 | Café Espresso | 1200 | ∞ | ✅ |

### Mesas
- Salón: Mesas 1-18
- Vereda: Mesas 19-46

---

## 📝 Notas para TestSprite

1. **URL base:** El sistema corre en `http://localhost:3000` o `http://localhost:5173`
2. **Autenticación:** Usar credenciales de prueba proporcionadas
3. **Impresión:** En ambiente de test, el servidor de impresión puede no estar disponible
4. **Tiempo real:** Polling cada 5-30 segundos, esperar actualizaciones
5. **Transiciones:** Usar waits para animaciones y transiciones
6. **Toasts:** Verificar mensajes de confirmación después de acciones
7. **Selectores recomendados:** Usar `data-testid` cuando estén disponibles, o textos visibles
