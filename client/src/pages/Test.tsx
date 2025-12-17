import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Word } from '../types';
import { CheckCircle, XCircle, ArrowRight, HelpCircle } from 'lucide-react';

type TestType = 'cz-en-choice' | 'en-cz-choice' | 'cz-en-type' | 'en-cz-type';

interface Question {
    word: Word;
    options?: string[]; // For choice
    correctAnswer: string; // The string to match
    prompt: string;
}

export default function Test() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // State
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [score, setScore] = useState(0);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [finished, setFinished] = useState(false);
    const [mistakes, setMistakes] = useState<string[]>([]); // word IDs
    const [loading, setLoading] = useState(true);
    const [skipped, setSkipped] = useState(false);

    const type = (searchParams.get('type') as TestType) || 'cz-en-choice';
    const limit = Number(searchParams.get('limit')) || 10;



    useEffect(() => {
        const load = async () => {
            const unit = searchParams.get('unit') || undefined;
            const section = searchParams.get('section') || undefined;
            const prioritizeMistakes = searchParams.get('prioritizeMistakes') === 'true';

            // Fetch target words
            // Note: api.getWords definition in client/services/api.ts needs Update to accept this param?
            // Actually getWords accepts `params` object which is passed to axios.
            // So I can just pass extra props if I cast it or update the type.
            // Let's update the type call.
            const targets = await api.getWords({ unit, section, limit, random: true, prioritizeMistakes } as any);

            // Fetch potential distractors (all words or a large random set)
            // Ideally we need distinct words.
            const allWords = await api.getWords({ limit: 100, random: true }); // Get 100 random words for distractors

            // Generate Questions
            const qs = targets.map((w) => {
                let q: Question = {
                    word: w,
                    prompt: '',
                    correctAnswer: ''
                };

                // Setup based on type
                if (type === 'cz-en-choice' || type === 'cz-en-type') {
                    q.prompt = w.translation; // CZ
                    q.correctAnswer = w.word; // EN
                } else {
                    q.prompt = w.word; // EN
                    q.correctAnswer = w.translation; // CZ
                }

                if (type.includes('choice')) {
                    // Generate 3 options
                    // Filter distractors to NOT be the correct word
                    const candidates = allWords.filter(aw => aw.id !== w.id);
                    // Shuffle candidates
                    const shuffledCandidates = candidates.sort(() => 0.5 - Math.random()).slice(0, 2);

                    const options = [q.correctAnswer];
                    shuffledCandidates.forEach(c => {
                        if (type === 'cz-en-choice') options.push(c.word);
                        else options.push(c.translation);
                    });

                    // Shuffle options
                    q.options = options.sort(() => 0.5 - Math.random());
                }

                return q;
            });

            setQuestions(qs);
            setLoading(false);
        };
        load();
    }, [searchParams, type, limit]);

    const handleAnswer = (answer: string) => {
        if (showFeedback) return; // Prevent double submit

        // Normalize checks
        const normalizedUser = answer.trim();

        const possibleAnswers = questions[currentIndex].correctAnswer.split('/').map(s => s.trim());
        const isRight = possibleAnswers.some(pa => pa.toLowerCase() === normalizedUser.toLowerCase());

        setIsCorrect(isRight);
        if (isRight) {
            setScore(p => p + 1);
        } else {
            setMistakes(p => [...p, questions[currentIndex].word.id]);
        }
        setUserAnswer(normalizedUser);
        setShowFeedback(true);
    };

    const handleSkip = () => {
        if (showFeedback) return;
        setSkipped(true);
        setIsCorrect(false);
        setMistakes(p => [...p, questions[currentIndex].word.id]);
        setUserAnswer('');
        setShowFeedback(true);
    };

    const nextQuestion = () => {
        setShowFeedback(false);
        setSkipped(false);
        setUserAnswer('');
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(p => p + 1);
        } else {
            finishTest();
        }
    };

    const finishTest = async () => {
        setFinished(true);
        const attempts = score + mistakes.length;
        // Save history
        await api.saveHistory({
            type,
            score,
            total: attempts, // Save only attempts
            mistakes
        });
    };

    if (loading) return <div className="container">Loading test...</div>;

    if (finished) {
        const attempts = score + mistakes.length;
        const pct = attempts > 0 ? Math.round((score / attempts) * 100) : 0;

        return (
            <div className="fade-in card" style={{ textAlign: 'center' }}>
                <h2>Test Complete!</h2>
                <div style={{ fontSize: '3rem', margin: '2rem 0', color: score === attempts && attempts > 0 ? 'var(--success)' : 'var(--primary)' }}>
                    {pct}%
                </div>
                <p>You scored {score} out of {attempts}</p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/')}>Home</button>
                    <button className="btn" onClick={() => window.location.reload()}>Try Again</button>
                </div>
            </div>
        );
    }

    const q = questions[currentIndex];
    const isChoice = type.includes('choice');

    return (
        <div className="fade-in container">
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '1rem', alignItems: 'center' }}>
                <span onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <XCircle size={20} /> Exit
                </span>
                <span>{currentIndex + 1} / {questions.length}</span>
                <span>Score: {score}</span>
            </div>

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ alignSelf: 'flex-end', marginBottom: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: 'auto' }} onClick={() => finishTest()}>
                        Finish & Save
                    </button>
                </div>
                <h3 style={{ color: 'var(--text-muted)' }}>Translate to {type.includes('cz-en') ? 'English' : 'Czech'}</h3>
                <h1 style={{ fontSize: '2rem', textAlign: 'center', margin: '2rem 0' }}>{q.prompt}</h1>

                <div style={{ width: '100%', maxWidth: '400px' }}>
                    {!showFeedback ? (
                        <>
                            {isChoice ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {q.options?.map((opt, idx) => (
                                        <button key={idx} className="btn btn-secondary" onClick={() => handleAnswer(opt)}>
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <input
                                        autoFocus
                                        type="text"
                                        className="form-control"
                                        placeholder="Type answer..."
                                        style={{ width: '100%', padding: '0.75rem', marginBottom: '0.5rem' }}
                                        value={userAnswer}
                                        onChange={e => setUserAnswer(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleAnswer(userAnswer); }}
                                    />
                                    <button className="btn" onClick={() => handleAnswer(userAnswer)}>Submit</button>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ background: '#f3f4f6', color: '#4b5563', border: 'none' }}
                                        onClick={handleSkip}
                                    >
                                        I don't know
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="fade-in">
                            <div style={{
                                padding: '1rem',
                                borderRadius: '8px',
                                background: isCorrect ? '#dcfce7' : (skipped ? '#ffedd5' : '#fee2e2'),
                                color: isCorrect ? '#166534' : (skipped ? '#9a3412' : '#991b1b'),
                                marginBottom: '1rem',
                                textAlign: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column'
                            }}>
                                {isCorrect ? <CheckCircle size={48} /> : (skipped ? <HelpCircle size={48} /> : <XCircle size={48} />)}
                                <h3 style={{ margin: '0.5rem 0' }}>
                                    {isCorrect ? 'Correct!' : (skipped ? 'You didn\'t know' : 'Wrong!')}
                                </h3>
                                {!isCorrect && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        Answer: <strong>{q.correctAnswer}</strong>
                                    </div>
                                )}
                            </div>
                            <button className="btn" onClick={nextQuestion}>
                                Next <ArrowRight size={16} style={{ verticalAlign: 'middle' }} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
