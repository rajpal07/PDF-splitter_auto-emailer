'use client'

import { CheckCircle, ChevronDown, ChevronUp, Download, ExternalLink, Loader2, MessageCircle, Send, UploadCloud } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const WA_URL = 'http://localhost:3900'

interface WaJobResult {
    name: string
    phone: string
    status: 'PENDING' | 'SENT' | 'FAILED'
    error?: string
}

interface WaJob {
    total: number
    sent: number
    done: boolean
    results: WaJobResult[]
}

interface WaStatus {
    state: 'disconnected' | 'connecting' | 'qr' | 'connected'
    connected: boolean
    qr: string | null
    me: string | null
    job: WaJob | null
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

export default function WhatsAppPanel({ pdfFile }: { pdfFile: File | null }) {
    const [expanded, setExpanded] = useState(false)
    const [serverUp, setServerUp] = useState(false)
    const [wa, setWa] = useState<WaStatus | null>(null)
    const [waCsv, setWaCsv] = useState<File | null>(null)
    const [sendError, setSendError] = useState('')
    const [starting, setStarting] = useState(false)
    const csvRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!expanded) return
        let alive = true
        const tick = async () => {
            try {
                const res = await fetch(`${WA_URL}/status`, { signal: AbortSignal.timeout(2500) })
                const data = await res.json()
                if (alive) {
                    setServerUp(true)
                    setWa(data)
                }
            } catch {
                if (alive) {
                    setServerUp(false)
                    setWa(null)
                }
            }
        }
        tick()
        const id = setInterval(tick, 3000)
        return () => { alive = false; clearInterval(id) }
    }, [expanded])

    const downloadInstaller = () => {
        const origin = window.location.origin
        // Portable-Node bootstrap: no pre-installed Node needed. Windows 10 (1803+)
        // ships curl + tar, so the script fetches a portable Node runtime into the
        // user folder when none is found — double-click and everything installs.
        const NODE_PKG = 'node-v22.11.0-win-x64'
        const bat = [
            '@echo off',
            'setlocal',
            'title Sunder WhatsApp Server',
            'set "DIR=%USERPROFILE%\\sunder-whatsapp"',
            'if not exist "%DIR%" mkdir "%DIR%"',
            'cd /d "%DIR%"',
            '',
            'REM --- download the latest server files (temp name so a failed fetch keeps the old copy) ---',
            `curl -fsSL "${origin}/whatsapp-server/server.js" -o server.js.new && move /y server.js.new server.js >nul`,
            `curl -fsSL "${origin}/whatsapp-server/package.json" -o package.json.new && move /y package.json.new package.json >nul`,
            'if not exist server.js (echo Could not download server files - internet needed on first run. & pause & exit /b 1)',
            '',
            'REM --- make sure Node is available (system Node, or portable Node we install here) ---',
            'call :ensure_node || (pause & exit /b 1)',
            '',
            'if not exist node_modules (',
            '  echo Installing dependencies - the first run takes a minute...',
            '  call npm install --no-audit --no-fund || (echo npm install failed. & pause & exit /b 1)',
            ')',
            'echo.',
            'echo WhatsApp server starting on http://localhost:3900 - keep this window open.',
            'node server.js',
            'pause',
            'exit /b 0',
            '',
            ':ensure_node',
            'where node >nul 2>nul && exit /b 0',
            'if exist "%DIR%\\node\\node.exe" (set "PATH=%DIR%\\node;%PATH%" & exit /b 0)',
            'echo Node.js not found - downloading portable Node.js ^(one time, ~30 MB^)...',
            `curl -fsSL "https://nodejs.org/dist/v22.11.0/${NODE_PKG}.zip" -o node.zip || (echo Node download failed - check internet. & exit /b 1)`,
            'echo Extracting Node.js...',
            'tar -xf node.zip || (echo Extract failed - needs Windows 10 1803+ ^(has tar^). & exit /b 1)',
            'if exist node rmdir /s /q node',
            `ren "${NODE_PKG}" node`,
            'del node.zip >nul 2>nul',
            'set "PATH=%DIR%\\node;%PATH%"',
            'exit /b 0',
        ].join('\r\n')
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([bat], { type: 'application/octet-stream' }))
        a.download = 'install-whatsapp.bat'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(a.href)
    }

    const handleSend = async () => {
        if (!pdfFile || !waCsv) return
        setSendError('')
        setStarting(true)
        try {
            const pdfBase64 = await fileToBase64(pdfFile)
            const csvText = await waCsv.text()
            const res = await fetch(`${WA_URL}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdfBase64, csvText }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to start send job')
        } catch (err: any) {
            setSendError(err.message)
        }
        setStarting(false)
    }

    const statusLabel = !serverUp
        ? { text: 'Not running', color: 'bg-gray-500' }
        : wa?.state === 'connected'
            ? { text: `Connected (+${wa.me})`, color: 'bg-green-500' }
            : wa?.state === 'qr'
                ? { text: 'Scan QR code', color: 'bg-amber-500' }
                : { text: 'Connecting…', color: 'bg-amber-500' }

    const job = wa?.job || null
    const failed = job?.results.filter(r => r.status === 'FAILED') || []

    return (
        <div className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-800 bg-gray-900/95 backdrop-blur-xl">
            {/* Collapsed bar */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-green-600 flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-gray-200">WhatsApp</span>
                    <span className="flex items-center gap-2 text-sm text-gray-400">
                        <span className={`h-2 w-2 rounded-full ${statusLabel.color}`} />
                        {expanded ? statusLabel.text : ''}
                    </span>
                    {job && !job.done && (
                        <span className="text-xs text-green-400 font-mono">sending {job.sent}/{job.total}…</span>
                    )}
                </div>
                {expanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronUp className="h-5 w-5 text-gray-400" />}
            </button>

            {expanded && (
                <div className="max-h-[70vh] overflow-y-auto border-t border-gray-800/50">
                    <div className="container mx-auto max-w-3xl px-6 py-6 space-y-5">

                        {/* Server not running -> installer */}
                        {!serverUp && (
                            <div className="space-y-4 text-center py-4">
                                <p className="text-gray-300 font-semibold">WhatsApp server is not running on this PC.</p>
                                <p className="text-sm text-gray-500 max-w-lg mx-auto">
                                    Click below to download the installer. Double-click <code className="text-green-400">install-whatsapp.bat</code> — it
                                    installs everything on its own (a portable Node.js runtime if the PC doesn't have one, then the WhatsApp server),
                                    starts it, and keeps it running while the window stays open. Nothing to install manually. Works on Windows 10/11.
                                </p>
                                <button
                                    onClick={downloadInstaller}
                                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-500 px-6 py-3 font-bold text-white transition-colors"
                                >
                                    <Download className="h-5 w-5" /> Install WhatsApp
                                </button>
                                <p className="text-xs text-gray-600">
                                    Already installed? Double-click the same file again — it skips the install and just starts the server.
                                    Dashboard will be at <code className="text-green-400">http://localhost:3900</code>. This panel detects it automatically.
                                </p>
                            </div>
                        )}

                        {/* QR pending */}
                        {serverUp && wa?.state === 'qr' && wa.qr && (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <img src={wa.qr} alt="WhatsApp QR" className="rounded-xl bg-white p-2 w-64 h-64" />
                                <p className="text-sm text-gray-400">
                                    Open WhatsApp on your phone → <b>Settings → Linked devices → Link a device</b> and scan.
                                </p>
                            </div>
                        )}

                        {serverUp && (wa?.state === 'connecting' || wa?.state === 'disconnected') && (
                            <div className="flex items-center justify-center gap-3 py-6 text-gray-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Waiting for WhatsApp connection…
                            </div>
                        )}

                        {/* Connected -> send flow */}
                        {serverUp && wa?.state === 'connected' && (
                            <>
                                <div className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
                                    <div className="flex items-center gap-2 text-green-400 font-semibold">
                                        <CheckCircle className="h-5 w-5" /> WhatsApp connected as +{wa.me}
                                    </div>
                                    <a
                                        href={WA_URL}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white underline"
                                    >
                                        Open dashboard <ExternalLink className="h-4 w-4" />
                                    </a>
                                </div>

                                {/* CSV upload (testing only — later reuse the main contacts CSV) */}
                                <div
                                    onClick={() => csvRef.current?.click()}
                                    className={`rounded-xl border-2 border-dashed p-5 cursor-pointer transition-colors flex items-center gap-4
                                        ${waCsv ? 'border-green-500/50 bg-green-500/10' : 'border-gray-700 hover:border-green-500/50 bg-gray-950/40'}`}
                                >
                                    <input type="file" ref={csvRef} accept=".csv" className="hidden" onChange={e => setWaCsv(e.target.files?.[0] || null)} />
                                    <UploadCloud className={`h-7 w-7 ${waCsv ? 'text-green-400' : 'text-gray-500'}`} />
                                    <div>
                                        <p className="font-semibold text-gray-200">{waCsv ? waCsv.name : 'Upload WhatsApp contacts CSV'}</p>
                                        <p className="text-xs text-gray-500">Columns: Flat owner name, Email, WhatsApp number (header row optional). Row 1 → PDF page 1, row 2 → page 2, …</p>
                                    </div>
                                </div>

                                {!pdfFile && (
                                    <p className="text-sm text-amber-400">Upload the combined PDF bill above first — its pages get sent here too.</p>
                                )}

                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleSend}
                                        disabled={!pdfFile || !waCsv || starting || (!!job && !job.done)}
                                        className={`flex items-center gap-2 rounded-lg px-6 py-3 font-bold transition-colors
                                            ${!pdfFile || !waCsv || starting || (!!job && !job.done)
                                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                                : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                    >
                                        {(starting || (job && !job.done)) ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                        {job && !job.done ? 'Sending…' : 'Send PDFs on WhatsApp'}
                                    </button>
                                    <p className="text-xs text-gray-600 max-w-xs">
                                        Anti-spam: 8–15s random pause between messages so WhatsApp doesn't flag the number. Change in the dashboard.
                                    </p>
                                </div>

                                {sendError && <p className="text-sm text-red-400">❌ {sendError}</p>}

                                {/* Job progress */}
                                {job && (
                                    <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-3 font-mono text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-300 font-sans font-semibold">
                                                {job.done ? 'Finished' : 'Sending…'} — <span className="text-green-400">{job.sent} sent</span>
                                                {failed.length > 0 && <> · <span className="text-red-400">{failed.length} failed</span></>}
                                                {' '}of {job.total}
                                            </span>
                                            <div className="h-2 w-32 rounded-full bg-gray-800 overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 transition-all"
                                                    style={{ width: `${((job.sent + failed.length) / job.total) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        {failed.length > 0 && (
                                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                                {failed.map((f, i) => (
                                                    <div key={i} className="text-red-400 text-xs">
                                                        ❌ {f.phone} ({f.name}) — {f.error}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
