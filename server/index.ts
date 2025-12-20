import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || (isProd ? 5010 : 5011);

app.use(cors());
app.use(express.json());

// Define path to client build (handles both ts-node and dist/index.js)
const isDist = path.basename(__dirname) === 'dist';
const ROOT_DIR = path.resolve(__dirname, isDist ? '../../' : '../');
const CLIENT_DIST = path.join(ROOT_DIR, 'client/dist');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const VOCAB_FILE = path.join(DATA_DIR, 'vocabulary.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Serve static frontend
app.use(express.static(CLIENT_DIST));

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to load words
function getWords() {
    if (!fs.existsSync(VOCAB_FILE)) return [];
    const data = fs.readFileSync(VOCAB_FILE, 'utf-8');
    const all = JSON.parse(data);
    // Filter out invalid entries
    return all.filter((w: any) => w.word && w.translation && w.word.trim().length > 0 && w.translation.trim().length > 0);
}

// Helper to load history
function getHistory() {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Helper to save history with Backup
function saveHistory(history: any[]) {
    // 1. Ensure backup dir exists
    const BACKUP_DIR = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // 2. Create WEEKLY backup
    // Get ISO Week string: YYYY-Www
    const date = new Date();
    const year = date.getFullYear();
    // Simple week number calc
    const oneJan = new Date(year, 0, 1);
    const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);

    const weekId = `${year}-W${week}`;
    const backupFile = path.join(BACKUP_DIR, `history_${weekId}.json`);

    if (fs.existsSync(HISTORY_FILE) && !fs.existsSync(backupFile)) {
        // Copy current history to backup before overwriting
        fs.copyFileSync(HISTORY_FILE, backupFile);
        console.log(`Created backup: ${backupFile}`);
    }

    // 3. Save new history
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// --- Endpoints ---

// Get unique languages
app.get('/api/languages', (req, res) => {
    const words = getWords();
    const languages = new Set<string>();
    words.forEach((w: any) => {
        if (w.lang) languages.add(w.lang);
    });
    // Default to eng if nothing else and eng is present
    if (languages.size === 0) languages.add('eng');
    res.json(Array.from(languages));
});

// Get structure (units and sections)
app.get('/api/structure', (req, res) => {
    const { lang } = req.query;
    let words = getWords();

    if (lang) {
        words = words.filter((w: any) => w.lang === lang);
    } else {
        // Default to first found lang or 'eng' if not specified
        const firstLang = words[0]?.lang || 'eng';
        words = words.filter((w: any) => w.lang === firstLang);
    }

    const structure: any = {};

    words.forEach((w: any) => {
        if (!structure[w.unit]) {
            structure[w.unit] = new Set();
        }
        if (w.section) {
            structure[w.unit].add(w.section);
        }
    });

    // Convert Sets to Arrays
    const result = Object.keys(structure).map(unit => ({
        unit,
        sections: Array.from(structure[unit])
    }));

    res.json(result);
});

// Get words
app.get('/api/words', (req, res) => {
    const { unit, section, limit, random, prioritizeMistakes, lang } = req.query;
    let words = getWords();

    if (lang) {
        words = words.filter((w: any) => w.lang === lang);
    }

    if (unit) {
        words = words.filter((w: any) => w.unit === unit);
    }

    if (section) {
        words = words.filter((w: any) => w.section === section);
    }

    if (prioritizeMistakes === 'true') {
        const history = getHistory();
        const mistakeIds = new Set<string>();
        // Collect all mistake IDs from history
        history.forEach((h: any) => {
            if (h.mistakes && Array.isArray(h.mistakes)) {
                h.mistakes.forEach((id: string) => mistakeIds.add(id));
            }
        });

        const mistakeWords = words.filter((w: any) => mistakeIds.has(w.id));
        const otherWords = words.filter((w: any) => !mistakeIds.has(w.id));

        // Shuffle both groups separately if random
        if (random === 'true') {
            const shuffle = (arr: any[]) => {
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
            };
            shuffle(mistakeWords);
            shuffle(otherWords);
        }

        // Combine: Mistakes first, then others
        words = [...mistakeWords, ...otherWords];

    } else if (random === 'true') {
        // Shuffle standard
        for (let i = words.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [words[i], words[j]] = [words[j], words[i]];
        }
    }

    if (limit) {
        words = words.slice(0, Number(limit));
    }

    res.json(words);
});

// Save test result
app.post('/api/history', (req, res) => {
    // ... (rest of saveHistory content)
    const entry = req.body;
    // Expected entry: { date: number, type: string, score: number, total: number, mistakes: Word[] }

    const history = getHistory();
    history.push({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        ...entry
    });
    saveHistory(history);

    res.json({ success: true, count: history.length });
});

// Get history
app.get('/api/history', (req, res) => {
    res.json(getHistory());
});

// Fallback for React routing
app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
