import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Word } from '../types';
import { CheckCircle, XCircle, ArrowRight, HelpCircle, X } from 'lucide-react';

interface Slot {
    id: number; // visual index 0..N
    wordId: string | null;
    status: 'empty' | 'active' | 'correct' | 'mistake' | 'unknown';
    attempts: number;
}

interface WordProgress {
    wordId: string;
    status: 'empty' | 'correct' | 'mistake' | 'unknown';
    attempts: number;
    slotIndex: number | null; // assigned on first appearance to keep dots filling left->right
}

// Utility to normalize string for comparison
function normalize(s: string) {
    return s.toLowerCase()
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ') // Standardize spaces
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.,!?;:]/g, ''); // Standardize punctuation
}

// Cleans text for display (removes pronunciation and meta-tags)
function cleanForDisplay(text: string): string {
    return text
        .replace(/\/[^/]+\//g, '') // Remove pronunciation /.../
        .replace(/\((v\.|n\.|adj\.|adv\.|prep\.|pron\.|phr\.|phr\s?v\.)\)/gi, '') // Remove common PoS tags
        .replace(/,\s*p.p\./g, '') // Remove past participle marking
        .replace(/\*/g, '') // Remove asterisks
        .replace(/\s+/g, ' ')
        .trim();
}

// Expands a "dirty" string into multiple possible valid answers
function getSmartVariations(text: string): string[] {
    // 1. Remove pronunciation and meta tags first
    const clean = cleanForDisplay(text);

    // 2. Handle slashes (vysoký /á /é OR word1 / word2)
    // We split by slash and then handle suffixes vs full words
    const parts = clean.split('/').map(p => p.trim());
    const base = parts[0];
    const results = new Set<string>();
    results.add(base);

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('-') || (part.length <= 3 && !part.includes(' '))) {
            // Likely a suffix (e.g., /á /é)
            // Try to find a common stem or just append
            // This is tricky, but let's try a simple heuristic: replace last N chars
            const stem = base.substring(0, base.length - part.replace('-', '').length);
            results.add(stem + part.replace('-', ''));
            results.add(part); // Also add just in case
        } else {
            // Likely a full word variation
            results.add(part);
        }
    }

    // 3. Handle parentheses (pick (up))
    const expanded = new Set<string>();
    results.forEach(val => {
        if (val.includes('(') && val.includes(')')) {
            // Option 1: with parentheses content
            expanded.add(val.replace(/\(|\)/g, '').replace(/\s+/g, ' ').trim());
            // Option 2: without parentheses content
            expanded.add(val.replace(/\([^)]+\)/g, '').replace(/\s+/g, ' ').trim());
        } else {
            expanded.add(val);
        }
    });

    return Array.from(expanded).filter(v => v.length > 0);
}

// Levenshtein distance for typo detection
function getLevenshteinDistance(a: string, b: string): number {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[a.length][b.length];
}

