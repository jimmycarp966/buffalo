import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorar si está escribiendo en un input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      shortcuts.forEach((shortcut) => {
        const keyMatch = event.key === shortcut.key || event.code === shortcut.key;
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          event.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Hook global para toda la aplicación
export function useGlobalShortcuts() {
  const router = useRouter();

  const shortcuts: ShortcutConfig[] = [
    {
      key: 'F1',
      action: () => router.push('/dashboard'),
      description: 'Ir a Inicio',
    },
    {
      key: 'F2',
      action: () => router.push('/productos'),
      description: 'Ir a Productos',
    },
    {
      key: 'F3',
      action: () => router.push('/ventas'),
      description: 'Ir a Ventas',
    },
    {
      key: 'F4',
      action: () => router.push('/reportes'),
      description: 'Ir a Reportes',
    },
    {
      key: 'F6',
      action: () => router.push('/caja-bar'),
      description: 'Caja Bar',
    },
  ];

  useKeyboardShortcuts(shortcuts);
}

// Componente para mostrar atajos disponibles
export const KEYBOARD_SHORTCUTS = [
  { key: 'F1', description: 'Ir a Inicio' },
  { key: 'F2', description: 'Ir a Productos' },
  { key: 'F3', description: 'Ir a Ventas' },
  { key: 'F4', description: 'Ir a Reportes' },
  { key: 'F6', description: 'Caja Bar' },
  { key: 'ESC', description: 'Cerrar/Cancelar' },
  { key: 'Enter', description: 'Confirmar' },
  { key: 'Ctrl+S', description: 'Guardar (en formularios)' },
];

