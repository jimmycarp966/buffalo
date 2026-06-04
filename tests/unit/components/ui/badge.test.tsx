import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'

// Mock the cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}))

describe('Badge Component', () => {
  it('renders with default props', () => {
    render(<Badge>Default Badge</Badge>)

    const badge = screen.getByText('Default Badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass(
      'inline-flex',
      'items-center',
      'rounded-md',
      'border',
      'px-2.5',
      'py-0.5',
      'text-xs',
      'font-semibold',
      'transition-colors',
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-ring',
      'focus:ring-offset-2',
      'border-transparent',
      'bg-primary',
      'text-primary-foreground',
      'shadow',
      'hover:bg-primary/80'
    )
  })

  it('renders with custom className', () => {
    render(<Badge className="custom-class">Badge</Badge>)

    const badge = screen.getByText('Badge')
    expect(badge).toHaveClass('custom-class')
  })

  describe('variants', () => {
    it('renders default variant', () => {
      render(<Badge variant="default">Default</Badge>)

      const badge = screen.getByText('Default')
      expect(badge).toHaveClass(
        'border-transparent',
        'bg-primary',
        'text-primary-foreground',
        'shadow',
        'hover:bg-primary/80'
      )
    })

    it('renders secondary variant', () => {
      render(<Badge variant="secondary">Secondary</Badge>)

      const badge = screen.getByText('Secondary')
      expect(badge).toHaveClass(
        'border-transparent',
        'bg-secondary',
        'text-secondary-foreground',
        'hover:bg-secondary/80'
      )
    })

    it('renders destructive variant', () => {
      render(<Badge variant="destructive">Destructive</Badge>)

      const badge = screen.getByText('Destructive')
      expect(badge).toHaveClass(
        'border-transparent',
        'bg-destructive',
        'text-destructive-foreground',
        'shadow',
        'hover:bg-destructive/80'
      )
    })

    it('renders outline variant', () => {
      render(<Badge variant="outline">Outline</Badge>)

      const badge = screen.getByText('Outline')
      expect(badge).toHaveClass('text-foreground')
      expect(badge).not.toHaveClass('border-transparent')
    })

    it('renders success variant', () => {
      render(<Badge variant="success">Success</Badge>)

      const badge = screen.getByText('Success')
      expect(badge).toHaveClass(
        'border-transparent',
        'bg-green-500',
        'text-white',
        'shadow',
        'hover:bg-green-600'
      )
    })

    it('renders warning variant', () => {
      render(<Badge variant="warning">Warning</Badge>)

      const badge = screen.getByText('Warning')
      expect(badge).toHaveClass(
        'border-transparent',
        'bg-yellow-500',
        'text-white',
        'shadow',
        'hover:bg-yellow-600'
      )
    })
  })

  describe('content and structure', () => {
    it('renders text content', () => {
      render(<Badge>Hello World</Badge>)

      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })

    it('renders React elements as children', () => {
      render(
        <Badge>
          <span>Icon</span>
          <span>Text</span>
        </Badge>
      )

      const badge = screen.getByRole('generic')
      expect(badge).toContainElement(screen.getByText('Icon'))
      expect(badge).toContainElement(screen.getByText('Text'))
    })

    it('renders with icons and text', () => {
      render(
        <Badge>
          <svg data-testid="icon" />
          Active
        </Badge>
      )

      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByTestId('icon')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('supports focus management', () => {
      render(<Badge tabIndex={0}>Focusable Badge</Badge>)

      const badge = screen.getByText('Focusable Badge')
      expect(badge).toHaveAttribute('tabIndex', '0')
      expect(badge).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-ring', 'focus:ring-offset-2')
    })

    it('supports ARIA attributes', () => {
      render(
        <Badge
          role="status"
          aria-label="Status badge"
          aria-describedby="badge-description"
        >
          Status
        </Badge>
      )

      const badge = screen.getByRole('status')
      expect(badge).toHaveAttribute('aria-label', 'Status badge')
      expect(badge).toHaveAttribute('aria-describedby', 'badge-description')
    })

    it('has appropriate semantic role', () => {
      render(<Badge>Generic Badge</Badge>)

      // Badge renders as a div, which has generic role
      const badge = screen.getByRole('generic')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('HTML attributes', () => {
    it('forwards HTML attributes', () => {
      render(
        <Badge
          id="custom-badge"
          data-testid="test-badge"
          title="Badge tooltip"
          onClick={() => {}}
        >
          Custom Badge
        </Badge>
      )

      const badge = screen.getByTestId('test-badge')
      expect(badge).toHaveAttribute('id', 'custom-badge')
      expect(badge).toHaveAttribute('title', 'Badge tooltip')
    })

    it('supports event handlers', () => {
      const handleClick = jest.fn()
      render(<Badge onClick={handleClick}>Clickable</Badge>)

      const badge = screen.getByText('Clickable')
      badge.click()

      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('styling and appearance', () => {
    it('has consistent padding and sizing', () => {
      render(<Badge>Test</Badge>)

      const badge = screen.getByText('Test')
      expect(badge).toHaveClass('px-2.5', 'py-0.5', 'text-xs')
    })

    it('has rounded corners', () => {
      render(<Badge>Rounded</Badge>)

      const badge = screen.getByText('Rounded')
      expect(badge).toHaveClass('rounded-md')
    })

    it('is inline-flex container', () => {
      render(<Badge>Flex</Badge>)

      const badge = screen.getByText('Flex')
      expect(badge).toHaveClass('inline-flex', 'items-center')
    })

    it('has transition effects', () => {
      render(<Badge>Transition</Badge>)

      const badge = screen.getByText('Transition')
      expect(badge).toHaveClass('transition-colors')
    })
  })

  describe('common use cases', () => {
    it('renders status badges', () => {
      render(
        <div>
          <Badge variant="success">Active</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="destructive">Error</Badge>
        </div>
      )

      expect(screen.getByText('Active')).toHaveClass('bg-green-500')
      expect(screen.getByText('Pending')).toHaveClass('bg-yellow-500')
      expect(screen.getByText('Error')).toHaveClass('bg-destructive')
    })

    it('renders count badges', () => {
      render(<Badge variant="secondary">5</Badge>)

      const badge = screen.getByText('5')
      expect(badge).toHaveClass('bg-secondary')
    })

    it('renders category badges', () => {
      render(
        <div>
          <Badge variant="outline">Technology</Badge>
          <Badge variant="outline">Design</Badge>
          <Badge variant="outline">Business</Badge>
        </div>
      )

      const badges = screen.getAllByText(/Technology|Design|Business/)
      badges.forEach(badge => {
        expect(badge).toHaveClass('text-foreground')
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty content', () => {
      render(<Badge />)

      const badge = screen.getByRole('generic')
      expect(badge).toBeEmptyDOMElement()
    })

    it('handles long text gracefully', () => {
      const longText = 'This is a very long badge text that should still render properly'
      render(<Badge>{longText}</Badge>)

      expect(screen.getByText(longText)).toBeInTheDocument()
    })

    it('handles special characters', () => {
      render(<Badge>Badge with émojis 🎉 and spëcial chärs</Badge>)

      expect(screen.getByText('Badge with émojis 🎉 and spëcial chärs')).toBeInTheDocument()
    })

    it('handles null/undefined variant', () => {
      render(<Badge variant={undefined}>Default</Badge>)

      const badge = screen.getByText('Default')
      expect(badge).toHaveClass('bg-primary') // default variant
    })

    it('preserves custom data attributes', () => {
      render(<Badge data-custom="value" data-testid="badge">Test</Badge>)

      const badge = screen.getByTestId('badge')
      expect(badge).toHaveAttribute('data-custom', 'value')
    })
  })

  describe('badgeVariants export', () => {
    it('exports badgeVariants function', () => {
      expect(typeof badgeVariants).toBe('function')
    })

    it('badgeVariants generates correct classes', () => {
      const defaultClasses = badgeVariants()
      const successClasses = badgeVariants({ variant: 'success' })

      expect(defaultClasses).toContain('bg-primary')
      expect(successClasses).toContain('bg-green-500')
    })
  })
})








