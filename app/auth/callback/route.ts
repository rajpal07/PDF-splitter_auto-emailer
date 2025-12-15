import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                // Get IP and User Agent
                // Note: 'x-forwarded-for' is standard for proxies like Vercel
                const ip = request.headers.get('x-forwarded-for') || 'unknown'
                const userAgent = request.headers.get('user-agent') || 'unknown'

                // Log the login
                await supabase.from('login_logs').insert({
                    user_id: user.id,
                    email: user.email!,
                    ip: ip,
                    user_agent: userAgent
                })
            }

            return NextResponse.redirect(`${origin}${next}`)
        } else {
            console.error('Auth Code Exchange Error:', error)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
