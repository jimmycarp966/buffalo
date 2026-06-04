import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useKeyboardShortcuts, useGlobalShortcuts, KEYBOARD_SHORTCUTS } from '@/hooks/useKeyboardShortcuts'
import { renderHook } from '@testing-library/react'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Test component to use the hook
function TestComponent({ shortcuts }: { shortcuts: any[] }) {
  useKeyboardShortcuts(shortcuts)
  return <div>Test Component</div>
}

function GlobalShortcutsComponent() {
  useGlobalShortcuts()
  return <div>Global Shortcuts Component</div>
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    mockPush.mockClear()
    // Clear all event listeners
    document.body.innerHTML = ''
  })

  it('should add and remove event listeners correctly', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'a',
        action: mockAction,
        description: 'Test shortcut'
      }
    ]

    const { unmount } = render(<TestComponent shortcuts={shortcuts} />)

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('should execute action when shortcut key is pressed', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'a',
        action: mockAction,
        description: 'Test shortcut'
      }
    ]

    render(<TestComponent shortcuts={shortcuts} />)

    fireEvent.keyDown(window, { key: 'a' })

    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it('should execute action when shortcut code is pressed', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'Enter',
        action: mockAction,
        description: 'Test shortcut'
      }
    ]

    render(<TestComponent shortcuts={shortcuts} />)

    fireEvent.keyDown(window, { code: 'Enter' })

    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it('should handle multiple shortcuts', () => {
    const mockAction1 = jest.fn()
    const mockAction2 = jest.fn()
    const shortcuts = [
      {
        key: 'a',
        action: mockAction1,
        description: 'Test shortcut 1'
      },
      {
        key: 'b',
        action: mockAction2,
        description: 'Test shortcut 2'
      }
    ]

    render(<TestComponent shortcuts={shortcuts} />)

    fireEvent.keyDown(window, { key: 'a' })
    fireEvent.keyDown(window, { key: 'b' })

    expect(mockAction1).toHaveBeenCalledTimes(1)
    expect(mockAction2).toHaveBeenCalledTimes(1)
  })

  it('should handle Ctrl modifier', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 's',
        ctrlKey: true,
        action: mockAction,
        description: 'Save shortcut'
      }
    ]

    render(<TestComponent shortcuts={shortcuts} />)

    // Should not trigger without Ctrl
    fireEvent.keyDown(window, { key: 's' })
    expect(mockAction).not.toHaveBeenCalled()

    // Should trigger with Ctrl
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it('should handle Alt modifier', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'x',
        altKey: true,
        action: mockAction,
        description: 'Alt shortcut'
      }
    ]

    render(<TestComponent shortcuts={shortcuts} />)

    // Should not trigger without Alt
    fireEvent.keyDown(window, { key: 'x' })
    expect(mockAction).not.toHaveBeenCalled()

    // Should trigger with Alt
    fireEvent.keyDown(window, { key: 'x', altKey: true })
    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it('should handle Shift modifier', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'A',
        shiftKey: true,
        action: mockAction,
        description: 'Shift shortcut'
      }
    ]

    render(<TestComponent shortcuts={shortcuts} />)

    // Should not trigger without Shift
    fireEvent.keyDown(window, { key: 'A' })
    expect(mockAction).not.toHaveBeenCalled()

    // Should trigger with Shift
    fireEvent.keyDown(window, { key: 'A', shiftKey: true })
    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it('should handle combination of modifiers', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 's',
        ctrlKey: true,
        shiftKey: true,
        action: mockAction,
        description: 'Ctrl+Shift+S shortcut'
      }
    ]

    render(<TestComponent shortcuts={shortcuts} />)

    // Should not trigger with only Ctrl
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(mockAction).not.toHaveBeenCalled()

    // Should not trigger with only Shift
    fireEvent.keyDown(window, { key: 's', shiftKey: true })
    expect(mockAction).not.toHaveBeenCalled()

    // Should trigger with both Ctrl and Shift
    fireEvent.keyDown(window, { key: 's', ctrlKey: true, shiftKey: true })
    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it('should prevent default behavior when shortcut is triggered', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'a',
        action: mockAction,
        description: 'Test shortcut'
      }
    ]

    render(<TestComponent shortcuts={shortcuts} />)

    const preventDefaultSpy = jest.fn()
    fireEvent.keyDown(window, {
      key: 'a',
      preventDefault: preventDefaultSpy
    })

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
  })

  it('should ignore shortcuts when typing in input elements', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'a',
        action: mockAction,
        description: 'Test shortcut'
      }
    ]

    render(
      <div>
        <TestComponent shortcuts={shortcuts} />
        <input type="text" data-testid="test-input" />
      </div>
    )

    const input = screen.getByTestId('test-input')
    input.focus()

    fireEvent.keyDown(input, { key: 'a' })

    expect(mockAction).not.toHaveBeenCalled()
  })

  it('should ignore shortcuts when typing in textarea elements', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'a',
        action: mockAction,
        description: 'Test shortcut'
      }
    ]

    render(
      <div>
        <TestComponent shortcuts={shortcuts} />
        <textarea data-testid="test-textarea" />
      </div>
    )

    const textarea = screen.getByTestId('test-textarea')
    textarea.focus()

    fireEvent.keyDown(textarea, { key: 'a' })

    expect(mockAction).not.toHaveBeenCalled()
  })

  it('should ignore shortcuts when typing in contenteditable elements', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'a',
        action: mockAction,
        description: 'Test shortcut'
      }
    ]

    render(
      <div>
        <TestComponent shortcuts={shortcuts} />
        <div contentEditable data-testid="contenteditable" />
      </div>
    )

    const contentEditable = screen.getByTestId('contenteditable')
    contentEditable.focus()

    fireEvent.keyDown(contentEditable, { key: 'a' })

    expect(mockAction).not.toHaveBeenCalled()
  })

  it('should update shortcuts when dependencies change', () => {
    const mockAction1 = jest.fn()
    const mockAction2 = jest.fn()

    const { rerender } = render(<TestComponent shortcuts={[{
      key: 'a',
      action: mockAction1,
      description: 'Test shortcut 1'
    }]} />)

    fireEvent.keyDown(window, { key: 'a' })
    expect(mockAction1).toHaveBeenCalledTimes(1)

    // Rerender with different shortcuts
    rerender(<TestComponent shortcuts={[{
      key: 'b',
      action: mockAction2,
      description: 'Test shortcut 2'
    }]} />)

    fireEvent.keyDown(window, { key: 'a' })
    expect(mockAction1).toHaveBeenCalledTimes(1) // Should not trigger again

    fireEvent.keyDown(window, { key: 'b' })
    expect(mockAction2).toHaveBeenCalledTimes(1)
  })
})

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('should set up global shortcuts correctly', () => {
    render(<GlobalShortcutsComponent />)

    // Test F1 shortcut
    fireEvent.keyDown(window, { key: 'F1' })
    expect(mockPush).toHaveBeenCalledWith('/dashboard')

    // Test F2 shortcut
    fireEvent.keyDown(window, { key: 'F2' })
    expect(mockPush).toHaveBeenCalledWith('/productos')

    // Test F3 shortcut
    fireEvent.keyDown(window, { key: 'F3' })
    expect(mockPush).toHaveBeenCalledWith('/ventas')

    // Test F4 shortcut
    fireEvent.keyDown(window, { key: 'F4' })
    expect(mockPush).toHaveBeenCalledWith('/reportes')

    // Test F6 shortcut
    fireEvent.keyDown(window, { key: 'F6' })
    expect(mockPush).toHaveBeenCalledWith('/caja-bar')
  })

  it('should not trigger shortcuts when typing in inputs', () => {
    render(
      <div>
        <GlobalShortcutsComponent />
        <input type="text" />
      </div>
    )

    const input = screen.getByRole('textbox')
    input.focus()

    fireEvent.keyDown(input, { key: 'F1' })

    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('KEYBOARD_SHORTCUTS', () => {
  it('should contain all expected shortcuts', () => {
    expect(KEYBOARD_SHORTCUTS).toHaveLength(9)

    const expectedShortcuts = [
      { key: 'F1', description: 'Ir a Inicio' },
      { key: 'F2', description: 'Ir a Productos' },
      { key: 'F3', description: 'Ir a Ventas' },
      { key: 'F4', description: 'Ir a Reportes' },
      { key: 'F6', description: 'Caja Bar' },
      { key: 'ESC', description: 'Cerrar/Cancelar' },
      { key: 'Enter', description: 'Confirmar' },
      { key: 'Ctrl+S', description: 'Guardar (en formularios)' },
    ]

    expectedShortcuts.forEach(expected => {
      expect(KEYBOARD_SHORTCUTS).toContainEqual(expected)
    })
  })

  it('should have unique keys', () => {
    const keys = KEYBOARD_SHORTCUTS.map(shortcut => shortcut.key)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })
})
