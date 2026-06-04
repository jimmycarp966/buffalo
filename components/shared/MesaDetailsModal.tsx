"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Mesa, MESA_ESTADOS, MESA_FORMAS } from "@/types/mesa";
import { 
  Clock, 
  Users, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Save,
  Trash2,
  Edit3
} from "lucide-react";

interface MesaDetailsModalProps {
  mesa: Mesa | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (mesa: Mesa) => void;
  onDelete?: (mesaId: string) => void;
}

export function MesaDetailsModal({
  mesa,
  isOpen,
  onClose,
  onUpdate,
  onDelete
}: MesaDetailsModalProps) {
  const [formData, setFormData] = useState<Partial<Mesa>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState<string>("");

  useEffect(() => {
    if (mesa) {
      setFormData(mesa);
      setIsEditing(false);
    }
  }, [mesa]);

  // Timer para actualizar tiempo transcurrido
  useEffect(() => {
    if (!mesa?.horaOcupacion) return;

    const interval = setInterval(() => {
      const ahora = new Date();
      const diferencia = ahora.getTime() - mesa.horaOcupacion!.getTime();
      const minutos = Math.floor(diferencia / (1000 * 60));
      const horas = Math.floor(minutos / 60);
      const minutosRestantes = minutos % 60;
      
      if (horas > 0) {
        setTiempoTranscurrido(`${horas}h ${minutosRestantes}m`);
      } else {
        setTiempoTranscurrido(`${minutos}m`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mesa?.horaOcupacion]);

  const handleSave = () => {
    if (mesa) {
      const mesaActualizada: Mesa = {
        ...mesa,
        ...formData,
        horaOcupacion: formData.estado === 'ocupada' && !mesa.horaOcupacion 
          ? new Date() 
          : mesa.horaOcupacion,
        horaInicioLimpieza: formData.estado === 'limpieza' && !mesa.horaInicioLimpieza
          ? new Date()
          : mesa.horaInicioLimpieza
      };
      onUpdate(mesaActualizada);
      setIsEditing(false);
    }
  };

  const handleEstadoChange = (nuevoEstado: Mesa['estado']) => {
    const ahora = new Date();
    setFormData(prev => ({
      ...prev,
      estado: nuevoEstado,
      horaOcupacion: nuevoEstado === 'ocupada' ? ahora : undefined,
      horaInicioLimpieza: nuevoEstado === 'limpieza' ? ahora : undefined,
      horaReserva: nuevoEstado === 'reservada' ? ahora : undefined
    }));
  };

  const handleComensalesChange = (comensales: number) => {
    if (comensales <= (mesa?.capacidad || 0)) {
      setFormData(prev => ({ ...prev, comensales }));
    }
  };

  if (!mesa) return null;

  const estado = MESA_ESTADOS[mesa.estado];
  const forma = MESA_FORMAS[mesa.forma];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold",
              estado.color
            )}>
              {mesa.numero}
            </div>
            <div>
              <h2 className="text-xl font-bold">Mesa {mesa.numero}</h2>
              <p className="text-sm text-muted-foreground">
                {estado.label} • {forma.label} • Capacidad: {mesa.capacidad}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información básica */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              Información Básica
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="numero">Número de Mesa</Label>
                <Input
                  id="numero"
                  value={formData.numero || mesa.numero}
                  onChange={(e) => setFormData(prev => ({ ...prev, numero: parseInt(e.target.value) }))}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label htmlFor="capacidad">Capacidad</Label>
                <Input
                  id="capacidad"
                  type="number"
                  value={formData.capacidad || mesa.capacidad}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacidad: parseInt(e.target.value) }))}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label htmlFor="forma">Forma</Label>
                <Select
                  value={formData.forma || mesa.forma}
                  onValueChange={(value: Mesa['forma']) => setFormData(prev => ({ ...prev, forma: value }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circular">Circular ●</SelectItem>
                    <SelectItem value="rectangular">Rectangular ▬</SelectItem>
                    <SelectItem value="cuadrada">Cuadrada ■</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="zona">Zona</Label>
                <Select
                  value={formData.zona || mesa.zona}
                  onValueChange={(value: Mesa['zona']) => setFormData(prev => ({ ...prev, zona: value }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="principal">Principal 🏠</SelectItem>
                    <SelectItem value="exterior">Exterior 🌿</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Estado actual */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Estado Actual
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge className={cn("text-white", estado.color)}>
                  {estado.icon} {estado.label}
                </Badge>
                {tiempoTranscurrido && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {tiempoTranscurrido}
                  </div>
                )}
              </div>

              {/* Cambiar estado */}
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(MESA_ESTADOS).map(([key, estadoInfo]) => (
                  <Button
                    key={key}
                    variant={formData.estado === key ? "default" : "outline"}
                    className={cn(
                      "justify-start",
                      formData.estado === key && estadoInfo.color
                    )}
                    onClick={() => handleEstadoChange(key as Mesa['estado'])}
                    disabled={!isEditing}
                  >
                    <span className="mr-2">{estadoInfo.icon}</span>
                    {estadoInfo.label}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* Comensales */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Comensales
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="comensales">Número de Comensales</Label>
                <Input
                  id="comensales"
                  type="number"
                  min="0"
                  max={mesa.capacidad}
                  value={formData.comensales || mesa.comensales || 0}
                  onChange={(e) => handleComensalesChange(parseInt(e.target.value) || 0)}
                  disabled={!isEditing}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Máximo: {mesa.capacidad} personas
              </div>
            </div>
          </Card>

          {/* Información adicional */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Información Adicional</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="customName">Nombre Personalizado</Label>
                <Input
                  id="customName"
                  value={formData.customName || mesa.customName || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, customName: e.target.value }))}
                  placeholder="Ej: Mesa VIP, Mesa Romántica..."
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label htmlFor="ordenId">ID de Orden</Label>
                <Input
                  id="ordenId"
                  value={formData.ordenId || mesa.ordenId || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, ordenId: e.target.value }))}
                  placeholder="ID de la orden asociada"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  placeholder="Notas adicionales sobre la mesa..."
                  disabled={!isEditing}
                />
              </div>
            </div>
          </Card>

          {/* Acciones */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              ) : (
                <>
                  <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
              {onDelete && (
                <Button variant="destructive" onClick={() => onDelete(mesa.id)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
