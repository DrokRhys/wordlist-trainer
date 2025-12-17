import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function History() {
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        api.getHistory().then(h => setHistory(h.reverse())).catch(console.error);
    }, []);

    return (
        <div className="fade-in">
            <Link to="/" className="btn btn-secondary" style={{ display: 'inline-flex', width: 'auto', alignItems: 'center' }}>
                <ArrowLeft size={16} style={{ marginRight: 8 }} /> Back
            </Link>

            <h2>Test History</h2>

            {history.length === 0 ? <p>No history yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {history.map((h, i) => (
                        <div key={i} className="card" style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <strong>{new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString()}</strong>
                                <span style={{
                                    color: (h.score / h.total) > 0.8 ? 'var(--success)' : 'var(--error)',
                                    fontWeight: 'bold'
                                }}>
                                    {Math.round((h.score / h.total) * 100)}%
                                </span>
                            </div>
                            <div style={{ color: 'var(--text-muted)' }}>
                                Type: {h.type} | Score: {h.score}/{h.total}
                                {h.deviceId && <div style={{ fontSize: '0.85em', marginTop: '0.25rem', color: '#888' }}>User: {h.deviceId}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
