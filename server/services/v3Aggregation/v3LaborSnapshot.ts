/**
 * @registry-id: v3LaborSnapshot
 * @created: 2026-04-28T19:55:00.000Z
 * @last-modified: 2026-04-28T19:55:00.000Z
 * @description: Build V3 labor working day snapshots from raw Eitje data
 * @last-fix: [2026-04-28] Initial V3 labor snapshot aggregation
 * 
 * @exports-to:
 * ✓ server/services/v3Aggregation/v3AggregationOrchestrator.ts
 * 
 * @data-flow:
 * eitje_raw_time_registrations → $match(businessDayRange) → $group(team/contract) → upsert snapshot
 * 
 * @business-day: 06:00-05:59:59 UTC
 * @update-frequency: 6x daily (triggered after Eitje sync)
 */

import { Db, ObjectId } from 'mongodb'
import type {
  V3LaborWorkingDaySnapshot,
  HourlyBreakdownEntry,
  TeamSummary,
  ContractSummary,
  LaborProductivityMetrics,
  SnapshotAggregationResult,
} from '~/types/daily-ops-v3'
import {
  getBusinessDate,
  getBusinessDayStart,
  getBusinessDayEnd,
  toISODateString,
  getCurrentBusinessDate,
} from '~/server/utils/v3BusinessDay'
import { upsertLaborSnapshot, shouldUpdateSnapshot, getLaborSnapshot } from '~/server/utils/v3Snapshots'

/**
 * Rebuild V3 labor working day snapshot for a specific location and date
 * Aggregates all Eitje raw time registration data for the business day
 */
