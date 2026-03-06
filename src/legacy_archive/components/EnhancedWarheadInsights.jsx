import React from 'react';
import { useAIAnalyst } from '../hooks/useAIAnalyst';
import { Sparkles, AlertTriangle, CheckCircle, Info, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGlassClass } from '../hooks/useGlassClass';

const EnhancedWarheadInsights = ({ onOpenChat }) => {
    const insights = useAIAnalyst();
    const navigate = useNavigate();
    const glassClass = useGlassClass();

    // Show top 3 insights
    const displayInsights = insights.slice(0, 3);

    const getInsightIcon = (type) => {
        switch (type) {
            case 'warning':
            case 'danger':
                return <AlertTriangle size={16} color="#fca5a5" />;
            case 'success':
                return <CheckCircle size={16} color="#5eead4" />;
            case 'suggestion':
                return <Lightbulb size={16} color="#fb923c" />;
            default:
                return <Info size={16} color="rgba(255,255,255,0.6)" />;
        }
    };

    const getInsightColor = (type) => {
        switch (type) {
            case 'warning':
            case 'danger':
                return { bg: 'rgba(252, 165, 165, 0.08)', border: 'rgba(252, 165, 165, 0.15)', text: '#fca5a5' };
            case 'success':
                return { bg: 'rgba(94, 234, 212, 0.08)', border: 'rgba(94, 234, 212, 0.15)', text: '#5eead4' };
            case 'suggestion':
                return { bg: 'rgba(251, 146, 60, 0.08)', border: 'rgba(251, 146, 60, 0.15)', text: '#fb923c' };
            default:
                return { bg: 'rgba(255, 255, 255, 0.03)', border: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255,255,255,0.6)' };
        }
    };

    if (displayInsights.length === 0) {
        return null;
    }

    // Main insight (first one)
    const mainInsight = displayInsights[0];
    const mainColors = getInsightColor(mainInsight.type);

    // Secondary insights
    const secondaryInsights = displayInsights.slice(1);

    return (
        <div>
            {/* Main Insight Card */}
            <div
                onClick={() => onOpenChat ? onOpenChat() : navigate('/warhead')}
                className={glassClass}
                style={{
                    padding: '28px',
                    borderRadius: '24px',
                    border: `1px solid ${mainColors.border}`,
                    background: `linear-gradient(135deg, ${mainColors.bg} 0%, rgba(30, 30, 30, 0.3) 100%)`,
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 20px 60px ${mainColors.bg}, 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)`;
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)';
                }}
            >
                {/* Gradient Overlay */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `linear-gradient(135deg, ${mainColors.bg} 0%, transparent 50%)`,
                    pointerEvents: 'none'
                }} />

                {/* Rim Lighting */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '1px',
                    background: `linear-gradient(90deg, transparent, ${mainColors.border}, transparent)`,
                    pointerEvents: 'none'
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: mainColors.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `0 0 20px ${mainColors.bg}`
                        }}>
                            <Sparkles size={18} color={mainColors.text} />
                        </div>
                        <span style={{
                            fontWeight: '700',
                            fontSize: '13px',
                            color: mainColors.text,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            Warhead Pulse
                        </span>
                    </div>

                    <h3 style={{
                        fontSize: '22px',
                        marginBottom: '10px',
                        color: 'white',
                        fontWeight: '700',
                        letterSpacing: '-0.02em'
                    }}>
                        {mainInsight.title}
                    </h3>
                    <p style={{
                        fontSize: '15px',
                        color: 'rgba(255,255,255,0.65)',
                        lineHeight: '1.6',
                        marginBottom: '16px',
                        maxWidth: '800px'
                    }}>
                        {mainInsight.description}
                    </p>

                    {mainInsight.question && (
                        <div style={{
                            fontSize: '14px',
                            color: 'rgba(255,255,255,0.8)',
                            fontStyle: 'italic',
                            marginBottom: '16px',
                            paddingLeft: '16px',
                            borderLeft: `2px solid ${mainColors.border}`
                        }}>
                            {mainInsight.question}
                        </div>
                    )}

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        color: mainColors.text,
                        fontWeight: '600'
                    }}>
                        Chat with Warhead →
                    </div>
                </div>

                {/* Glow Effect */}
                <div style={{
                    position: 'absolute',
                    top: '-40px',
                    right: '-40px',
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${mainColors.bg} 0%, transparent 70%)`,
                    filter: 'blur(40px)',
                    pointerEvents: 'none'
                }} />
            </div>

            {/* Secondary Insights */}
            {secondaryInsights.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: secondaryInsights.length === 1 ? '1fr' : 'repeat(2, 1fr)', gap: '16px', marginTop: '16px' }}>
                    {secondaryInsights.map(insight => {
                        const colors = getInsightColor(insight.type);
                        return (
                            <div
                                key={insight.id}
                                onClick={() => onOpenChat ? onOpenChat() : navigate('/warhead')}
                                className={glassClass}
                                style={{
                                    padding: '20px',
                                    borderRadius: '18px',
                                    border: `1px solid ${colors.border}`,
                                    background: colors.bg,
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = `0 8px 24px ${colors.bg}`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: colors.bg,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        {getInsightIcon(insight.type)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{
                                            fontSize: '15px',
                                            fontWeight: '700',
                                            color: '#fff',
                                            marginBottom: '6px',
                                            letterSpacing: '-0.01em'
                                        }}>
                                            {insight.title}
                                        </h4>
                                        <p style={{
                                            fontSize: '13px',
                                            color: 'rgba(255,255,255,0.6)',
                                            lineHeight: '1.5',
                                            marginBottom: 0
                                        }}>
                                            {insight.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default EnhancedWarheadInsights;
