import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card'

// Mock the cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}))

describe('Card Components', () => {
  describe('Card', () => {
    it('renders with default props', () => {
      render(<Card>Card content</Card>)

      const card = screen.getByText('Card content')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass(
        'rounded-xl',
        'border',
        'bg-card',
        'text-card-foreground',
        'shadow'
      )
    })

    it('renders with custom className', () => {
      render(<Card className="custom-class">Content</Card>)

      const card = screen.getByText('Content')
      expect(card).toHaveClass('custom-class')
    })

    it('forwards HTML attributes', () => {
      render(<Card data-testid="custom-card" id="card-id">Content</Card>)

      const card = screen.getByTestId('custom-card')
      expect(card).toHaveAttribute('id', 'card-id')
    })

    it('supports ref forwarding', () => {
      const ref = jest.fn()
      render(<Card ref={ref}>Content</Card>)

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    })
  })

  describe('CardHeader', () => {
    it('renders with default styling', () => {
      render(
        <Card>
          <CardHeader>Header content</CardHeader>
        </Card>
      )

      const header = screen.getByText('Header content')
      expect(header).toHaveClass(
        'flex',
        'flex-col',
        'space-y-1.5',
        'p-6'
      )
    })

    it('renders with custom className', () => {
      render(
        <Card>
          <CardHeader className="custom-header">Header</CardHeader>
        </Card>
      )

      const header = screen.getByText('Header')
      expect(header).toHaveClass('custom-header')
    })

    it('supports ref forwarding', () => {
      const ref = jest.fn()
      render(<CardHeader ref={ref}>Header</CardHeader>)

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    })
  })

  describe('CardTitle', () => {
    it('renders as h3 with correct styling', () => {
      render(<CardTitle>Card Title</CardTitle>)

      const title = screen.getByRole('heading', { level: 3, name: 'Card Title' })
      expect(title).toBeInTheDocument()
      expect(title).toHaveClass(
        'font-semibold',
        'leading-none',
        'tracking-tight'
      )
    })

    it('renders with custom className', () => {
      render(<CardTitle className="custom-title">Title</CardTitle>)

      const title = screen.getByRole('heading', { level: 3, name: 'Title' })
      expect(title).toHaveClass('custom-title')
    })

    it('supports ref forwarding', () => {
      const ref = jest.fn()
      render(<CardTitle ref={ref}>Title</CardTitle>)

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLHeadingElement))
    })

    it('accepts heading props', () => {
      render(<CardTitle id="title-id">Title</CardTitle>)

      const title = screen.getByRole('heading', { level: 3, name: 'Title' })
      expect(title).toHaveAttribute('id', 'title-id')
    })
  })

  describe('CardDescription', () => {
    it('renders with correct styling', () => {
      render(<CardDescription>Description text</CardDescription>)

      const description = screen.getByText('Description text')
      expect(description).toHaveClass(
        'text-sm',
        'text-muted-foreground'
      )
      expect(description.tagName).toBe('P')
    })

    it('renders with custom className', () => {
      render(<CardDescription className="custom-desc">Description</CardDescription>)

      const description = screen.getByText('Description')
      expect(description).toHaveClass('custom-desc')
    })

    it('supports ref forwarding', () => {
      const ref = jest.fn()
      render(<CardDescription ref={ref}>Description</CardDescription>)

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLParagraphElement))
    })
  })

  describe('CardContent', () => {
    it('renders with default styling', () => {
      render(<CardContent>Content text</CardContent>)

      const content = screen.getByText('Content text')
      expect(content).toHaveClass(
        'p-6',
        'pt-0'
      )
    })

    it('renders with custom className', () => {
      render(<CardContent className="custom-content">Content</CardContent>)

      const content = screen.getByText('Content')
      expect(content).toHaveClass('custom-content')
    })

    it('supports ref forwarding', () => {
      const ref = jest.fn()
      render(<CardContent ref={ref}>Content</CardContent>)

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    })
  })

  describe('CardFooter', () => {
    it('renders with default styling', () => {
      render(<CardFooter>Footer content</CardFooter>)

      const footer = screen.getByText('Footer content')
      expect(footer).toHaveClass(
        'flex',
        'items-center',
        'p-6',
        'pt-0'
      )
    })

    it('renders with custom className', () => {
      render(<CardFooter className="custom-footer">Footer</CardFooter>)

      const footer = screen.getByText('Footer')
      expect(footer).toHaveClass('custom-footer')
    })

    it('supports ref forwarding', () => {
      const ref = jest.fn()
      render(<CardFooter ref={ref}>Footer</CardFooter>)

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    })
  })

  describe('Complete Card Composition', () => {
    it('renders a complete card with all sections', () => {
      render(
        <Card data-testid="complete-card">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card description goes here</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Main content of the card</p>
            <p>More content here</p>
          </CardContent>
          <CardFooter>
            <Button>Action</Button>
          </CardFooter>
        </Card>
      )

      // Check that all parts are rendered
      expect(screen.getByTestId('complete-card')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 3, name: 'Card Title' })).toBeInTheDocument()
      expect(screen.getByText('Card description goes here')).toBeInTheDocument()
      expect(screen.getByText('Main content of the card')).toBeInTheDocument()
      expect(screen.getByText('More content here')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    })

    it('maintains proper semantic structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Main Title</CardTitle>
            <CardDescription>Subtitle description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Body content</p>
          </CardContent>
          <CardFooter>
            <span>Footer info</span>
          </CardFooter>
        </Card>
      )

      // Verify semantic HTML elements
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
      expect(screen.getByText('Body content').tagName).toBe('P')
    })

    it('supports nested components correctly', () => {
      render(
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Nested Title</CardTitle>
            </div>
            <CardDescription>Nested Description</CardDescription>
          </CardHeader>
          <CardContent>
            <Card>
              <CardContent>Nested card content</CardContent>
            </Card>
          </CardContent>
        </Card>
      )

      expect(screen.getByRole('heading', { level: 3, name: 'Nested Title' })).toBeInTheDocument()
      expect(screen.getByText('Nested card content')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('maintains proper heading hierarchy', () => {
      render(
        <div>
          <h1>Main Page Title</h1>
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )

      const mainHeading = screen.getByRole('heading', { level: 1 })
      const cardHeading = screen.getByRole('heading', { level: 3 })

      expect(mainHeading).toHaveTextContent('Main Page Title')
      expect(cardHeading).toHaveTextContent('Card Title')
    })

    it('supports ARIA attributes on all components', () => {
      render(
        <Card aria-label="Custom card">
          <CardHeader aria-label="Card header">
            <CardTitle aria-label="Card title">Title</CardTitle>
            <CardDescription aria-label="Card desc">Desc</CardDescription>
          </CardHeader>
          <CardContent aria-label="Card content">Content</CardContent>
          <CardFooter aria-label="Card footer">Footer</CardFooter>
        </Card>
      )

      expect(screen.getByLabelText('Custom card')).toBeInTheDocument()
      expect(screen.getByLabelText('Card header')).toBeInTheDocument()
      expect(screen.getByLabelText('Card title')).toBeInTheDocument()
      expect(screen.getByLabelText('Card desc')).toBeInTheDocument()
      expect(screen.getByLabelText('Card content')).toBeInTheDocument()
      expect(screen.getByLabelText('Card footer')).toBeInTheDocument()
    })
  })

  describe('Display Names', () => {
    it('all components have correct displayName', () => {
      expect(Card.displayName).toBe('Card')
      expect(CardHeader.displayName).toBe('CardHeader')
      expect(CardTitle.displayName).toBe('CardTitle')
      expect(CardDescription.displayName).toBe('CardDescription')
      expect(CardContent.displayName).toBe('CardContent')
      expect(CardFooter.displayName).toBe('CardFooter')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty content gracefully', () => {
      render(<Card />)

      const card = screen.getByRole('generic') // div without role
      expect(card).toBeInTheDocument()
      expect(card).toBeEmptyDOMElement()
    })

    it('handles missing optional sections', () => {
      render(
        <Card>
          <CardContent>Only content</CardContent>
        </Card>
      )

      expect(screen.getByText('Only content')).toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })

    it('preserves custom HTML attributes', () => {
      render(
        <Card data-custom="value" tabIndex={0}>
          <CardHeader data-header="true">
            <CardTitle data-title="main">Title</CardTitle>
          </CardHeader>
        </Card>
      )

      const card = screen.getByRole('generic')
      const header = screen.getByText('Title').parentElement
      const title = screen.getByRole('heading', { level: 3 })

      expect(card).toHaveAttribute('data-custom', 'value')
      expect(card).toHaveAttribute('tabIndex', '0')
      expect(header).toHaveAttribute('data-header', 'true')
      expect(title).toHaveAttribute('data-title', 'main')
    })
  })
})

// Mock Button component for the complete card test
function Button({ children }: { children: React.ReactNode }) {
  return <button>{children}</button>
}








