import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renewGmailWatch } from '@/lib/gmail-watch'
import { createScopedLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

const logger = createScopedLogger('cron.renew-gmail-watches')

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  const timer = logger.time('renew-gmail-watches')

  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.HEALTH_API_KEY

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting Gmail watch renewal job')

    // Get all watches expiring in the next 24 hours
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: expiringWatches, error: fetchError } = await supabase
      .from('gmail_watch')
      .select('user_id, email_address, expiration')
      .lt('expiration', tomorrow.toISOString())
      .order('expiration', { ascending: true })

    if (fetchError) {
      logger.error('Failed to fetch expiring watches', { error: fetchError })
      timer.end({ status: 'error' })
      return NextResponse.json(
        {
          error: 'Failed to fetch expiring watches',
          details: fetchError.message,
        },
        { status: 500 }
      )
    }

    if (!expiringWatches || expiringWatches.length === 0) {
      logger.info('No watches need renewal')
      timer.end({ status: 'no_watches' })
      return NextResponse.json({
        message: 'No watches need renewal',
        checked: 0,
        renewed: 0,
      })
    }

    logger.info(`Found ${expiringWatches.length} watches to renew`)

    // Renew watches in batches to avoid rate limiting
    const results = {
      total: expiringWatches.length,
      renewed: 0,
      failed: 0,
      errors: [] as any[],
    }

    const BATCH_SIZE = 10 // Process 10 watches at a time

    for (let i = 0; i < expiringWatches.length; i += BATCH_SIZE) {
      const batch = expiringWatches.slice(i, i + BATCH_SIZE)
      logger.info(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(expiringWatches.length / BATCH_SIZE)} (${batch.length} watches)`
      )

      // Process batch in parallel
      const renewalPromises = batch.map(async watch => {
        const renewTimer = logger.time(`renew-watch-${watch.user_id}`)

        try {
          await renewGmailWatch(watch.user_id)

          logger.info('Successfully renewed watch', {
            userId: watch.user_id,
            emailAddress: watch.email_address,
            oldExpiration: watch.expiration,
          })

          renewTimer.end({ status: 'success' })
          return { success: true, userId: watch.user_id }
        } catch (error) {
          logger.error('Failed to renew watch', {
            userId: watch.user_id,
            emailAddress: watch.email_address,
            error,
          })

          renewTimer.end({ status: 'error' })
          return {
            success: false,
            userId: watch.user_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })

      // Wait for all renewals to complete
      const renewalResults = await Promise.allSettled(renewalPromises)

      // Process results
      renewalResults.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.renewed++
          } else {
            results.failed++
            results.errors.push({
              userId: result.value.userId,
              error: result.value.error,
            })
          }
        } else {
          // Promise itself rejected (shouldn't happen with our error handling)
          results.failed++
          results.errors.push({
            error: result.reason,
          })
        }
      })
    }

    logger.info('Gmail watch renewal job completed', results)
    timer.end({ status: 'success' })

    return NextResponse.json({
      message: 'Gmail watch renewal completed',
      ...results,
    })
  } catch (error) {
    logger.error('Gmail watch renewal job failed', { error })
    timer.end({ status: 'error' })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Also support POST for some cron services
export async function POST(request: NextRequest) {
  return GET(request)
}
