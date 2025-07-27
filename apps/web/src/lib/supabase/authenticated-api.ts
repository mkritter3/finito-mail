import { PostgrestError } from '@supabase/supabase-js'

type QueryResult<T> = {
  data: T | null
  error: PostgrestError | null
}

/**
 * Wrapper function for making authenticated API calls.
 * This function now simply passes through the query result as all auth
 * is handled by Supabase SSR cookies.
 * 
 * @param query - The Supabase query to execute
 * @returns The query result or an error
 */
export async function authenticatedApiCall<T>(
  query: Promise<QueryResult<T>>
): Promise<QueryResult<T>> {
  try {
    const { data, error } = await query
    return { data, error }
  } catch (err) {
    // Handle any unexpected errors
    console.error('Unexpected error in authenticatedApiCall:', err)
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
        code: 'unexpected_error',
        details: String(err),
        hint: 'Please try again or contact support'
      } as PostgrestError
    }
  }
}