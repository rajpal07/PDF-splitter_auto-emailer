# Bill Distribution & Automation System

A robust Next.js application designed to automate the splitting of PDF bills and emailing them to individual residents based on a CSV contact list. Securely integrated with Firebase and Google Gmail API.

## 🚀 Features

-   **Intelligent PDF Splitting**: Automatically splits a large master PDF into individual files for each flat/unit.
-   **Bulk Emailing**: Uses your own Gmail account (via OAuth) to send personalized emails with attachments.
-   **Customization**:
    -   Set custom **Email Subjects** (e.g., "Bill for {flatNo}").
    -   Set custom **Email Bodies**.
    -   Define **Filename Patterns** (e.g., "Bill-{flatNo}.pdf").
-   **Backup Generation**: Download a `.zip` archive containing all the generated individual PDFs for your records.
-   **Secure Authentication**: Google Sign-In powered by Firebase Auth ensures only authorized users can process bills.

## 🛠️ Technology Stack

-   **Frontend**: Next.js 15 (React 19), Tailwind CSS, Lucide React
-   **Backend**: Next.js API Routes, Nodemailer (Gmail API)
-   **PDF Processing**: `pdf-lib` (Splitting & Manipulation)
-   **Data Processing**: `csv-parse` (Extracting Flat/Name/Email)
-   **Auth**: Firebase Authentication (Google OAuth)
-   **Database**: Cloud Firestore
-   **Utilities**: `jszip` for archives

## 🏁 Getting Started

### 1. Prerequisites

-   Node.js 18+ installed.
-   A **Firebase** project with Authentication and Firestore enabled.
-   A **Google Cloud Console** project with "Gmail API" enabled and OAuth credentials configured.

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```bash
# Firebase Client Configuration (Public - safe to expose)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Admin SDK Configuration (Private - keep secret!)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Installation

```bash
npm install
# or
yarn install
```

### 4. Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📦 Deployment (Vercel)

This project is optimized for deployment on Vercel.

1.  **Push to GitHub**: Push this code to a private GitHub repository.
2.  **Import to Vercel**: Create a new project in Vercel and import your repository.
3.  **Configure Environment Variables**:
    -   Go to **Settings > Environment Variables**.
    -   Add all the environment variables from `.env.local`.
4.  **Deploy**: Click "Deploy". The app will be live in minutes.

> **Note on Region**: The `vercel.json` is configured to use the Singapore (`sin1`) region by default. You can change this if needed.

## 📂 Project Structure

-   `app/page.tsx`: Main dashboard UI.
-   `app/api/process`: Backend logic for PDF/Email processing.
-   `app/api/auth/login-log`: Login logging endpoint.
-   `app/login`: Login page with Google OAuth.
-   `app/logs`: Activity logs page.
-   `utils/firebase`: Firebase client and server utilities.
-   `middleware.ts`: Route protection middleware.

## 💡 Usage Guide
1.  **Login**: Sign in with your Google Account.
2.  **Upload Files**:
    -   **PDF**: The master bill file containing all pages (1 page per flat).
    -   **CSV**: A contact list with the following required column structure:
        -   **Column B (Index 1)**: Flat Number (e.g., "101")
        -   **Column D (Index 3)**: Owner Name (e.g., "John Doe")
        -   **Column G (Index 6)**: Email Address (e.g., "john@example.com")
3.  **Customize Email**:
    -   Subject/Body supports placeholders:
        -   `{flatNo}`: Replaced with Flat Number.
        -   `{flat_owner_name}`: Replaced with the Owner Name from CSV.
        -   `{pdf name}`: Replaced with the filename (e.g., "Bill-101.pdf").
4.  **Process**: Click "Start Processing".
5.  **Review**: See real-time logs of emails sent.
6.  **Download**: Optionally download the Zip backup.

## 📱 WhatsApp Sending (Baileys)

Split PDFs can also be sent on WhatsApp via a small **local companion server** (Baileys — WhatsApp Web protocol, no browser needed). It cannot run on Vercel (serverless kills persistent WebSocket connections), so it runs on the PC where you use the site.

### How it works
1. Open the **WhatsApp bar** at the bottom of the main page and expand it.
2. If the server isn't running, click **Install WhatsApp** — it downloads `install-whatsapp.bat`. Double-click it: **no Node.js needed** — if the PC has none, the script downloads a portable Node runtime (~30 MB, into `%USERPROFILE%\sunder-whatsapp\node`, no admin), then installs and starts the server on `http://localhost:3900`. Re-running the file just starts the server. Windows 10 (1803+) / 11 — uses the built-in `curl` + `tar`.
   - If the PC already has Node, the repo can instead run `npm run whatsapp`.
3. Scan the QR shown in the panel (WhatsApp → Settings → Linked devices → Link a device).
4. Once connected, upload the **WhatsApp contacts CSV**: columns `Flat owner name, Email, WhatsApp number` (header row optional). Row *N* maps to PDF page *N* — same convention as the email flow.
5. Click **Send PDFs on WhatsApp**. Progress, sent count, and per-number failures (with errors) show in the panel.

### Dashboard
`http://localhost:3900` — connection status, QR, logout/reset session, and settings (message delays, default country code, caption template).

### Anti-ban rate limiting
Messages are sent with a **randomized 8–15 s pause** between each (configurable in the dashboard). Guidelines to avoid WhatsApp flagging the number:
- Keep volume modest: a few hundred messages/day max; much less for a fresh number (warm it up over ~1–2 weeks).
- Recipients who have your number saved / reply to you dramatically reduce ban risk.
- Don't lower the delay below ~5 s for bulk sends; the caption varies per recipient (`{name}`) which also helps.
- Numbers are verified via `onWhatsApp` before sending, so non-WhatsApp numbers are skipped, not blasted.

## 🔥 Firebase Configuration

### Firestore Collections

#### `login_logs`
```javascript
{
  id: string (auto-generated),
  user_id: string,
  email: string,
  login_at: timestamp,
  ip: string,
  user_agent: string
}
```

#### `workflow_jobs`
```javascript
{
  id: string (auto-generated),
  user_id: string,
  pdf_filename: string,
  csv_filename: string,
  email_subject_template: string,
  total_processed: number,
  success_count: number,
  error_count: number,
  created_at: timestamp
}
```

### Security Rules

The Firestore security rules are configured to ensure users can only access their own data:

```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    match /login_logs/{logId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }
    
    match /workflow_jobs/{jobId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }
  }
}
```

### Google OAuth Setup

1. Go to Firebase Console > Authentication > Sign-in method
2. Enable Google as a sign-in provider
3. Add your authorized domains
4. Configure OAuth consent screen in Google Cloud Console
5. Add the Gmail API scope: `https://www.googleapis.com/auth/gmail.send`
