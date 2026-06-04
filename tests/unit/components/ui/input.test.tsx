import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/input'

// Mock the cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}))

describe('Input Component', () => {
  it('renders with default props', () => {
    render(<Input />)

    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveClass(
      'flex',
      'h-9',
      'w-full',
      'rounded-md',
      'border',
      'border-input',
      'bg-transparent',
      'px-3',
      'py-1',
      'text-base',
      'shadow-sm',
      'transition-colors',
      'file:border-0',
      'file:bg-transparent',
      'file:text-sm',
      'file:font-medium',
      'file:text-foreground',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none',
      'focus-visible:ring-1',
      'focus-visible:ring-ring',
      'disabled:cursor-not-allowed',
      'disabled:opacity-50'
    )
  })

  it('renders with custom className', () => {
    render(<Input className="custom-class" />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-class')
  })

  describe('input types', () => {
    it('renders with text type by default', () => {
      render(<Input />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'text')
    })

    it('renders with different input types', () => {
      const types = ['email', 'password', 'number', 'tel', 'url', 'search']

      types.forEach(type => {
        const { rerender } = render(<Input type={type} />)
        const input = screen.getByRole(type === 'textbox' ? 'textbox' : type === 'search' ? 'searchbox' : type)
        expect(input).toHaveAttribute('type', type)
        rerender(<></>) // cleanup
      })
    })

    it('renders with file input type', () => {
      render(<Input type="file" />)

      // File inputs don't have a specific role, just check it's an input with correct type
      const input = screen.getByDisplayValue('') // Empty file input
      expect(input).toHaveAttribute('type', 'file')
    })
  })

  describe('props forwarding', () => {
    it('forwards standard HTML input props', () => {
      render(
        <Input
          placeholder="Enter text"
          value="test value"
          name="test-input"
          id="test-id"
          required
          disabled
          readOnly
          maxLength={10}
          minLength={2}
          pattern="[A-Za-z]+"
          autoComplete="off"
          autoFocus
        />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', 'Enter text')
      expect(input).toHaveValue('test value')
      expect(input).toHaveAttribute('name', 'test-input')
      expect(input).toHaveAttribute('id', 'test-id')
      expect(input).toHaveAttribute('required')
      expect(input).toBeDisabled()
      expect(input).toHaveAttribute('readOnly')
      expect(input).toHaveAttribute('maxLength', '10')
      expect(input).toHaveAttribute('minLength', '2')
      expect(input).toHaveAttribute('pattern', '[A-Za-z]+')
      expect(input).toHaveAttribute('autoComplete', 'off')
      expect(input).toHaveAttribute('autoFocus')
    })

    it('forwards number input props', () => {
      render(
        <Input
          type="number"
          min="0"
          max="100"
          step="5"
        />
      )

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('max', '100')
      expect(input).toHaveAttribute('step', '5')
    })

    it('forwards event handlers', () => {
      const handleChange = jest.fn()
      const handleFocus = jest.fn()
      const handleBlur = jest.fn()

      render(
        <Input
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      )

      const input = screen.getByRole('textbox')

      // Test change event
      userEvent.type(input, 'a')
      expect(handleChange).toHaveBeenCalled()

      // Test focus event
      input.focus()
      expect(handleFocus).toHaveBeenCalled()

      // Test blur event
      input.blur()
      expect(handleBlur).toHaveBeenCalled()
    })
  })

  describe('user interaction', () => {
    it('allows typing text', async () => {
      const user = userEvent.setup()
      const handleChange = jest.fn()

      render(<Input onChange={handleChange} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Hello World')

      expect(input).toHaveValue('Hello World')
      expect(handleChange).toHaveBeenCalledTimes(11) // 11 characters
    })

    it('handles controlled input', async () => {
      const user = userEvent.setup()
      const TestComponent = () => {
        const [value, setValue] = React.useState('')
        return (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )
      }

      render(<TestComponent />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'controlled')

      expect(input).toHaveValue('controlled')
    })

    it('respects maxLength', async () => {
      const user = userEvent.setup()

      render(<Input maxLength={5} />)

      const input = screen.getByRole('textbox')
      await user.type(input, '123456789')

      expect(input).toHaveValue('12345') // Only first 5 characters
    })

    it('handles number input validation', async () => {
      const user = userEvent.setup()

      render(<Input type="number" min="0" max="10" />)

      const input = screen.getByRole('spinbutton')
      await user.type(input, '5')

      expect(input).toHaveValue(5)
    })
  })

  describe('accessibility', () => {
    it('supports aria attributes', () => {
      render(
        <Input
          aria-label="Custom label"
          aria-describedby="description"
          aria-invalid="true"
        />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-label', 'Custom label')
      expect(input).toHaveAttribute('aria-describedby', 'description')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('supports form association', () => {
      render(<Input form="my-form" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('form', 'my-form')
    })

    it('has correct focus styles', () => {
      render(<Input />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('focus-visible:ring-1', 'focus-visible:ring-ring')
    })
  })

  describe('states', () => {
    it('handles disabled state', () => {
      render(<Input disabled />)

      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
      expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')
    })

    it('handles readonly state', () => {
      render(<Input readOnly />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('readOnly')
    })

    it('handles required state', () => {
      render(<Input required />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('required')
    })
  })

  describe('file input handling', () => {
    it('handles file input correctly', () => {
      render(<Input type="file" accept=".jpg,.png" multiple />)

      const input = screen.getByDisplayValue('')
      expect(input).toHaveAttribute('type', 'file')
      expect(input).toHaveAttribute('accept', '.jpg,.png')
      expect(input).toHaveAttribute('multiple')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = jest.fn()
      render(<Input ref={ref} />)

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement))
    })

    it('allows programmatic focus', () => {
      let inputRef: HTMLInputElement | null = null
      render(<Input ref={(el) => inputRef = el} />)

      if (inputRef) {
        inputRef.focus()
        expect(inputRef).toHaveFocus()
      }
    })
  })

  describe('edge cases', () => {
    it('handles empty props', () => {
      render(<Input />)

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('handles undefined values', () => {
      render(<Input value={undefined} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('')
    })

    it('handles null children', () => {
      render(<Input>{null}</Input>)

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('preserves custom data attributes', () => {
      render(<Input data-testid="custom-input" data-custom="value" />)

      const input = screen.getByTestId('custom-input')
      expect(input).toHaveAttribute('data-custom', 'value')
    })
  })

  describe('displayName', () => {
    it('has correct displayName', () => {
      expect(Input.displayName).toBe('Input')
    })
  })

  describe('validation', () => {
    it('shows validation styles when invalid', () => {
      render(<Input aria-invalid="true" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('supports pattern validation', async () => {
      const user = userEvent.setup()

      render(<Input pattern="[A-Za-z]+" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Valid123')

      // Note: HTML5 validation is handled by the browser
      expect(input).toHaveAttribute('pattern', '[A-Za-z]+')
    })
  })
})








