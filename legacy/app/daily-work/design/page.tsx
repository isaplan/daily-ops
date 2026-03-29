/**
 * Design page: disabled. Redirects to Old Design System at /daily-work/old/design.
 */
import { redirect } from 'next/navigation'

export default function DesignPage() {
  redirect('/daily-work/old/design')
}
