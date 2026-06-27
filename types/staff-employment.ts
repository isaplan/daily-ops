export type StaffEmploymentOverride = 'auto' | 'still_working' | 'no_longer_working'

export const STAFF_EMPLOYMENT_OVERRIDE_OPTIONS: Array<{
  value: StaffEmploymentOverride
  label: string
}> = [
  { value: 'auto', label: 'Auto' },
  { value: 'still_working', label: 'Still working' },
  { value: 'no_longer_working', label: 'No longer working' },
]
