"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogIn, LogOut, ShoppingCart, Printer, DollarSign, ChevronDown } from "lucide-react";
import { OpenCashModal } from "./OpenCashModal";
import { CloseCashModal } from "./CloseCashModal";
import { IncomeModal } from "./IncomeModal";
import { SaleView } from "./SaleView";
import { CashHistoryTab } from "./CashHistoryTab";
import { PrintTicket } from "./PrintTicket";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getLastSaleFromSession, getDailyStats } from "@/actions/saleActions";
import { useNotificationStore } from "@/store/notificationStore";
import { EMPLOYEES } from "@/lib/validations";

interface CashRegister {
  id: string;
  name: string;
  type: string;
}

interface CashSession {
  id: string;
  opening_amount: number;
  opened_at: string;
  shift: string;
  status: string;
  area?: string; // Área de la caja (bar)
  employees?: string[]; // IDs de empleados del turno
  opened_by?: {
    id: string;
    full_name: string;
  };
  closed_by?: {
    id: string;
    full_name: string;
  };
  cash_register?: any;
}

interface CashRegisterViewProps {
  cashRegister: CashRegister;
  initialSession: CashSession | null;
  type: "bar";
}

export function CashRegisterView({
  cashRegister,
  initialSession,
  type,
}: CashRegisterViewProps) {
  // Hooks PRIMERO (siempre deben llamarse en el mismo orden)
  const [isMounted, setIsMounted] = useState(false);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [showSaleView, setShowSaleView] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [showReprintTicket, setShowReprintTicket] = useState(false);
  const [isSessionCardOpen, setIsSessionCardOpen] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const [dailyStats, setDailyStats] = useState({
    sales: 0,
    transactions: 0,
    expenses: 0,
    cash: 0
  });
  const addNotification = useNotificationStore((state) => state.addNotification);

  const isOpen = initialSession?.status === "open";

  // Verificar que el componente está montado en el cliente
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Validación temprana pero DESPUÉS de todos los hooks
  const isLoading = !isMounted || !cashRegister;

  const getEmployeeNames = (employeeIds?: string[]): string => {
    if (!employeeIds || employeeIds.length === 0) return "Sin empleados asignados";

    const names = employeeIds
      .map(id => EMPLOYEES.find(emp => emp.id === id)?.name)
      .filter(Boolean);

    return names.join(", ");
  };
  const colorClass = "text-foreground";
  const bgColorClass = "border border-border bg-card text-foreground";

  const getShiftIcon = (shift: string) => {
    switch (shift) {
      case "morning": return "🌅";
      case "afternoon": return "🌆";
      case "night": return "🌙";
      default: return "📅";
    }
  };

  const getShiftName = (shift: string) => {
    switch (shift) {
      case "morning": return "Mañana";
      case "afternoon": return "Tarde";
      case "night": return "Noche";
      default: return shift;
    }
  };

  const loadDailyStats = useCallback(async () => {
    if (!initialSession) return;

    const result = await getDailyStats(initialSession.id);
    if (result.success && result.data) {
      setDailyStats(result.data);
    } else {
      console.error("Error loading daily stats:", result.message);
    }
  }, [initialSession]);

  const handleReprintLastTicket = async () => {
    if (!initialSession) return;

    const result = await getLastSaleFromSession(initialSession.id);

    if (result.success && result.data) {
      setLastSaleData(result.data);
      setShowReprintTicket(true);
    } else {
      addNotification("error", result.message || "No se pudo obtener la última venta");
    }
  };

  // Cargar estadísticas cuando se carga el componente
  useEffect(() => {
    if (isMounted && initialSession) {
      loadDailyStats();
    }
  }, [isMounted, initialSession, loadDailyStats]);

  // Validación defensiva: NO renderizar NADA hasta que todo esté listo
  if (!isMounted) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-buffalo-caramel"></div>
          </div>
          <p className="text-muted-foreground">Inicializando...</p>
        </div>
      </Card>
    );
  }

  if (!cashRegister || !cashRegister.id || !cashRegister.name) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <p className="text-red-600 font-semibold">Error de Configuración</p>
          <p className="text-muted-foreground">
            No se pudo cargar la información de la caja registradora.
            <br />
            Por favor, recarga la página o contacta al administrador.
          </p>
        </div>
      </Card>
    );
  }

  // En este punto, TypeScript sabe que cashRegister está definido y tiene id y name
  const safeCashRegister = cashRegister;

  if (showSaleView && isOpen && initialSession) {
    return (
      <SaleView
        cashRegister={safeCashRegister}
        session={initialSession}
        onBack={() => setShowSaleView(false)}
        onSaleComplete={loadDailyStats}
        type={type}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-brand text-4xl tracking-tight text-foreground">{safeCashRegister.name}</h1>
          <p className="text-muted-foreground">
            Gestión de caja y punto de venta
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isOpen && initialSession && (
            <Badge variant="outline" className="text-base px-4 py-2 border-buffalo-espresso">
              {getShiftIcon(initialSession.shift)} Turno {getShiftName(initialSession.shift)}
            </Badge>
          )}
          <Badge variant={isOpen ? "success" : "secondary"} className="text-sm px-4 py-2">
            {isOpen ? "Caja Abierta" : "Caja Cerrada"}
          </Badge>
          {isOpen && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setIsSessionCardOpen((v) => !v)}
            >
              Detalles
              <ChevronDown className={`h-4 w-4 transition-transform ${isSessionCardOpen ? "rotate-180" : ""}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-6 py-3 font-medium transition-colors ${activeTab === "active"
              ? "border-b-2 border-secondary text-secondary"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Caja Activa
          </div>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-6 py-3 font-medium transition-colors ${activeTab === "history"
              ? "border-b-2 border-secondary text-secondary"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Historial
          </div>
        </button>
      </div>

      {/* Contenido de Caja Activa */}
      {activeTab === "active" && (
        <>
          {isOpen && initialSession ? (
            <>
              {isSessionCardOpen && (
                <Card className={bgColorClass}>
                  <CardHeader>
                    <CardTitle className={colorClass}>Sesión Activa</CardTitle>
                    <CardDescription>
                      Apertura: {formatDate(new Date(initialSession.opened_at))}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Cajero</p>
                        <p className="font-medium">
                          {initialSession.opened_by?.full_name || 'Usuario desconocido'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Monto Inicial</p>
                        <p className="font-medium text-lg">
                          {formatCurrency(initialSession.opening_amount)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Empleados del Turno</p>
                      <p className="font-medium text-sm">
                        {getEmployeeNames(initialSession.employees)}
                      </p>
                    </div>
                    <div className="space-y-2 pt-4">
                      {/* Nota: El botón "Nueva Venta" fue removido - ahora las ventas se abren directamente desde el mapa de mesas */}

                      {/* Fila 1: Acciones principales */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={handleReprintLastTicket}
                          size="lg"
                          className="flex-1"
                        >
                          <Printer className="mr-2 h-5 w-5" />
                          Reimprimir Último
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setIsIncomeModalOpen(true)}
                          size="lg"
                          className="flex-1 border-green-400/20 bg-green-500/10 text-green-700 hover:bg-green-500/15"
                        >
                          <DollarSign className="mr-2 h-5 w-5" />
                          Ingreso Extra
                        </Button>
                      </div>

                      {/* Fila 2: Cierre de caja */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsCloseModalOpen(true)}
                          size="lg"
                          className="w-full"
                        >
                          <LogOut className="mr-2 h-5 w-5" />
                          Cerrar Caja
                        </Button>
                      </div>

                      {/* Instrucción para abrir mesas */}
                      <div className="pt-2 px-2">
                        <p className="text-xs text-muted-foreground text-center">
                          💡 Para tomar un pedido, tocá una mesa libre en el mapa
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Estadísticas del día */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Ventas del Día</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(dailyStats.sales)}</div>
                    <p className="text-xs text-muted-foreground">{dailyStats.transactions} transacciones</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Efectivo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(dailyStats.cash)}
                    </div>
                    <p className="text-xs text-muted-foreground">Disponible</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Gastos</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="text-2xl font-bold text-foreground">{formatCurrency(dailyStats.expenses)}</div>
                    <p className="text-xs text-muted-foreground">Registrados hoy</p>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <LogIn className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Caja Cerrada</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Para comenzar a operar, debes abrir la caja registrando el monto
                  inicial en efectivo.
                </p>
                <Button onClick={() => setIsOpenModalOpen(true)} size="lg">
                  <LogIn className="mr-2 h-5 w-5" />
                  Abrir Caja
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Contenido de Historial */}
      {activeTab === "history" && (
        <CashHistoryTab cashRegisterId={safeCashRegister.id} />
      )}

      <OpenCashModal
        open={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        cashRegisterId={safeCashRegister.id}
        type={type}
      />

      {initialSession && (
        <>
          <CloseCashModal
            open={isCloseModalOpen}
            onClose={() => setIsCloseModalOpen(false)}
            session={initialSession}
          />

          <IncomeModal
            open={isIncomeModalOpen}
            onClose={() => {
              setIsIncomeModalOpen(false);
              loadDailyStats(); // Recargar estadísticas después de registrar ingreso
            }}
            sessionId={initialSession.id}
            sessionArea={initialSession.area || type}
          />
        </>
      )}

      {showReprintTicket && lastSaleData && (
        <PrintTicket
          sale={lastSaleData.sale}
          items={lastSaleData.items}
          payments={lastSaleData.payments}
          onAfterPrint={() => {
            setShowReprintTicket(false);
            setLastSaleData(null);
          }}
        />
      )}
    </div>
  );
}