export async function rebuildV3LaborSnapshot(
  db: Db,
  locationId: ObjectId,
  locationName: string,
  businessDate: string,
): Promise<SnapshotAggregationResult> {
  const startTime = Date.now()
  const stepsExecuted: string[] = []

  try {
    stepsExecuted.push('starting_aggregation')

    // Get business day boundaries
    const workingDayStart = getBusinessDayStart(businessDate)
    const workingDayEnd = getBusinessDayEnd(businessDate)

    stepsExecuted.push('fetched_business_day_boundaries')

    // Check if we should update
    const existingSnapshot = await getLaborSnapshot(db, locationId, businessDate)
    const shouldUpdate = shouldUpdateSnapshot(existingSnapshot, 15)

    if (!shouldUpdate && existingSnapshot) {
      stepsExecuted.push('snapshot_recent_skipped_update')
      return {
        success: true,
        message: 'Snapshot already up-to-date',
        locationId,
        locationName,
        businessDate,
        timestamp: new Date(),
        syncCount: existingSnapshot.syncCount + 1,
        durationMs: Date.now() - startTime,
        stepsExecuted,
        laborSnapshot: existingSnapshot,
      }
    }

    stepsExecuted.push('querying_raw_labor_data')

    // Aggregate all time registrations for the business day
    const laborPipeline = [
      {
        $match: {
          locationId,
          date: { $gte: workingDayStart, $lt: workingDayEnd },
        },
      },
      {
        $addFields: {
          hour: { $hour: { date: '$date', timezone: 'UTC' } },
        },
      },
      {
        $group: {
          _id: {
            workerId: '$workerId',
            team: '$team',
            contract: '$contractType',
          },
          totalHours: { $sum: '$hours' },
          totalCost: { $sum: '$cost' },
          hourlyBreakdown: {
            $push: {
              hour: '$hour',
              hours: '$hours',
              cost: '$cost',
            },
          },
        },
      },
    ]

    const laborData = await db.collection('eitje_raw_time_registrations').aggregate(laborPipeline).toArray()
    stepsExecuted.push('aggregated_labor_data')

    // Build workers map
    let totalHours = 0
    let totalCost = 0
    const workersSet = new Set<string>()
    const teamsMap = new Map<string, TeamSummary>()
    const contractsMap = new Map<string, ContractSummary>()
    const hourlyMap = new Map<number, { hours: number; cost: number }>()

    for (const entry of laborData) {
      const hours = entry.totalHours ?? 0
      const cost = entry.totalCost ?? 0
      const team = entry._id.team ?? 'Unassigned'
      const contract = entry._id.contract ?? 'Unknown'

      totalHours += hours
      totalCost += cost
      workersSet.add(entry._id.workerId)

      // Aggregate by team
      if (!teamsMap.has(team)) {
        teamsMap.set(team, {
          teamId: entry._id.workerId,
          teamName: team,
          workerCount: 0,
          totalHours: 0,
          totalCost: 0,
          pctOfTotalHours: 0,
        })
      }
      const teamSummary = teamsMap.get(team)!
      teamSummary.workerCount += 1
      teamSummary.totalHours += hours
      teamSummary.totalCost += cost

      // Aggregate by contract
      if (!contractsMap.has(contract)) {
        contractsMap.set(contract, {
          contractType: contract,
          workerCount: 0,
          totalHours: 0,
          totalCost: 0,
          pctOfTotalHours: 0,
        })
      }
      const contractSummary = contractsMap.get(contract)!
      contractSummary.workerCount += 1
      contractSummary.totalHours += hours
      contractSummary.totalCost += cost

      // Aggregate hourly breakdown
      if (entry.hourlyBreakdown) {
        for (const hourEntry of entry.hourlyBreakdown) {
          const hour = hourEntry.hour
          if (!hourlyMap.has(hour)) {
            hourlyMap.set(hour, { hours: 0, cost: 0 })
          }
          const hourData = hourlyMap.get(hour)!
          hourData.hours += hourEntry.hours ?? 0
          hourData.cost += hourEntry.cost ?? 0
        }
      }
    }

    stepsExecuted.push('aggregated_by_team_contract')

    // Calculate percentages
    for (const team of teamsMap.values()) {
      team.pctOfTotalHours = totalHours > 0 ? (team.totalHours / totalHours) * 100 : 0
    }
    for (const contract of contractsMap.values()) {
      contract.pctOfTotalHours = totalHours > 0 ? (contract.totalHours / totalHours) * 100 : 0
    }

    stepsExecuted.push('calculated_percentages')

    // Build hourly breakdown
    const hourlyBreakdown: HourlyBreakdownEntry[] = Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, data]) => ({
        hour,
        isoDate: new Date(),
        totalRevenue: 0, // Will be filled in from sales snapshot
        totalHours: data.hours,
        totalCost: data.cost,
      }))

    stepsExecuted.push('built_hourly_breakdown')

    // Calculate productivity metrics
    const productivity: LaborProductivityMetrics = calculateProductivityMetrics(
      laborData,
      totalHours,
      totalCost,
      hourlyBreakdown,
    )
    stepsExecuted.push('calculated_productivity_metrics')

    // Create snapshot
    const snapshot: V3LaborWorkingDaySnapshot = {
      locationId,
      locationName,
      businessDate,
      workingDayStart,
      workingDayEnd,
      workingDayStarted: true,
      workingDayFinished: getBusinessDate(new Date()) !== businessDate,
      totalHours,
      totalCost,
      totalWorkers: workersSet.size,
      costPerHour: totalHours > 0 ? totalCost / totalHours : 0,
      teams: Array.from(teamsMap.values()).sort((a, b) => b.totalHours - a.totalHours),
      contracts: Array.from(contractsMap.values()).sort((a, b) => b.totalHours - a.totalHours),
      productivity,
      hourlyBreakdown,
      lastUpdatedAt: new Date(),
      syncCount: (existingSnapshot?.syncCount ?? 0) + 1,
      version: 3,
    }

    stepsExecuted.push('created_snapshot_object')

    // Upsert snapshot
    await upsertLaborSnapshot(db, snapshot)
    stepsExecuted.push('upserted_snapshot')

    return {
      success: true,
      message: 'Labor snapshot updated successfully',
      locationId,
      locationName,
      businessDate,
      timestamp: new Date(),
      syncCount: snapshot.syncCount,
      durationMs: Date.now() - startTime,
      stepsExecuted,
      laborSnapshot: snapshot,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: 'Labor snapshot aggregation failed',
      locationId,
      locationName,
      businessDate,
      timestamp: new Date(),
      syncCount: 0,
      durationMs: Date.now() - startTime,
      stepsExecuted,
      error: errorMsg,
    }
  }
}

/**
 * Calculate labor productivity metrics
 */
function calculateProductivityMetrics(
  laborData: any[],
  totalHours: number,
  totalCost: number,
  hourlyBreakdown: HourlyBreakdownEntry[],
): LaborProductivityMetrics {
  const metrics: LaborProductivityMetrics = {}

  // These will be calculated later when combined with sales data
  // For now, we set up the structure
  metrics.laborCostPctOfRevenue = undefined // Calculated in dashboard snapshot
  metrics.revenuePerLaborHour = undefined

  // Find best and worst hours by efficiency (hours worked, cost per hour)
  let bestHour: number | undefined
  let worstHour: number | undefined
  let bestEfficiency = Infinity
  let worstEfficiency = 0

  for (const entry of hourlyBreakdown) {
    if (entry.totalHours && entry.totalHours > 0) {
      const costPerHour = (entry.totalCost ?? 0) / entry.totalHours
      if (costPerHour < bestEfficiency) {
        bestEfficiency = costPerHour
        bestHour = entry.hour
      }
      if (costPerHour > worstEfficiency) {
        worstEfficiency = costPerHour
        worstHour = entry.hour
      }
    }
  }

  metrics.bestHour = bestHour
  metrics.bestHourEfficiency = bestEfficiency === Infinity ? undefined : bestEfficiency
  metrics.worstHour = worstHour
  metrics.worstHourEfficiency = worstEfficiency === 0 ? undefined : worstEfficiency

  return metrics
}
