/**
 * @registry-id: formFieldComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: FormField composite microcomponent - Input + Label + Error message wrapper
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/form.tsx => Form components
 *   - app/components/ui/input.tsx => Input component
 *   - app/components/ui/label.tsx => Label component
 * 
 * @exports-to:
 *   ✓ app/components/** => Form components use FormField for form inputs
 */

import * as React from 'react'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form'

export interface FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  name: TName
  label?: string
  description?: string
  placeholder?: string
  type?: React.InputHTMLAttributes<HTMLInputElement>['type']
  control: any
  render?: (field: ControllerRenderProps<TFieldValues, TName>) => React.ReactNode
}

export function FormFieldWrapper<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  label,
  description,
  placeholder,
  type = 'text',
  control,
  render,
}: FormFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            {render ? (
              render(field)
            ) : (
              <Input type={type} placeholder={placeholder} {...field} />
            )}
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
