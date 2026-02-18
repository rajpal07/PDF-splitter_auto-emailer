import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { PDFDocument } from 'pdf-lib'
import { parse } from 'csv-parse/sync'
import JSZip from 'jszip'
import { adminDb } from '@/utils/firebase/server'

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const pdfFile = formData.get('pdf') as File
        const csvFile = formData.get('csv') as File
        const userId = formData.get('userId') as string

        // Customization
        const emailSubjectTpl = (formData.get('emailSubject') as string) || "Flat No-{flatNo} - Lift Repair Bill"
        const emailBodyTpl = (formData.get('emailBody') as string) || "Please see attached bill."
        const filenamePatternTpl = (formData.get('filenamePattern') as string) || "Bill-{flatNo}.pdf"
        const downloadZip = formData.get('downloadZip') === 'true'

        if (!pdfFile || !csvFile || !userId) {
            return NextResponse.json({ error: 'Missing files or user ID' }, { status: 400 })
        }

        // 1. Parse CSV (skip first 5 lines of iterator)
        const csvText = await csvFile.text()
        const records = parse(csvText, {
            skip_empty_lines: true,
            relax_column_count: true,
        }) as string[][]
        const dataRows = records.slice(5)

        // 2. Load PDF
        const pdfBuffer = await pdfFile.arrayBuffer()
        const srcDoc = await PDFDocument.load(pdfBuffer)
        const pageCount = srcDoc.getPageCount()

        // 3. Setup Gmail - Note: For Firebase, we need to get the Google access token from the client
        // The client should pass the Google access token in the request
        // For now, we'll use a placeholder - in production, you'd use Firebase Auth's getAccessToken
        const googleAccessToken = request.headers.get('X-Google-Access-Token')

        if (!googleAccessToken) {
            return NextResponse.json({ error: 'Missing Google access token. Please re-authenticate.' }, { status: 401 })
        }

        const auth = new google.auth.OAuth2()
        auth.setCredentials({ access_token: googleAccessToken })
        const gmail = google.gmail({ version: 'v1', auth })

        const results = []
        const zip = new JSZip()

        for (let i = 0; i < pageCount; i++) {
            if (!dataRows[i]) break;

            const row = dataRows[i]
            const flatNo = row[1]?.trim() || `Unknown-${i}`
            const email = row[6]?.trim()

            // 4. Create Single Page PDF
            const newPdf = await PDFDocument.create()
            const [copiedPage] = await newPdf.copyPages(srcDoc, [i])
            newPdf.addPage(copiedPage)
            const pdfBytes = await newPdf.save()

            // Generate Filename
            const filename = filenamePatternTpl.replace(/{flatNo}/g, flatNo)

            // Add to Zip if requested
            if (downloadZip) {
                zip.file(filename, pdfBytes)
            }

            if (!email || email === "NO EMAIL") {
                results.push({ i, flatNo, status: 'SKIPPED_NO_EMAIL' })
                continue
            }

            const pdfBase64 = Buffer.from(pdfBytes).toString('base64')

            // 5. Get Owner Name from CSV (Column D / Index 3)
            const flatOwnerName = row[3]?.trim() || "Resident"

            // 6. Compose Email
            const subject = emailSubjectTpl
                .replace(/{flatNo}/g, flatNo)
                .replace(/{flat_owner_name}/g, flatOwnerName)
                .replace(/{pdf name}/g, filename)
                .replace(/{pdf_name}/g, filename)

            const bodyText = emailBodyTpl
                .replace(/{flatNo}/g, flatNo)
                .replace(/{flat_owner_name}/g, flatOwnerName)
                .replace(/{pdf name}/g, filename)
                .replace(/{pdf_name}/g, filename)

            const messageParts = [
                `From: me`,
                `To: ${email}`,
                `Subject: ${subject}`,
                `MIME-Version: 1.0`,
                `Content-Type: multipart/mixed; boundary="boundary_example"`,
                ``,
                `--boundary_example`,
                `Content-Type: text/plain; charset="UTF-8"`,
                ``,
                bodyText,
                ``,
                `--boundary_example`,
                `Content-Type: application/pdf; name="${filename}"`,
                `Content-Disposition: attachment; filename="${filename}"`,
                `Content-Transfer-Encoding: base64`,
                ``,
                pdfBase64,
                ``,
                `--boundary_example--`
            ]

            const messageRaw = Buffer.from(messageParts.join('\r\n')).toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '')

            // 6. Send
            try {
                await gmail.users.messages.send({
                    userId: 'me',
                    requestBody: { raw: messageRaw }
                })
                results.push({ i, flatNo, email, status: 'SENT' })
            } catch (err: any) {
                console.error(`Failed to send to ${email}`, err)
                results.push({ i, flatNo, email, status: 'ERROR', error: err.message })
            }
        }

        let zipBase64 = null
        if (downloadZip) {
            zipBase64 = await zip.generateAsync({ type: 'base64' })
        }

        // 7. Log the Job to Firestore
        try {
            await adminDb.collection('workflow_jobs').add({
                user_id: userId,
                pdf_filename: pdfFile.name,
                csv_filename: csvFile.name,
                email_subject_template: emailSubjectTpl,
                total_processed: results.length,
                success_count: results.filter(r => r.status === 'SENT').length,
                error_count: results.filter(r => r.status === 'ERROR').length,
                created_at: new Date(),
            })
        } catch (dbError) {
            console.error('Failed to log workflow job:', dbError)
            // Continue even if logging fails
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results,
            zipBase64
        })

    } catch (error: any) {
        console.error('Processing error:', error)
        try {
            return NextResponse.json({ error: error.message }, { status: 500 })
        } catch (e) {
            return NextResponse.json({ error: "Unknown error" }, { status: 500 })
        }
    }
}
