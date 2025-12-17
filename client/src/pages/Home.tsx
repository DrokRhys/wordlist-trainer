import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { VocabularyStructure } from '../types';
import { Book, GraduationCap, History as HistoryIcon } from 'lucide-react';

export default function Home() {
    const navigate = useNavigate();
    const [structure, setStructure] = useState<VocabularyStructure[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [questionCount, setQuestionCount] = useState<number>(10);
    const [testType, setTestType] = useState<string>('cz-en-choice');
    const [prioritizeMistakes, setPrioritizeMistakes] = useState(false);

    useEffect(() => {
        api.getStructure().then(setStructure).catch(console.error);
    }, []);

    const startTest = () => {
        navigate(`/test?unit=${encodeURIComponent(selectedUnit)}&section=${encodeURIComponent(selectedSection)}&limit=${questionCount}&type=${testType}&prioritizeMistakes=${prioritizeMistakes}`);
    };

    const startLearning = () => {
        navigate(`/learning?unit=${encodeURIComponent(selectedUnit)}&section=${encodeURIComponent(selectedSection)}`);
    };

    const availableSections = selectedUnit ? structure.find(s => s.unit === selectedUnit)?.sections || [] : [];

    return (
        <div className="fade-in">
            <div className="container">
                <div className="card">
                    <h3>Select Content</h3>

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

                    <label><strong>Questions</strong></label>
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

                    <label><strong>Test Type</strong></label>
                    <select value={testType} onChange={e => setTestType(e.target.value)}>
                        <option value="cz-en-choice">CZ &rarr; EN (Choice)</option>
                        <option value="en-cz-choice">EN &rarr; CZ (Choice)</option>
                        <option value="cz-en-type">CZ &rarr; EN (Type)</option>
                        <option value="en-cz-type">EN &rarr; CZ (Type)</option>
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

                <button className="btn btn-secondary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => navigate('/history')}>
                    <HistoryIcon size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                    View History
                </button>
            </div>
        </div>
    );
}
