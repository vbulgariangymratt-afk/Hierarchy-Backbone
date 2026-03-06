import React, { useState } from 'react';
import { RefreshCw, CheckCircle, Volume2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { speak } from '../utils/tts';

const FlashcardReview = ({ dueCards, onFinish }) => {
    const { reviewCard } = useStore();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    if (dueCards.length === 0 || isFinished) {
        return (
            <div className="liquid-glass flashcard-complete" style={{ textAlign: 'center', padding: '80px 40px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CheckCircle size={64} color="#10b981" style={{ marginBottom: '24px', opacity: 0.9, filter: 'drop-shadow(0 0 20px rgba(16,185,129,0.3))' }} />
                <h2 style={{ fontSize: '32px', marginBottom: '12px', fontWeight: '800', color: 'var(--color-text-main)' }}>Session Complete!</h2>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '40px', fontSize: '15px' }}>You've reviewed all contextual phrases for today. Mastery is a journey!</p>
                <button
                    onClick={onFinish}
                    style={{
                        padding: '16px 40px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #d4a373, #b08968)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        cursor: 'pointer',
                        boxShadow: '0 10px 30px rgba(212,163,115,0.2)',
                        transition: 'transform 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    Return to Islands
                </button>
            </div>
        );
    }

    const currentCard = dueCards[currentIndex];

    const handleRating = (rating) => {
        const habitId = currentCard.sourceType === 'island' ? currentCard.sourceId : null;
        const folderId = currentCard.sourceType === 'folder' ? currentCard.sourceId : null;

        reviewCard(habitId, currentCard.id, rating, folderId);
        if (currentIndex < dueCards.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsFlipped(false);
            setShowHint(false);
        } else {
            setIsFinished(true);
        }
    };

    const highlightWord = (sentence, target) => {
        if (!sentence || !target) return sentence;

        const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const content = sentence.includes('**') ? sentence : sentence.replace(new RegExp(`(${escapedTarget})`, 'gi'), '**$1**');
        const parts = content.split('**');

        return parts.map((part, i) => (
            i % 2 === 1 ? (
                <span key={i} style={{ color: '#c39a6b', fontWeight: '900', textShadow: '0 0 15px rgba(195, 154, 107, 0.3)' }}>
                    {part}
                </span>
            ) : part
        ));
    };

    const progress = ((currentIndex) / dueCards.length) * 100;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            {/* Progress Bar */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.3s ease' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                <span>Reviewing: {currentCard.sourceName}</span>
                <span>{currentIndex + 1} / {dueCards.length}</span>
            </div>

            {/* The Card */}
            <div
                className="flashcard-container"
                onClick={() => setIsFlipped(!isFlipped)}
                style={{
                    height: '380px',
                    borderRadius: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    perspective: '1000px',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    transformStyle: 'preserve-3d',
                    padding: '40px',
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'transparent',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.1)'
                }}
            >
                <div style={{ width: '100%' }}>
                    {isFlipped ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                                <p style={{ opacity: 0.7, fontSize: '11px', marginBottom: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Meaning (English)</p>
                                <div style={{ fontSize: '32px', fontWeight: '800' }}>{currentCard.back}</div>
                            </div>
                            {currentCard.example && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px', textAlign: 'center' }}>
                                    <p style={{ opacity: 0.6, fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase' }}>Target Translation</p>
                                    <div style={{ fontSize: '14px', opacity: 0.8 }}>{currentCard.exampleTranslation}</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                            {currentCard.example ? (
                                <>
                                    <div style={{ fontSize: '28px', fontWeight: '600', lineHeight: '1.4', color: 'var(--color-text-main)' }}>
                                        {highlightWord(currentCard.example, currentCard.front)}
                                    </div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px', letterSpacing: '0.05em', textTransform: 'uppercase', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                                        Recall the word: <span style={{ fontWeight: 'bold', color: 'var(--color-text-main)' }}>{currentCard.front}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Target Phrase</p>
                                    <div style={{ padding: '0 40px', fontSize: '36px', fontWeight: '900', color: 'var(--color-text-main)' }}>{currentCard.front}</div>
                                </>
                            )}

                            {showHint && currentCard.exampleTranslation && (
                                <div className="flashcard-hint" style={{ marginTop: '10px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase' }}>Translation Hint</p>
                                    <div style={{ fontSize: '15px', color: 'var(--color-text-secondary)' }}>{currentCard.exampleTranslation}</div>
                                </div>
                            )}

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Find parent area for better context
                                    const cardHabit = Object.values(state.habits || {}).find(h => (h.cards || []).some(c => c.id === currentCard.id));
                                    const parentArea = Object.values(state.areas || {}).find(a =>
                                        (cardHabit && (a.skillIds || []).includes(cardHabit.skillId)) ||
                                        (cardHabit && (a.habitIds || []).includes(cardHabit.id)) ||
                                        (folderId && (a.skillIds || []).includes(state.flashcardFolders[folderId]?.skillId))
                                    );
                                    speak(currentCard.audioOverride || currentCard.example || currentCard.front, parentArea?.name || currentCard.sourceName);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '-40px',
                                    right: '0',
                                    background: 'rgba(195, 154, 107, 0.1)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '44px',
                                    height: '44px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#c39a6b',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <Volume2 size={24} />
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', opacity: 0.3, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={14} /> Click to flip
                </div>
            </div>

            {/* Controls */}
            {isFlipped ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', height: '90px' }}>
                    <button
                        onClick={() => handleRating('forgot')}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '24px', color: '#f87171', cursor: 'pointer', transition: 'all 0.2s', opacity: 0.8 }}
                    >
                        <span style={{ fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Forgot</span>
                        <span style={{ fontSize: '10px', opacity: 0.5 }}>Level 0</span>
                    </button>
                    <button
                        onClick={() => handleRating('hard')}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '24px', color: '#fbbf24', cursor: 'pointer', transition: 'all 0.2s', opacity: 0.8 }}
                    >
                        <span style={{ fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hard</span>
                        <span style={{ fontSize: '10px', opacity: 0.5 }}>Stay</span>
                    </button>
                    <button
                        onClick={() => handleRating('good')}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(195, 154, 107, 0.08)', border: '1px solid rgba(195, 154, 107, 0.15)', borderRadius: '24px', color: '#c39a6b', cursor: 'pointer', transition: 'all 0.2s', opacity: 0.8 }}
                    >
                        <span style={{ fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Good</span>
                        <span style={{ fontSize: '10px', opacity: 0.5 }}>Next Lv</span>
                    </button>
                    <button
                        onClick={() => handleRating('easy')}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '24px', color: '#34d399', cursor: 'pointer', transition: 'all 0.2s', opacity: 0.8 }}
                    >
                        <span style={{ fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Easy</span>
                        <span style={{ fontSize: '10px', opacity: 0.5 }}>Advance</span>
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '16px' }}>
                    <button
                        className="flashcard-button"
                        onClick={() => setIsFlipped(true)}
                        style={{
                            flex: 2,
                            height: '90px',
                            borderRadius: '24px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--color-text-main)',
                            fontWeight: '800',
                            fontSize: '18px',
                            cursor: 'pointer',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            backdropFilter: 'blur(10px)',
                            transition: 'all 0.3s'
                        }}
                    >
                        Reveal Answer
                    </button>
                    {!showHint && currentCard.example && (
                        <button
                            className="flashcard-button"
                            onClick={() => setShowHint(true)}
                            style={{
                                flex: 1,
                                height: '90px',
                                borderRadius: '24px',
                                background: 'rgba(195, 154, 107, 0.05)',
                                border: '1px solid rgba(195, 154, 107, 0.2)',
                                color: '#c39a6b',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.3s'
                            }}
                        >
                            Show Hint
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default FlashcardReview;
