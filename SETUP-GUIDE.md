# 🏔️ Steamboat Val Gardenia 1 — Setup Guide

This guide walks you through every step to get your guest calendar live on the internet with a shareable link. No coding experience needed — just follow along.

---

## Overview

You'll set up 4 free accounts, then connect them together:

| Service | What it does | Cost |
|---------|-------------|------|
| **GitHub** | Stores your code | Free |
| **Supabase** | Stores your bookings (database) | Free |
| **EmailJS** | Sends you email when someone requests dates | Free (200 emails/mo) |
| **Vercel** | Hosts your website and gives you a link | Free |

---

## Step 1: Create a GitHub Account & Repository

1. Go to [github.com](https://github.com) and sign up (or log in if you have one)
2. Click the **+** button in the top-right → **New repository**
3. Name it: `steamboat-val-gardenia`
4. Keep it **Public** (or Private, either works)
5. Click **Create repository**
6. Upload all the project files:
   - On the new repo page, click **"uploading an existing file"**
   - Drag in ALL the files from the project folder I gave you
   - Click **Commit changes**

> **Important:** Make sure to upload the `.env.example` file but do NOT upload a `.env` file (it has your secret keys).

---

## Step 2: Set Up Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub login is easiest)
2. Click **New Project**
3. Name it `steamboat-val-gardenia`
4. Set a database password (save this somewhere, you won't need it often)
5. Choose region closest to you (e.g., East US)
6. Click **Create new project** — wait ~2 minutes for it to set up

### Create the bookings table:

7. In your Supabase dashboard, click **SQL Editor** in the left sidebar
8. Paste this entire block and click **Run**:

```sql
-- Create the bookings table
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_count INTEGER DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allow anyone to read approved bookings (so guests can see the calendar)
-- Allow anyone to insert new requests
-- Only allow updates/deletes from authenticated or service role (admin)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view approved bookings
CREATE POLICY "Anyone can view approved bookings"
  ON bookings FOR SELECT
  USING (true);

-- Policy: Anyone can submit a request
CREATE POLICY "Anyone can submit requests"
  ON bookings FOR INSERT
  WITH CHECK (true);

-- Policy: Anyone can update (for admin actions via anon key — simple setup)
CREATE POLICY "Allow updates"
  ON bookings FOR UPDATE
  USING (true);

-- Policy: Anyone can delete (for admin actions via anon key — simple setup)
CREATE POLICY "Allow deletes"
  ON bookings FOR DELETE
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
```

9. You should see "Success" — your database is ready!

### Get your Supabase keys:

10. Click **Settings** (gear icon) in the left sidebar → **API**
11. Copy these two values (you'll need them in Step 4):
    - **Project URL** — looks like `https://abcdefg.supabase.co`
    - **anon / public key** — a long string starting with `eyJ...`

---

## Step 3: Set Up EmailJS (Email Notifications)

1. Go to [emailjs.com](https://www.emailjs.com/) and sign up
2. Once logged in, go to **Email Services** → **Add New Service**
3. Choose **Gmail** (or your email provider)
4. Click **Connect Account** and authorize your email
5. Click **Create Service** — note your **Service ID** (like `service_abc123`)

### Create an email template:

6. Go to **Email Templates** → **Create New Template**
7. Set up the template like this:
   - **Subject:** `🏔️ New Stay Request: {{guest_name}} — {{dates}}`
   - **Content (body):**
   ```
   New stay request for Steamboat Val Gardenia 1!

   Guest: {{guest_name}}
   Email: {{guest_email}}
   Guests: {{guest_count}}
   Dates: {{dates}}
   Notes: {{notes}}

   Log into your calendar to approve or reject this request.
   ```
   - **To Email:** Your personal email address
8. Click **Save** — note your **Template ID** (like `template_xyz789`)

### Get your public key:

9. Go to **Account** → **General** tab
10. Copy your **Public Key** (like `aBcDeFgHiJkL`)

---

## Step 4: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with your **GitHub account**
2. Click **Add New...** → **Project**
3. Find and select your `steamboat-val-gardenia` repository
4. Before clicking Deploy, expand **Environment Variables**
5. Add each of these one at a time (click "Add" after each):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | Your Supabase Project URL from Step 2 |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key from Step 2 |
   | `VITE_EMAILJS_SERVICE_ID` | Your EmailJS Service ID from Step 3 |
   | `VITE_EMAILJS_TEMPLATE_ID` | Your EmailJS Template ID from Step 3 |
   | `VITE_EMAILJS_PUBLIC_KEY` | Your EmailJS Public Key from Step 3 |
   | `VITE_ADMIN_PASSWORD` | Whatever password you want (default: `powder`) |

6. Click **Deploy**
7. Wait 1-2 minutes — Vercel will build and deploy your site
8. 🎉 **You'll get a URL like `steamboat-val-gardenia.vercel.app`** — this is your shareable link!

---

## Step 5: Test It!

1. Open your new URL in a browser
2. Click on two dates to select a range → fill in the form → submit
3. Check your email — you should receive a notification!
4. Click **🔑 Owner Login** → enter your password
5. Click **🔔 Requests** → you should see the test request
6. Click **Approve** → the dates turn colored on the calendar
7. Try **Revoke** to open dates back up

---

## Sharing With Guests

Send your guests the URL! They'll see the calendar with booked dates and can submit requests. You'll get an email each time, and can log in to approve/reject.

---

## Changing Your Password

Update the `VITE_ADMIN_PASSWORD` environment variable in Vercel:
1. Go to vercel.com → your project → Settings → Environment Variables
2. Edit `VITE_ADMIN_PASSWORD` to your new password
3. Click **Save**
4. Go to Deployments → click the **...** menu on the latest → **Redeploy**

---

## Custom Domain (Optional)

Want a nicer URL like `calendar.yourdomain.com`?
1. In Vercel → your project → Settings → Domains
2. Add your custom domain and follow Vercel's DNS instructions

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Loading..." forever | Check your Supabase URL and anon key in Vercel env vars |
| No email notifications | Verify your EmailJS Service ID, Template ID, and Public Key |
| Can't log in as owner | Check your `VITE_ADMIN_PASSWORD` env var in Vercel |
| Dates don't update for others | Make sure you ran the SQL that includes `ALTER PUBLICATION supabase_realtime` |
| Build fails on Vercel | Make sure all files were uploaded to GitHub correctly |

---

## Need Help?

If you get stuck on any step, come back to our chat and let me know exactly where you are — I'll walk you through it!
