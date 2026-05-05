declare global {
  const EITJE_HOURS_ADD_FIELDS: typeof import('../../server/utils/eitjeHours').EITJE_HOURS_ADD_FIELDS
  const H3Error: typeof import('../../node_modules/h3').H3Error
  const H3Event: typeof import('../../node_modules/h3').H3Event
  const INBOX_COLLECTIONS: typeof import('../../server/utils/inbox/constants').INBOX_COLLECTIONS
  const INBOX_TARGET_COLLECTIONS: typeof import('../../server/utils/inbox/constants').INBOX_TARGET_COLLECTIONS
  const V3_COLLECTIONS: typeof import('../../server/utils/v3Collections').V3_COLLECTIONS
  const V3_COLLECTION_INDEXES: typeof import('../../server/utils/v3Collections').V3_COLLECTION_INDEXES
  const VAT_DISCLAIMER: typeof import('../../server/utils/dailyOpsDashboardMetrics').VAT_DISCLAIMER
  const __buildAssetsURL: typeof import('../../node_modules/@nuxt/nitro-server/dist/runtime/utils/paths').buildAssetsURL
  const __publicAssetsURL: typeof import('../../node_modules/@nuxt/nitro-server/dist/runtime/utils/paths').publicAssetsURL
  const activeNotesMatch: typeof import('../../server/utils/noteDeletedFilter').activeNotesMatch
  const appendCorsHeaders: typeof import('../../node_modules/h3').appendCorsHeaders
  const appendCorsPreflightHeaders: typeof import('../../node_modules/h3').appendCorsPreflightHeaders
  const appendHeader: typeof import('../../node_modules/h3').appendHeader
  const appendHeaders: typeof import('../../node_modules/h3').appendHeaders
  const appendResponseHeader: typeof import('../../node_modules/h3').appendResponseHeader
  const appendResponseHeaders: typeof import('../../node_modules/h3').appendResponseHeaders
  const assembleDailyOpsLaborMetricsDto: typeof import('../../server/utils/dailyOpsDashboardMetrics').assembleDailyOpsLaborMetricsDto
  const assertMethod: typeof import('../../node_modules/h3').assertMethod
  const buildDailyOpsRevenueBreakdownDto: typeof import('../../server/utils/dailyOpsDashboardMetrics').buildDailyOpsRevenueBreakdownDto
  const buildDailyOpsSummaryDto: typeof import('../../server/utils/dailyOpsDashboardMetrics').buildDailyOpsSummaryDto
  const cachedEventHandler: typeof import('../../node_modules/nitropack/dist/runtime/internal/cache').cachedEventHandler
  const cachedFunction: typeof import('../../node_modules/nitropack/dist/runtime/internal/cache').cachedFunction
  const callNodeListener: typeof import('../../node_modules/h3').callNodeListener
  const canonicalInboxSalesRow: typeof import('../../server/utils/inbox/inbox-sales-row-canonical').canonicalInboxSalesRow
  const classifyByContent: typeof import('../../server/utils/inbox/document-classifier').classifyByContent
  const classifyByFilename: typeof import('../../server/utils/inbox/document-classifier').classifyByFilename
  const classifyDocument: typeof import('../../server/utils/inbox/document-classifier').classifyDocument
  const cleanupOldSnapshots: typeof import('../../server/utils/v3Snapshots').cleanupOldSnapshots
  const clearResponseHeaders: typeof import('../../node_modules/h3').clearResponseHeaders
  const clearSession: typeof import('../../node_modules/h3').clearSession
  const collectMentionSlugsFromContent: typeof import('../../server/utils/noteMentions').collectMentionSlugsFromContent
  const computeMostProfitableHour: typeof import('../../server/utils/dailyOpsDashboardMetrics').computeMostProfitableHour
  const connectToDatabase: typeof import('../../server/utils/db').connectToDatabase
  const createApp: typeof import('../../node_modules/h3').createApp
  const createAppEventHandler: typeof import('../../node_modules/h3').createAppEventHandler
  const createError: typeof import('../../node_modules/h3').createError
  const createEvent: typeof import('../../node_modules/h3').createEvent
  const createEventStream: typeof import('../../node_modules/h3').createEventStream
  const createRouter: typeof import('../../node_modules/h3').createRouter
  const defaultContentType: typeof import('../../node_modules/h3').defaultContentType
  const defineAppConfig: typeof import('../../node_modules/@nuxt/nitro-server/dist/runtime/utils/config').defineAppConfig
  const defineCachedEventHandler: typeof import('../../node_modules/nitropack/dist/runtime/internal/cache').defineCachedEventHandler
  const defineCachedFunction: typeof import('../../node_modules/nitropack/dist/runtime/internal/cache').defineCachedFunction
  const defineEventHandler: typeof import('../../node_modules/h3').defineEventHandler
  const defineLazyEventHandler: typeof import('../../node_modules/h3').defineLazyEventHandler
  const defineNitroErrorHandler: typeof import('../../node_modules/nitropack/dist/runtime/internal/error/utils').defineNitroErrorHandler
  const defineNitroPlugin: typeof import('../../node_modules/nitropack/dist/runtime/internal/plugin').defineNitroPlugin
  const defineNodeListener: typeof import('../../node_modules/h3').defineNodeListener
  const defineNodeMiddleware: typeof import('../../node_modules/h3').defineNodeMiddleware
  const defineRenderHandler: typeof import('../../node_modules/nitropack/dist/runtime/internal/renderer').defineRenderHandler
  const defineRequestMiddleware: typeof import('../../node_modules/h3').defineRequestMiddleware
  const defineResponseMiddleware: typeof import('../../node_modules/h3').defineResponseMiddleware
  const defineRouteMeta: typeof import('../../node_modules/nitropack/dist/runtime/internal/meta').defineRouteMeta
  const defineTask: typeof import('../../node_modules/nitropack/dist/runtime/internal/task').defineTask
  const defineWebSocket: typeof import('../../node_modules/h3').defineWebSocket
  const defineWebSocketHandler: typeof import('../../node_modules/h3').defineWebSocketHandler
  const deleteCookie: typeof import('../../node_modules/h3').deleteCookie
  const detectHeaderRow: typeof import('../../server/utils/parseMenuDump').detectHeaderRow
  const documentToCredentialsApiShape: typeof import('../../server/utils/eitjeApiCredentials').documentToCredentialsApiShape
  const documentToEitjeStoredCredentials: typeof import('../../server/utils/eitjeApiCredentials').documentToEitjeStoredCredentials
  const dynamicEventHandler: typeof import('../../node_modules/h3').dynamicEventHandler
  const eitjeUserIdCandidates: typeof import('../../server/utils/memberEitjeContext').eitjeUserIdCandidates
  const ensureGmailWatchIfNeeded: typeof import('../../server/utils/inbox/gmailWatchAutostart').ensureGmailWatchIfNeeded
  const ensureInboxCollections: typeof import('../../server/utils/inbox/collections').ensureInboxCollections
  const ensureInboxIndexes: typeof import('../../server/utils/inbox/collections').ensureInboxIndexes
  const enumerateUtcDatesInclusive: typeof import('../../server/utils/dailyOpsDashboardMetrics').enumerateUtcDatesInclusive
  const eventHandler: typeof import('../../node_modules/h3').eventHandler
  const extractDumpRows: typeof import('../../server/utils/parseMenuDump').extractDumpRows
  const extractLocationFromTrivecCsv: typeof import('../../server/utils/inbox/trivec-sales-csv').extractLocationFromTrivecCsv
  const extractMentionSlug: typeof import('../../server/utils/noteMentions').extractMentionSlug
  const extractWijnkaartItems: typeof import('../../server/utils/parseMenuFile').extractWijnkaartItems
  const fetchAggregationActivityByLocationTeam: typeof import('../../server/utils/memberEitjeContext').fetchAggregationActivityByLocationTeam
  const fetchBorkHourAggregatesBundle: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchBorkHourAggregatesBundle
  const fetchBorkRevenueTotals: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchBorkRevenueTotals
  const fetchEitjeLaborTotals: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchEitjeLaborTotals
  const fetchHourlyRevenueForRange: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchHourlyRevenueForRange
  const fetchHoursCostByContractType: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchHoursCostByContractType
  const fetchHoursCostByContractTypeByDay: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchHoursCostByContractTypeByDay
  const fetchLaborByDate: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchLaborByDate
  const fetchLaborMetricsPipelineInput: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchLaborMetricsPipelineInput
  const fetchLaborProductivityByLocationDay: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchLaborProductivityByLocationDay
  const fetchMemberEitjePlaces: typeof import('../../server/utils/memberEitjeContext').fetchMemberEitjePlaces
  const fetchRevenueByCategoryFromHourAggregates: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchRevenueByCategoryFromHourAggregates
  const fetchRevenueByCategoryFromRaw: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchRevenueByCategoryFromRaw
  const fetchRevenueByDate: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchRevenueByDate
  const fetchRevenueByDateAndLocation: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchRevenueByDateAndLocation
  const fetchRevenueByTimePeriod: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchRevenueByTimePeriod
  const fetchWithEvent: typeof import('../../node_modules/h3').fetchWithEvent
  const fetchWorkersByTeamLocation: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchWorkersByTeamLocation
  const fetchWorkersByTeamLocationByDay: typeof import('../../server/utils/dailyOpsDashboardMetrics').fetchWorkersByTeamLocationByDay
  const findEitjeCredentialDocument: typeof import('../../server/utils/eitjeApiCredentials').findEitjeCredentialDocument
  const formatBusinessDate: typeof import('../../server/utils/v3BusinessDay').formatBusinessDate
  const fromNodeMiddleware: typeof import('../../node_modules/h3').fromNodeMiddleware
  const fromPlainHandler: typeof import('../../node_modules/h3').fromPlainHandler
  const fromWebHandler: typeof import('../../node_modules/h3').fromWebHandler
  const getAggregationHistory: typeof import('../../server/utils/v3Snapshots').getAggregationHistory
  const getBusinessDate: typeof import('../../server/utils/v3BusinessDay').getBusinessDate
  const getBusinessDayDurationMs: typeof import('../../server/utils/v3BusinessDay').getBusinessDayDurationMs
  const getBusinessDayEnd: typeof import('../../server/utils/v3BusinessDay').getBusinessDayEnd
  const getBusinessDayPart1Date: typeof import('../../server/utils/v3BusinessDay').getBusinessDayPart1Date
  const getBusinessDayPart2Date: typeof import('../../server/utils/v3BusinessDay').getBusinessDayPart2Date
  const getBusinessDayPart: typeof import('../../server/utils/v3BusinessDay').getBusinessDayPart
  const getBusinessDayProgressPercent: typeof import('../../server/utils/v3BusinessDay').getBusinessDayProgressPercent
  const getBusinessDayStart: typeof import('../../server/utils/v3BusinessDay').getBusinessDayStart
  const getCookie: typeof import('../../node_modules/h3').getCookie
  const getCurrentBusinessDate: typeof import('../../server/utils/v3BusinessDay').getCurrentBusinessDate
  const getDashboardSnapshot: typeof import('../../server/utils/v3Snapshots').getDashboardSnapshot
  const getDb: typeof import('../../server/utils/db').getDb
  const getGmailInvalidGrantHint: typeof import('../../server/utils/gmailOAuthError').getGmailInvalidGrantHint
  const getGmailOAuthErrorMessage: typeof import('../../server/utils/gmailOAuthError').getGmailOAuthErrorMessage
  const getGmailRedirectUri: typeof import('../../server/utils/gmailRedirectUri').getGmailRedirectUri
  const getHeader: typeof import('../../node_modules/h3').getHeader
  const getHeaders: typeof import('../../node_modules/h3').getHeaders
  const getHourFromDate: typeof import('../../server/utils/v3BusinessDay').getHourFromDate
  const getInboxImportTablePayload: typeof import('../../server/utils/inbox/inboxImportTableQuery').getInboxImportTablePayload
  const getLaborSnapshot: typeof import('../../server/utils/v3Snapshots').getLaborSnapshot
  const getLatestSalesSnapshotsAllLocations: typeof import('../../server/utils/v3Snapshots').getLatestSalesSnapshotsAllLocations
  const getMenuItemsCollection: typeof import('../../server/utils/db').getMenuItemsCollection
  const getMenuVersionsCollection: typeof import('../../server/utils/db').getMenuVersionsCollection
  const getMenusCollection: typeof import('../../server/utils/db').getMenusCollection
  const getMethod: typeof import('../../node_modules/h3').getMethod
  const getMongoDatabaseName: typeof import('../../server/utils/db').getMongoDatabaseName
  const getNextAggregationTime: typeof import('../../server/utils/v3BusinessDay').getNextAggregationTime
  const getNotesCollection: typeof import('../../server/utils/db').getNotesCollection
  const getProxyRequestHeaders: typeof import('../../node_modules/h3').getProxyRequestHeaders
  const getQuery: typeof import('../../node_modules/h3').getQuery
  const getRequestFingerprint: typeof import('../../node_modules/h3').getRequestFingerprint
  const getRequestHeader: typeof import('../../node_modules/h3').getRequestHeader
  const getRequestHeaders: typeof import('../../node_modules/h3').getRequestHeaders
  const getRequestHost: typeof import('../../node_modules/h3').getRequestHost
  const getRequestIP: typeof import('../../node_modules/h3').getRequestIP
  const getRequestPath: typeof import('../../node_modules/h3').getRequestPath
  const getRequestProtocol: typeof import('../../node_modules/h3').getRequestProtocol
  const getRequestURL: typeof import('../../node_modules/h3').getRequestURL
  const getRequestWebStream: typeof import('../../node_modules/h3').getRequestWebStream
  const getResponseHeader: typeof import('../../node_modules/h3').getResponseHeader
  const getResponseHeaders: typeof import('../../node_modules/h3').getResponseHeaders
  const getResponseStatus: typeof import('../../node_modules/h3').getResponseStatus
  const getResponseStatusText: typeof import('../../node_modules/h3').getResponseStatusText
  const getRouteRules: typeof import('../../node_modules/nitropack/dist/runtime/internal/route-rules').getRouteRules
  const getRouterParam: typeof import('../../node_modules/h3').getRouterParam
  const getRouterParams: typeof import('../../node_modules/h3').getRouterParams
  const getSalesSnapshot: typeof import('../../server/utils/v3Snapshots').getSalesSnapshot
  const getSalesSnapshotsByLocationRange: typeof import('../../server/utils/v3Snapshots').getSalesSnapshotsByLocationRange
  const getSession: typeof import('../../node_modules/h3').getSession
  const getSheetNames: typeof import('../../server/utils/inbox/excel-parser').getSheetNames
  const getUnifiedUsersCollection: typeof import('../../server/utils/db').getUnifiedUsersCollection
  const getUtcDayRange: typeof import('../../server/utils/eitjeHours').getUtcDayRange
  const getV3AggregationScheduleHours: typeof import('../../server/utils/v3BusinessDay').getV3AggregationScheduleHours
  const getValidatedQuery: typeof import('../../node_modules/h3').getValidatedQuery
  const getValidatedRouterParams: typeof import('../../node_modules/h3').getValidatedRouterParams
  const handleCacheHeaders: typeof import('../../node_modules/h3').handleCacheHeaders
  const handleCors: typeof import('../../node_modules/h3').handleCors
  const initializeV3Collections: typeof import('../../server/utils/v3Collections').initializeV3Collections
  const inventoryCollections: typeof import('../../server/utils/dailyOpsDashboardMetrics').inventoryCollections
  const isBusinessDayFinished: typeof import('../../server/utils/v3BusinessDay').isBusinessDayFinished
  const isCorsOriginAllowed: typeof import('../../node_modules/h3').isCorsOriginAllowed
  const isError: typeof import('../../node_modules/h3').isError
  const isEvent: typeof import('../../node_modules/h3').isEvent
  const isEventHandler: typeof import('../../node_modules/h3').isEventHandler
  const isInvalidGrantError: typeof import('../../server/utils/gmailOAuthError').isInvalidGrantError
  const isMethod: typeof import('../../node_modules/h3').isMethod
  const isPreflightRequest: typeof import('../../node_modules/h3').isPreflightRequest
  const isScheduledAggregationTime: typeof import('../../server/utils/v3BusinessDay').isScheduledAggregationTime
  const isStream: typeof import('../../node_modules/h3').isStream
  const isValidBusinessDateFormat: typeof import('../../server/utils/v3BusinessDay').isValidBusinessDateFormat
  const isWebResponse: typeof import('../../node_modules/h3').isWebResponse
  const lazyEventHandler: typeof import('../../node_modules/h3').lazyEventHandler
  const locationDayKey: typeof import('../../server/utils/dailyOpsDashboardMetrics').locationDayKey
  const looksLikeTrivecSemicolonSales: typeof import('../../server/utils/inbox/csv-parser').looksLikeTrivecSemicolonSales
  const mapBasisReportXLSX: typeof import('../../server/utils/inbox/basis-report-mapper').mapBasisReportXLSX
  const mapWijnkaartRowToItem: typeof import('../../server/utils/parseMenuFile').mapWijnkaartRowToItem
  const mergeWorkedAndPlanned: typeof import('../../server/utils/memberEitjeContext').mergeWorkedAndPlanned
  const nitroPlugin: typeof import('../../node_modules/nitropack/dist/runtime/internal/plugin').nitroPlugin
  const normalizeTrivecSemicolonSalesParse: typeof import('../../server/utils/inbox/trivec-sales-csv').normalizeTrivecSemicolonSalesParse
  const parseCSV: typeof import('../../server/utils/inbox/csv-parser').parseCSV
  const parseCookies: typeof import('../../node_modules/h3').parseCookies
  const parseCsvToRows: typeof import('../../server/utils/parseMenuFile').parseCsvToRows
  const parseDailyOpsMetricsQuery: typeof import('../../server/utils/dailyOpsDashboardMetrics').parseDailyOpsMetricsQuery
  const parseDdMmYyyyToNoonUtc: typeof import('../../server/utils/inbox/inbox-sales-row-canonical').parseDdMmYyyyToNoonUtc
  const parseEuroInbox: typeof import('../../server/utils/inbox/inbox-sales-row-canonical').parseEuroInbox
  const parseExcel: typeof import('../../server/utils/inbox/excel-parser').parseExcel
  const parseExcelToRows: typeof import('../../server/utils/parseMenuFile').parseExcelToRows
  const parseInboxImportTableQuery: typeof import('../../server/utils/inbox/inboxImportTableQuery').parseInboxImportTableQuery
  const parseLocationDayKey: typeof import('../../server/utils/dailyOpsDashboardMetrics').parseLocationDayKey
  const parseMenuFileToRows: typeof import('../../server/utils/parseMenuFile').parseMenuFileToRows
  const parsePDF: typeof import('../../server/utils/inbox/pdf-parser').parsePDF
  const parsePdfToRows: typeof import('../../server/utils/parsePdf').parsePdfToRows
  const parseYmdToNoonUtc: typeof import('../../server/utils/inbox/inbox-sales-row-canonical').parseYmdToNoonUtc
  const productGroupFromFilename: typeof import('../../server/utils/parseMenuDump').productGroupFromFilename
  const promisifyNodeListener: typeof import('../../node_modules/h3').promisifyNodeListener
  const proxyRequest: typeof import('../../node_modules/h3').proxyRequest
  const readBody: typeof import('../../node_modules/h3').readBody
  const readFormData: typeof import('../../node_modules/h3').readFormData
  const readMultipartFormData: typeof import('../../node_modules/h3').readMultipartFormData
  const readRawBody: typeof import('../../node_modules/h3').readRawBody
  const readValidatedBody: typeof import('../../node_modules/h3').readValidatedBody
  const recordAggregationMetadata: typeof import('../../server/utils/v3Snapshots').recordAggregationMetadata
  const removeResponseHeader: typeof import('../../node_modules/h3').removeResponseHeader
  const resolveBorkAggReadSuffix: typeof import('../../server/utils/borkAggVersionSuffix').resolveBorkAggReadSuffix
  const resolveBorkAggRebuildSuffix: typeof import('../../server/utils/borkAggVersionSuffix').resolveBorkAggRebuildSuffix
  const resolveDailyOpsPeriod: typeof import('../../server/utils/dailyOpsPeriod').resolveDailyOpsPeriod
  const resolveEitjeAggregationUserCandidates: typeof import('../../server/utils/memberEitjeContext').resolveEitjeAggregationUserCandidates
  const resolveSlugsToUnifiedUserIds: typeof import('../../server/utils/noteMentions').resolveSlugsToUnifiedUserIds
  const resolveUnifiedLocationToEitjeId: typeof import('../../server/utils/dailyOpsDashboardMetrics').resolveUnifiedLocationToEitjeId
  const resolveV2RebuildCollectionSuffix: typeof import('../../server/utils/borkV2RebuildSuffix').resolveV2RebuildCollectionSuffix
  const revenueByTimePeriodFromHourTotals: typeof import('../../server/utils/dailyOpsDashboardMetrics').revenueByTimePeriodFromHourTotals
  const rowToData: typeof import('../../server/utils/parseMenuDump').rowToData
  const runTask: typeof import('../../node_modules/nitropack/dist/runtime/internal/task').runTask
  const sanitizeStatusCode: typeof import('../../node_modules/h3').sanitizeStatusCode
  const sanitizeStatusMessage: typeof import('../../node_modules/h3').sanitizeStatusMessage
  const sealSession: typeof import('../../node_modules/h3').sealSession
  const send: typeof import('../../node_modules/h3').send
  const sendError: typeof import('../../node_modules/h3').sendError
  const sendIterable: typeof import('../../node_modules/h3').sendIterable
  const sendNoContent: typeof import('../../node_modules/h3').sendNoContent
  const sendProxy: typeof import('../../node_modules/h3').sendProxy
  const sendRedirect: typeof import('../../node_modules/h3').sendRedirect
  const sendStream: typeof import('../../node_modules/h3').sendStream
  const sendWebResponse: typeof import('../../node_modules/h3').sendWebResponse
  const serveStatic: typeof import('../../node_modules/h3').serveStatic
  const setCookie: typeof import('../../node_modules/h3').setCookie
  const setHeader: typeof import('../../node_modules/h3').setHeader
  const setHeaders: typeof import('../../node_modules/h3').setHeaders
  const setResponseHeader: typeof import('../../node_modules/h3').setResponseHeader
  const setResponseHeaders: typeof import('../../node_modules/h3').setResponseHeaders
  const setResponseStatus: typeof import('../../node_modules/h3').setResponseStatus
  const shouldUpdateSnapshot: typeof import('../../server/utils/v3Snapshots').shouldUpdateSnapshot
  const splitCookiesString: typeof import('../../node_modules/h3').splitCookiesString
  const toEventHandler: typeof import('../../node_modules/h3').toEventHandler
  const toISODateString: typeof import('../../server/utils/v3BusinessDay').toISODateString
  const toNodeListener: typeof import('../../node_modules/h3').toNodeListener
  const toPlainHandler: typeof import('../../node_modules/h3').toPlainHandler
  const toWebHandler: typeof import('../../node_modules/h3').toWebHandler
  const toWebRequest: typeof import('../../node_modules/h3').toWebRequest
  const trashedNotesMatch: typeof import('../../server/utils/noteDeletedFilter').trashedNotesMatch
  const unsealSession: typeof import('../../node_modules/h3').unsealSession
  const updateSession: typeof import('../../node_modules/h3').updateSession
  const upsertDashboardSnapshot: typeof import('../../server/utils/v3Snapshots').upsertDashboardSnapshot
  const upsertLaborSnapshot: typeof import('../../server/utils/v3Snapshots').upsertLaborSnapshot
  const upsertSalesSnapshot: typeof import('../../server/utils/v3Snapshots').upsertSalesSnapshot
  const useAppConfig: typeof import('../../node_modules/nitropack/dist/runtime/internal/config').useAppConfig
  const useBase: typeof import('../../node_modules/h3').useBase
  const useEvent: typeof import('../../node_modules/nitropack/dist/runtime/internal/context').useEvent
  const useNitroApp: typeof import('../../node_modules/nitropack/dist/runtime/internal/app').useNitroApp
  const useRuntimeConfig: typeof import('../../node_modules/nitropack/dist/runtime/internal/config').useRuntimeConfig
  const useSession: typeof import('../../node_modules/h3').useSession
  const useStorage: typeof import('../../node_modules/nitropack/dist/runtime/internal/storage').useStorage
  const v3ValidationComplete: typeof import('../../server/utils/v3ValidationChecklist').v3ValidationComplete
  const writeEarlyHints: typeof import('../../node_modules/h3').writeEarlyHints
}
// for type re-export
declare global {
  // @ts-ignore
  export type { EventHandler, EventHandlerRequest, EventHandlerResponse, EventHandlerObject, H3EventContext } from '../../node_modules/h3'
  import('../../node_modules/h3')
  // @ts-ignore
  export type { DailyOpsMetricsContext, BorkHourAggregatesBundle, ContractTypeDayRow, WorkersTeamLocationDayRow, LaborMetricsPipelineInput } from '../../server/utils/dailyOpsDashboardMetrics'
  import('../../server/utils/dailyOpsDashboardMetrics')
  // @ts-ignore
  export type { DailyOpsDateRange } from '../../server/utils/dailyOpsPeriod'
  import('../../server/utils/dailyOpsPeriod')
  // @ts-ignore
  export type { UtcDayRange } from '../../server/utils/eitjeHours'
  import('../../server/utils/eitjeHours')
  // @ts-ignore
  export type { BasisReportData } from '../../server/utils/inbox/basis-report-mapper'
  import('../../server/utils/inbox/basis-report-mapper')
  // @ts-ignore
  export type { CsvParseOptions } from '../../server/utils/inbox/csv-parser'
  import('../../server/utils/inbox/csv-parser')
  // @ts-ignore
  export type { ClassificationResult } from '../../server/utils/inbox/document-classifier'
  import('../../server/utils/inbox/document-classifier')
  // @ts-ignore
  export type { ExcelParseOptions } from '../../server/utils/inbox/excel-parser'
  import('../../server/utils/inbox/excel-parser')
  // @ts-ignore
  export type { GmailWatchAutostartResult } from '../../server/utils/inbox/gmailWatchAutostart'
  import('../../server/utils/inbox/gmailWatchAutostart')
  // @ts-ignore
  export type { InboxImportDocumentType, InboxImportTableQuery, InboxImportTablePayload } from '../../server/utils/inbox/inboxImportTableQuery'
  import('../../server/utils/inbox/inboxImportTableQuery')
  // @ts-ignore
  export type { PdfParseOptions } from '../../server/utils/inbox/pdf-parser'
  import('../../server/utils/inbox/pdf-parser')
  // @ts-ignore
  export type { HoursActivityEntry, MergedPlaceRow } from '../../server/utils/memberEitjeContext'
  import('../../server/utils/memberEitjeContext')
  // @ts-ignore
  export type { DumpRow } from '../../server/utils/parseMenuDump'
  import('../../server/utils/parseMenuDump')
  // @ts-ignore
  export type { ParseMenuFileResult, MappedMenuItem } from '../../server/utils/parseMenuFile'
  import('../../server/utils/parseMenuFile')
  // @ts-ignore
  export type { ParsePdfResult } from '../../server/utils/parsePdf'
  import('../../server/utils/parsePdf')
}
export { H3Event, H3Error, appendCorsHeaders, appendCorsPreflightHeaders, appendHeader, appendHeaders, appendResponseHeader, appendResponseHeaders, assertMethod, callNodeListener, clearResponseHeaders, clearSession, createApp, createAppEventHandler, createError, createEvent, createEventStream, createRouter, defaultContentType, defineEventHandler, defineLazyEventHandler, defineNodeListener, defineNodeMiddleware, defineRequestMiddleware, defineResponseMiddleware, defineWebSocket, defineWebSocketHandler, deleteCookie, dynamicEventHandler, eventHandler, fetchWithEvent, fromNodeMiddleware, fromPlainHandler, fromWebHandler, getCookie, getHeader, getHeaders, getMethod, getProxyRequestHeaders, getQuery, getRequestFingerprint, getRequestHeader, getRequestHeaders, getRequestHost, getRequestIP, getRequestPath, getRequestProtocol, getRequestURL, getRequestWebStream, getResponseHeader, getResponseHeaders, getResponseStatus, getResponseStatusText, getRouterParam, getRouterParams, getSession, getValidatedQuery, getValidatedRouterParams, handleCacheHeaders, handleCors, isCorsOriginAllowed, isError, isEvent, isEventHandler, isMethod, isPreflightRequest, isStream, isWebResponse, lazyEventHandler, parseCookies, promisifyNodeListener, proxyRequest, readBody, readFormData, readMultipartFormData, readRawBody, readValidatedBody, removeResponseHeader, sanitizeStatusCode, sanitizeStatusMessage, sealSession, send, sendError, sendIterable, sendNoContent, sendProxy, sendRedirect, sendStream, sendWebResponse, serveStatic, setCookie, setHeader, setHeaders, setResponseHeader, setResponseHeaders, setResponseStatus, splitCookiesString, toEventHandler, toNodeListener, toPlainHandler, toWebHandler, toWebRequest, unsealSession, updateSession, useBase, useSession, writeEarlyHints } from 'h3';
export { useNitroApp } from 'nitropack/runtime/internal/app';
export { useRuntimeConfig, useAppConfig } from 'nitropack/runtime/internal/config';
export { defineNitroPlugin, nitroPlugin } from 'nitropack/runtime/internal/plugin';
export { defineCachedFunction, defineCachedEventHandler, cachedFunction, cachedEventHandler } from 'nitropack/runtime/internal/cache';
export { useStorage } from 'nitropack/runtime/internal/storage';
export { defineRenderHandler } from 'nitropack/runtime/internal/renderer';
export { defineRouteMeta } from 'nitropack/runtime/internal/meta';
export { getRouteRules } from 'nitropack/runtime/internal/route-rules';
export { useEvent } from 'nitropack/runtime/internal/context';
export { defineTask, runTask } from 'nitropack/runtime/internal/task';
export { defineNitroErrorHandler } from 'nitropack/runtime/internal/error/utils';
export { buildAssetsURL as __buildAssetsURL, publicAssetsURL as __publicAssetsURL } from '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/@nuxt/nitro-server/dist/runtime/utils/paths';
export { defineAppConfig } from '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/@nuxt/nitro-server/dist/runtime/utils/config';
export { resolveBorkAggReadSuffix, resolveBorkAggRebuildSuffix } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/borkAggVersionSuffix';
export { resolveV2RebuildCollectionSuffix } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/borkV2RebuildSuffix';
export { parseDailyOpsMetricsQuery, resolveUnifiedLocationToEitjeId, enumerateUtcDatesInclusive, fetchBorkRevenueTotals, fetchEitjeLaborTotals, fetchRevenueByCategoryFromHourAggregates, fetchRevenueByCategoryFromRaw, fetchBorkHourAggregatesBundle, revenueByTimePeriodFromHourTotals, fetchRevenueByTimePeriod, fetchHourlyRevenueForRange, fetchRevenueByDate, locationDayKey, parseLocationDayKey, fetchRevenueByDateAndLocation, fetchLaborByDate, fetchHoursCostByContractTypeByDay, computeMostProfitableHour, fetchWorkersByTeamLocation, fetchWorkersByTeamLocationByDay, fetchHoursCostByContractType, fetchLaborProductivityByLocationDay, inventoryCollections, fetchLaborMetricsPipelineInput, assembleDailyOpsLaborMetricsDto, buildDailyOpsSummaryDto, buildDailyOpsRevenueBreakdownDto, VAT_DISCLAIMER } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/dailyOpsDashboardMetrics';
export { resolveDailyOpsPeriod } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/dailyOpsPeriod';
export { getMongoDatabaseName, getDb, getNotesCollection, getUnifiedUsersCollection, getMenuItemsCollection, getMenusCollection, getMenuVersionsCollection, connectToDatabase } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/db';
export { findEitjeCredentialDocument, documentToEitjeStoredCredentials, documentToCredentialsApiShape } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/eitjeApiCredentials';
export { EITJE_HOURS_ADD_FIELDS, getUtcDayRange } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/eitjeHours';
export { getGmailOAuthErrorMessage, isInvalidGrantError, getGmailInvalidGrantHint } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/gmailOAuthError';
export { getGmailRedirectUri } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/gmailRedirectUri';
export { mapBasisReportXLSX } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/basis-report-mapper';
export { ensureInboxCollections, ensureInboxIndexes } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/collections';
export { INBOX_COLLECTIONS, INBOX_TARGET_COLLECTIONS } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/constants';
export { looksLikeTrivecSemicolonSales, parseCSV } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/csv-parser';
export { classifyByFilename, classifyByContent, classifyDocument } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/document-classifier';
export { parseExcel, getSheetNames } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/excel-parser';
export { ensureGmailWatchIfNeeded } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/gmailWatchAutostart';
export { parseDdMmYyyyToNoonUtc, parseYmdToNoonUtc, parseEuroInbox, canonicalInboxSalesRow } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/inbox-sales-row-canonical';
export { parseInboxImportTableQuery, getInboxImportTablePayload } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/inboxImportTableQuery';
export { parsePDF } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/pdf-parser';
export { extractLocationFromTrivecCsv, normalizeTrivecSemicolonSalesParse } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/inbox/trivec-sales-csv';
export { eitjeUserIdCandidates, resolveEitjeAggregationUserCandidates, fetchAggregationActivityByLocationTeam, mergeWorkedAndPlanned, fetchMemberEitjePlaces } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/memberEitjeContext';
export { activeNotesMatch, trashedNotesMatch } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/noteDeletedFilter';
export { extractMentionSlug, collectMentionSlugsFromContent, resolveSlugsToUnifiedUserIds } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/noteMentions';
export { detectHeaderRow, rowToData, productGroupFromFilename, extractDumpRows } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/parseMenuDump';
export { parseCsvToRows, parseExcelToRows, mapWijnkaartRowToItem, extractWijnkaartItems, parseMenuFileToRows } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/parseMenuFile';
export { parsePdfToRows } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/parsePdf';
export { getBusinessDate, getBusinessDayStart, getBusinessDayEnd, getBusinessDayPart1Date, getBusinessDayPart2Date, getBusinessDayPart, isBusinessDayFinished, toISODateString, formatBusinessDate, getCurrentBusinessDate, getHourFromDate, isValidBusinessDateFormat, getBusinessDayDurationMs, getBusinessDayProgressPercent, getV3AggregationScheduleHours, isScheduledAggregationTime, getNextAggregationTime } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/v3BusinessDay';
export { V3_COLLECTIONS, V3_COLLECTION_INDEXES, initializeV3Collections } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/v3Collections';
export { getSalesSnapshot, getLaborSnapshot, getDashboardSnapshot, upsertSalesSnapshot, upsertLaborSnapshot, upsertDashboardSnapshot, getSalesSnapshotsByLocationRange, getLatestSalesSnapshotsAllLocations, recordAggregationMetadata, getAggregationHistory, cleanupOldSnapshots, shouldUpdateSnapshot } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/v3Snapshots';
export { v3ValidationComplete } from '/Users/alviniomolina/Documents/GitHub/daily-ops/server/utils/v3ValidationChecklist';