# Ticket Tracker

A free, browser-based tool for restaurant and food service operators to scan order tickets, track daily sales, analyze costs, and compare delivery platform fees. No API key required — OCR runs entirely in the browser.

## Features

- **Scanner** — Drag & drop or upload order ticket images; OCR extracts item names, costs, and quantities (Tesseract.js, runs locally)
- **Daily Summary** — Log and review orders by day; add pickup vs. delivery breakdown
- **Monthly Summary** — Track revenue and order counts month by month
- **Dashboard** — Visual charts of revenue trends and platform splits (recharts)
- **Platform Sales** — Compare net revenue across DoorDash, Uber Eats, Grubhub, and direct orders
- **Cost Analysis** — Enter ingredient, labor, and overhead costs per item; see margin vs. industry benchmarks
- **Google Sheets** — Export to `.xlsx` (3 sheets: Order Summary, Cost Analysis, Delivery Fees) or import a previously exported file
- **Bilingual** — English and Mandarin Chinese UI

## Getting Started

```bash
npm install
npm run dev
```

## Deploying to Netlify

### Option 1: Via Netlify UI (Recommended)
1. Push this repo to GitHub
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import an existing project**
3. Connect your GitHub repo
4. Netlify auto-detects settings from `netlify.toml` (build: `npm run build`, publish: `dist`)
5. Click **Deploy site**

### Option 2: Via Netlify CLI
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

## Project Structure

```
ticket-tracker/
├── src/
│   ├── components/
│   │   ├── Scanner.jsx           # Upload + drag-and-drop UI
│   │   ├── ScannerTab.jsx        # Scanner tab wrapper (lazy-loaded)
│   │   ├── ResultsTable.jsx      # Scanned results + manual entry
│   │   ├── DailySummaryTable.jsx # Daily order log
│   │   ├── MonthlySummaryTable.jsx
│   │   ├── Dashboard.jsx         # Revenue charts
│   │   ├── DeliveryAnalysis.jsx  # Platform fee calculator
│   │   ├── CostAnalysis.jsx      # Margin analysis
│   │   ├── SheetPanel.jsx        # Excel import/export
│   │   └── AddOrderModal.jsx
│   ├── hooks/
│   │   ├── useOrderScan.js       # Tesseract.js OCR + parsing
│   │   ├── useOrderStore.js      # Daily order state
│   │   └── useMonthlyStore.js    # Monthly summary state
│   ├── i18n/
│   │   ├── LangContext.jsx
│   │   └── translations.js       # EN + ZH strings
│   ├── styles/
│   │   └── index.css
│   ├── utils/
│   │   └── helpers.js
│   ├── App.jsx
│   └── main.jsx
├── netlify.toml
├── vite.config.js
└── package.json
```

## Tech Stack

- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- [Tesseract.js](https://tesseract.projectnaptha.com/) — in-browser OCR
- [recharts](https://recharts.org/) — dashboard charts
- [react-router-dom v6](https://reactrouter.com/) — URL-based tab navigation
- [xlsx](https://sheetjs.com/) — Excel export/import
- [Netlify](https://netlify.com) — hosting
