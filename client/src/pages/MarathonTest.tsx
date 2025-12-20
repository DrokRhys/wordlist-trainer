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
    const [allWords, setAllWords] = useState<Word[]>([]); // Full pool from DB
    const [availableWords, setAvailableWords] = useState<Word[]>([]); // Words yet to be assigned to a slot
    const [slots, setSlots] = useState<Slot[]>([]);

    // Execution State
    const [currentSlotIndex, setCurrentSlotIndex] = useState<number | null>(null);
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

    // Refs for safe access in timeouts if needed, though mostly using state
    const slotsRef = useRef<Slot[]>([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const lang = searchParams.get('lang') || undefined;
                // Load ALL words to ensure we have a pool to draw from
                // We rely on backend to shuffle and prioritize mistakes if requested
                const data = await api.getWords({
                    unit: unit || undefined,
                    section: section || undefined,
                    limit: 10000,
                    random: true,
                    prioritizeMistakes,
                    lang
                });


                // Initialize empty slots
                const initialSlots: Slot[] = Array.from({ length: limit }, (_, i) => ({
                    id: i,
                    wordId: null,
                    status: 'empty',
                    attempts: 0
                }));

                // Fill all initial slots with available words
                const queue = [...data];
                const updatedSlots = [...initialSlots];
                for (let i = 0; i < updatedSlots.length; i++) {
                    if (queue.length > 0) {
                        const word = queue.shift()!;
                        updatedSlots[i] = {
                            ...updatedSlots[i],
                            wordId: word.id,
                            status: 'active'
                        };
                    }
                }

                setAllWords(data);
                setAvailableWords(queue);
                setSlots(updatedSlots);
                slotsRef.current = updatedSlots;

                // Start first turn
                if (data.length > 0) {
                    // Pick the first slot to start
                    setCurrentSlotIndex(0);
                    setShowFeedback(false);
                    setLastResult(null);
                    setUserInput('');
                } else {
                    setLoading(false);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [unit, section, limit, prioritizeMistakes, searchParams.get('lang')]); // Added lang dependency

    const pickNext = (currentSlots: Slot[], currentAvailable: Word[], prevSlotIdx: number | null) => {
        // 1. If we have empty slots AND available words, fill ONE empty slot first
        const nextEmptyIndex = currentSlots.findIndex(s => s.status === 'empty');

        if (nextEmptyIndex !== -1 && currentAvailable.length > 0) {
            // Pick next word
            const nextWord = currentAvailable[0];
            const remaining = currentAvailable.slice(1);

            setAvailableWords(remaining);

            // Assign to slot
            const newSlots = [...currentSlots];
            newSlots[nextEmptyIndex] = {
                ...newSlots[nextEmptyIndex],
                wordId: nextWord.id,
                status: 'active',
                attempts: 0
            };

            setSlots(newSlots);
            slotsRef.current = newSlots;
            setCurrentSlotIndex(nextEmptyIndex);

            // Reset UI
            setShowFeedback(false);
            setLastResult(null);
            setUserInput('');
            return;
        }

        // 2. Check termination condition: 
        // All assigned slots are 'correct' AND no more words in queue
        const allFilledDone = currentSlots.filter(s => s.wordId !== null).every(s => s.status === 'correct');
        const noMoreWords = currentAvailable.length === 0;

        if (allFilledDone && noMoreWords) {
            finishTest();
            return;
        }
        // Note: 'empty' should logically not exist here if we are in this branch, UNLESS pool ran out smaller than limit.
        // If pool < limit, we might have empty slots at end that will never be filled. They should be ignored.


        // Weighted selection from assigned slots
        let candidates: { index: number, weight: number }[] = [];

        // Helper to populate candidates
        const buildCandidates = (allowOverLimit: boolean) => {
            const temp: { index: number, weight: number }[] = [];
            currentSlots.forEach((s, idx) => {
                if (s.status === 'empty') return;

                // If not allowing over limit, respect the cap
                if (!allowOverLimit && s.status === 'correct' && s.attempts >= 3) return;

                let weight = 0;
                // High priority for fixing
                if (s.status === 'mistake' || s.status === 'unknown') weight = 100;
                // Low priority for re-checking
                if (s.status === 'correct') weight = 1;

                // Anti-repetition penalty
                if (idx === prevSlotIdx) {
                    weight = 0.001; // Extremely low, but possible if it's the ONLY choice
                }

                if (weight > 0) temp.push({ index: idx, weight });
            });
            return temp;
        };

        candidates = buildCandidates(false);

        // Emergency Spacer Check:
        // If we only have 1 candidate, and it is the SAME slot as before,
        // and we actually have other filled slots available (that were vetted out by limits),
        // then relax the limits to find a spacer.
        if (candidates.length === 1 && candidates[0].index === prevSlotIdx) {
            const anyOtherSlots = currentSlots.some((s, i) => i !== prevSlotIdx && s.status !== 'empty');
            if (anyOtherSlots) {
                candidates = buildCandidates(true);
                // Filter out the previous one purely to force a swap if possible
                const others = candidates.filter(c => c.index !== prevSlotIdx);
                if (others.length > 0) {
                    candidates = others;
                }
            }
        }

        if (candidates.length === 0) {
            // No candidates? Probably everything correct.
            finishTest();
            return;
        }

        const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedIndex = candidates[candidates.length - 1].index;

        for (const candidate of candidates) {
            random -= candidate.weight;
            if (random <= 0) {
                selectedIndex = candidate.index;
                break;
            }
        }

        // Set Active
        // We don't change status to 'active' here permanently, just set current index.
        // The previous active one keeps its status (correct/mistake).
        setCurrentSlotIndex(selectedIndex);
        setShowFeedback(false);
        setLastResult(null);
        setUserInput('');
    };

    const submitAnswer = (skip = false) => {
        if (showFeedback || currentSlotIndex === null) return;

        const slot = slots[currentSlotIndex];
        if (!slot.wordId) return;

        const wordObj = allWords.find(w => w.id === slot.wordId);
        if (!wordObj) return;

        const rawText = type === 'cz-en' ? wordObj.word : wordObj.translation;
        const normalizedAnswers = getSmartVariations(rawText).map(s => normalize(s));
        const normalizedInput = normalize(userInput);

        let result: 'correct' | 'wrong' | 'unknown';
        let foundTypo = false;

        if (skip) {
            result = 'unknown';
        } else {
            // 1. Check exact (normalized) match
            const exactMatch = normalizedAnswers.some(ans => ans === normalizedInput);

            if (exactMatch) {
                result = 'correct';
            } else {
                // 2. Check for typos (fuzzy match)
                // Threshold: 1 char for len > 3, 2 chars for len > 8
                const fuzzyMatch = normalizedAnswers.some(ans => {
                    const dist = getLevenshteinDistance(ans, normalizedInput);
                    const threshold = ans.length > 8 ? 2 : (ans.length > 3 ? 1 : 0);
                    if (dist > 0 && dist <= threshold) return true;
                    return false;
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

        // Update Slot Status
        const newSlots = [...slots];
        const s = { ...newSlots[currentSlotIndex] };

        s.attempts += 1;
        if (result === 'correct') {
            s.status = 'correct';
        } else if (result === 'wrong') {
            s.status = 'mistake';
            setMistakesList(prev => new Set(prev).add(wordObj.id));
        } else {
            s.status = 'unknown'; // Orange
            setMistakesList(prev => new Set(prev).add(wordObj.id));
        }

        newSlots[currentSlotIndex] = s;
        setSlots(newSlots);
        slotsRef.current = newSlots;

        setShowFeedback(true);
    };

    const handleNext = () => {
        pickNext(slots, availableWords, currentSlotIndex);
    };

    const finishTest = async () => {
        setFinished(true);
        const usedWordsCount = slots.filter(s => s.wordId !== null).length;
        await api.saveHistory({
            type: 'marathon',
            score: usedWordsCount,
            total: totalAttempts,
            mistakes: Array.from(mistakesList)
        });
    };

    // Helper to get color
    const getDotStyle = (slot: Slot, isActive: boolean) => {
        let bg = '#e5e7eb'; // empty/grey
        let border = '2px solid transparent';
        let scale = 'scale(1)';

        if (slot.status === 'correct') bg = '#4ade80';
        if (slot.status === 'mistake') bg = '#fca5a5';
        if (slot.status === 'unknown') bg = '#fdba74';

        if (isActive) {
            border = '2px solid #3b82f6';
            scale = 'scale(1.2)';
            // Active color intensifies
            if (slot.status === 'empty' || slot.status === 'active') bg = '#9ca3af';
            if (slot.status === 'correct') bg = '#22c55e';
            if (slot.status === 'mistake') bg = '#ef4444';
            if (slot.status === 'unknown') bg = '#f97316';
        }

        return {
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: bg,
            border,
            transform: scale,
            transition: 'all 0.3s ease'
        };
    };

    if (loading) return <div className="p-8 text-center">Loading Marathon...</div>;

    if (finished) {
        const usedWordsCount = slots.filter(s => s.wordId !== null).length;
        return (
            <div className="fade-in card text-center">
                <h2>Marathon Batch Complete!</h2>
                <div style={{ fontSize: '1.2rem', margin: '2rem 0' }}>
                    You mastered {usedWordsCount} words in {totalAttempts} attempts.
                </div>
                <div className="flex gap-4 justify-center">
                    <button className="btn btn-secondary" onClick={() => navigate('/')}>Home</button>
                    <button className="btn" onClick={() => window.location.reload()}>Next Batch</button>
                </div>
            </div>
        );
    }

    // Get Current Word for display
    const currentSlot = currentSlotIndex !== null ? slots[currentSlotIndex] : null;
    const currentWordObj = currentSlot?.wordId ? allWords.find(w => w.id === currentSlot.wordId) : null;

    // Safety check
    if (!currentWordObj && !finished) {
        if (allWords.length === 0) {
            return (
                <div className="fade-in card text-center">
                    <h2>No words found</h2>
                    <p className="mb-4">Try selecting a different unit or section.</p>
                    <button className="btn btn-secondary" onClick={() => navigate('/')}>Back Home</button>
                </div>
            );
        }
        return <div className="p-8 text-center">Preparing next word...</div>;
    }

    const promptText = type === 'cz-en' ? cleanForDisplay(currentWordObj!.translation) : cleanForDisplay(currentWordObj!.word);
    const correctAnswerText = type === 'cz-en' ? currentWordObj!.word : currentWordObj!.translation;


    return (
        <div className="fade-in container max-w-2xl mx-auto">
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '1rem', alignItems: 'center' }}>
                <span onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <X size={20} /> Exit
                </span>
                <span>Batch Size: {limit}</span>
            </div>

            {/* Question Card */}
            <div className="card text-center mb-6" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
                                    {lastResult === 'correct' && !isTypo ? 'Solution:' : 'Correct answer:'} <strong>{correctAnswerText}</strong>
                                </div>
                            </div>
                        </div>
                        <button className="btn btn-primary w-full max-w-xs mx-auto flex items-center justify-center gap-2" onClick={handleNext}>
                            Next <ArrowRight size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Progress Dots - Moved BELOW question */}
            <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                    {slots.map((s, idx) => (
                        <div
                            key={s.id}
                            style={getDotStyle(s, idx === currentSlotIndex)}
                            title={`Status: ${s.status} `}
                        />
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
