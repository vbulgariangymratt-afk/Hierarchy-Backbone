import React from 'react';
import WealthTable from '../../components/WealthTable';
import { useStore } from '../../context/StoreContext';
import * as LucideIcons from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 20, color: '#ef4444', background: 'rgba(255,0,0,0.1)', borderRadius: 8, border: '1px solid #ef4444' }}>
                    <h3>Tracker Crashed</h3>
                    <pre style={{ overflow: 'auto' }}>{this.state.error?.message}</pre>
                    <pre>{this.state.error?.stack}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

const Wealth = () => {
    const { state } = useStore();
    const tracker = state.trackers?.wealth || { name: 'Wealth Management', icon: '💰' };

    const renderIcon = (iconStr) => {
        if (!iconStr) return <span style={{ fontSize: '3.5rem' }}>💰</span>;

        try {
            const IconComponent = LucideIcons[iconStr];
            if (IconComponent) return <IconComponent size={56} />;
        } catch (e) {
            console.warn('Icon render error', e);
        }

        if (iconStr?.startsWith('http') || iconStr?.startsWith('data:')) {
            return <img src={iconStr} alt="icon" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />;
        }
        return <span style={{ fontSize: '3.5rem' }}>{iconStr}</span>;
    };

    return (
        <div style={{ padding: '2rem', height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Premium Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--spacing-xl)', position: 'relative' }}>
                <div style={{ marginRight: 'var(--spacing-md)', display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '100px',
                        height: '100px',
                        background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
                        opacity: 0.2,
                        filter: 'blur(20px)',
                        zIndex: 0,
                        pointerEvents: 'none'
                    }} />
                    <div style={{
                        fontSize: '3.5rem',
                        transition: 'transform 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        position: 'relative',
                        zIndex: 1,
                        filter: 'drop-shadow(0 0 15px rgba(0,0,0,0.3))'
                    }}>
                        {renderIcon(tracker.icon)}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h1 style={{
                        fontSize: '3rem',
                        fontWeight: '800',
                        lineHeight: '1.2',
                        background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.7))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-0.03em',
                        margin: 0
                    }}>
                        {tracker.name}
                    </h1>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: '500' }}>
                        Track your expenses, savings, and investments.
                    </p>
                </div>
            </div>

            <ErrorBoundary>
                <WealthTable />
            </ErrorBoundary>
        </div>
    );
};

export default Wealth;
