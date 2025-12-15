'use client'

import { createClient } from '@/utils/supabase/client'
import { LogOut, UploadCloud, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

export default function Home() {
  const [userEmail, setUserEmail] = useState<string>('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE')
  const [logs, setLogs] = useState<string[]>([])
  const router = useRouter()

  const [emailSubject, setEmailSubject] = useState<string>('Flat No-{flatNo} - Lift Repair Bill - Dec Yr 2025-26')
  const [emailBody, setEmailBody] = useState<string>('Dear {flat_owner_name},\nBelow is your scoiety\'s {pdf name}')
  const [filenamePattern, setFilenamePattern] = useState<string>('Flat no{flatNo} - Lift Repair Bill Dec\'25.pdf')
  const [downloadZip, setDownloadZip] = useState<boolean>(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email)
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  const pdfInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const handleProcess = async () => {
    if (!pdfFile || !csvFile) return
    setStatus('PROCESSING')
    setLogs(['Starting process...', 'Uploading files...'])

    const formData = new FormData()
    formData.append('pdf', pdfFile)
    formData.append('csv', csvFile)
    formData.append('emailSubject', emailSubject)
    formData.append('emailBody', emailBody)
    formData.append('filenamePattern', filenamePattern)
    formData.append('downloadZip', String(downloadZip))

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData
      })

      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        throw new Error(`Server Response (not JSON): ${text.substring(0, 200)}`)
      }

      if (!res.ok) throw new Error(data.error || 'Unknown error')

      // Handle Zip Download
      if (data.zipBase64) {
        setLogs(prev => [...prev, '📦 Downloading Zip archive...'])
        const link = document.createElement('a');
        link.href = `data:application/zip;base64,${data.zipBase64}`;
        link.download = 'split_bills.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setLogs(prev => [...prev, `Processed ${data.processed} emails`])
      data.details.forEach((d: any) => {
        if (d.status === 'SENT') {
          setLogs(prev => [...prev, `✅ Sent to ${d.email} (Flat: ${d.flatNo})`])
        } else if (d.status === 'SKIPPED_NO_EMAIL') {
          setLogs(prev => [...prev, `⚠️ Skipped Flat ${d.flatNo} (No Email)`])
        } else {
          setLogs(prev => [...prev, `❌ Failed: ${d.email} - ${d.error}`])
        }
      })
      setStatus('SUCCESS')
    } catch (err: any) {
      setLogs(prev => [...prev, `CRITICAL ERROR: ${err.message}`])
      setStatus('ERROR')
    }
  }

  // ... (keep handleSignOut)

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-100 font-sans selection:bg-blue-500/30">
      <header className="border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3 group cursor-default">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              W
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-100"><span className="text-blue-400">Sunder's</span>Workflow</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Signed in as</span>
              <span className="text-sm text-gray-300 font-semibold">{userEmail}</span>
            </div>
            <a
              href="/logs"
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all font-medium text-sm border border-gray-700 hover:border-gray-600"
            >
              Logs
            </a>
            <button onClick={handleSignOut} className="rounded-full p-2.5 hover:bg-gray-800 text-gray-400 hover:text-white transition-all hover:rotate-90 active:scale-95">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-10 flex flex-col items-center">
        <div className="w-full max-w-5xl space-y-10">
          {/* Header ... */}
          <div className="text-center space-y-4 pt-8">
            <h1 className="text-5xl md:text-6xl font-extrabold bg-gradient-to-br from-white via-gray-200 to-gray-500 bg-clip-text text-transparent tracking-tight">
              Bill Distribution
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Securely split PDF bills and email them to residents directly from your Gmail account.
            </p>
          </div>

          {/* Input Grid (File Uploads) */}
          <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
            {/* PDF Upload */}
            <div
              onClick={() => pdfInputRef.current?.click()}
              className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group h-64 flex flex-col items-center justify-center gap-4
                        ${pdfFile
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-gray-700 bg-gray-900/40 hover:border-blue-500/50 hover:bg-gray-800/60'
                }
                    `}
            >
              <input type="file" ref={pdfInputRef} accept=".pdf" className="hidden" onChange={e => setPdfFile(e.target.files?.[0] || null)} />

              <div className={`p-4 rounded-full transition-all duration-300 ${pdfFile ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-800 text-gray-400 group-hover:scale-110 group-hover:text-blue-400'}`}>
                {pdfFile ? <CheckCircle className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
              </div>

              <div className="text-center px-6">
                <h3 className={`font-bold text-lg mb-1 ${pdfFile ? 'text-blue-200' : 'text-gray-200'}`}>
                  {pdfFile ? pdfFile.name : 'Combined PDF Bill'}
                </h3>
                <p className="text-sm text-gray-500 font-medium">
                  {pdfFile ? 'Ready to process' : 'Drag & drop or click to upload'}
                </p>
              </div>
            </div>

            {/* CSV Upload */}
            <div
              onClick={() => csvInputRef.current?.click()}
              className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group h-64 flex flex-col items-center justify-center gap-4
                        ${csvFile
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-gray-700 bg-gray-900/40 hover:border-green-500/50 hover:bg-gray-800/60'
                }
                    `}
            >
              <input type="file" ref={csvInputRef} accept=".csv" className="hidden" onChange={e => setCsvFile(e.target.files?.[0] || null)} />

              <div className={`p-4 rounded-full transition-all duration-300 ${csvFile ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-gray-800 text-gray-400 group-hover:scale-110 group-hover:text-green-400'}`}>
                {csvFile ? <CheckCircle className="h-8 w-8" /> : <UploadCloud className="h-8 w-8" />}
              </div>

              <div className="text-center px-6">
                <h3 className={`font-bold text-lg mb-1 ${csvFile ? 'text-green-200' : 'text-gray-200'}`}>
                  {csvFile ? csvFile.name : 'Contacts CSV'}
                </h3>
                <p className="text-sm text-gray-500 font-medium">
                  {csvFile ? 'Ready to process' : 'Drag & drop or click to upload'}
                </p>
              </div>
            </div>
          </div>

          {/* Customization Options */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
              <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
              Customization Settings
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Email Subject Pattern</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. Bill for {flatNo}"
                />
                <p className="text-xs text-gray-600">Use <code className="text-blue-400">{'{flatNo}'}</code> as a placeholder.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">PDF Filename Pattern</label>
                <input
                  type="text"
                  value={filenamePattern}
                  onChange={(e) => setFilenamePattern(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. Bill-{flatNo}.pdf"
                />
                <p className="text-xs text-gray-600">Must end in .pdf. Use <code className="text-blue-400">{'{flatNo}'}</code> for flat number.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-400">Email Body</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all resize-y"
                />
                <p className="text-xs text-gray-600">Available placeholders: <code className="text-blue-400">{'{flatNo}'}</code>, <code className="text-blue-400">{'{flat_owner_name}'}</code>, <code className="text-blue-400">{'{pdf name}'}</code>.</p>
              </div>

              <div className="md:col-span-2 flex items-center gap-3 p-4 bg-gray-950 rounded-xl border border-gray-800/50">
                <input
                  type="checkbox"
                  id="zipDownload"
                  checked={downloadZip}
                  onChange={(e) => setDownloadZip(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500/50 focus:ring-offset-0"
                />
                <label htmlFor="zipDownload" className="flex flex-col cursor-pointer select-none">
                  <span className="font-semibold text-gray-300">Download Backup Zip</span>
                  <span className="text-sm text-gray-500">Download all split PDF files to your computer after processing.</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col items-center pb-20">
            <button
              onClick={handleProcess}
              disabled={!pdfFile || !csvFile || status === 'PROCESSING'}
              className={`
                        relative group flex items-center gap-3 rounded-xl px-10 py-4 font-bold text-lg shadow-2xl transition-all duration-300
                        ${!pdfFile || !csvFile
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : status === 'PROCESSING'
                    ? 'bg-blue-600/50 text-blue-100 cursor-wait'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-105 hover:shadow-blue-500/30 active:scale-95'
                }
                    `}
            >
              {status === 'PROCESSING' ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Start Processing</>
              )}
            </button>

            {/* Logs Area */}
            {(status !== 'IDLE' || logs.length > 0) && (
              <div className="mt-12 w-full max-w-3xl rounded-xl border border-gray-800 bg-gray-900/80 p-6 backdrop-blur font-mono text-sm shadow-2xl">
                <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
                  <h3 className="font-semibold text-gray-300">Processing Logs</h3>
                  {status === 'SUCCESS' && <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold">COMPLETED</span>}
                  {status === 'ERROR' && <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold">FAILED</span>}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {logs.map((log, i) => (
                    <div key={i} className="text-gray-400 border-l-2 border-gray-800 pl-3 py-1">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
