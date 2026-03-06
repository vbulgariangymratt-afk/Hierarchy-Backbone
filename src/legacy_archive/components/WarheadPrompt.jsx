import { AlertTriangle, Sparkles, Check, X, Clock } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useState } from 'react';

/**
 * WarheadPrompt
 * Premium floating UI that appears when Warhead Pulse triggers.
 */
const WarheadPrompt = () => {
    const { state, dispatch } = useStore();
    const [isClosing, setIsClosing] = useState(false);

    if (!state.warheadPrompt) return null;

    const { title, lastStartedAt } = state.warheadPrompt;
    const elapsedMinutes = Math.round((Date.now() - lastStartedAt) / 60000);
    const elapsedHours = (elapsedMinutes / 60).toFixed(1);

    const handleAcknowledge = () => {
        // Just clear the prompt, user is still working
        dispatch({ type: 'SET_WARHEAD_PROMPT', payload: null });
    };

    const handleStopNow = () => {
        dispatch({
            type: 'UPDATE_TASK',
            payload: {
                id: state.warheadPrompt.taskId,
                updates: { status: 'not-started' }
            }
        });
        dispatch({ type: 'SET_WARHEAD_PROMPT', payload: null });
    };

    const handleForgot = () => {
        // Open Warhead Chat and clear prompt
        dispatch({ type: 'SET_WARHEAD_PROMPT', payload: null });
        // We assume WarheadChat is available or we can trigger it
        // For now, clearing it is the first step, user can then talk to Warhead
        window.location.hash = '/warhead'; // Heuristic to navigate if needed
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '320px',
            background: 'rgba(15, 15, 20, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
            color: 'white',
            zIndex: 9999,
            animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        }}>
            <style>
                {`
                    @keyframes slideUp {
                        from { transform: translateY(20px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    .warhead-btn {
                        transition: all 0.2s ease;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        font-weight: 600;
                        font-size: 13px;
                    }
                    .warhead-btn:hover {
                        transform: translateY(-1px);
                        filter: brightness(1.1);
                    }
                    .warhead-btn:active {
                        transform: translateY(0);
                    }
                `}
            </style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f0f0f0, #a0a0a0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 15px rgba(255, 255, 255, 0.2)'
                }}>
                    <Sparkles size={16} color="#333" />
                </div>
                <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, fontWeight: 700 }}>Warhead Pulse</div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>Active Session Check</div>
                </div>
            </div>

            {/* Content */}
            <div style={{ fontSize: '14px', lineHeight: '1.5', opacity: 0.9 }}>
                Task <strong style={{ color: '#fff' }}>{title}</strong> has been running for <span style={{ color: '#fbbf24', fontWeight: 700 }}>{elapsedHours} hours</span>.
                Are you still working on this?
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                    onClick={handleAcknowledge}
                    className="warhead-btn"
                    style={{
                        padding: '10px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white'
                    }}
                >
                    <Check size={16} /> Yes, I'm still at it
                </button>

                <button
                    onClick={handleForgot}
                    className="warhead-btn"
                    style={{
                        padding: '10px',
                        background: 'rgba(251, 191, 36, 0.15)',
                        border: '1px solid rgba(251, 191, 36, 0.3)',
                        borderRadius: '8px',
                        color: '#fbbf24'
                    }}
                >
                    <Clock size={16} /> I forgot / Stopped earlier
                </button>

                <button
                    onClick={handleStopNow}
                    className="warhead-btn"
                    style={{
                        padding: '10px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        color: '#f87171'
                    }}
                >
                    <X size={16} /> Stop tracking now
                </button>
            </div>
        </div>
    );
};

export default WarheadPrompt;
