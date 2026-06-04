import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

// Mock the cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}))

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>)

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'gap-2',
      'whitespace-nowrap',
      'rounded-md',
      'text-sm',
      'font-medium',
      'transition-colors',
      'focus-visible:outline-none',
      'focus-visible:ring-1',
      'focus-visible:ring-ring',
      'disabled:pointer-events-none',
      'disabled:opacity-50',
      'bg-almendra-warm',
      'text-white',
      'shadow',
      'hover:bg-almendra-warm/90',
      'h-9',
      'px-4',
      'py-2'
    )
  })

  it('renders with custom className', () => {
    render(<Button className="custom-class">Click me</Button>)

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toHaveClass('custom-class')
  })

  describe('variants', () => {
    it('renders default variant', () => {
      render(<Button variant="default">Default</Button>)

      const button = screen.getByRole('button', { name: /default/i })
      expect(button).toHaveClass('bg-almendra-warm', 'text-white', 'hover:bg-almendra-warm/90')
    })

    it('renders shell variant', () => {
      render(<Button variant="shell">Shell</Button>)

      const button = screen.getByRole('button', { name: /shell/i })
      expect(button).toHaveClass('bg-almendra-brown', 'text-white', 'hover:bg-almendra-brown/90', 'font-semibold')
    })

    it('renders destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>)

      const button = screen.getByRole('button', { name: /delete/i })
      expect(button).toHaveClass('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')
    })

    it('renders outline variant', () => {
      render(<Button variant="outline">Outline</Button>)

      const button = screen.getByRole('button', { name: /outline/i })
      expect(button).toHaveClass('border', 'border-almendra-warm', 'text-almendra-warm', 'bg-background', 'hover:bg-almendra-warm/10')
    })

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>)

      const button = screen.getByRole('button', { name: /secondary/i })
      expect(button).toHaveClass('bg-almendra-warm/20', 'text-almendra-brown', 'hover:bg-almendra-warm/30', 'border', 'border-almendra-warm')
    })

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)

      const button = screen.getByRole('button', { name: /ghost/i })
      expect(button).toHaveClass('hover:bg-almendra-warm/10', 'hover:text-almendra-warm')
    })

    it('renders link variant', () => {
      render(<Button variant="link">Link</Button>)

      const button = screen.getByRole('button', { name: /link/i })
      expect(button).toHaveClass('text-almendra-warm', 'underline-offset-4', 'hover:underline')
    })
  })

  describe('sizes', () => {
    it('renders default size', () => {
      render(<Button size="default">Default</Button>)

      const button = screen.getByRole('button', { name: /default/i })
      expect(button).toHaveClass('h-9', 'px-4', 'py-2')
    })

    it('renders small size', () => {
      render(<Button size="sm">Small</Button>)

      const button = screen.getByRole('button', { name: /small/i })
      expect(button).toHaveClass('h-8', 'rounded-md', 'px-3', 'text-xs')
    })

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>)

      const button = screen.getByRole('button', { name: /large/i })
      expect(button).toHaveClass('h-10', 'rounded-md', 'px-8')
    })

    it('renders extra large size', () => {
      render(<Button size="xl">Extra Large</Button>)

      const button = screen.getByRole('button', { name: /extra large/i })
      expect(button).toHaveClass('h-12', 'rounded-md', 'px-10', 'text-base')
    })

    it('renders icon size', () => {
      render(<Button size="icon">🔍</Button>)

      const button = screen.getByRole('button', { name: /🔍/i })
      expect(button).toHaveClass('h-9', 'w-9')
    })
  })

  describe('states', () => {
    it('renders disabled state', () => {
      render(<Button disabled>Disabled</Button>)

      const button = screen.getByRole('button', { name: /disabled/i })
      expect(button).toBeDisabled()
      expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50')
    })

    it('handles loading state with custom class', () => {
      render(<Button className="opacity-50 cursor-not-allowed">Loading...</Button>)

      const button = screen.getByRole('button', { name: /loading/i })
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed')
    })
  })

  describe('functionality', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup()
      const handleClick = jest.fn()

      render(<Button onClick={handleClick}>Click me</Button>)

      const button = screen.getByRole('button', { name: /click me/i })
      await user.click(button)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('handles keyboard interaction', async () => {
      const user = userEvent.setup()
      const handleClick = jest.fn()

      render(<Button onClick={handleClick}>Click me</Button>)

      const button = screen.getByRole('button', { name: /click me/i })

      // Test Enter key
      button.focus()
      await user.keyboard('{Enter}')
      expect(handleClick).toHaveBeenCalledTimes(1)

      // Test Space key
      await user.keyboard('{ }')
      expect(handleClick).toHaveBeenCalledTimes(2)
    })

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup()
      const handleClick = jest.fn()

      render(<Button disabled onClick={handleClick}>Disabled</Button>)

      const button = screen.getByRole('button', { name: /disabled/i })
      await user.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<Button aria-label="Custom label">Button</Button>)

      const button = screen.getByRole('button', { name: /custom label/i })
      expect(button).toHaveAttribute('aria-label', 'Custom label')
    })

    it('supports custom type attribute', () => {
      render(<Button type="submit">Submit</Button>)

      const button = screen.getByRole('button', { name: /submit/i })
      expect(button).toHaveAttribute('type', 'submit')
    })

    it('supports form association', () => {
      render(<Button form="my-form" formAction="/submit">Submit</Button>)

      const button = screen.getByRole('button', { name: /submit/i })
      expect(button).toHaveAttribute('form', 'my-form')
      expect(button).toHaveAttribute('formAction', '/submit')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = jest.fn()
      render(<Button ref={ref}>Button</Button>)

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
    })
  })

  describe('children and content', () => {
    it('renders text children', () => {
      render(<Button>Hello World</Button>)

      expect(screen.getByRole('button', { name: /hello world/i })).toBeInTheDocument()
    })

    it('renders React elements as children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      )

      const button = screen.getByRole('button')
      expect(button).toContainElement(screen.getByText('Icon'))
      expect(button).toContainElement(screen.getByText('Text'))
    })

    it('renders with gap between children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('gap-2')
    })
  })

  describe('edge cases', () => {
    it('handles empty children', () => {
      render(<Button />)

      const button = screen.getByRole('button')
      expect(button).toBeEmptyDOMElement()
    })

    it('handles null/undefined variant and size', () => {
      render(<Button variant={undefined} size={undefined}>Button</Button>)

      const button = screen.getByRole('button', { name: /button/i })
      expect(button).toHaveClass('bg-almendra-warm', 'h-9') // default variants
    })

    it('handles complex className combinations', () => {
      render(
        <Button
          variant="shell"
          size="lg"
          className="custom-class another-class"
        >
          Button
        </Button>
      )

      const button = screen.getByRole('button', { name: /button/i })
      expect(button).toHaveClass('custom-class', 'another-class')
      expect(button).toHaveClass('bg-almendra-brown', 'h-10') // variant and size classes
    })
  })

  describe('displayName', () => {
    it('has correct displayName', () => {
      expect(Button.displayName).toBe('Button')
    })
  })
})








