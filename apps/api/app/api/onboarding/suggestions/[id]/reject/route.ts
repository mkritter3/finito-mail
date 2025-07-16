// Reject onboarding suggestion API - Mark suggestion as rejected
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../../lib/auth'
import { dbPool } from '../../../../../lib/db-pool'

export const POST = withAuth(async (request: NextRequest) => {
  const { user } = request.auth
  const { id } = request.params

  try {
    const result = await rejectSuggestion(id, user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error rejecting suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to reject suggestion' },
      { status: 500 }
    )
  }
})

async function rejectSuggestion(suggestionId: string, userId: string) {
  const client = await dbPool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Update suggestion status to rejected
    const updateResult = await client.query(
      `UPDATE onboarding_suggestions 
       SET status = 'rejected', updated_at = NOW() 
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING *`,
      [suggestionId, userId]
    )
    
    if (updateResult.rows.length === 0) {
      throw new Error('Suggestion not found or already processed')
    }
    
    await client.query('COMMIT')
    
    return {
      success: true,
      message: 'Suggestion rejected successfully'
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}