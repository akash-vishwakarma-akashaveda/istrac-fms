// Run: npx tsx src/lib/eventStatus.check.ts
import assert from 'node:assert/strict'
import { deriveEventStatus } from './eventStatus.js'

const now = new Date('2026-10-06T12:00:00Z')
const h = (n: number) => new Date(now.getTime() + n * 3600_000)

assert.equal(deriveEventStatus({ status: 'TIMED_OUT', eventDate: h(24), endDate: h(26) }, now), 'UPCOMING') // rescheduled into the future
assert.equal(deriveEventStatus({ status: 'UPCOMING', eventDate: h(-1), endDate: h(1) }, now), 'IN_PROGRESS')
assert.equal(deriveEventStatus({ status: 'IN_PROGRESS', eventDate: h(-3), endDate: h(-1) }, now), 'TIMED_OUT')
assert.equal(deriveEventStatus({ status: 'UPCOMING', eventDate: h(-1), endDate: null }, now), 'IN_PROGRESS')
assert.equal(deriveEventStatus({ status: 'UPCOMING', eventDate: h(-1), endDate: h(-1) }, now), 'TIMED_OUT') // end boundary is exclusive
assert.equal(deriveEventStatus({ status: 'UPCOMING', eventDate: now, endDate: h(1) }, now), 'IN_PROGRESS') // start boundary is inclusive
assert.equal(deriveEventStatus({ status: 'CANCELLED', eventDate: h(5), endDate: h(6) }, now), 'CANCELLED')
assert.equal(deriveEventStatus({ status: 'COMPLETED', eventDate: h(5), endDate: null }, now), 'COMPLETED')
console.log('eventStatus: all checks passed')
