/**
 * Compute display status for status badge based on auction lifecycle
 *
 * Logic:
 * 1. If final_bid > 0 → SOLD
 * 2. If auction_date is future → UPCOMING
 * 3. If auction_date is today/recent (within 24h) → LIVE
 * 4. If auction_date is past:
 *    a. Has bids but no final_bid → PENDING_RESULT (awaiting approval)
 *    b. No bids at all → NO_BIDS
 * 5. Fallback to db status
 */

type ComputeStatusInput = {
  status?: string
  auctionDateTimeUtc?: string | null
  finalBid?: number | null
  currentBid?: number | null
}

export function computeDisplayStatus(item: ComputeStatusInput): string {
  const { status, auctionDateTimeUtc, finalBid, currentBid } = item

  // 1. If there's a final bid, it's sold
  if (finalBid && finalBid > 0) {
    return 'sold'
  }

  // 2. Check auction date if available
  if (auctionDateTimeUtc) {
    const auctionDate = new Date(auctionDateTimeUtc)
    const now = new Date()
    const diffHours = (auctionDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Future auction = upcoming
    if (diffHours > 24) {
      return 'upcoming'
    }

    // Within 24 hours (past or future) = live
    if (diffHours >= -24 && diffHours <= 24) {
      return 'live'
    }

    // Past auction (>24h ago)
    if (diffHours < -24) {
      // Has bids but no final bid = pending result / awaiting approval
      if (currentBid && currentBid > 0) {
        return 'pending_result'
      }
      // No bids at all
      return 'no_bids'
    }
  }

  // 3. Fallback to database status
  const dbStatus = (status || 'active').toLowerCase()

  // Map common db statuses
  if (dbStatus === 'pending_result' || dbStatus === 'on_approval') {
    return 'pending_result'
  }

  return dbStatus
}
