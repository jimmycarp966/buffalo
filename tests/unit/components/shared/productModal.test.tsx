import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductModal } from '@/components/shared/ProductModal'

// Mock dependencies
jest.mock('@/store/notificationStore', () => ({
  useNotificationStore: jest.fn(() => ({
    addNotification: jest.fn()
  }))
}))

jest.mock('@/actions/productActions', () => ({
  createProduct: jest.fn(),
  updateProduct: jest.fn()
}))

jest.mock('@/actions/inventoryActions', () => ({
  getInventoryItems: jest.fn()
}))

jest.mock('@/actions/productInventoryActions', () => ({
  getProductInventoryItems: jest.fn(),
  linkInventoryItem: jest.fn(),
  unlinkInventoryItem: jest.fn()
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}))

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: any) => (
    <input value={value} onChange={onChange} {...props} />
  )
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>
}))

jest.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader">Loading...</div>,
  Plus: () => <div data-testid="plus">+</div>,
  Trash2: () => <div data-testid="trash">🗑️</div>,
  Package: () => <div data-testid="package">📦</div>
}))

describe('ProductModal Component', () => {
  const mockProduct = {
    id: 'product-123',
    name: 'Test Product',
    code: '123456789',
    description: 'Test description',
    cost_price: 100,
    sale_price: 150,
    profit_margin: 50,
    use_auto_price: false,
    stock: 10,
    min_stock: 5,
    unlimited_stock: false
  }

  const mockOnClose = jest.fn()
  const mockAddNotification = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup notification store mock
    const mockUseNotificationStore = require('@/store/notificationStore').useNotificationStore
    mockUseNotificationStore.mockReturnValue({
      addNotification: mockAddNotification
    })

    // Setup action mocks
    const mockCreateProduct = require('@/actions/productActions').createProduct
    const mockUpdateProduct = require('@/actions/productActions').updateProduct
    const mockGetInventoryItems = require('@/actions/inventoryActions').getInventoryItems
    const mockGetProductInventoryItems = require('@/actions/productInventoryActions').getProductInventoryItems

    mockCreateProduct.mockResolvedValue({ success: true, data: mockProduct })
    mockUpdateProduct.mockResolvedValue({ success: true, data: mockProduct })
    mockGetInventoryItems.mockResolvedValue({ success: true, data: [] })
    mockGetProductInventoryItems.mockResolvedValue({ success: true, data: [] })
  })

  it('renders create mode when no product is provided', () => {
    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    expect(screen.getByTestId('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('dialog-title')).toHaveTextContent(/nuevo producto/i)
  })

  it('renders edit mode when product is provided', () => {
    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={mockProduct}
      />
    )

    expect(screen.getByTestId('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('dialog-title')).toHaveTextContent(/editar producto/i)

    // Check if form is populated with product data
    const nameInput = screen.getByDisplayValue('Test Product')
    expect(nameInput).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <ProductModal
        open={false}
        onClose={mockOnClose}
        product={null}
      />
    )

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
  })

  it('handles form input changes', async () => {
    const user = userEvent.setup()

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    const nameInput = screen.getByLabelText(/nombre/i)
    await user.type(nameInput, 'New Product Name')

    expect(nameInput).toHaveValue('New Product Name')
  })

  it('calculates sale price when auto price is enabled', async () => {
    const user = userEvent.setup()

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    const costPriceInput = screen.getByLabelText(/precio costo/i)
    const profitMarginInput = screen.getByLabelText(/margen ganancia/i)
    const autoPriceCheckbox = screen.getByLabelText(/precio automático/i)

    await user.type(costPriceInput, '200')
    await user.type(profitMarginInput, '25')
    await user.click(autoPriceCheckbox)

    // The sale price should be calculated as 200 * (1 + 25/100) = 250
    const salePriceInput = screen.getByLabelText(/precio venta/i)
    await waitFor(() => {
      expect(salePriceInput).toHaveValue('250')
    })
  })

  it('validates required fields on submit', async () => {
    const user = userEvent.setup()

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    const submitButton = screen.getByRole('button', { name: /guardar|crear/i })
    await user.click(submitButton)

    // Should show validation errors
    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Error',
        message: expect.stringContaining('requerido')
      })
    })
  })

  it('submits create form successfully', async () => {
    const user = userEvent.setup()
    const mockCreateProduct = require('@/actions/productActions').createProduct

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    // Fill required fields
    const nameInput = screen.getByLabelText(/nombre/i)
    const costPriceInput = screen.getByLabelText(/precio costo/i)
    const salePriceInput = screen.getByLabelText(/precio venta/i)
    const stockInput = screen.getByLabelText(/stock/i)

    await user.type(nameInput, 'New Product')
    await user.type(costPriceInput, '100')
    await user.type(salePriceInput, '150')
    await user.type(stockInput, '10')

    const submitButton = screen.getByRole('button', { name: /guardar|crear/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith({
        name: 'New Product',
        code: '',
        description: '',
        cost_price: 100,
        sale_price: 150,
        profit_margin: 30,
        use_auto_price: false,
        stock: 10,
        min_stock: 0,
        unlimited_stock: false
      })
    })

    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'success',
      title: 'Éxito',
      message: 'Producto creado exitosamente'
    })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('submits update form successfully', async () => {
    const user = userEvent.setup()
    const mockUpdateProduct = require('@/actions/productActions').updateProduct

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={mockProduct}
      />
    )

    // Modify a field
    const nameInput = screen.getByDisplayValue('Test Product')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Product Name')

    const submitButton = screen.getByRole('button', { name: /guardar|actualizar/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockUpdateProduct).toHaveBeenCalledWith('product-123', {
        name: 'Updated Product Name',
        code: '123456789',
        description: 'Test description',
        cost_price: 100,
        sale_price: 150,
        profit_margin: 50,
        use_auto_price: false,
        stock: 10,
        min_stock: 5,
        unlimited_stock: false
      })
    })

    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'success',
      title: 'Éxito',
      message: 'Producto actualizado exitosamente'
    })
  })

  it('handles create failure', async () => {
    const user = userEvent.setup()
    const mockCreateProduct = require('@/actions/productActions').createProduct
    mockCreateProduct.mockResolvedValue({
      success: false,
      message: 'Database error'
    })

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    // Fill required fields
    const nameInput = screen.getByLabelText(/nombre/i)
    const costPriceInput = screen.getByLabelText(/precio costo/i)
    const salePriceInput = screen.getByLabelText(/precio venta/i)
    const stockInput = screen.getByLabelText(/stock/i)

    await user.type(nameInput, 'New Product')
    await user.type(costPriceInput, '100')
    await user.type(salePriceInput, '150')
    await user.type(stockInput, '10')

    const submitButton = screen.getByRole('button', { name: /guardar|crear/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Error',
        message: 'Database error'
      })
    })

    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    const mockCreateProduct = require('@/actions/productActions').createProduct
    mockCreateProduct.mockImplementation(() => new Promise(resolve =>
      setTimeout(() => resolve({ success: true }), 100)
    ))

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    // Fill required fields
    const nameInput = screen.getByLabelText(/nombre/i)
    const costPriceInput = screen.getByLabelText(/precio costo/i)
    const salePriceInput = screen.getByLabelText(/precio venta/i)
    const stockInput = screen.getByLabelText(/stock/i)

    await user.type(nameInput, 'New Product')
    await user.type(costPriceInput, '100')
    await user.type(salePriceInput, '150')
    await user.type(stockInput, '10')

    const submitButton = screen.getByRole('button', { name: /guardar|crear/i })
    await user.click(submitButton)

    // Should show loading state
    expect(submitButton).toBeDisabled()
    expect(screen.getByTestId('loader')).toBeInTheDocument()

    // Wait for completion
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('closes modal when cancel is clicked', async () => {
    const user = userEvent.setup()

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancelar/i })
    await user.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('handles unlimited stock toggle', async () => {
    const user = userEvent.setup()

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    const unlimitedStockCheckbox = screen.getByLabelText(/stock ilimitado/i)
    const stockInput = screen.getByLabelText(/stock/i)

    // Initially stock input should be enabled
    expect(stockInput).not.toBeDisabled()

    await user.click(unlimitedStockCheckbox)

    // Stock input should be disabled when unlimited is checked
    await waitFor(() => {
      expect(stockInput).toBeDisabled()
    })
  })

  it('loads inventory items on mount', async () => {
    const mockGetInventoryItems = require('@/actions/inventoryActions').getInventoryItems

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={mockProduct}
      />
    )

    await waitFor(() => {
      expect(mockGetInventoryItems).toHaveBeenCalled()
    })
  })

  it('loads product inventory items when editing', async () => {
    const mockGetProductInventoryItems = require('@/actions/productInventoryActions').getProductInventoryItems

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={mockProduct}
      />
    )

    await waitFor(() => {
      expect(mockGetProductInventoryItems).toHaveBeenCalledWith('product-123')
    })
  })

  it('handles numeric input validation', async () => {
    const user = userEvent.setup()

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    const costPriceInput = screen.getByLabelText(/precio costo/i)

    // Try invalid input
    await user.type(costPriceInput, 'invalid-text')

    // Should not allow submission with invalid numbers
    const submitButton = screen.getByRole('button', { name: /guardar|crear/i })
    await user.click(submitButton)

    // Should show validation error for invalid number
    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Error',
        message: expect.stringContaining('número')
      })
    })
  })

  it('resets form when product changes', () => {
    const { rerender } = render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={null}
      />
    )

    // Initially no product data
    expect(screen.queryByDisplayValue('Test Product')).not.toBeInTheDocument()

    // Rerender with product
    rerender(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        product={mockProduct}
      />
    )

    // Should now show product data
    expect(screen.getByDisplayValue('Test Product')).toBeInTheDocument()
  })
})








