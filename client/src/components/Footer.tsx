
import { getDeviceId } from '../utils/identity';

export default function Footer() {
    return (
        <footer style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginTop: 'auto',
            background: '#fff',
            borderTop: '1px solid #eee'
        }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem', lineHeight: 1.6 }}>
                <span>&copy; {new Date().getFullYear()} <a href="https://magiostudios.com" target="_blank" rel="noreferrer" style={linkStyle}>Magiostudios.com</a></span>
                <span>Creator: <a href="https://github.com/DrokRhys" target="_blank" rel="noreferrer" style={linkStyle}>Drok Rhys</a></span>
                <span>Data: <a
                    href="https://fdslive.oup.com/www.oup.com/elt/general_content/cz/ef3e_pre-int_cz_wl.pdf?cc=cz&selLanguage=cs&mode=hub"
                    target="_blank"
                    rel="noreferrer"
                    style={linkStyle}
                >
                    PDF Source
                </a>
                </span>
                <span><a href="https://www.patreon.com/magiostudios" target="_blank" rel="noreferrer" style={linkStyle}>Support on Patreon</a></span>
            </div>

            <div>
                Connected as: <strong style={{ color: 'var(--primary)' }}>{getDeviceId()}</strong>
            </div>
        </footer>
    );
}

const linkStyle = {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    borderBottom: '1px dotted var(--text-muted)'
};
