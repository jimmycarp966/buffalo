"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Map, 
  List, 
  BarChart3, 
  Filter, 
  Bell, 
  Settings,
  RefreshCw,
  Edit3,
  Grid3x3
} from "lucide-react";
import { Mesa } from "@/types/mesa";
import { BarCanvasView } from "./BarCanvasView";
import { MesaListView } from "./MesaListView";
import { MesaStatistics } from "./MesaStatistics";
import { MesaFilters } from "./MesaFilters";
import { NotificationSystem } from "./NotificationSystem";
import { MesaDetailsModal } from "./MesaDetailsModal";

export function FudoMesaSystem() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [filteredMesas, setFilteredMesas] = useState<Mesa[]>([]);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("mapa");
  const [isLoading, setIsLoading] = useState(true);

  // Cargar mesas (simulado - en un sistema real vendría de la API)
  useEffect(() => {
    const cargarMesas = async () => {
      setIsLoading(true);
      try {
        // Simular carga de datos
        const mesasSimuladas: Mesa[] = [
          {
            id: "1",
            numero: 1,
            capacidad: 4,
            forma: "cuadrada",
            estado: "disponible",
            posicion: { x: 100, y: 100 },
            zona: "principal",
            customName: "Mesa VIP"
          },
          {
            id: "2",
            numero: 2,
            capacidad: 6,
            forma: "rectangular",
            estado: "ocupada",
            posicion: { x: 200, y: 100 },
            zona: "principal",
            comensales: 4,
            horaOcupacion: new Date(Date.now() - 90 * 60 * 1000), // 90 minutos atrás
            ordenId: "ORD-001"
          },
          {
            id: "3",
            numero: 3,
            capacidad: 2,
            forma: "circular",
            estado: "reservada",
            posicion: { x: 300, y: 100 },
            zona: "exterior",
            horaReserva: new Date(Date.now() + 30 * 60 * 1000) // En 30 minutos
          },
          {
            id: "4",
            numero: 4,
            capacidad: 8,
            forma: "rectangular",
            estado: "limpieza",
            posicion: { x: 400, y: 100 },
            zona: "exterior",
            horaInicioLimpieza: new Date(Date.now() - 45 * 60 * 1000) // 45 minutos atrás
          },
          // Agregar más mesas...
          ...Array.from({ length: 20 }, (_, i) => ({
            id: `${i + 5}`,
            numero: i + 5,
            capacidad: Math.floor(Math.random() * 6) + 2,
            forma: ["circular", "rectangular", "cuadrada"][Math.floor(Math.random() * 3)] as Mesa['forma'],
            estado: ["disponible", "ocupada", "reservada", "limpieza"][Math.floor(Math.random() * 4)] as Mesa['estado'],
            posicion: { 
              x: Math.random() * 1000 + 50, 
              y: Math.random() * 500 + 50 
            },
            zona: Math.random() > 0.5 ? "principal" as const : "exterior" as const,
            comensales: Math.random() > 0.5 ? Math.floor(Math.random() * 6) + 1 : undefined,
            horaOcupacion: Math.random() > 0.7 ? new Date(Date.now() - Math.random() * 180 * 60 * 1000) : undefined,
            horaReserva: Math.random() > 0.8 ? new Date(Date.now() + Math.random() * 120 * 60 * 1000) : undefined,
            horaInicioLimpieza: Math.random() > 0.9 ? new Date(Date.now() - Math.random() * 60 * 60 * 1000) : undefined
          }))
        ];

        setMesas(mesasSimuladas);
        setFilteredMesas(mesasSimuladas);
      } catch (error) {
        console.error("Error cargando mesas:", error);
      } finally {
        setIsLoading(false);
      }
    };

    cargarMesas();
  }, []);

  const handleMesaClick = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setIsModalOpen(true);
  };

  const handleMesaUpdate = (mesaActualizada: Mesa) => {
    setMesas(prev => prev.map(m => m.id === mesaActualizada.id ? mesaActualizada : m));
    setFilteredMesas(prev => prev.map(m => m.id === mesaActualizada.id ? mesaActualizada : m));
    setIsModalOpen(false);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-muted-foreground">Cargando sistema de mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 via-white to-green-50 border-2 border-blue-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-blue-600 flex items-center gap-3 mb-2">
              🍽️ Sistema de Mesas Fudo
            </h1>
            <p className="text-muted-foreground mb-3">
              Gestión completa de mesas con estados, timers y notificaciones
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="default" className="bg-green-500 text-white">
                🟢 {mesas.filter(m => m.estado === 'disponible').length} Disponibles
              </Badge>
              <Badge variant="default" className="bg-red-500 text-white">
                🔴 {mesas.filter(m => m.estado === 'ocupada').length} Ocupadas
              </Badge>
              <Badge variant="default" className="bg-yellow-500 text-white">
                🟡 {mesas.filter(m => m.estado === 'reservada').length} Reservadas
              </Badge>
              <Badge variant="default" className="bg-gray-500 text-white">
                ⚪ {mesas.filter(m => m.estado === 'limpieza').length} En Limpieza
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configuración
            </Button>
          </div>
        </div>
      </Card>

      {/* Sistema de notificaciones */}
      <NotificationSystem 
        mesas={mesas} 
        onMesaClick={handleMesaClick}
      />

      {/* Filtros */}
      <MesaFilters 
        mesas={mesas}
        onFilterChange={setFilteredMesas}
      />

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mapa" className="flex items-center gap-2">
            <Map className="w-4 h-4" />
            Mapa Visual
          </TabsTrigger>
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Vista Lista
          </TabsTrigger>
          <TabsTrigger value="estadisticas" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Estadísticas
          </TabsTrigger>
          <TabsTrigger value="configuracion" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuración
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapa" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Map className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold">Mapa Visual de Mesas</h3>
              <Badge variant="outline">
                {filteredMesas.length} mesas mostradas
              </Badge>
            </div>
            <BarCanvasView />
          </Card>
        </TabsContent>

        <TabsContent value="lista" className="space-y-4">
          <MesaListView 
            mesas={filteredMesas}
            onMesaClick={handleMesaClick}
            onMesaEdit={handleMesaClick}
          />
        </TabsContent>

        <TabsContent value="estadisticas" className="space-y-4">
          <MesaStatistics mesas={mesas} />
        </TabsContent>

        <TabsContent value="configuracion" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500" />
              Configuración del Sistema
            </h3>
            <div className="text-center py-12 space-y-4">
              <div className="text-6xl">⚙️</div>
              <h4 className="text-xl font-semibold">Configuración</h4>
              <p className="text-muted-foreground">
                Aquí podrás configurar parámetros del sistema, notificaciones y preferencias.
              </p>
              <Button variant="outline">
                <Edit3 className="w-4 h-4 mr-2" />
                Configurar Sistema
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de detalles de mesa */}
      <MesaDetailsModal
        mesa={selectedMesa}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={handleMesaUpdate}
      />
    </div>
  );
}
