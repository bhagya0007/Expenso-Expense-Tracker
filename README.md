# Expenso — Smart Expense Tracker & Financial Companion

Expenso is a modern web application for tracking personal expenses, analyzing bank statements, setting budget limits, and forecasting financial health — built with React, Vite, TanStack Router, Tailwind CSS, and Firebase (Authentication & Cloud Firestore).

---

## 🔒 Security & Environment Variables

All sensitive values, credentials, and API configuration keys are managed strictly via environment variables. **No API keys or secret tokens are hardcoded anywhere in the source code.**

### Environment Setup

1. Copy `.env.example` to create your local `.env` file:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Firebase Web App configuration keys from **Firebase Console -> Project Settings -> General -> Web App**:
   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

---

## ⚠️ Security Notice & Secret Rotation

> [!WARNING]
> **Git History Notice**: If any legacy credentials or API keys (such as historical Supabase anon keys or test tokens) were hardcoded during early development phases prior to this migration, **rotate those keys immediately** in their respective provider consoles (Firebase, Supabase, etc.). Secrets in past git history must be treated as public and revoked.

---

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Local Development Server
```bash
npm run dev
```

The application will launch on `http://localhost:8080/`.

---

## 🛡️ Production Deployment Checklist

1. **Environment Variables**: Add `VITE_FIREBASE_*` variables to your hosting platform (Vercel, Netlify, Cloudflare Pages, etc.).
2. **Authorized Domains**: Add your production domain in **Firebase Console -> Authentication -> Settings -> Authorized Domains**.
3. **Firestore Security Rules**: Set production rules in **Firebase Console -> Firestore Database -> Rules**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```