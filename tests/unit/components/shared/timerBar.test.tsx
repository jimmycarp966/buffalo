import { render, screen, act } from '@testing-library/react'
import { TimerBar } from '@/components/shared/TimerBar'

// Mock utilities
jest.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}))

describe('TimerBar Component', () => {
  const mockCreatedAt = '2024-01-15T09:00:00Z'

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders with initial state', () => {
    // Mock current time to be 15 minutes after createdAt
    const mockNow = new Date('2024-01-15T09:15:00Z')
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    const container = screen.getByRole('generic')
    expect(container).toBeInTheDocument()
    expect(container).toHaveClass('relative', 'group')
  })

  it('displays green bar for recent tables (0-30 minutes)', () => {
    const mockNow = new Date('2024-01-15T09:15:00Z') // 15 minutes later
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    const progressBar = screen.getByRole('generic').querySelector('div > div')
    expect(progressBar).toHaveClass('bg-emerald-500')

    const backgroundBar = screen.getByRole('generic').firstElementChild
    expect(backgroundBar).toHaveClass('bg-emerald-100')
  })

  it('displays yellow bar for normal time (30-60 minutes)', () => {
    const mockNow = new Date('2024-01-15T10:30:00Z') // 1.5 hours later
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    const progressBar = screen.getByRole('generic').querySelector('div > div')
    expect(progressBar).toHaveClass('bg-yellow-500')
  })

  it('displays orange bar for long time (60-120 minutes)', () => {
    const mockNow = new Date('2024-01-15T11:30:00Z') // 2.5 hours later
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    const progressBar = screen.getByRole('generic').querySelector('div > div')
    expect(progressBar).toHaveClass('bg-orange-500')
  })

  it('displays red bar for very long time (120+ minutes)', () => {
    const mockNow = new Date('2024-01-15T13:00:00Z') // 4 hours later
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    const progressBar = screen.getByRole('generic').querySelector('div > div')
    expect(progressBar).toHaveClass('bg-red-500')
  })

  it('shows correct progress width for recent tables', () => {
    const mockNow = new Date('2024-01-15T09:10:00Z') // 10 minutes later = 33% of 30min
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    const progressBar = screen.getByRole('generic').querySelector('div > div')
    expect(progressBar).toHaveStyle({ width: '33.3333%' })
  })

  it('shows full width for tables over 30 minutes', () => {
    const mockNow = new Date('2024-01-15T10:00:00Z') // 1 hour later
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    const progressBar = screen.getByRole('generic').querySelector('div > div')
    expect(progressBar).toHaveStyle({ width: '100%' })
  })

  it('displays tooltip on hover', async () => {
    const mockNow = new Date('2024-01-15T09:45:00Z') // 45 minutes later
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    const container = screen.getByRole('generic')

    // Initially tooltip should be hidden
    const tooltip = container.querySelector('.absolute')
    expect(tooltip).toHaveClass('opacity-0')

    // Hover should show tooltip
    await act(async () => {
      container.classList.add('group-hover:opacity-100')
    })

    // The tooltip should contain formatted time
    expect(tooltip).toHaveTextContent('45m abierta')
  })

  it('formats time correctly in minutes', () => {
    const mockNow = new Date('2024-01-15T09:25:00Z') // 25 minutes later
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    const container = screen.getByRole('generic')
    const tooltip = container.querySelector('.absolute')

    expect(tooltip).toHaveTextContent('25m abierta')
  })

  it('formats time correctly in hours and minutes', () => {
    const mockNow = new Date('2024-01-15T12:45:00Z') // 3 hours 45 minutes later
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    const container = screen.getByRole('generic')
    const tooltip = container.querySelector('.absolute')

    expect(tooltip).toHaveTextContent('3h 45m abierta')
  })

  it('updates time every 60 seconds', () => {
    const mockNow = new Date('2024-01-15T09:00:00Z')
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={mockCreatedAt} />)

    // Initial time should be 0
    const container = screen.getByRole('generic')
    const tooltip = container.querySelector('.absolute')
    expect(tooltip).toHaveTextContent('0m abierta')

    // Advance time by 61 seconds
    act(() => {
      jest.advanceTimersByTime(61000)
    })

    // Should update to 1 minute
    expect(tooltip).toHaveTextContent('1m abierta')
  })

  it('cleans up interval on unmount', () => {
    const mockNow = new Date('2024-01-15T09:00:00Z')
    jest.setSystemTime(mockNow)

    const { unmount } = render(<TimerBar createdAt={mockCreatedAt} />)

    // Spy on clearInterval
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  it('recalculates when createdAt changes', () => {
    const mockNow = new Date('2024-01-15T09:00:00Z')
    jest.setSystemTime(mockNow)

    const { rerender } = render(<TimerBar createdAt={mockCreatedAt} />)

    const container = screen.getByRole('generic')
    const tooltip = container.querySelector('.absolute')
    expect(tooltip).toHaveTextContent('0m abierta')

    // Change createdAt to 1 hour ago
    const newCreatedAt = '2024-01-15T08:00:00Z'
    rerender(<TimerBar createdAt={newCreatedAt} />)

    // Should now show 1 hour
    expect(tooltip).toHaveTextContent('1h 0m abierta')
  })

  it('handles edge case: future createdAt', () => {
    const mockNow = new Date('2024-01-15T09:00:00Z')
    const futureCreatedAt = '2024-01-15T10:00:00Z' // 1 hour in future
    jest.setSystemTime(mockNow)

    render(<TimerBar createdAt={futureCreatedAt} />)

    const container = screen.getByRole('generic')
    const tooltip = container.querySelector('.absolute')

    // Should show 0 minutes for future dates
    expect(tooltip).toHaveTextContent('0m abierta')
  })

  it('handles invalid createdAt gracefully', () => {
    const mockNow = new Date('2024-01-15T09:00:00Z')
    jest.setSystemTime(mockNow)

    // Suppress console errors for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    render(<TimerBar createdAt="invalid-date" />)

    const container = screen.getByRole('generic')
    expect(container).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('has correct accessibility attributes', () => {
    render(<TimerBar createdAt={mockCreatedAt} />)

    const container = screen.getByRole('generic')
    const tooltip = container.querySelector('.absolute')

    // Tooltip should have proper positioning and accessibility
    expect(tooltip).toHaveClass('absolute', 'opacity-0', 'pointer-events-none', 'z-10')
  })

  it('has responsive design classes', () => {
    render(<TimerBar createdAt={mockCreatedAt} />)

    const backgroundBar = screen.getByRole('generic').firstElementChild
    expect(backgroundBar).toHaveClass('w-full', 'h-1.5', 'rounded-full', 'overflow-hidden')
  })

  it('transitions smoothly', () => {
    render(<TimerBar createdAt={mockCreatedAt} />)

    const progressBar = screen.getByRole('generic').querySelector('div > div')
    expect(progressBar).toHaveClass('transition-all', 'duration-300', 'rounded-full')
  })

  it('shows tooltip with correct positioning', () => {
    render(<TimerBar createdAt={mockCreatedAt} />)

    const tooltip = screen.getByRole('generic').querySelector('.absolute')
    expect(tooltip).toHaveClass(
      'left-1/2',
      '-translate-x-1/2',
      '-top-8',
      'bg-gray-900',
      'text-white',
      'px-2',
      'py-1',
      'rounded',
      'text-xs',
      'font-medium',
      'whitespace-nowrap'
    )
  })
})








