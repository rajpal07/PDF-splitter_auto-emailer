# Bill Distribution & Automation System

A robust Next.js application designed to automate the splitting of PDF bills and emailing them to individual residents based on a CSV contact list. Securely integrated with Supabase and Google Gmail API.

## 🚀 Features

-   **Intelligent PDF Splitting**: Automatically splits a large master PDF into individual files for each flat/unit.
-   **Bulk Emailing**: Uses your own Gmail account (via OAuth) to send personalized emails with attachments.
-   **Customization**:
    -   Set custom **Email Subjects** (e.g., "Bill for {flatNo}").
    -   Set custom **Email Bodies**.
    -   Define **Filename Patterns** (e.g., "Bill-{flatNo}.pdf").
-   **Backup Generation**: Download a `.zip` archive containing all the generated individual PDFs for your records.
-   **Secure Authentication**: Google Sign-In powered by Supabase Auth ensures only authorized users can process bills.

## 🛠️ Technology Stack

-   **Frontend**: Next.js 15 (React 19), Tailwind CSS, Lucide React
-   **Backend**: Next.js API Routes, Nodemailer (Gmail API)
-   **PDF Processing**: `pdf-lib`
-   **Data Processing**: `csv-parse`
-   **Auth**: Supabase (Google OAuth)
-   **Utilities**: `jszip` for archives

## 🏁 Getting Started

### 1. Prerequisites

-   Node.js 18+ installed.
-   A **Supabase** project (free tier is fine).
-   A **Google Cloud Console** project with "Gmail API" enabled and OAuth credentials configured.

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
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
    -   Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4.  **Deploy**: Click "Deploy". The app will be live in minutes.

> **Note on Region**: The `vercel.json` is configured to use the Singapore (`sin1`) region by default. You can change this if needed.

## 📂 Project Structure

-   `app/page.tsx`: Main dashboard UI.
-   `app/api/process`: Backend logic for PDF/Email processing.
-   `app/auth`: Authentication callbacks (Supabase).
-   `utils/supabase`: Supabase client/server utilities.
-   `legacy_scripts`: Original Python scripts (preserved for reference).

## 💡 Usage Guide

1.  **Login**: Sign in with your Google Account.
2.  **Upload**:
    -   **PDF**: The master bill file containing all pages.
    -   **CSV**: A list of residents with columns for `Flat No` (Index 1) and `Email` (Index 6).
3.  **Customize**: Update the email subject/body template if needed.
4.  **Process**: Click "Start Processing".
5.  **Review**: See real-time logs of emails sent.
6.  **Download**: Optionally download the Zip backup.
