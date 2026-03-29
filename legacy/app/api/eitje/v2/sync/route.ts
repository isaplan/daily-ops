/**
 * @registry-id: eitjeV2SyncRoute
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-25T00:00:00.000Z
 * @description: Sync Eitje V2 API data into MongoDB (`eitje_raw_data`) with master + date-based endpoints
 * @last-fix: [2026-01-25] Added Member.hourly_rate population from users master data
 *
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 *   - app/lib/mongodb.ts => dbConnect
 *   - app/models/Member.ts => Member model
 *   - app/lib/eitje/v2-credentials.ts => getEitjeCredentials
 *   - app/lib/eitje/v2-api-client.ts => fetchEitje* endpoint helpers
 *   - app/lib/utils/jsonb-extractor.ts => extractEitjeFields
 *   - mongodb => ObjectId
 *
 * @exports-to:
 *   ✓ app/(authenticated)/settings/eitje-api/page.tsx => test connection and manual syncs
 *   ✓ app/lib/cron/v2-cron-manager.ts => scheduled sync execution
 *   ✓ app/api/hours/route.ts => relies on `eitje_raw_data` populated by this sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import dbConnect from '@/lib/mongodb';
import Member from '@/models/Member';
import { getEitjeCredentials } from '@/lib/eitje/v2-credentials';
import {
  fetchEitjeEnvironments,
  fetchEitjeTeams,
  fetchEitjeUsers,
  fetchEitjeShiftTypes,
  fetchEitjeTimeRegistrationShifts,
  fetchEitjePlanningShifts,
  fetchEitjeRevenueDays,
  fetchEitjeAvailabilityShifts,
  fetchEitjeLeaveRequests,
  fetchEitjeEvents,
} from '@/lib/eitje/v2-api-client';
import { extractEitjeFields } from '@/lib/utils/jsonb-extractor';
import { ObjectId } from 'mongodb';

export const maxDuration = 300; // 5 minutes
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, endpoint = 'time_registration_shifts', fullRewrite = false } = body;

    // Master data endpoints don't require date ranges
    const masterDataEndpoints = ['environments', 'teams', 'users', 'shift_types'];
    const requiresDateRange = !masterDataEndpoints.includes(endpoint);

    if (requiresDateRange && (!startDate || !endDate)) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required for this endpoint' },
        { status: 400 }
      );
    }

    // Get credentials
    const creds = await getEitjeCredentials();
    if (!creds) {
      return NextResponse.json(
        { success: false, error: 'No active Eitje credentials found' },
        { status: 404 }
      );
    }

    const db = await getDatabase();
    let recordsSaved = 0;

    // Build environmentId -> locationId mapping
    const locations = await db.collection('locations').find({}).toArray();
    const envToLocationMap = new Map<number, ObjectId>();
    
    for (const loc of locations) {
      if (loc.systemMappings && Array.isArray(loc.systemMappings)) {
        const eitjeMapping = loc.systemMappings.find((m: any) => m.system === 'eitje');
        if (eitjeMapping) {
          envToLocationMap.set(Number(eitjeMapping.externalId), loc._id);
        }
      }
    }

    // Get default location for fallback
    const defaultLocation = await db.collection('locations')
      .findOne({ isActive: true }, { sort: { createdAt: 1 } });

    try {
      let apiData: any[] = [];

      // Fetch data from Eitje API based on endpoint
      if (endpoint === 'environments') {
        apiData = await fetchEitjeEnvironments(creds.baseUrl, creds.credentials);
      } else if (endpoint === 'teams') {
        apiData = await fetchEitjeTeams(creds.baseUrl, creds.credentials);
      } else if (endpoint === 'users') {
        apiData = await fetchEitjeUsers(creds.baseUrl, creds.credentials);
      } else if (endpoint === 'shift_types') {
        apiData = await fetchEitjeShiftTypes(creds.baseUrl, creds.credentials);
      } else if (endpoint === 'time_registration_shifts') {
        if (!startDate || !endDate) {
          return NextResponse.json(
            { success: false, error: 'startDate and endDate are required for time_registration_shifts' },
            { status: 400 }
          );
        }
        apiData = await fetchEitjeTimeRegistrationShifts(
          creds.baseUrl,
          creds.credentials,
          startDate,
          endDate
        );
      } else if (endpoint === 'planning_shifts') {
        if (!startDate || !endDate) {
          return NextResponse.json(
            { success: false, error: 'startDate and endDate are required for planning_shifts' },
            { status: 400 }
          );
        }
        apiData = await fetchEitjePlanningShifts(
          creds.baseUrl,
          creds.credentials,
          startDate,
          endDate
        );
      } else if (endpoint === 'revenue_days') {
        if (!startDate || !endDate) {
          return NextResponse.json(
            { success: false, error: 'startDate and endDate are required for revenue_days' },
            { status: 400 }
          );
        }
        apiData = await fetchEitjeRevenueDays(
          creds.baseUrl,
          creds.credentials,
          startDate,
          endDate
        );
      } else if (endpoint === 'availability_shifts') {
        if (!startDate || !endDate) {
          return NextResponse.json(
            { success: false, error: 'startDate and endDate are required for availability_shifts' },
            { status: 400 }
          );
        }
        apiData = await fetchEitjeAvailabilityShifts(
          creds.baseUrl,
          creds.credentials,
          startDate,
          endDate
        );
      } else if (endpoint === 'leave_requests') {
        if (!startDate || !endDate) {
          return NextResponse.json(
            { success: false, error: 'startDate and endDate are required for leave_requests' },
            { status: 400 }
          );
        }
        apiData = await fetchEitjeLeaveRequests(
          creds.baseUrl,
          creds.credentials,
          startDate,
          endDate
        );
      } else if (endpoint === 'events') {
        if (!startDate || !endDate) {
          return NextResponse.json(
            { success: false, error: 'startDate and endDate are required for events' },
            { status: 400 }
          );
        }
        apiData = await fetchEitjeEvents(
          creds.baseUrl,
          creds.credentials,
          startDate,
          endDate
        );
      } else {
        return NextResponse.json(
          { success: false, error: `Unsupported endpoint: ${endpoint}` },
          { status: 400 }
        );
      }

      if (!Array.isArray(apiData)) {
        return NextResponse.json(
          { success: false, error: 'Invalid API response format' },
          { status: 500 }
        );
      }

      // Process and save each record
      const recordsToInsert = apiData.map((item: any) => {
        // Extract all JSONB fields
        const extracted = extractEitjeFields(item);

        // Determine date from the item (for date-based endpoints)
        let date: Date | undefined = undefined;
        if (masterDataEndpoints.includes(endpoint)) {
          // Master data endpoints don't have dates - use current date or null
          date = undefined;
        } else {
          // Date-based endpoints
          if (item.date) {
            date = new Date(item.date);
          } else if (item.start_time) {
            date = new Date(item.start_time);
          } else if (item.resource_date) {
            date = new Date(item.resource_date);
          } else if (item.start_date) {
            date = new Date(item.start_date);
          } else {
            date = new Date(); // Fallback to today
          }
        }

        // Get environment ID if available
        const environmentId = item.environment_id || item.environment?.id || extracted.environmentId;
        const envIdNum = environmentId ? Number(environmentId) : null;

        // Map environmentId to locationId
        let recordLocationId: ObjectId | undefined = undefined;
        if (envIdNum) {
          recordLocationId = envToLocationMap.get(envIdNum);
        }
        
        // Final fallback to default location (only for date-based endpoints)
        if (!recordLocationId && defaultLocation && !masterDataEndpoints.includes(endpoint)) {
          recordLocationId = defaultLocation._id;
        }

        return {
          locationId: recordLocationId,
          environmentId: envIdNum,
          date: date,
          endpoint: endpoint,
          rawApiResponse: item, // Store entire raw response
          extracted: extracted, // Store extracted fields for querying
          createdAt: new Date(),
        };
      });

      // Insert records (use upsert to avoid duplicates based on a unique key)
      if (recordsToInsert.length > 0) {
        // Use bulkWrite with upsert to handle duplicates
        const operations = recordsToInsert.map((record) => {
          // Different unique keys for master data vs date-based endpoints
          const filter: any = {
            endpoint: record.endpoint,
          };

          // For date-based endpoints (time_registration_shifts, planning_shifts, etc.)
          // Use a more robust unique key: endpoint + date + userId + support_id (if available)
          // This prevents duplicates when the same shift is synced multiple times
          if (!masterDataEndpoints.includes(endpoint)) {
            if (record.date) {
              filter.date = record.date;
            }
            
            // Use support_id as primary unique identifier (most reliable)
            // Fallback to extracted.id if support_id not available
            const supportId = record.extracted?.supportId || 
                             record.rawApiResponse?.support_id || 
                             record.rawApiResponse?.id ||
                             record.extracted?.id;
            
            if (supportId !== undefined && supportId !== null) {
              filter['extracted.supportId'] = supportId;
              // Also try rawApiResponse.support_id as fallback
              if (!filter['extracted.supportId']) {
                filter['rawApiResponse.support_id'] = supportId;
              }
            } else if (record.extracted.id !== undefined && record.extracted.id !== null) {
              // Fallback to extracted.id if support_id not available
              filter['extracted.id'] = record.extracted.id;
            } else {
              // Last resort: use userId + date + locationId + teamId combination
              filter['extracted.userId'] = record.extracted.userId || record.rawApiResponse?.user_id;
              if (record.environmentId) {
                filter.environmentId = record.environmentId;
              }
            }
          } else {
            // Master data endpoints: use extracted.id + environmentId
            filter['extracted.id'] = record.extracted.id;
            if (record.environmentId) {
              filter.environmentId = record.environmentId;
            }
          }

          return {
            updateOne: {
              filter,
              update: { $set: record },
              upsert: true,
            },
          };
        });

        const result = await db.collection('eitje_raw_data').bulkWrite(operations);
        recordsSaved = result.upsertedCount + result.modifiedCount;
      }

      // After syncing users master data, update Member.hourly_rate
      if (endpoint === 'users' && recordsToInsert.length > 0) {
        try {
          await dbConnect(); // Ensure mongoose connection for Member model
          let membersUpdated = 0;

          for (const record of recordsToInsert) {
            const hourlyRate = record.extracted.hourlyRate;
            if (hourlyRate === undefined || hourlyRate === null) continue;

            const rawUser = record.rawApiResponse;
            const userEmail = rawUser.email || rawUser.email_address || rawUser.user_email;
            const userId = record.extracted.id || rawUser.id;

            if (!userEmail && !userId) continue;

            // Try to find member by email first (most reliable)
            let member = null;
            if (userEmail) {
              member = await Member.findOne({ email: userEmail.toLowerCase() });
            }

            // Fallback: try to match by Eitje user ID if stored somewhere
            // (This would require storing Eitje user ID in Member model, which we don't currently do)
            // For now, email matching is the primary method

            if (member && typeof hourlyRate === 'number') {
              member.hourly_rate = hourlyRate;
              await member.save();
              membersUpdated++;
            }
          }

          if (membersUpdated > 0) {
            console.log(`[API /eitje/v2/sync] Updated hourly_rate for ${membersUpdated} members from users master data`);
          }
        } catch (memberUpdateError: any) {
          // Log error but don't fail the sync
          console.error('[API /eitje/v2/sync] Error updating Member.hourly_rate:', memberUpdateError);
        }
      }

      const integrityUrl = process.env.NUXT_APP_URL || process.env.DATA_INTEGRITY_URL;
      if (integrityUrl) {
        fetch(`${integrityUrl.replace(/\/$/, '')}/api/cron/data-integrity`).catch(() => {});
      }
      return NextResponse.json({
        success: true,
        recordsSaved,
        message: `Successfully synced ${recordsSaved} records for ${endpoint}`,
      });

    } catch (apiError: any) {
      console.error('[API /eitje/v2/sync] API error:', apiError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch from Eitje API: ${apiError.message}`,
          recordsSaved: 0,
        },
        { status: 502 }
      );
    }

  } catch (error: any) {
    console.error('[API /eitje/v2/sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync data',
        recordsSaved: 0,
      },
      { status: 500 }
    );
  }
}
