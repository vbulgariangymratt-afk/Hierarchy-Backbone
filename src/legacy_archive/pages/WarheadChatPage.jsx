import WarheadChat from '../components/WarheadChat';

const WarheadChatPage = () => {
    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: 'var(--spacing-lg)',
            gap: 'var(--spacing-lg)'
        }}>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: '4px' }}>Warhead</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                    Your personal AI performance analyst.
                </p>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <WarheadChat mode="embedded" />
            </div>
        </div>
    );
};

export default WarheadChatPage;
