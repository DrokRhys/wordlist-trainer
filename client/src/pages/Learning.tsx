import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import type { Word } from '../types';
import { ArrowLeft, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

export default function Learning() {
    const [searchParams] = useSearchParams();
    const [words, setWords] = useState<Word[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showExample, setShowExample] = useState(false);

    useEffect(() => {
        const unit = searchParams.get('unit') || undefined;
        const section = searchParams.get('section') || undefined;
        const lang = searchParams.get('lang') || undefined;
        const limit = Number(searchParams.get('limit')) || 10;

        // Always random for learning? Or sequential? 
        // User "selects unit/section". Sequence matches book usually?
        // Let's keep it sequential unless user asked for Shuffle. 
        // User didn't specify, but "training" usually implies order or random.
        // Let's shuffle to make it interesting.
        api.getWords({ unit, section, limit, random: true, lang }).then(setWords).catch(console.error);
    }, [searchParams]);

    if (words.length === 0) return <div className="container">Loading or no words found...</div>;

    const currentWord = words[currentIndex];

    const next = () => {
        if (currentIndex < words.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setShowExample(false);
        }
    };

    const prev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setShowExample(false);
        }
    };

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                <Link to="/" style={{ color: 'var(--text-muted)', marginRight: 'auto' }}><ArrowLeft /></Link>
                <span>{currentIndex + 1} / {words.length}</span>
            </div>

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--text-muted)', marginBottom: 0 }}>{currentWord.unit}</h3>
                <p style={{ marginTop: 0, fontSize: '0.9rem', color: '#9ca3af' }}>{currentWord.section}</p>

                <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{currentWord.translation}</h1>
                <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)', fontWeight: 'normal' }}>{currentWord.word}</h2>
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{currentWord.pronunciation}</div>

                <div style={{ marginTop: '2rem', minHeight: '60px' }}>
                    {!showExample ? (
                        <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => setShowExample(true)}>
                            <Eye size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Show Example
                        </button>
                    ) : (
                        <div className="fade-in" style={{ fontStyle: 'italic', color: '#4b5563' }}>
                            "{currentWord.example}"
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={prev} disabled={currentIndex === 0}>
                    <ChevronLeft style={{ verticalAlign: 'middle' }} /> Prev
                </button>
                <button className="btn" onClick={next} disabled={currentIndex === words.length - 1}>
                    Next <ChevronRight style={{ verticalAlign: 'middle' }} />
                </button>
            </div>
        </div>
    );
}
