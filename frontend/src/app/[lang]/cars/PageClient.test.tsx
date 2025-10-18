/**
 * Component tests for catalog PageClient
 * Tests fix for Issue #2: Reset navigation should preserve type and prevent regressions
 */

import { describe, it, expect, vi, beforeEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import PageClient from './PageClient'

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(),
}))

describe('PageClient Reset Functionality', () => {
  let mockRouter: any
  let mockSearchParams: any

  beforeEach(() => {
    mockRouter = {
      replace: vi.fn(),
    }
    mockSearchParams = new URLSearchParams('type=auto&make=FORD&model=F150&year=2020')

    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)
    ;(usePathname as any).mockReturnValue('/en/cars')
  })

  it('should preserve type=auto when resetting filters', async () => {
    const { getByText } = render(
      <PageClient
        params={{ lang: 'en' }}
        initialVehicles={[]}
        initialPagination={{ hasMore: false, count: 0, nextCursor: null }}
      />
    )

    const resetButton = getByText('Reset')
    fireEvent.click(resetButton)

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalled()
      const callArgs = mockRouter.replace.mock.calls[0][0]
      expect(callArgs).toContain('type=auto')
      expect(callArgs).not.toContain('make=')
      expect(callArgs).not.toContain('model=')
      expect(callArgs).not.toContain('year=')
    })
  })

  it('should preserve custom vehicle type when resetting filters', async () => {
    mockSearchParams = new URLSearchParams('type=moto&make=HONDA&model=CBR')
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    const { getByText } = render(
      <PageClient
        params={{ lang: 'en' }}
        initialVehicles={[]}
        initialPagination={{ hasMore: false, count: 0, nextCursor: null }}
      />
    )

    const resetButton = getByText('Reset')
    fireEvent.click(resetButton)

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalled()
      const callArgs = mockRouter.replace.mock.calls[0][0]
      expect(callArgs).toContain('type=moto')
      expect(callArgs).not.toContain('make=')
    })
  })

  it('should default to type=auto when no type in URL', () => {
    mockSearchParams = new URLSearchParams('')
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    const { container } = render(
      <PageClient
        params={{ lang: 'en' }}
        initialVehicles={[]}
        initialPagination={{ hasMore: false, count: 0, nextCursor: null }}
      />
    )

    // Check that Auto tab is active (has pill-active class)
    const autoTab = screen.getByText('Auto')
    expect(autoTab.closest('.pill')).toHaveClass('pill-active')
  })

  it('should clear all filter states when reset is clicked', async () => {
    const { getByText } = render(
      <PageClient
        params={{ lang: 'en' }}
        initialVehicles={[]}
        initialPagination={{ hasMore: false, count: 0, nextCursor: null }}
      />
    )

    const resetButton = getByText('Reset')
    fireEvent.click(resetButton)

    // Verify all filters are cleared
    const makeSelect = screen.getByDisplayValue('All makes') as HTMLSelectElement
    const modelSelect = screen.getByDisplayValue('All models') as HTMLSelectElement
    const yearSelect = screen.getByDisplayValue('Generation') as HTMLSelectElement

    expect(makeSelect.value).toBe('')
    expect(modelSelect.value).toBe('')
    expect(yearSelect.value).toBe('')
  })
})

describe('PageClient Filter Cascading', () => {
  let mockRouter: any
  let mockSearchParams: any

  beforeEach(() => {
    mockRouter = { replace: vi.fn() }
    mockSearchParams = new URLSearchParams('type=auto')
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)
    ;(usePathname as any).mockReturnValue('/en/cars')

    // Mock fetch for filter options
    global.fetch = vi.fn((url: string) => {
      if (url.includes('make=FORD&year=2020')) {
        return Promise.resolve({
          json: () => Promise.resolve({ models: ['F150', 'MUSTANG'] }),
        })
      }
      if (url.includes('make=FORD&model=F150&year=2020')) {
        return Promise.resolve({
          json: () => Promise.resolve({ modelDetails: ['XLT', 'LARIAT'] }),
        })
      }
      return Promise.resolve({
        json: () => Promise.resolve({ makes: ['FORD', 'TOYOTA'] }),
      })
    }) as any
  })

  it('should fetch models filtered by selected year', async () => {
    const { getByDisplayValue } = render(
      <PageClient
        params={{ lang: 'en' }}
        initialVehicles={[]}
        initialPagination={{ hasMore: false, count: 0, nextCursor: null }}
      />
    )

    // Select make
    const makeSelect = getByDisplayValue('All makes') as HTMLSelectElement
    fireEvent.change(makeSelect, { target: { value: 'FORD' } })

    // Select year
    const yearSelect = screen.getByRole('combobox', { name: /generation/i }) as HTMLSelectElement
    fireEvent.change(yearSelect, { target: { value: '2020' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('make=FORD&type=auto&year=2020')
      )
    })
  })

  it('should fetch model_details filtered by selected year', async () => {
    const { getByDisplayValue } = render(
      <PageClient
        params={{ lang: 'en' }}
        initialVehicles={[]}
        initialPagination={{ hasMore: false, count: 0, nextCursor: null }}
      />
    )

    // Select make, model, and year
    const makeSelect = getByDisplayValue('All makes') as HTMLSelectElement
    fireEvent.change(makeSelect, { target: { value: 'FORD' } })

    await waitFor(() => {
      const modelSelect = screen.getByRole('combobox', { name: /all models/i }) as HTMLSelectElement
      fireEvent.change(modelSelect, { target: { value: 'F150' } })
    })

    const yearSelect = screen.getByRole('combobox', { name: /generation/i }) as HTMLSelectElement
    fireEvent.change(yearSelect, { target: { value: '2020' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('make=FORD&model=F150&type=auto&year=2020')
      )
    })
  })
})
