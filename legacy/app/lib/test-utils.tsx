/**
 * @registry-id: testUtils
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Test utilities for React component testing - render wrapper with providers
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ **/__tests__/** => All component tests use renderWithProviders
 */

import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

/**
 * Custom render function that wraps components with necessary providers
 * Extend this as needed when adding context providers
 */
function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    ...options,
  })
}

export * from '@testing-library/react'
export { renderWithProviders as render }
