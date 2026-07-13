// Sunder WhatsApp Server
// Local companion for the Bill Distribution web app. Runs Baileys (WhatsApp Web
// protocol, no browser needed) on this PC and exposes a small HTTP API + dashboard
// on http://localhost:3900. The website talks to it directly from the browser.
//
// Run: node server.js        Self-check: node server.js --selftest

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 3900
const AUTH_DIR = path.join(__dirname, 'auth_info')

// ---------------------------------------------------------------- pure helpers

function normalizePhone(raw, countryCode) {
    const digits = String(raw || '').replace(/\D/g, '').replace(/^0+/, '')
    if (!digits || digits.length < 8) return null
    // 10-digit local number -> prepend country code
    if (digits.length === 10) return countryCode + digits
    return digits
}

function detectHeader(rows) {
    // header row = phone column (index 2) contains no long digit run
    return rows.length > 0 && !/\d{6,}/.test(String(rows[0][2] || ''))
}

// ---------------------------------------------------------------- self test

if (process.argv.includes('--selftest')) {
    const assert = require('assert')
    assert.strictEqual(normalizePhone('98765 43210', '91'), '919876543210')
    assert.strictEqual(normalizePhone('+91 98765-43210', '91'), '919876543210')
    assert.strictEqual(normalizePhone('09876543210', '91'), '919876543210')
    assert.strictEqual(normalizePhone('', '91'), null)
    assert.strictEqual(normalizePhone('abc', '91'), null)
    assert.strictEqual(detectHeader([['Name', 'Email', 'Phone']]), true)
    assert.strictEqual(detectHeader([['John', 'j@x.com', '9876543210']]), false)
    console.log('selftest OK')
    process.exit(0)
}

// ---------------------------------------------------------------- deps (installed by npm install)

const { PDFDocument } = require('pdf-lib')
const { parse } = require('csv-parse/sync')
const QRCode = require('qrcode')
const pino = require('pino')
const baileys = require('baileys')

const makeWASocket = baileys.makeWASocket || baileys.default
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys
const logger = pino({ level: 'warn' })

// ---------------------------------------------------------------- state

const settings = {
    minDelaySec: 8,   // anti-ban: randomized pause between messages
    maxDelaySec: 15,
    countryCode: '91',
    caption: 'Dear {name}, please find your bill attached.',
}

let sock = null
let waState = 'disconnected' // disconnected | connecting | qr | connected
let qrDataUrl = null
let me = null
let job = null // { total, sent, done, results: [{ name, phone, status, error? }] }

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ---------------------------------------------------------------- whatsapp connection

async function startWhatsApp() {
    if (sock) return
    waState = 'connecting'
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    let version
    try { ({ version } = await fetchLatestBaileysVersion()) } catch { /* offline: library default */ }

    sock = makeWASocket({ auth: state, version, logger, markOnlineOnConnect: false })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            waState = 'qr'
            qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 300 })
        }
        if (connection === 'open') {
            waState = 'connected'
            qrDataUrl = null
            me = String(sock.user?.id || '').split(':')[0].split('@')[0]
            console.log('WhatsApp connected as +' + me)
        }
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode
            sock = null
            qrDataUrl = null
            if (code === DisconnectReason.loggedOut) {
                waState = 'disconnected'
                me = null
                fs.rmSync(AUTH_DIR, { recursive: true, force: true })
                console.log('Logged out - session cleared. POST /connect for a new QR.')
            } else {
                waState = 'connecting'
                console.log(`Connection closed (code ${code}), reconnecting in 3s...`)
                setTimeout(() => startWhatsApp().catch(err => {
                    waState = 'disconnected'
                    console.error('Reconnect failed:', err.message)
                }), 3000)
            }
        }
    })
}

// ---------------------------------------------------------------- send job

function parseContacts(csvText) {
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true })
    const body = detectHeader(rows) ? rows.slice(1) : rows
    return body.map(r => ({
        name: String(r[0] || '').trim() || 'Resident',
        email: String(r[1] || '').trim(),
        phone: String(r[2] || '').trim(),
    }))
}

