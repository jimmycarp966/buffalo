import React from 'react'
import { render, screen } from '@testing-library/react'
import { Separator } from '@/components/ui/separator'

// Mock Radix UI Separator
jest.mock('@radix-ui/react-separator', () => ({
  Root: React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
      orientation?: 'horizontal' | 'vertical'
      decorative?: boolean
    }
  >(({ className, orientation, decorative, ...props }, ref) => (
    <div
      ref={ref}
      data-orientation={orientation}
      data-decorative={decorative}
      className={className}
      {...props}
    />
  )),
}))

// Mock the cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}))

describe('Separator Component', () => {
  it('renders with default horizontal orientation', () => {
    render(<Separator />)

    const separator = screen.getByRole('separator')
    expect(separator).toBeInTheDocument()
    expect(separator).toHaveAttribute('data-orientation', 'horizontal')
    expect(separator).toHaveAttribute('data-decorative', 'true')
    expect(separator).toHaveClass(
      'shrink-0',
      'bg-border',
      'h-[1px]',
      'w-full'
    )
  })

  it('renders with custom className', () => {
    render(<Separator className="custom-separator" />)

    const separator = screen.getByRole('separator')
    expect(separator).toHaveClass('custom-separator')
  })

  describe('orientation', () => {
    it('renders horizontal orientation', () => {
      render(<Separator orientation="horizontal" />)

      const separator = screen.getByRole('separator')
      expect(separator).toHaveAttribute('data-orientation', 'horizontal')
      expect(separator).toHaveClass('h-[1px]', 'w-full')
    })

    it('renders vertical orientation', () => {
      render(<Separator orientation="vertical" />)

      const separator = screen.getByRole('separator')
      expect(separator).toHaveAttribute('data-orientation', 'vertical')
      expect(separator).toHaveClass('h-full', 'w-[1px]')
    })
  })

  describe('decorative prop', () => {
    it('is decorative by default', () => {
      render(<Separator />)

      const separator = screen.getByRole('separator')
      expect(separator).toHaveAttribute('data-decorative', 'true')
    })

    it('can be set as non-decorative', () => {
      render(<Separator decorative={false} />)

      const separator = screen.getByRole('separator')
      expect(separator).toHaveAttribute('data-decorative', 'false')
    })
  })

  describe('accessibility', () => {
    it('has correct ARIA role', () => {
      render(<Separator />)

      const separator = screen.getByRole('separator')
      expect(separator).toBeInTheDocument()
    })

    it('supports ARIA attributes', () => {
      render(
        <Separator
          aria-label="Content separator"
          aria-orientation="horizontal"
        />
      )

      const separator = screen.getByRole('separator')
      expect(separator).toHaveAttribute('aria-label', 'Content separator')
      expect(separator).toHaveAttribute('aria-orientation', 'horizontal')
    })

    it('passes through other props', () => {
      render(
        <Separator
          id="separator-id"
          data-testid="custom-separator"
          title="Visual separator"
        />
      )

      const separator = screen.getByTestId('custom-separator')
      expect(separator).toHaveAttribute('id', 'separator-id')
      expect(separator).toHaveAttribute('title', 'Visual separator')
    })
  })

  describe('styling', () => {
    it('has consistent base styles', () => {
      render(<Separator />)

      const separator = screen.getByRole('separator')
      expect(separator).toHaveClass('shrink-0', 'bg-border')
    })

    it('changes dimensions based on orientation', () => {
      // Horizontal
      const { rerender } = render(<Separator orientation="horizontal" />)
      expect(screen.getByRole('separator')).toHaveClass('h-[1px]', 'w-full')

      // Vertical
      rerender(<Separator orientation="vertical" />)
      expect(screen.getByRole('separator')).toHaveClass('h-full', 'w-[1px]')
    })

    it('handles custom className with orientation styles', () => {
      render(
        <Separator
          orientation="vertical"
          className="my-custom-class"
        />
      )

      const separator = screen.getByRole('separator')
      expect(separator).toHaveClass('my-custom-class', 'h-full', 'w-[1px]')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = jest.fn()
      render(<Separator ref={ref} />)

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    })
  })

  describe('common use cases', () => {
    it('separates content sections horizontally', () => {
      render(
        <div>
          <section>Section 1</section>
          <Separator />
          <section>Section 2</section>
        </div>
      )

      expect(screen.getByText('Section 1')).toBeInTheDocument()
      expect(screen.getByText('Section 2')).toBeInTheDocument()
      expect(screen.getByRole('separator')).toBeInTheDocument()
    })

    it('separates sidebar content vertically', () => {
      render(
        <div className="flex">
          <aside>Sidebar</aside>
          <Separator orientation="vertical" />
          <main>Main content</main>
        </div>
      )

      const separator = screen.getByRole('separator')
      expect(separator).toHaveAttribute('data-orientation', 'vertical')
      expect(separator).toHaveClass('w-[1px]', 'h-full')
    })

    it('separates list items', () => {
      render(
        <ul>
          <li>Item 1</li>
          <Separator />
          <li>Item 2</li>
          <Separator />
          <li>Item 3</li>
        </ul>
      )

      const separators = screen.getAllByRole('separator')
      expect(separators).toHaveLength(2)
    })
  })

  describe('edge cases', () => {
    it('handles undefined orientation', () => {
      render(<Separator orientation={undefined} />)

      const separator = screen.getByRole('separator')
      expect(separator).toHaveAttribute('data-orientation', 'horizontal') // default
    })

    it('handles undefined decorative', () => {
      render(<Separator decorative={undefined} />)

      const separator = screen.getByRole('separator')
      expect(separator).toHaveAttribute('data-decorative', 'true') // default
    })

    it('renders without children', () => {
      render(<Separator />)

      const separator = screen.getByRole('separator')
      expect(separator).toBeEmptyDOMElement()
    })

    it('preserves custom data attributes', () => {
      render(<Separator data-custom="separator-value" />)

      const separator = screen.getByRole('separator')
      expect(separator).toHaveAttribute('data-custom', 'separator-value')
    })
  })

  describe('displayName', () => {
    it('has correct displayName from Radix UI', () => {
      expect(Separator.displayName).toBeDefined()
    })
  })
})
