import fs from 'fs';
import pdf from 'pdf-parse';
import path from 'path';

const pdfPath = path.join(__dirname, '../ref/ef3e_pre-int_cz_wl.pdf');

async function debug() {
    console.log("Reading PDF for debug...");
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    const lines = data.text.split('\n');

    console.log("--- Searching for 'File' pattern ---");
    lines.forEach((l, i) => {
        const t = l.trim();
        if (t.includes('File') || t.includes('Vocabulary Bank') || /^\d+$/.test(t)) {
            console.log(`[${i}] ${t}`);
        }
    });
}

debug();