async function runJob(pdfBase64, contacts) {
    const srcDoc = await PDFDocument.load(Buffer.from(pdfBase64, 'base64'))
    const pageCount = srcDoc.getPageCount()
    job = {
        total: contacts.length,
        sent: 0,
        done: false,
        startedAt: Date.now(),
        results: contacts.map(c => ({ name: c.name, phone: c.phone, status: 'PENDING' })),
    }

    for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i]
        const r = job.results[i]
        try {
            if (!sock || waState !== 'connected') throw new Error('WhatsApp disconnected')
            if (i >= pageCount) throw new Error(`No matching PDF page (row ${i + 1}, PDF has ${pageCount} pages)`)
            const digits = normalizePhone(c.phone, settings.countryCode)
            if (!digits) throw new Error(`Invalid phone number "${c.phone}"`)

            const [check] = await sock.onWhatsApp(digits + '@s.whatsapp.net')
            if (!check || !check.exists) throw new Error('Number not registered on WhatsApp')

            // CSV row i maps to PDF page i (same convention as the email flow)
            const single = await PDFDocument.create()
            const [page] = await single.copyPages(srcDoc, [i])
            single.addPage(page)
            const bytes = await single.save()

            await sock.sendMessage(check.jid, {
                document: Buffer.from(bytes),
                mimetype: 'application/pdf',
                fileName: `Bill-${c.name}.pdf`,
                caption: settings.caption.replace(/{name}/g, c.name),
            })
            r.status = 'SENT'
            job.sent++
            console.log(`SENT ${i + 1}/${contacts.length} -> ${c.name} (${digits})`)
        } catch (err) {
            r.status = 'FAILED'
            r.error = err.message
            console.log(`FAILED ${i + 1}/${contacts.length} -> ${c.phone}: ${err.message}`)
        }
        if (i < contacts.length - 1) {
            // anti-ban pause: human-like randomized gap so WhatsApp doesn't flag bulk sends
            const ms = (settings.minDelaySec + Math.random() * Math.max(0, settings.maxDelaySec - settings.minDelaySec)) * 1000
            await sleep(ms)
        }
    }
    job.done = true
    console.log(`Job done: ${job.sent}/${job.total} sent`)
}

// ---------------------------------------------------------------- http server

function readBody(req, limit = 120 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const chunks = []
        let size = 0
        req.on('data', (c) => {
            size += c.length
            if (size > limit) { reject(new Error('Body too large')); req.destroy() }
            else chunks.push(c)
        })
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        req.on('error', reject)
    })
}

function json(res, code, obj) {
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(obj))
}

const server = http.createServer(async (req, res) => {
    // CORS: page may be served from Vercel (https) while we live on localhost
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

    const url = req.url.split('?')[0]
    try {
        if (req.method === 'GET' && url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            return res.end(DASHBOARD_HTML)
        }
        if (req.method === 'GET' && url === '/status') {
            return json(res, 200, {
                state: waState,
                connected: waState === 'connected',
                qr: qrDataUrl,
                me,
                settings,
                job,
            })
        }
        if (req.method === 'POST' && url === '/connect') {
            startWhatsApp().catch(err => { waState = 'disconnected'; console.error(err) })
            return json(res, 200, { ok: true })
        }
        if (req.method === 'POST' && url === '/logout') {
            try { if (sock) await sock.logout() } catch { /* already dead */ }
            sock = null
            waState = 'disconnected'
            me = null
            qrDataUrl = null
            fs.rmSync(AUTH_DIR, { recursive: true, force: true })
            return json(res, 200, { ok: true })
        }
        if (req.method === 'POST' && url === '/settings') {
            const body = JSON.parse(await readBody(req))
            if (body.minDelaySec != null) settings.minDelaySec = Math.min(600, Math.max(2, Number(body.minDelaySec) || 8))
            if (body.maxDelaySec != null) settings.maxDelaySec = Math.min(600, Math.max(settings.minDelaySec, Number(body.maxDelaySec) || 15))
            if (body.countryCode) settings.countryCode = String(body.countryCode).replace(/\D/g, '')
            if (body.caption) settings.caption = String(body.caption)
            return json(res, 200, { ok: true, settings })
        }
        if (req.method === 'POST' && url === '/send') {
            if (waState !== 'connected') return json(res, 409, { error: 'WhatsApp not connected' })
            if (job && !job.done) return json(res, 409, { error: 'A send job is already running' })
            const body = JSON.parse(await readBody(req))
            if (!body.pdfBase64 || !body.csvText) return json(res, 400, { error: 'pdfBase64 and csvText required' })
            const contacts = parseContacts(body.csvText)
            if (!contacts.length) return json(res, 400, { error: 'No contacts found in CSV' })
            runJob(body.pdfBase64, contacts).catch(err => {
                if (job) { job.done = true; job.error = err.message }
                console.error('Job crashed:', err)
            })
            return json(res, 200, { started: true, total: contacts.length })
        }
        json(res, 404, { error: 'Not found' })
    } catch (err) {
        json(res, 500, { error: err.message })
    }
})

