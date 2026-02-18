import { NextResponse } from 'next/server'
import { adminDb } from '@/utils/firebase/server'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { email, uid } = body

        if (!email || !uid) {
            return NextResponse.json({ error: 'Missing email or uid' }, { status: 400 })
        }

        // Get IP and User Agent from headers
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const userAgent = request.headers.get('user-agent') || 'unknown'

        // Log the login to Firestore
        await adminDb.collection('login_logs').add({
            user_id: uid,
            email: email,
            login_at: new Date(),
            ip: ip,
            user_agent: userAgent,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Login log error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
