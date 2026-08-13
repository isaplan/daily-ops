/**
 * @registry-id: staffOrgRosterPlaceholders
 * @created: 2026-08-13T14:00:00.000Z
 * @last-modified: 2026-08-13T14:00:00.000Z
 * @description: TBD need-FT/PT/ZZP placeholders for RosterPlanner cells
 * @last-fix: [2026-08-13] Initial need-* member ids + synthetic roster rows
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ components/staffOrg/StaffOrgBoard.vue
 * ✓ pages/staff-org/[id].vue
 */

import type { StaffOrgRosterMember } from '~/types/staff-org'

export type StaffOrgNeedBucket = 'ft' | 'pt' | 'zzp'

const TEMPLATE_PREFIX = 'need-template:'
const INSTANCE_RE = /^need:(ft|pt|zzp):/

const BUCKET_META: Record<
  StaffOrgNeedBucket,
  { name: string; contractType: string }
> = {
  ft: { name: 'Need FT (TBD)', contractType: 'uren contract (32)' },
  pt: { name: 'Need PT (TBD)', contractType: 'nul uren' },
  zzp: { name: 'Need ZZP (TBD)', contractType: 'zzp (0)' },
}

export function isNeedTemplateId (memberId: string): boolean {
  return memberId.startsWith(TEMPLATE_PREFIX)
}

export function isNeedInstanceId (memberId: string): boolean {
  return INSTANCE_RE.test(memberId)
}

export function isNeedMemberId (memberId: string): boolean {
  return isNeedTemplateId(memberId) || isNeedInstanceId(memberId)
}

export function needBucketFromMemberId (memberId: string): StaffOrgNeedBucket | null {
  if (isNeedTemplateId(memberId)) {
    const raw = memberId.slice(TEMPLATE_PREFIX.length)
    if (raw === 'ft' || raw === 'pt' || raw === 'zzp') return raw
    return null
  }
  const m = INSTANCE_RE.exec(memberId)
  const raw = m?.[1]
  if (raw === 'ft' || raw === 'pt' || raw === 'zzp') return raw
  return null
}

export function needTemplateId (bucket: StaffOrgNeedBucket): string {
  return `${TEMPLATE_PREFIX}${bucket}`
}

export function createNeedInstanceId (bucket: StaffOrgNeedBucket): string {
  const uid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  return `need:${bucket}:${uid}`
}

export function syntheticNeedMember (memberId: string): StaffOrgRosterMember | null {
  const bucket = needBucketFromMemberId(memberId)
  if (!bucket) return null
  const meta = BUCKET_META[bucket]
  return {
    memberId,
    name: meta.name,
    teamHint: null,
    contractType: meta.contractType,
    weeklyContractHours: null,
    hourlyRate: 0,
    costPerHour: 0,
    homeLocationId: null,
  }
}

export const NEED_TEMPLATE_MEMBERS: StaffOrgRosterMember[] = (
  ['ft', 'pt', 'zzp'] as const
).map((bucket) => syntheticNeedMember(needTemplateId(bucket))!)
