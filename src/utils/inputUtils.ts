import type { FocusEvent } from 'react'

/**
 * Use as onFocus for InputNumber (and similar) so the value is selected on focus.
 * User can then type the new number without manually clearing the existing value.
 */
export function selectAllOnFocus(e: FocusEvent<HTMLElement>): void {
  const el =
    (e.target as HTMLElement).tagName === 'INPUT'
      ? (e.target as HTMLInputElement)
      : (e.target as HTMLElement).querySelector?.('input')
  if (el instanceof HTMLInputElement) {
    requestAnimationFrame(() => el.select())
  }
}
