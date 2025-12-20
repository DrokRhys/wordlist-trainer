import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { VocabularyStructure } from '../types';
import { Book, GraduationCap, History as HistoryIcon } from 'lucide-react';

export default function Home() {
    const navigate = useNavigate();
    const [languages, setLanguages] = useState<string[]>([]);
    const [selectedLang, setSelectedLang] = useState<string>('');
    const [structure, setStructure] = useState<VocabularyStructure[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [questionCount, setQuestionCount] = useState<number>(10);
    const [testType, setTestType] = useState<string>('cz-en-choice');
    const [prioritizeMistakes, setPrioritizeMistakes] = useState(false);
    const [isMarathon, setIsMarathon] = useState(false);

    useEffect(() => {
        api.getLanguages().then(langs => {
            setLanguages(langs);
            if (langs.length > 0) {
                // Try to find 'eng' or 'english' first, else take first
                const defaultLang = langs.find(l => l.toLowerCase() === 'eng' || l.toLowerCase() === 'english') || langs[0];
                setSelectedLang(defaultLang);
            }
        }).catch(console.error);
    }, []);

    useEffect(() => {
        if (selectedLang) {
            api.getStructure(selectedLang).then(setStructure).catch(console.error);
            setSelectedUnit('');
            setSelectedSection('');
        }
    }, [selectedLang]);


    const startTest = () => {
        const langQuery = selectedLang ? `&lang=${encodeURIComponent(selectedLang)}` : '';
        if (isMarathon) {
            const direction = testType.includes('en-cz') ? 'en-cz' : 'cz-en';
            navigate(`/marathon?unit=${encodeURIComponent(selectedUnit)}&section=${encodeURIComponent(selectedSection)}&limit=${questionCount}&type=${direction}&prioritizeMistakes=${prioritizeMistakes}${langQuery}`);
        } else {
            navigate(`/test?unit=${encodeURIComponent(selectedUnit)}&section=${encodeURIComponent(selectedSection)}&limit=${questionCount}&type=${testType}&prioritizeMistakes=${prioritizeMistakes}${langQuery}`);
        }
    };

    const startLearning = () => {
        const langQuery = selectedLang ? `&lang=${encodeURIComponent(selectedLang)}` : '';
        navigate(`/learning?unit=${encodeURIComponent(selectedUnit)}&section=${encodeURIComponent(selectedSection)}${langQuery}`);
    };

    const availableSections = selectedUnit ? structure.find(s => s.unit === selectedUnit)?.sections || [] : [];

    const getLanguageDisplay = (lang: string) => {
        const map: Record<string, string> = {
            'eng': 'English',
            'deutsch': 'Deutsch',
            'cz': 'Čeština'
        };
        const normalized = lang.toLowerCase();
        return map[normalized] || lang.charAt(0).toUpperCase() + lang.slice(1);
    };

    return (
        <div className="fade-in">
            <div className="container">
                <div className="card">
                    <h3>Select Content</h3>

                    <label><strong>Language</strong></label>
                    <select value={selectedLang} onChange={e => setSelectedLang(e.target.value)}>
                        {languages.map(l => (
                            <option key={l} value={l}>{getLanguageDisplay(l)}</option>
                        ))}
                    </select>

                    <label><strong>Unit</strong></label>
                    <select value={selectedUnit} onChange={e => {
                        setSelectedUnit(e.target.value);
                        setSelectedSection('');
                    }}>
                        <option value="">-- All Units --</option>
                        {structure.map(s => (
                            <option key={s.unit} value={s.unit}>{s.unit}</option>
                        ))}
                    </select>

                    <label><strong>Section</strong> (Optional)</label>
                    <select
                        value={selectedSection}
                        onChange={e => setSelectedSection(e.target.value)}
                        disabled={!selectedUnit}
                    >
                        <option value="">-- All Sections --</option>
                        {availableSections.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    <label><strong>{isMarathon ? 'Batch Size' : 'Questions'}</strong></label>
                    <input
                        type="number"
                        value={questionCount}
                        onChange={e => setQuestionCount(Number(e.target.value))}
                        min={5}
                        max={100}
                    />
                </div>
                <div className="card">
                    <h3>Select Mode</h3>

                    <label><strong>Experience Mode</strong></label>
                    <select
                        value={isMarathon ? 'marathon' : 'normal'}
                        onChange={e => setIsMarathon(e.target.value === 'marathon')}
                        style={{ marginBottom: '0.5rem' }}
                    >
                        <option value="normal">Normal Mode</option>
                        <option value="marathon">Marathon Mode</option>
                    </select>

                    <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        backgroundColor: 'rgba(0,0,0,0.03)',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        borderLeft: '3px solid var(--primary)'
                    }}>
                        {isMarathon ? (
                            <p style={{ margin: 0 }}>
                                <strong>Marathon Mode:</strong> Type words until you get them all correct. Words you miss will keep reappearing until mastered. Features smart validation and typo tolerance.
                            </p>
                        ) : (
                            <p style={{ margin: 0 }}>
                                <strong>Normal Mode:</strong> Standard practice session. Supports multiple choice and translation. Best for initial learning and testing.
                            </p>
                        )}
                    </div>

                    <label><strong>Test Type</strong></label>
                    <select value={testType} onChange={e => setTestType(e.target.value)}>
                        {!isMarathon && <option value="cz-en-choice">CZ &rarr; {selectedLang.toLowerCase().startsWith('de') ? 'DE' : 'EN'} (Choice)</option>}
                        {!isMarathon && <option value="en-cz-choice">{selectedLang.toLowerCase().startsWith('de') ? 'DE' : 'EN'} &rarr; CZ (Choice)</option>}
                        <option value="cz-en-type">CZ &rarr; {selectedLang.toLowerCase().startsWith('de') ? 'DE' : 'EN'} (Type)</option>
                        <option value="en-cz-type">{selectedLang.toLowerCase().startsWith('de') ? 'DE' : 'EN'} &rarr; CZ (Type)</option>
                    </select>

                    <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            id="pMistakes"
                            checked={prioritizeMistakes}
                            onChange={e => setPrioritizeMistakes(e.target.checked)}
                            style={{ width: 'auto', marginRight: '0.5rem', marginBottom: 0 }}
                        />
                        <label htmlFor="pMistakes"><strong>Prioritize Mistakes</strong></label>
                    </div>

                    <button className="btn btn-success" onClick={startTest}>
                        <GraduationCap size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                        Start Test
                    </button>

                    <div style={{ margin: '1rem 0', textAlign: 'center', color: '#666' }}>OR</div>

                    <button className="btn" onClick={startLearning}>
                        <Book size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                        Learning Mode
                    </button>
                </div>
            </div>

            <button className="btn btn-secondary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => navigate('/history')}>
                <HistoryIcon size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                View History
            </button>
        </div>
    );
}
