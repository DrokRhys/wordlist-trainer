import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function History() {
    const [history, setHistory] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('all');

    useEffect(() => {
        api.getHistory().then(h => setHistory(h.reverse())).catch(console.error);
    }, []);

    const uniqueUsers = Array.from(new Set(history.map(h => h.deviceId).filter(Boolean)));
    const filteredHistory = selectedUser === 'all'
        ? history
        : history.filter(h => h.deviceId === selectedUser);

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <Link to="/" className="btn btn-secondary" style={{ display: 'inline-flex', width: 'auto', alignItems: 'center' }}>
                    <ArrowLeft size={16} style={{ marginRight: 8 }} /> Back
                </Link>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ margin: 0, whiteSpace: 'nowrap' }}><strong>Filter by User:</strong></label>
                    <select
                        value={selectedUser}
                        onChange={e => setSelectedUser(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                        <option value="all">All Users</option>
                        {uniqueUsers.map(user => (
                            <option key={user as string} value={user as string}>{user as string}</option>
                        ))}
                    </select>
                </div>
            </div>

            <h2>Test History</h2>

            {filteredHistory.length === 0 ? <p>No history matching this filter.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredHistory.map((h, i) => (
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
                                Unit: {h.unit || 'All'} | Type: {h.type} | Score: {h.score}/{h.total}
                                {h.deviceId && <div style={{ fontSize: '0.85em', marginTop: '0.25rem', color: '#888' }}>User: {h.deviceId}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
