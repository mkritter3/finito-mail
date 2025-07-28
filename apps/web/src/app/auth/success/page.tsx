import { Suspense } from 'react'
import SuccessContent from './success-content'

// Fallback component for Suspense boundary
function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading authentication details...</p>
      </div>
    </div>
  )
}

export default function AuthSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<LoadingState />}>
        <SuccessContent />
      </Suspense>
    </div>
  )
}
