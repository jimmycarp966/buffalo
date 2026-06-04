"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mesa, MesaNotification, NOTIFICATION_CONFIG } from "@/types/mesa";

interface NotificationSystemProps {
  mesas: Mesa[];
  onMesaClick?: (mesa: Mesa) => void;
}

export function NotificationSystem({ mesas, onMesaClick }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<MesaNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);

  useEffect(() => {
    const nuevasNotificaciones: MesaNotification[] = [];
    const ahora = new Date();

    mesas.forEach(mesa => {
      // Notificación por ocupación larga
      if (mesa.estado === 'ocupada' && mesa.horaOcupacion) {
        const minutosOcupada = Math.floor((ahora.getTime() - mesa.horaOcupacion.getTime()) / (1000 * 60));
        if (minutosOcupada > NOTIFICATION_CONFIG.ocupacion_larga.tiempoLimite) {
          nuevasNotificaciones.push({
            id: `ocupacion_${mesa.numero}`,
            mesaNumero: mesa.numero,
            tipo: 'ocupacion_larga',
            mensaje: NOTIFICATION_CONFIG.ocupacion_larga.mensaje
              .replace('{numero}', mesa.numero.toString())
              .replace('{tiempo}', `${Math.floor(minutosOcupada / 60)}h ${minutosOcupada % 60}m`),
            timestamp: ahora,
            leida: false
          });
        }
      }

      // Notificación por limpieza pendiente
      if (mesa.estado === 'limpieza' && mesa.horaInicioLimpieza) {
        const minutosLimpieza = Math.floor((ahora.getTime() - mesa.horaInicioLimpieza.getTime()) / (1000 * 60));
        if (minutosLimpieza > NOTIFICATION_CONFIG.limpieza_pendiente.tiempoLimite) {
          nuevasNotificaciones.push({
            id: `limpieza_${mesa.numero}`,
            mesaNumero: mesa.numero,
            tipo: 'limpieza_pendiente',
            mensaje: NOTIFICATION_CONFIG.limpieza_pendiente.mensaje
              .replace('{numero}', mesa.numero.toString()),
            timestamp: ahora,
            leida: false
          });
        }
      }

      // Notificación por reserva próxima
      if (mesa.estado === 'reservada' && mesa.horaReserva) {
        const minutosHastaReserva = Math.floor((mesa.horaReserva.getTime() - ahora.getTime()) / (1000 * 60));
        if (minutosHastaReserva <= NOTIFICATION_CONFIG.reserva_proxima.tiempoLimite && minutosHastaReserva > 0) {
          nuevasNotificaciones.push({
            id: `reserva_${mesa.numero}`,
            mesaNumero: mesa.numero,
            tipo: 'reserva_proxima',
            mensaje: NOTIFICATION_CONFIG.reserva_proxima.mensaje
              .replace('{numero}', mesa.numero.toString()),
            timestamp: ahora,
            leida: false
          });
        }
      }
    });

    setNotifications(nuevasNotificaciones);
  }, [mesas]);

  const marcarComoLeida = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, leida: true }
          : notif
      )
    );
  };

  const eliminarNotificacion = (notificationId: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
  };

  const getNotificationIcon = (tipo: MesaNotification['tipo']) => {
    switch (tipo) {
      case 'ocupacion_larga':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'reserva_proxima':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'limpieza_pendiente':
        return <Bell className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (tipo: MesaNotification['tipo']) => {
    switch (tipo) {
      case 'ocupacion_larga':
        return 'border-red-200 bg-red-50';
      case 'reserva_proxima':
        return 'border-yellow-200 bg-yellow-50';
      case 'limpieza_pendiente':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-border bg-muted/30';
    }
  };

  const notificacionesNoLeidas = notifications.filter(n => !n.leida);

  if (notificacionesNoLeidas.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Card className={cn(
        "p-4 shadow-lg border-2",
        notificacionesNoLeidas.length > 0 && "animate-pulse"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Notificaciones</h3>
            <Badge variant="destructive" className="ml-2">
              {notificacionesNoLeidas.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {showNotifications && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notificacionesNoLeidas.map(notification => (
              <div
                key={notification.id}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                  getNotificationColor(notification.tipo)
                )}
                onClick={() => {
                  const mesa = mesas.find(m => m.numero === notification.mesaNumero);
                  if (mesa && onMesaClick) {
                    onMesaClick(mesa);
                  }
                  marcarComoLeida(notification.id);
                }}
              >
                <div className="flex items-start gap-3">
                  {getNotificationIcon(notification.tipo)}
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Mesa {notification.mesaNumero}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {notification.mensaje}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarNotificacion(notification.id);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Hook para usar el sistema de notificaciones
export function useMesaNotifications(mesas: Mesa[]) {
  const [notifications, setNotifications] = useState<MesaNotification[]>([]);

  useEffect(() => {
    const nuevasNotificaciones: MesaNotification[] = [];
    const ahora = new Date();

    mesas.forEach(mesa => {
      // Lógica de notificaciones aquí (igual que arriba)
      if (mesa.estado === 'ocupada' && mesa.horaOcupacion) {
        const minutosOcupada = Math.floor((ahora.getTime() - mesa.horaOcupacion.getTime()) / (1000 * 60));
        if (minutosOcupada > NOTIFICATION_CONFIG.ocupacion_larga.tiempoLimite) {
          nuevasNotificaciones.push({
            id: `ocupacion_${mesa.numero}`,
            mesaNumero: mesa.numero,
            tipo: 'ocupacion_larga',
            mensaje: `Mesa ${mesa.numero} lleva más de ${Math.floor(minutosOcupada / 60)}h ocupada`,
            timestamp: ahora,
            leida: false
          });
        }
      }
    });

    setNotifications(nuevasNotificaciones);
  }, [mesas]);

  return notifications;
}
