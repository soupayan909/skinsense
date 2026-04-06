# Skinsense — AI Skin & Wellness App

## Deploy to Vercel (5 minutes)

### Step 1 — Get your Anthropic API key
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Click **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)

### Step 2 — Push to GitHub
1. Go to https://github.com and create a **New repository** called `skinsense`
2. On your computer, open Terminal (Mac) or Command Prompt (Windows)
3. Run these commands one by one:

```bash
cd skinsense          # navigate into this folder
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/skinsense.git
git push -u origin main
```

### Step 3 — Deploy on Vercel
1. Go to https://vercel.com and sign up with GitHub
2. Click **Add New Project** → import your `skinsense` repo
3. Vercel auto-detects Vite — click **Deploy**
4. Wait ~30 seconds for the first deploy

### Step 4 — Add your API key
1. In Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key from Step 1
3. Click **Save**
4. Go to **Deployments** → click the three dots → **Redeploy**

### Step 5 — Open on phone
1. Your app is live at `https://skinsense-xxx.vercel.app`
2. Open that URL on your phone
3. Camera will work — tap **Selfie** tab and allow camera access when prompted

---

## Local development

```bash
npm install
npm run dev
```

Add a `.env.local` file:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
VITE_API_URL=http://localhost:3000
```
