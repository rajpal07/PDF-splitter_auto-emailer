import Link from 'next/link'

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white p-4">
      <div className="w-full max-w-md rounded-xl bg-gray-900 p-8 border border-red-900/50 shadow-2xl text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-900/20 text-red-500">
           <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
           </svg>
        </div>
        
        <h1 className="mb-2 text-2xl font-bold text-red-400">Authentication Failed</h1>
        <p className="mb-6 text-gray-400">
            {searchParams.error || "There was a problem logging you in with Google."}
        </p>

        <div className="space-y-4">
            <div className="text-sm bg-gray-950 p-3 rounded text-left border border-gray-800 text-gray-500 font-mono overflow-x-auto">
                Tip: Check your Supabase URL/Keys in .env.local and ensure 'http://localhost:3000/auth/callback' is in your Redirect URLs.
            </div>

            <Link 
              href="/login"
              className="inline-block w-full rounded-lg bg-white px-4 py-2 font-semibold text-black hover:bg-gray-200 transition-colors"
            >
              Try Again
            </Link>
        </div>
      </div>
    </div>
  )
}
