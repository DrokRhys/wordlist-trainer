import fs from 'fs';
import pdf from 'pdf-parse';
import path from 'path';

const pdfPath = path.join(__dirname, '../ref/ef3e_pre-int_cz_wl.pdf');
const outputPath = path.join(__dirname, '../data/vocabulary.json');

interface Word {
    id: string;
    word: string;
    pos: string;
    pronunciation: string;
    example: string;
    translation: string;
    unit: string;
    section: string;
}

async function extract() {
    console.log("Reading PDF...");
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);

    // Split lines and cleanup
    const lines = data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const cleanWords: Word[] = []; // Changed from 'words' to 'cleanWords' to match the instruction's final usage
    let currentUnit = "General";
    let currentSection = "";

    // Regex helpers
    const pronStartRegex = /^\//; // Starts with /
    // Updated exclude regex to handle "3English File..."
    const headerExcludeRegex = /^\d*English File|Czech Wordlist|Oxford University Press/i;

    // STRICTER unit regex: Only File X or More words in File X
    const unitRegex = /^(File \d+|More words in File \d+)$/;
    const czChars = /[áéíóúůýžščřďťňÁÉÍÓÚŮÝŽŠČŘĎŤŇ]/;

    // We'll iterate and look for pronunciation lines as anchors
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // Global exclusion check
        if (headerExcludeRegex.test(line)) {
            i++; continue;
        }

        if (unitRegex.test(line)) {
            // ... existing unit logic ...
            // (Wait, I can't overwrite easily without copying block)
            // Normalize "More words in File X" -> "File X"
            const match = line.match(/File \d+/);
            if (match) {
                currentUnit = match[0];
            } else {
                currentUnit = line;
            }
            currentSection = ""; // Reset section on new unit
            i++; continue;
        }

        // Look ahead for Pronunciation to confirm Word start
        if (i + 1 < lines.length && pronStartRegex.test(lines[i + 1])) {
            // Found Word Start at `i` (Word Line)
            const wordLine = line;

            // Handle potentially split pronunciation
            let pronLine = lines[i + 1];
            let k = i + 1;
            while (!pronLine.endsWith('/') && k + 1 < lines.length) {
                k++;
                pronLine += lines[k];
            }

            // Example and Translation handling
            // Example starts at k+2 (after pron) if k was pron end
            // Wait, logic:
            // i = word
            // i+1 ... k = pron
            // j starts at k + 1

            let exampleParts: string[] = [];
            let transParts: string[] = [];

            let j = k + 1;
            let collectingExample = true;

            while (j < lines.length) {
                const subLine = lines[j];

                // Stop if next word starts (lookahead j+1 is pron)
                if (j + 1 < lines.length && pronStartRegex.test(lines[j + 1])) {
                    break;
                }
                // Stop if Unit
                if (unitRegex.test(subLine)) {
                    break;
                }

                // Skip headers/footers
                if (headerExcludeRegex.test(subLine)) {
                    j++; continue;
                }

                // Decision: Is this line part of Example or Translation?
                // Heuristic:
                // 1. If we are collecting example...
                //    - If line has Czech chars -> Switch to Translation.
                //    - If line is very short and looks like a word but no Czech chars... ambiguous.
                //    - If line completes a sentence?

                if (collectingExample) {
                    if (czChars.test(subLine)) {
                        // Check if this line is actually [English Def] [Czech Trans]
                        // Use Greedy match to capture full English sentence(s)
                        const splitMatch = subLine.match(/^(.*[.!?])\s+(.+)$/);
                        if (splitMatch) {
                            const part1 = splitMatch[1];
                            const part2 = splitMatch[2];

                            // If part 1 has NO Czech chars and part 2 HAS Czech chars
                            if (!czChars.test(part1) && czChars.test(part2)) {
                                exampleParts.push(part1);
                                transParts.push(part2);
                                collectingExample = false;
                                j++; continue;
                            }
                        }

                        collectingExample = false;
                        transParts.push(subLine);
                    } else {
                        // Ambiguous case: "looks at him. extrovert" (from "extrovert")
                        // The line `looks at him. extrovert` was SPLIT by `pdf-parse`?
                        // No, `pdf-parse` output showed:
                        // "looks at him."
                        // "extrovert"
                        // But wait, my previous output showed `"translation": "looks at him. extrovert"`.
                        // This implies `extrovert` was NOT on a new line?
                        // "translation": "understanding things. chytrý"

                        // Wait, looking at the JSON output earlier:
                        // "example": "He is very clever. He is quick at learning and",
                        // "translation": "understanding things. chytrý"

                        // This means `lines[i+2]` was "understanding things. chytrý" ??
                        // If so, `pdf-parse` grouped them on one line.
                        // If they are on one line, I need to split string by heuristic.

                        // Scan the line for the transition from English to Czech.
                        // "understanding things. chytrý"
                        // Split by ". " or "? " or "! "?
                        // Example sentences usually end with punctuation.

                        // Let's try to split `subLine` if it contains a sentence end AND then text.
                        // Use Greedy regex to catch multiple sentences in example
                        const splitMatch = subLine.match(/^(.*[.!?])\s+(.+)$/);
                        if (splitMatch) {
                            const p1 = splitMatch[1];
                            const p2 = splitMatch[2];

                            // DEBUG
                            if (subLine.includes('people laugh')) {
                                console.log(`DEBUG: subLine='${subLine}'`);
                                console.log(`DEBUG: p1='${p1}'`);
                                console.log(`DEBUG: p2='${p2}'`);
                                console.log(`DEBUG: cz=${czChars.test(p2)}, lower=${/^[a-z]/.test(p2)}`);
                            }

                            // Heuristic: Split if P2 looks like translation (Czech chars OR starts with lowercase)
                            if (czChars.test(p2) || /^[a-z]/.test(p2)) {
                                exampleParts.push(p1);
                                transParts.push(p2);
                                collectingExample = false;
                            } else {
                                // Otherwise assume it's all example
                                exampleParts.push(subLine);
                            }
                        } else {
                            // No clear split.

                            // HEURISTIC: Multi-line separation
                            // If previous example line ended with punctuation, and this line starts with lowercase (and no cz chars passed before),
                            // Assume it is the translation.
                            const lastExample = exampleParts.length > 0 ? exampleParts[exampleParts.length - 1] : '';
                            if (collectingExample && lastExample.match(/[.!?]$/) && /^[a-z]/.test(subLine)) {
                                collectingExample = false;
                                transParts.push(subLine);
                            } else {
                                exampleParts.push(subLine);
                            }
                        }
                    }
                } else {
                    // collecting Translation
                    transParts.push(subLine);
                }
                j++;
            }

            // Post-process Translation parts for trailing Section headers
            // Same logic as before
            if (transParts.length > 0) {
                const last = transParts[transParts.length - 1];
                // If last line is capitalized English and looks like a Section title
                // "Describing people"
                if (/^[A-Z][a-z ]+$/.test(last) && !czChars.test(last) && !last.includes('/')) {
                    // Likely a section header for the NEXT group
                    // Wait, if I consume it here, I should set `currentSection` for NEXT.
                    // But I can't set it for NEXT easily in this loop structure.
                    // Actually I can set a `pendingSection` variable.
                    // But simpler: just remove it from here. The loop will encounter it? 
                    // No, I consumed `j` past it.

                    // If I consumed it, I must use it.
                    currentSection = last;
                    transParts.pop();
                }
            }

            const { w, p } = parseWordLine(wordLine); // Use existing helper for word and POS

            let translation = transParts.join(' ');

            // Heuristic: If translation is "Word (Explanation)" or "word (explanation)" and the repeated word is similar to the source word
            // We want to keep ONLY the Explanation.
            const bracketMatch = translation.match(/^(.+?)\s+\((.+?)\)$/);
            if (bracketMatch) {
                const prefix = bracketMatch[1].toLowerCase().trim();
                const content = bracketMatch[2].trim();

                // If the part before the bracket is just the original word repeated (or very similar)
                if (prefix === w.toLowerCase() || prefix === w.toLowerCase().replace(/s$/, '')) {
                    translation = content;
                }
            }

            cleanWords.push({
                id: Math.random().toString(36).substr(2, 9),
                word: w,
                pos: p,
                pronunciation: pronLine,
                example: exampleParts.join(' '),
                translation: translation,
                unit: currentUnit,
                section: currentSection
            });

            // Update i
            i = j;

        } else {
            // Not a word, check for Section Header?
            // If we skipped lines in loop, we handled it.
            // If we are here, `i` was not word start.
            // Check if it looks like a Section
            if (!unitRegex.test(line) && line.length < 50 && /^[A-Z]/.test(line) && !czChars.test(line)) {
                currentSection = line;
            }
            i++;
        }
    }

    // Save
    fs.writeFileSync(outputPath, JSON.stringify(cleanWords, null, 2));
    console.log(`Extracted ${cleanWords.length} words to ${outputPath}`);
}

function parseWordLine(line: string) {
    // Basic split by space
    const parts = line.trim().split(' ');

    // Check if Last Token is a known POS (part of speech)
    // Common tags in this PDF: adj, n, v, adv, prep, pron, conj, det, pl (plural noun)
    // Sometimes multiple: "n pl"

    // Strategy: Look from the end. If it matches a know POS tag, consume it.
    const knownPos = new Set(['adj', 'n', 'v', 'adv', 'prep', 'conj', 'pron', 'det', 'pl']);

    let wParts = [...parts];
    let pParts: string[] = [];

    // consume from end
    while (wParts.length > 0) {
        const last = wParts[wParts.length - 1];
        if (knownPos.has(last.replace('.', ''))) { // handle "n." optional dot
            pParts.unshift(last);
            wParts.pop();
        } else {
            break;
        }
    }

    if (pParts.length > 0) {
        return { w: wParts.join(' '), p: pParts.join(' ') };
    }

    // Fallback if no POS found (maybe it was just the word?)
    return { w: line, p: '' };
}

function unwrapExample(lines: string[], idx: number) {
    // Just return true if it exists?
    return true;
}

extract().catch(console.error);
