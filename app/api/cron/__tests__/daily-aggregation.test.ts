/**
 * @registry-id: dailyAggregationCronTest
 * @created: 2026-01-15T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Integration test for daily-aggregation cron POST handler
 * @last-fix: [2026-03-02] Added metadata header for registry tracking
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

vi.mock('@/lib/mongodb', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/Location', () => ({
  default: {
    find: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { _id: new ObjectId(), name: 'Store A' },
      ]),
    }),
  },
}));
const mockBuildDailyAggregation = vi.fn();
vi.mock('@/lib/services/aggregation/dailyOpsAggregationService', () => ({
  buildDailyAggregation: (...args: unknown[]) => mockBuildDailyAggregation(...args),
}));

describe('daily-aggregation cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildDailyAggregation.mockResolvedValue({
      success: true,
      dashboardId: new ObjectId().toString(),
    });
  });

  it('returns 200 and runs aggregation for each active location', async () => {
    const { POST } = await import('../daily-aggregation/route');
    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.aggregations).toBe(1);
    expect(data.total_locations).toBe(1);
    expect(data.details).toHaveLength(1);
    expect(data.details[0].success).toBe(true);
    expect(mockBuildDailyAggregation).toHaveBeenCalledTimes(1);
  });
});
