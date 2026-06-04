import { render, screen } from '@testing-library/react'
import { Label } from '@/components/ui/label'

// Mock the cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}))

describe('Label Component', () => {
  it('renders with default props', () => {
    render(<Label>Label text</Label>)

    const label = screen.getByText('Label text')
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass(
      'text-sm',
      'font-medium',
      'leading-none',
      'peer-disabled:cursor-not-allowed',
      'peer-disabled:opacity-70'
    )
    expect(label.tagName).toBe('LABEL')
  })

  it('renders with custom className', () => {
    render(<Label className="custom-class">Label</Label>)

    const label = screen.getByText('Label')
    expect(label).toHaveClass('custom-class')
  })

  describe('form association', () => {
    it('associates with form control via htmlFor', () => {
      render(
        <div>
          <Label htmlFor="input-id">Username</Label>
          <input id="input-id" type="text" />
        </div>
      )

      const label = screen.getByText('Username')
      const input = screen.getByRole('textbox')

      expect(label).toHaveAttribute('for', 'input-id')
      expect(input).toHaveAttribute('id', 'input-id')
    })

    it('associates with form control via nested input', () => {
      render(
        <Label>
          Email
          <input type="email" />
        </Label>
      )

      const label = screen.getByText('Email')
      const input = screen.getByRole('textbox', { type: 'email' })

      expect(label).toContainElement(input)
    })
  })

  describe('accessibility', () => {
    it('supports ARIA attributes', () => {
      render(
        <Label
          aria-label="Custom label"
          aria-describedby="description"
        >
          Label
        </Label>
      )

      const label = screen.getByText('Label')
      expect(label).toHaveAttribute('aria-label', 'Custom label')
      expect(label).toHaveAttribute('aria-describedby', 'description')
    })

    it('handles disabled state with peer classes', () => {
      render(
        <div>
          <Label>Disabled Field</Label>
          <input disabled />
        </div>
      )

      const label = screen.getByText('Disabled Field')
      expect(label).toHaveClass('peer-disabled:cursor-not-allowed', 'peer-disabled:opacity-70')
    })
  })

  describe('styling', () => {
    it('has correct typography styles', () => {
      render(<Label>Styled Label</Label>)

      const label = screen.getByText('Styled Label')
      expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none')
    })

    it('handles custom styling', () => {
      render(
        <Label
          className="text-lg font-bold text-blue-500"
          style={{ color: 'red' }}
        >
          Custom Label
        </Label>
      )

      const label = screen.getByText('Custom Label')
      expect(label).toHaveClass('text-lg', 'font-bold', 'text-blue-500')
      expect(label).toHaveStyle({ color: 'red' })
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = jest.fn()
      render(<Label ref={ref}>Label</Label>)

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLLabelElement))
    })
  })

  describe('content and structure', () => {
    it('renders text content', () => {
      render(<Label>Simple label</Label>)

      expect(screen.getByText('Simple label')).toBeInTheDocument()
    })

    it('renders React elements as children', () => {
      render(
        <Label>
          <span>Required</span>
          <span>*</span>
        </Label>
      )

      const label = screen.getByRole('generic')
      expect(label).toContainElement(screen.getByText('Required'))
      expect(label).toContainElement(screen.getByText('*'))
    })
  })

  describe('edge cases', () => {
    it('handles empty content', () => {
      render(<Label />)

      const label = screen.getByRole('generic')
      expect(label).toBeEmptyDOMElement()
    })

    it('preserves custom HTML attributes', () => {
      render(
        <Label
          data-testid="custom-label"
          data-custom="value"
          title="Tooltip"
        >
          Label
        </Label>
      )

      const label = screen.getByTestId('custom-label')
      expect(label).toHaveAttribute('data-custom', 'value')
      expect(label).toHaveAttribute('title', 'Tooltip')
    })
  })

  describe('displayName', () => {
    it('has correct displayName', () => {
      expect(Label.displayName).toBe('Label')
    })
  })
})








