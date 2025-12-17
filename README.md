
# Wordlist Trainer

A full-stack vocabulary training application designed to help users learn English words from the "English File 3rd Edition Pre-Intermediate" wordlist. The app parses vocabulary directly from a PDF source and provides an interactive testing interface.

## 🚀 How It Works

### 1. Data Extraction (Backend)
The application starts with a raw PDF file located in `ref/ef3e_pre-int_cz_wl.pdf`.
- **Parser**: A custom Node.js script (`server/extractor.ts`) reads the PDF using `pdf-parse`.
- **Heuristics**: It uses complex regex and heuristics to identify words, pronunciations, parts of speech, example sentences, and Czech translations. It handles edge cases like split lines and mixed content.
- **Output**: The extracted data is saved to `data/vocabulary.json`, which serves as the database for the application.

### 2. API Server
- Built with **Node.js** and **Express**.
- Serves the vocabulary data to the frontend.
- Manages user progress and test history in `data/history.json`.
- Implements an "Adaptive Learning" algorithm to prioritize words the user has previously mistaken.

### 3. Frontend Client
- Built with **React** and **Vite**.
- **Mobile-First Design**: Optimized for phone screens with large touch targets.
- **Modes**:
    - **Learning Mode**: Browse words by Unit/Section with examples and pronunciations.
    - **Test Mode**:
        - **Choice**: Select the correct translation (CZ ↔ EN).
        - **Typing**: Type the correct word (Strict character checking).
- **Features**:
    - **"I don't know" button**: Skips the question and marks it as "You didn't know" (Orange) instead of "Wrong" (Red).
    - **History**: Tracks score and mistakes over time.
    - **Daily Backups**: Automatically backs up history files.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Frontend**: React, Vite, CSS Modules
- **Backend**: Express.js
- **Data**: JSON (No external database required)
- **Tools**: concurrently, pdf-parse, nodemon

## 🏁 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone git@github.com:DrokRhys/wordlist-trainer.git
   cd wordlist-trainer
   ```

2. Install dependencies (runs for root, client, and server):
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   cd ..
   ```
   *(Note: You usually just need to run `npm install` in the root if workspaces are configured, but manual installation in subfolders ensures everything is ready.)*

### Running the App

Start both the backend server and frontend client with a single command:

```bash
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:5010

## 📝 Credits

- **App Creator**: Drok Rhys
- **Data Source**: Oxford University Press (English File 3rd Ed. Pre-Intermediate)
- **Developed for**: Magiostudios.com

