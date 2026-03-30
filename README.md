# CareCoordinator

A private, AI-powered medical care coordination hub for families managing a loved one's diagnosis and treatment. Built to consolidate fragmented information from WhatsApp messages, phone calls, doctor visits, and medical reports into a single organized view.

## Why This Exists

When a family member is diagnosed with a serious medical condition, information gets scattered across WhatsApp groups, phone calls, emails, faxes, and in-person doctor visits. This app brings everything into one place, with an AI assistant that automatically organizes the information, tracks action items, and helps the family stay on top of what needs to happen next.

## Features

- **AI-Powered Summary** — Automatically maintained overview organized by condition with medical status, administrative status, and flagged concerns
- **Smart Document Processing** — Upload PDFs and Word docs; AI extracts text and updates all relevant sections
- **Referrals Tracker** — Track specialist referrals with status, star preferred doctors, add notes
- **Timeline** — Chronological view of past events and upcoming appointments
- **Chat with Claude** — Ask questions about the diagnosis; AI searches the web and clearly separates your records from general medical knowledge
- **Research Tab** — Deep-dive literature reviews on specific conditions
- **Voice Input** — Dictate notes using browser microphone or Wispr
- **WhatsApp Parsing** — Paste group chat conversations; AI extracts only the medically relevant information
- **Image OCR** — Upload screenshots of messages; AI extracts the text
- **Patient Profile** — Auto-populated from uploaded documents
- **Activity Log** — Full audit trail of who added what and when
- **Export** — Download complete backup as JSON
- **Mobile Responsive** — Works on phones and tablets

## Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | Next.js 14 | Free (Vercel) |
| Backend/DB/Auth | Supabase | Free tier |
| Hosting | Vercel | Free tier |
| AI | Claude API (Opus) | ~$1-5/month |

## Quick Start (15 minutes)

### 1. Clone and configure

```bash
git clone https://github.com/ShreeshaJay/carecoordinator-template.git
cd carecoordinator-template
npm install
```

### 2. Edit `care-config.json` for your situation

```json
{
  "app_name": "CareCoordinator",
  "patient_label": "Mom",
  "conditions": [
    {
      "name": "Kidney Tumor",
      "category": "Urology",
      "color": "blue",
      "emoji": "🫘"
    },
    {
      "name": "Uterine Tumor",
      "category": "Gynecology",
      "color": "pink",
      "emoji": "🏥"
    }
  ],
  "extra_categories": ["Admin", "Logistics"],
  "google_drive_folder_id": ""
}
```

Change the conditions to match your situation. Available colors: `blue`, `pink`, `green`, `purple`, `orange`, `red`, `teal`, `gray`.

### 3. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**, name it, choose a region
3. Go to **SQL Editor**, paste the contents of `supabase/migrations/001_initial_schema.sql`, and click **Run**
4. Run each additional migration file in order (002, 003, 004, 005)
5. Go to **Project Settings > Data API** and copy your **Project URL** and **anon key**
6. Copy your **service_role key** from the same page

### 4. Get a Claude API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key

### 5. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### 6. Create user accounts

In Supabase dashboard: **Authentication > Users > Add User** for each family member.

### 7. Test locally

```bash
npm run dev
```

Open http://localhost:3000 and log in.

### 8. Deploy to Vercel

1. Push to a **private** GitHub repo
2. Go to [vercel.com](https://vercel.com), import the repo
3. Add the 4 environment variables from `.env.local`
4. Deploy

Share the URL with your family.

## Configuration

### Conditions

Add as many conditions as needed in `care-config.json`. Each condition gets its own section in the Summary page with styled headers, and appears as a category option throughout the app.

```json
{
  "conditions": [
    { "name": "Breast Cancer", "category": "Oncology", "color": "pink", "emoji": "🎗️" },
    { "name": "Heart Condition", "category": "Cardiology", "color": "red", "emoji": "❤️" }
  ]
}
```

### Google Drive Integration

If you have medical reports in a shared Google Drive folder, add the folder ID to the config:

```json
{
  "google_drive_folder_id": "ABC123DEF456"
}
```

The folder ID is the part after `/folders/` in the Google Drive URL.

## How It Works

1. **Upload information** via Add Info (text, voice, images) or Reports (PDFs, Word docs)
2. **AI processes it** — Claude extracts medical facts, timeline events, action items, patient details, and referral information
3. **Summary auto-updates** — The home page shows a living summary organized by condition
4. **New content is highlighted** — Green highlights show what changed in the latest update
5. **Track referrals** — Star preferred doctors, add conversation notes
6. **Chat for questions** — Ask Claude about the diagnosis; it searches the web and clearly labels sources

## Security and Privacy

- All data is stored in your private Supabase project (you own the database)
- Authentication required for all pages
- HTTPS enforced by Vercel
- API keys are never committed to git (`.env*` is in `.gitignore`)
- The AI processes data through Anthropic's API (see their [privacy policy](https://www.anthropic.com/privacy))

## License

MIT
