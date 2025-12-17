
import fs from 'fs';
import pdf from 'pdf-parse';
import path from 'path';

const pdfPath = path.join(__dirname, '../ref/ef3e_pre-int_cz_wl.pdf');

async function debug() {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    const lines = data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('travel arrangements')) {
            console.log(`Line ${i - 2}: ${lines[i - 2]}`);
            console.log(`Line ${i - 1}: ${lines[i - 1]}`);
            console.log(`Line ${i}: ${lines[i]}`);
            console.log(`Line ${i + 1}: ${lines[i + 1]}`);
            console.log(`Line ${i + 2}: ${lines[i + 2]}`);
        }
    }
}

debug();