// ---------------------------------------------------------------- dashboard

const DASHBOARD_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WhatsApp Server - Dashboard</title>
<style>
body{font-family:system-ui,sans-serif;background:#0a0f0d;color:#d1d5db;max-width:640px;margin:0 auto;padding:24px}
h1{color:#22c55e;font-size:22px} h2{font-size:15px;color:#9ca3af;margin-top:28px;text-transform:uppercase;letter-spacing:.05em}
.card{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:16px;margin-top:8px}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px}
input,textarea{width:100%;box-sizing:border-box;background:#030712;color:#e5e7eb;border:1px solid #374151;border-radius:8px;padding:8px;margin:4px 0 12px}
label{font-size:13px;color:#9ca3af}
button{background:#16a34a;color:#fff;border:0;border-radius:8px;padding:9px 18px;font-weight:600;cursor:pointer}
button.red{background:#dc2626}
table{width:100%;border-collapse:collapse;font-size:13px} td,th{text-align:left;padding:5px 8px;border-bottom:1px solid #1f2937}
.SENT{color:#22c55e}.FAILED{color:#ef4444}.PENDING{color:#9ca3af}
#qr img{background:#fff;padding:8px;border-radius:8px}
</style></head><body>
<h1>WhatsApp Server</h1>
<div class="card"><span class="dot" id="dot" style="background:#6b7280"></span><span id="state">loading...</span>
<div id="qr" style="margin-top:12px"></div>
<div style="margin-top:12px"><button id="connect">Connect</button> <button class="red" id="logout">Logout / reset session</button></div>
</div>
<h2>Settings</h2>
<div class="card">
<label>Min delay between messages (seconds)</label><input id="minDelaySec" type="number">
<label>Max delay between messages (seconds)</label><input id="maxDelaySec" type="number">
<label>Default country code (for 10-digit numbers)</label><input id="countryCode">
<label>Message caption ({name} = flat owner name)</label><textarea id="caption" rows="2"></textarea>
<button id="save">Save settings</button> <span id="saved"></span>
</div>
<h2>Current send job</h2>
<div class="card" id="job">No job yet.</div>
<script>
let settingsLoaded = false
async function poll(){
  try{
    const s = await (await fetch('/status')).json()
    const dot = document.getElementById('dot'), state = document.getElementById('state'), qr = document.getElementById('qr')
    const colors = {connected:'#22c55e', qr:'#f59e0b', connecting:'#f59e0b', disconnected:'#6b7280'}
    dot.style.background = colors[s.state] || '#6b7280'
    state.textContent = s.state === 'connected' ? 'Connected as +' + s.me : s.state === 'qr' ? 'Scan the QR with WhatsApp (Linked devices)' : s.state
    qr.innerHTML = s.qr ? '<img src="' + s.qr + '">' : ''
    if(!settingsLoaded){
      for(const k of ['minDelaySec','maxDelaySec','countryCode','caption']) document.getElementById(k).value = s.settings[k]
      settingsLoaded = true
    }
    const j = s.job
    document.getElementById('job').innerHTML = !j ? 'No job yet.' :
      '<b>' + (j.done ? 'Done' : 'Sending...') + '</b> ' + j.sent + '/' + j.total + ' sent' +
      '<table><tr><th>Name</th><th>Phone</th><th>Status</th><th>Error</th></tr>' +
      j.results.map(r => '<tr><td>' + r.name + '</td><td>' + r.phone + '</td><td class="' + r.status + '">' + r.status + '</td><td>' + (r.error || '') + '</td></tr>').join('') + '</table>'
  }catch(e){ document.getElementById('state').textContent = 'server unreachable' }
}
document.getElementById('save').onclick = async () => {
  const body = {}
  for(const k of ['minDelaySec','maxDelaySec','countryCode','caption']) body[k] = document.getElementById(k).value
  await fetch('/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  document.getElementById('saved').textContent = 'saved'
  setTimeout(()=>document.getElementById('saved').textContent='',1500)
}
document.getElementById('logout').onclick = () => fetch('/logout',{method:'POST'})
document.getElementById('connect').onclick = () => fetch('/connect',{method:'POST'})
poll(); setInterval(poll, 2000)
</script></body></html>`

// ---------------------------------------------------------------- boot

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} already in use - is the WhatsApp server already running?`)
        process.exit(1)
    }
    throw err
})

server.listen(PORT, () => {
    console.log(`WhatsApp server running -> dashboard: http://localhost:${PORT}`)
    startWhatsApp().catch(err => { waState = 'disconnected'; console.error('Startup failed:', err.message) })
})
