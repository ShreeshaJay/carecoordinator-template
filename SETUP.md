# CareCoordinator Setup Guide

## Quick Overview
- **Frontend:** Next.js (hosted free on Vercel)
- **Backend/DB/Auth:** Supabase (free tier)
- **AI:** Claude API (your existing subscription)
- **Estimated cost:** $0/month for hosting, ~$1-5/month for Claude API usage

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up / sign in
2. Click **"New Project"**
3. Name it `carecoordinator`, choose a strong database password, select nearest region
4. Wait ~2 minutes for the project to spin up

### Run the database migration

5. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
6. Click **"New Query"**
7. Copy the entire contents of `supabase/migrations/001_initial_schema.sql` and paste it
8. Click **"Run"** — you should see "Success" messages

### Get your API keys

9. Go to **Settings → API** (left sidebar)
10. Copy these values:
    - **Project URL** (looks like `https://xxxxx.supabase.co`)
    - **anon/public key** (long string starting with `eyJ...`)
    - **service_role key** (another long string — keep this secret!)

### Create user accounts

11. Go to **Authentication → Users** (left sidebar)
12. Click **"Add User" → "Create New User"**
13. Enter email + password for each family member
14. They'll use these credentials to log in

---

## Step 2: Get Claude API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Go to **API Keys**
3. Create a new key, copy it (starts with `sk-ant-...`)

---

## Step 3: Configure Environment Variables

Edit the file `.env.local` in the project root with your real values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional: Google Drive folder ID
NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here
```

To get the Google Drive folder ID: open the shared folder in Google Drive, the URL looks like
`https://drive.google.com/drive/folders/ABC123DEF456` — the ID is `ABC123DEF456`.

---

## Step 4: Test Locally

```bash
cd carecoordinator
npm install
npm run dev
```

Open http://localhost:3000 — you should see the login page.
Log in with one of the accounts you created in Supabase.

---

## Step 5: Deploy to Vercel

### Option A: GitHub (Recommended)

1. Push this repo to a private GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click **"Import Project"** → select `carecoordinator`
4. In the **Environment Variables** section, add all 4 variables from `.env.local`
5. Click **Deploy**
6. Your site will be live at `https://carecoordinator-xxxxx.vercel.app`

### Option B: CLI

```bash
npm install -g vercel
cd carecoordinator
vercel
```

Follow the prompts. Then add environment variables:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ANTHROPIC_API_KEY
```

Redeploy: `vercel --prod`

---

## Step 6: Share with Family

Send the Vercel URL + their login credentials to each family member.

---

## Daily Usage

1. **Adding information:** Go to "Add Info" tab → speak or type → hit Submit
2. **Checking status:** The home page ("Summary") always shows the latest consolidated view
3. **Timeline:** Auto-updates when new information is submitted
4. **Action items:** Check/uncheck items, add new ones from the Summary page
5. **Reports:** Upload PDFs/docs, or click the Google Drive link to access shared files

---

## Troubleshooting

- **"Unauthorized" errors:** Make sure you're logged in. Try signing out and back in.
- **Summary not updating:** Check that your `ANTHROPIC_API_KEY` is valid. Look at Vercel function logs.
- **Can't upload files:** In Supabase dashboard, go to Storage and verify the `uploads` bucket exists.
- **Build errors on Vercel:** Make sure all 4 environment variables are set in the Vercel dashboard.
