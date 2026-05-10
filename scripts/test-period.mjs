import { resolveDailyOpsPeriod } from './utils/dailyOpsPeriod.ts'

const range = resolveDailyOpsPeriod('yesterday')
console.log('Yesterday period:', JSON.stringify(range, null, 2))
