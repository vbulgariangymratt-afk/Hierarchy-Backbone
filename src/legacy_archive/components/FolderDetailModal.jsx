import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Folder, Sparkles, Loader2, MessageSquare, BookOpen } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import IslandChat from './islands/IslandChat';
import { callOpenRouter } from '../services/openrouter';

const FolderDetailModal = ({ folder, onClose }) => {
    const { state, dispatch } = useStore();
    const [name, setName] = useState(folder.name);
    const [cards, setCards] = useState(folder.cards || []);
    const [activeTab, setActiveTab] = useState('notes'); // 'notes' (Chat) or 'cards' (Phrasebook)
    const [loadingIds, setLoadingIds] = useState({});
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);

    const handleSave = () => {
        dispatch({
            type: 'UPDATE_FLASHCARD_FOLDER',
            payload: { id: folder.id, updates: { name, cards } }
        });
        onClose();
    };

    const addFlashcardFromChat = (front, back, example, exampleTranslation, audioOverride) => {
        const newCard = {
            id: crypto.randomUUID(),
            front,
            back,
            audioOverride: audioOverride || '',
            example: example || '',
            exampleTranslation: exampleTranslation || '',
            level: 0,
            easeFactor: 2.5,
            interval: 0,
            nextReview: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        const updatedCards = [newCard, ...cards];
        setCards(updatedCards);

        // Auto-save to global store immediately
        dispatch({
            type: 'UPDATE_FLASHCARD_FOLDER',
            payload: { id: folder.id, updates: { name, cards: updatedCards } }
        });
    };

    const generateAIDetail = async (id, phrase) => {
        if (!phrase.trim()) return;
        setLoadingIds(prev => ({ ...prev, [id]: true }));

        try {
            const parentArea = Object.values(state.areas || {}).find(a => (a.skillIds || []).includes(folder.skillId));
            const skill = state.skills[folder.skillId];

            let targetLang = parentArea ? parentArea.name : 'your target language';
            const skillName = skill ? skill.name.toLowerCase() : '';
            const areaName = parentArea ? parentArea.name.toLowerCase() : '';
            const fName = folder.name.toLowerCase();

            if (skillName.includes('ukr') || areaName.includes('ukr') || fName.includes('ukr')) targetLang = 'Ukrainian';
            else if (skillName.includes('rus') || areaName.includes('rus') || fName.includes('rus')) targetLang = 'Russian';
            else if (skillName.includes('can') || areaName.includes('can') || fName.includes('hk') || fName.includes('hong')) targetLang = 'Cantonese';
            else if (skillName.includes('ara') || areaName.includes('ara') || fName.includes('ara') || fName.includes('emi')) targetLang = 'Arabic';

            const isCantonese = targetLang.toLowerCase().includes('can') || folder.name.toLowerCase().includes('hong');
            const isArabic = targetLang.toLowerCase().includes('ara') || targetLang.toLowerCase().includes('emi');
            const isSlavic = targetLang.toLowerCase().includes('ukr') || targetLang.toLowerCase().includes('rus');

            const systemContext = `
                You are Warhead, a context-focused language expert.
                TARGET LANGUAGE: ${targetLang}
                
                STRICT DIRECTIVE: YOU MUST RETURN ONLY A VALID JSON OBJECT. 
                NO PREAMBLE. NO CONVERSATIONAL TEXT.
                
                ${isCantonese ? `CANTONESE RULE: YOU MUST include Jyutping romanization in parentheses for ALL Cantonese text in "example" (e.g., "你好 (nei5 hou2)"). 2. Provide an "audioOverride" with ONLY Chinese characters.` : ''}
                
                ${isArabic ? `ARABIC DIALECT RULE: YOU MUST provide an "audioOverride" field in ARABIC SCRIPT. 
                RULES: 1. Feminine 'K' -> 'T-Sh' (تش) (e.g. "حالچ" -> "حالتش"). 2. Use sukun (ْ) to stop MSA 'a' endings. 3. DO NOT change Kh (خ) or H (ح).` : ''}
                
                ${isSlavic ? `SLAVIC RULE: YOU MUST USE ONLY NATIVE CYRILLIC CHARACTERS for "example". DO NOT PROVIDE TRANSLITERATION. (e.g., use "Привіт" never "Pryvit").` : ''}
                
                JSON SCHEMA:
                {
                    "translation": "English translation of the input",
                    "audioOverride": "Optional. Clean version for TTS.",
                    "example": "Context sentence in NATIVE SCRIPT ONLY. RULES: 1. Word in MIDDLE. 2. Meaning OBVIOUS. 3. Wrap word in **double asterisks**. ${isCantonese ? '(Include Jyutping)' : ''}",
                    "exampleTranslation": "English translation of context sentence"
                }
            `;

            const rawResponse = await callOpenRouter(state.apiKey, systemContext, [], `Phrase: "${phrase}"`);

            let parsed;
            const firstBracket = rawResponse.indexOf('{');
            const lastBracket = rawResponse.lastIndexOf('}');

            if (firstBracket !== -1 && lastBracket !== -1) {
                const jsonStr = rawResponse.substring(firstBracket, lastBracket + 1);
                parsed = JSON.parse(jsonStr);
            } else {
                throw new Error("No JSON found");
            }

            const updatedCards = cards.map(c => c.id === id ? {
                ...c,
                back: parsed.translation,
                audioOverride: parsed.audioOverride,
                example: parsed.example,
                exampleTranslation: parsed.exampleTranslation
            } : c);

            setCards(updatedCards);
        } catch (error) {
            console.error("AI Error:", error);
        } finally {
            setLoadingIds(prev => ({ ...prev, [id]: false }));
        }
    };

    const generateAllWithAI = async () => {
        const missingCards = cards.filter(c => c.front.trim() && (!c.back || !c.example));
        if (missingCards.length === 0) return;

        setIsGeneratingAll(true);
        for (const card of missingCards) {
            await generateAIDetail(card.id, card.front);
        }
        setIsGeneratingAll(false);
    };

    const addCard = () => {
        const newCard = {
            id: crypto.randomUUID(),
            front: '',
            back: '',
            example: '',
            exampleTranslation: '',
            level: 0,
            easeFactor: 2.5,
            interval: 0,
            nextReview: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        setCards([newCard, ...cards]);
    };

    const updateCard = (id, field, value) => {
        setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const deleteCard = (id) => {
        const updatedCards = cards.filter(c => c.id !== id);
        setCards(updatedCards);
    };

    const handleSaveChat = (chatHistory, chatLastUpdated) => {
        dispatch({
            type: 'UPDATE_FLASHCARD_FOLDER',
            payload: { id: folder.id, updates: { chatHistory, chatLastUpdated } }
        });
    };

    const habitContext = {
        id: folder.id,
        name: folder.name,
        skillId: folder.skillId,
        chatHistory: folder.chatHistory,
        chatLastUpdated: folder.chatLastUpdated
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(15px) saturate(150%)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div className="liquid-glass" style={{
                width: '95%',
                maxWidth: '900px',
                height: '85vh',
                borderRadius: '40px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 50px 100px rgba(0,0,0,0.8), inset 0 0 40px rgba(255,255,255,0.02)',
                background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(30, 30, 30, 0.8))'
            }}>
                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#c39a6b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Folder size={20} color="white" />
                        </div>
                        <div>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', fontWeight: '800', outline: 'none' }}
                            />
                            <p style={{ fontSize: '13px', opacity: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Flashcard Folder</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        cursor: 'pointer',
                        width: '32px', height: '32px',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0.6,
                        transition: 'all 0.2s'
                    }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '40px', padding: '0 40px', borderBottom: '1px solid rgba(255,255,255,0.03)', background: 'rgba(255,255,255,0.02)' }}>
                    <button
                        onClick={() => setActiveTab('notes')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0',
                            background: 'none', border: 'none',
                            borderBottom: activeTab === 'notes' ? '2px solid #c39a6b' : '2px solid transparent',
                            color: activeTab === 'notes' ? '#fff' : 'rgba(255,255,255,0.4)',
                            cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                            textTransform: 'uppercase', letterSpacing: '0.1em',
                            textShadow: activeTab === 'notes' ? '0 0 20px rgba(212, 163, 115, 0.5)' : 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <MessageSquare size={16} /> Warhead Tutor
                    </button>
                    <button
                        onClick={() => setActiveTab('cards')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0',
                            background: 'none', border: 'none',
                            borderBottom: activeTab === 'cards' ? '2px solid #c39a6b' : '2px solid transparent',
                            color: activeTab === 'cards' ? '#fff' : 'rgba(255,255,255,0.4)',
                            cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                            textTransform: 'uppercase', letterSpacing: '0.1em',
                            textShadow: activeTab === 'cards' ? '0 0 20px rgba(212, 163, 115, 0.5)' : 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        Phrasebook ({cards.length})
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {activeTab === 'notes' ? (
                        <IslandChat habit={{ ...habitContext, skillId: folder.skillId }} onSaveCard={addFlashcardFromChat} onSaveChat={handleSaveChat} />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={addCard}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '16px',
                                        background: 'rgba(212, 163, 115, 0.1)',
                                        border: '1px dashed rgba(212, 163, 115, 0.3)',
                                        color: '#c39a6b',
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <Plus size={18} /> Add New Card
                                </button>
                                <button
                                    onClick={generateAllWithAI}
                                    disabled={isGeneratingAll || !cards.some(c => c.front.trim() && (!c.back || !c.example))}
                                    style={{
                                        padding: '12px 24px',
                                        borderRadius: '16px',
                                        background: 'linear-gradient(135deg, #c39a6b, #8b6b4a)',
                                        border: 'none',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        boxShadow: '0 8px 16px rgba(113, 89, 61, 0.2)',
                                        opacity: isGeneratingAll ? 0.7 : (!cards.some(c => c.front.trim() && (!c.back || !c.example)) ? 0.4 : 1)
                                    }}
                                >
                                    {isGeneratingAll ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
                                    {isGeneratingAll ? 'Warhead is processing...' : 'Generate All with Warhead'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {cards.map(card => (
                                    <div key={card.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div style={{ flex: 1, position: 'relative' }}>
                                                <div style={{ fontSize: '10px', opacity: 0.3, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '1px' }}>Front</div>
                                                <input
                                                    value={card.front}
                                                    onChange={(e) => updateCard(card.id, 'front', e.target.value)}
                                                    placeholder="Target language..."
                                                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '15px', fontWeight: '700' }}
                                                />
                                                {loadingIds[card.id] && (
                                                    <div style={{ position: 'absolute', right: '10px', top: '28px', color: '#c39a6b', display: 'flex', alignItems: 'center' }}>
                                                        <Loader2 size={16} className="spin" />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '10px', opacity: 0.3, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '1px' }}>Back</div>
                                                <input value={card.back} onChange={(e) => updateCard(card.id, 'back', e.target.value)} placeholder="English..." style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '15px' }} />
                                            </div>
                                            <button onClick={() => deleteCard(card.id)} style={{ alignSelf: 'flex-start', marginTop: '24px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#f87171', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '10px', opacity: 0.3, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '1px' }}>Context Sentence</div>
                                                <input value={card.example} onChange={(e) => updateCard(card.id, 'example', e.target.value)} placeholder="Example in target language..." style={{ width: '100%', background: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '6px 0', color: '#fff', fontSize: '13px', fontStyle: 'italic', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '10px', opacity: 0.3, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '1px' }}>Sentence Translation</div>
                                                <input value={card.exampleTranslation} onChange={(e) => updateCard(card.id, 'exampleTranslation', e.target.value)} placeholder="Translation..." style={{ width: '100%', background: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '6px 0', color: 'rgba(255,255,255,0.4)', fontSize: '13px', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }} />
                                            </div>
                                            <div style={{ width: '36px' }}></div>
                                        </div>
                                        {card.audioOverride && (
                                            <div style={{ background: 'rgba(212, 163, 115, 0.05)', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(212, 163, 115, 0.1)' }}>
                                                <div style={{ fontSize: '9px', opacity: 0.4, textTransform: 'uppercase', marginBottom: '2px' }}>Dialect Armor (Phonetic Override)</div>
                                                <input value={card.audioOverride} onChange={(e) => updateCard(card.id, 'audioOverride', e.target.value)} style={{ width: '100%', background: 'none', border: 'none', color: '#c39a6b', fontSize: '12px', outline: 'none' }} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '24px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', gap: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
                    <button onClick={onClose} style={{
                        padding: '10px 20px',
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '14px',
                        color: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                    }}>Cancel</button>
                    <button onClick={handleSave} style={{
                        padding: '10px 28px',
                        background: 'linear-gradient(135deg, #c39a6b, #8b6b4a)',
                        border: 'none',
                        borderRadius: '14px',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '14px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        boxShadow: '0 8px 16px rgba(113, 89, 61, 0.3)',
                        transition: 'all 0.2s'
                    }}>
                        <Save size={16} /> Save Folder
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FolderDetailModal;