export default function MarathonTest() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const unit = searchParams.get('unit');
    const section = searchParams.get('section');
    const limitRaw = searchParams.get('limit');
    const limit = limitRaw ? parseInt(limitRaw) : 20; // Default batch size
    const type = searchParams.get('type') === 'en-cz' ? 'en-cz' : 'cz-en';
    const prioritizeMistakes = searchParams.get('prioritizeMistakes') === 'true';

    // Data State
    const [allWords, setAllWords] = useState<Word[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]); // visual timeline left->right
    const [wordStates, setWordStates] = useState<Record<string, WordProgress>>({});

    // Execution State
    const [currentWordId, setCurrentWordId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [finished, setFinished] = useState(false);

    // Interaction State
    const [userInput, setUserInput] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastResult, setLastResult] = useState<'correct' | 'wrong' | 'unknown' | null>(null);
    const [isTypo, setIsTypo] = useState(false);

    // Stats
    const [totalAttempts, setTotalAttempts] = useState(0);
    const [mistakesList, setMistakesList] = useState<Set<string>>(new Set());

    // Refs to keep stable data for selection logic
    const allWordsRef = useRef<Word[]>([]);
    const slotsLengthRef = useRef(0);
    const wordStatesRef = useRef<Record<string, WordProgress>>({});
    const nextSlotRef = useRef(0); // pointer for next free dot (fills left->right)

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const lang = searchParams.get('lang') || undefined;
                // God Prompt: "vezme se automaticky celý počet slovíček, který je v dané skupině"
                const data = await api.getWords({
                    unit: unit || undefined,
                    section: section || undefined,
                    limit: limit,
                    random: true, // Initially shuffle words
                    prioritizeMistakes,
                    lang
                });

                // Initialize word progress map (slot assigned on first appearance)
                const initialWordStates: Record<string, WordProgress> = {};
                data.forEach(w => {
                    initialWordStates[w.id] = {
                        wordId: w.id,
                        status: 'empty',
                        attempts: 0,
                        slotIndex: null
                    };
                });

                // Prepare empty visual slots; ids map to chronological order
                const initialSlots: Slot[] = Array.from({ length: data.length }, (_, i) => ({
                    id: i,
                    wordId: null,
                    status: 'empty',
                    attempts: 0
                }));

                allWordsRef.current = data;
                slotsLengthRef.current = initialSlots.length;
                nextSlotRef.current = 0;
                wordStatesRef.current = initialWordStates;
                setAllWords(data);
                setWordStates(initialWordStates);
                setSlots(initialSlots);
                setCurrentWordId(null);
                setShowFeedback(false);
                setLastResult(null);
                setUserInput('');

                // Immediately pick first word if available (uses refs to avoid stale state)
                if (data.length > 0) pickNext(null);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [unit, section, limit, prioritizeMistakes, searchParams.get('lang')]);

    const pickNext = (prevWordId: string | null) => {
        const currentStates = wordStatesRef.current;
        // God Prompt: "test trvá do té chvíle, dokud není celé pole teček zelené"
        const allCorrect = Object.values(currentStates).every(s => s.status === 'correct');
        if (allCorrect) {
            finishTest();
            return;
        }

        // Pass 1: always visit all unseen words before repeating (ensures dots advance)
        const wordsForOrder = allWordsRef.current;
        const nextUnseen = wordsForOrder.find(w => currentStates[w.id]?.status === 'empty');
        if (nextUnseen) {
            selectWord(nextUnseen.id, currentStates);
            return;
        }

        // Pass 2: Weighted Selection for already seen words
        // God Prompt: "intenzita 'náhodné' volby špatně zodpovězených... nebo které nevěděl je vyšší"
        // God Prompt: "každé slovíčko se použije... maximálně třikrát (vyjma těch, které nebyly správně zodpovězené...)"

        const baseCandidates: { wordId: string, weight: number }[] = [];

        Object.values(currentStates).forEach(s => {
            // Rule: skip correct words that appeared 3+ times
            if (s.status === 'correct' && s.attempts >= 3) return;

            let weight = 0;
            if (s.status === 'mistake' || s.status === 'unknown') weight = 20; // High priority Errors
            else if (s.status === 'empty') weight = 10; // Medium priority Unseen
            else if (s.status === 'correct') weight = 1; // Low priority Review

            // Anti-repetition (don't pick same if others available)
            if (s.wordId === prevWordId && Object.keys(currentStates).length > 1) {
                weight *= 0.1;
            }

            if (weight > 0) baseCandidates.push({ wordId: s.wordId, weight });
        });

        // Never immediately repeat the same word if there is another option
        const otherCandidates = baseCandidates.filter(c => c.wordId !== prevWordId);
        const candidates = otherCandidates.length > 0 ? otherCandidates : baseCandidates;

        // Fallback: If everything correct but some < 3 attempts and weights ended up 0?
        // Or if only the current one is left.
        if (candidates.length === 0) {
            finishTest();
            return;
        }

        const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedWordId = candidates[candidates.length - 1].wordId;

        for (const candidate of candidates) {
            random -= candidate.weight;
            if (random <= 0) {
                selectedWordId = candidate.wordId;
                break;
            }
        }

        // Ensure the selected word has a slot assigned in left->right order
        selectWord(selectedWordId, currentStates);
    };

    const selectWord = (selectedWordId: string, currentStates: Record<string, WordProgress>) => {
        const statesAfterAssign = { ...currentStates };
        const selectedState = { ...statesAfterAssign[selectedWordId] };
        if (selectedState.slotIndex === null) {
            const assignIndex = nextSlotRef.current;
            selectedState.slotIndex = assignIndex;
            statesAfterAssign[selectedWordId] = selectedState;
            const maxSlots = slotsLengthRef.current || slots.length || assignIndex + 1;
            nextSlotRef.current = Math.min(assignIndex + 1, maxSlots);
            setSlots(prev => {
                const updated = [...prev];
                updated[assignIndex] = { ...updated[assignIndex], wordId: selectedWordId, status: selectedState.status, attempts: selectedState.attempts };
                return updated;
            });
        }

        wordStatesRef.current = statesAfterAssign;
        setWordStates(statesAfterAssign);

        setCurrentWordId(selectedWordId);
        setShowFeedback(false);
        setLastResult(null);
        setUserInput('');
    };

    const submitAnswer = (skip = false) => {
        if (showFeedback || currentWordId === null) return;

        const stateForWord = wordStatesRef.current[currentWordId];
        const wordObj = allWords.find(w => w.id === currentWordId);
        if (!wordObj || !stateForWord || stateForWord.slotIndex === null) return;

        const rawText = type === 'cz-en' ? wordObj.word : wordObj.translation;
        const normalizedAnswers = getSmartVariations(rawText).map(s => normalize(s));
        const normalizedInput = normalize(userInput);

        let result: 'correct' | 'wrong' | 'unknown';
        let foundTypo = false;

        if (skip) {
            result = 'unknown';
        } else {
            const exactMatch = normalizedAnswers.some(ans => ans === normalizedInput);
            if (exactMatch) {
                result = 'correct';
            } else {
                const fuzzyMatch = normalizedAnswers.some(ans => {
                    const dist = getLevenshteinDistance(ans, normalizedInput);
                    const threshold = ans.length > 8 ? 2 : (ans.length > 3 ? 1 : 0);
                    return dist > 0 && dist <= threshold;
                });
                if (fuzzyMatch) {
                    result = 'correct';
                    foundTypo = true;
                } else {
                    result = 'wrong';
                }
            }
        }

        setIsTypo(foundTypo);
        setLastResult(result);
        setTotalAttempts(p => p + 1);

        const newWordStates = { ...wordStatesRef.current };
        const newState = { ...stateForWord };
        newState.attempts += 1;

        // God Prompt colors
        if (result === 'correct') {
            newState.status = 'correct';
        } else if (result === 'wrong') {
            newState.status = 'mistake'; // Red
            setMistakesList(prev => new Set(prev).add(wordObj.id));
        } else {
            newState.status = 'unknown'; // Orange
            setMistakesList(prev => new Set(prev).add(wordObj.id));
        }

        newWordStates[currentWordId] = newState;
        wordStatesRef.current = newWordStates;
        setWordStates(newWordStates);

        const updatedSlots = [...slots];
        const slotIndex = newState.slotIndex!;
        updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], wordId: currentWordId, status: newState.status, attempts: newState.attempts };
        setSlots(updatedSlots);
        setShowFeedback(true);
    };

    const finishTest = async () => {
        setFinished(true);
        await api.saveHistory({
            type: 'marathon',
            score: allWords.length,
            total: totalAttempts,
            mistakes: Array.from(mistakesList)
        });
    };

    const getDotStyle = (slot: Slot, isActive: boolean) => {
        let bg = '#e5e7eb'; // neaktivní (light grey)

        if (slot.status === 'correct') bg = '#4ade80'; // zelená
        if (slot.status === 'mistake') bg = '#fca5a5'; // světle červená
        if (slot.status === 'unknown') bg = '#fdba74'; // světle oranžová

        let border = 'none';
        let opacity = 0.6;
        let transform = 'scale(1)';

        if (isActive) {
            opacity = 1;
            transform = 'scale(1.3)';
            border = '1px solid #3b82f6'; // Highlight active
            // Intense color for active
            if (slot.status === 'empty') bg = '#9ca3af';
        }

        return {
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: bg,
            opacity,
            transform,
            border,
            transition: 'all 0.2s ease'
        };
    };

    if (loading) return <div className="p-8 text-center">Loading Marathon...</div>;

    if (finished) {
        return (
            <div className="fade-in card text-center">
                <h2>Marathon Completed!</h2>
                <div style={{ fontSize: '1.2rem', margin: '2rem 0' }}>
                    You mastered all <strong>{allWords.length}</strong> words in <strong>{totalAttempts}</strong> attempts.
                    <br />
                    <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                        Efficiency Rate: {Math.round((allWords.length / totalAttempts) * 100)}%
                    </span>
                </div>
                <div className="flex gap-4 justify-center">
                    <button className="btn btn-secondary" onClick={() => navigate('/')}>Home</button>
                    <button className="btn" onClick={() => window.location.reload()}>Restart</button>
                </div>
            </div>
        );
    }

    const currentState = currentWordId ? wordStates[currentWordId] : null;
    const currentWordObj = currentWordId ? allWords.find(w => w.id === currentWordId) : null;
    const activeSlotIndex = currentState?.slotIndex ?? null;

    if (!currentWordObj || !currentState) return <div className="p-8 text-center">No words found...</div>;

    const promptText = type === 'cz-en' ? cleanForDisplay(currentWordObj.translation) : cleanForDisplay(currentWordObj.word);
    const correctAnswerText = type === 'cz-en' ? currentWordObj.word : currentWordObj.translation;

    return (
        <div className="fade-in container max-w-2xl mx-auto">
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '1rem', alignItems: 'center' }}>
                <span onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <X size={20} /> Exit
                </span>
                <span>Remaining: {Object.values(wordStates).filter(s => s.status !== 'correct').length} / {allWords.length}</span>
            </div>

            <div className="card text-center mb-6" style={{ minHeight: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h3 className="text-muted mb-2">Translate to {type === 'cz-en' ? (searchParams.get('lang')?.toLowerCase().startsWith('de') ? 'German' : 'English') : 'Czech'}</h3>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>{promptText}</h1>

                {!showFeedback ? (
                    <div className="w-full max-w-md mx-auto">
                        <input
                            autoFocus
                            type="text"
                            className="form-control text-center text-lg mb-4"
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && submitAnswer()}
                            placeholder="Type answer..."
                        />
                        <div className="flex gap-2 justify-center">
                            <button className="btn btn-primary" onClick={() => submitAnswer()}>Submit</button>
                            <button className="btn btn-secondary" onClick={() => submitAnswer(true)}>I don't know</button>
                        </div>
                    </div>
                ) : (
                    <div className="fade-in">
                        <div style={{
                            padding: '1.5rem',
                            borderRadius: '12px',
                            marginBottom: '1.5rem',
                            background: lastResult === 'correct' ? '#dcfce7' : '#fee2e2',
                            color: lastResult === 'correct' ? '#166534' : '#991b1b'
                        }}>
                            <div className="flex flex-col items-center gap-2">
                                {lastResult === 'correct' && <CheckCircle size={48} />}
                                {lastResult === 'wrong' && <XCircle size={48} />}
                                {lastResult === 'unknown' && <HelpCircle size={48} />}
                                <h2 className="text-xl font-bold">
                                    {isTypo ? 'Correct (with typo)' : (lastResult === 'correct' ? 'Correct!' : (lastResult === 'unknown' ? 'Skipped' : 'Incorrect'))}
                                </h2>
                                <div className="text-lg mt-2">
                                    Correct answer: <strong>{correctAnswerText}</strong>
                                </div>
                            </div>
                        </div>
                        <button className="btn btn-primary w-full max-w-xs mx-auto" onClick={() => pickNext(currentWordId)}>
                            Next <ArrowRight size={20} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
                        </button>
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.5)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                    {slots.map((s, idx) => (
                        <div key={s.id} style={getDotStyle(s, idx === activeSlotIndex)} />
                    ))}
                </div>
            </div>
        </div>
    );
}

// Add some styles to index.css if needed for utilities like 'flex', 'text-center' if they don't exist
// I used some utility classes like 'btn', 'card', but also 'mb-6', 'text-center'. 
// I should check if those utility classes exist or just use inline styles to be safe.
// 'btn', 'card', 'container' exist in Home.tsx.
// 'text-center' might not. I will use inline styles where unsure to match the 'nicit soucasnou strukturu' request (safest bet).
