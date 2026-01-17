/**
 * @registry-id: inputComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Input microcomponent for text, email, password, number, date, time, search inputs
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/components/** => All form components use Input
 */

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, value, ...props }, ref) => {
    // If value is explicitly provided (even if undefined), ensure it's always a string
    // to prevent React warning about switching between controlled/uncontrolled
    // If value is not provided, don't include it (uncontrolled input)
    const inputProps = value !== undefined 
      ? { ...props, value: value ?? '' }
      : props
    
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...inputProps}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
