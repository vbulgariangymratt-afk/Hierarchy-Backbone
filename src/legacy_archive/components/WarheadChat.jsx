import { useState, useRef, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Send, Sparkles, MessageSquare, X, Bot, AlertTriangle, Lightbulb, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAIAnalyst } from '../hooks/useAIAnalyst';
import { useStore } from '../context/StoreContext';
import { getBeliefsAnalysisContext, suggestEventCorrelations, analyzeNaturalnessProgress } from '../utils/beliefAnalysis';
import { callOpenRouter } from '../services/openrouter';
import { flattenState } from '../services/dataAggregator';
import { Settings, Loader2 } from 'lucide-react';

// Helper for simple markdown (bold only)
const parseMarkdown = (text) => {
    if (!text) return text;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} style={{ color: '#fff', fontWeight: '700' }}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

const ChatContent = ({ messages, inputValue, setInputValue, handleSend, mode, setIsOpen, endRef, insights, isThinking, thinkingMessage, showSettings, setShowSettings, apiKey, tempKey, setTempKey, saveKey, onRefresh }) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
            padding: '12px 16px',
            // borderBottom: '1px solid rgba(255,255,255,0.1)', // Removed border for cleaner look
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            // background: 'rgba(255, 255, 255, 0.03)', // Removed background to blend with main glass
            // backdropFilter: 'blur(10px)' // Removed secondary blur
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f0f0f0, #a0a0a0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 15px rgba(255, 255, 255, 0.1)'
                }}>
                    <Sparkles size={16} color="#333" />
                </div>
                <span style={{ fontWeight: '600', fontSize: '15px', color: '#fff' }}>Warhead</span>
                <span style={{
                    fontSize: '11px',
                    color: isThinking ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                    marginLeft: '8px',
                    fontWeight: '400',
                    animation: isThinking ? 'pulse 1.5s infinite' : 'none'
                }}>
                    {isThinking ? 'Thinking...' : 'Ready'}
                </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                    onClick={onRefresh}
                    title="Start Fresh Session (Clears Chat)"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
                >
                    <RefreshCw size={18} />
                </button>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
                >
                    <Settings size={18} />
                </button>
                {mode === 'floating' && (
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
                    >
                        <X size={24} />
                    </button>
                )}
            </div>
        </div>

        {/* Settings View */}
        {showSettings ? (
            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                <h3 style={{ color: 'white', fontSize: '16px' }}>Warhead Brain Settings</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: '1.4' }}>
                    Connect OpenRouter AI (DeepSeek V3.1 Terminus) to enable deep pattern analysis of your journal, habits, and tasks.
                    Your key is stored locally on this device.
                </p>
                <div>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '6px' }}>OpenRouter API Key</label>
                    <input
                        type="password"
                        value={tempKey}
                        onChange={(e) => setTempKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        style={{
                            width: '100%',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '10px',
                            borderRadius: '6px',
                            color: 'white',
                            fontSize: '13px'
                        }}
                    />
                </div>



                <button
                    onClick={() => { saveKey(); setShowSettings(false); }}
                    style={{
                        padding: '10px',
                        background: 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    Save & Activate
                </button>
                {apiKey && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4ade80', fontSize: '12px' }}>
                        <CheckCircle2 size={12} /> AI Active
                    </div>
                )}
            </div>
        ) : (
            <>
                {/* Messages */}
                <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {messages.map(msg => (
                        <div key={msg.id} style={{
                            alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            padding: '10px 14px',
                            borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            background: msg.sender === 'user' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255,255,255,0.05)',
                            border: msg.sender === 'user' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255,255,255,0.08)',
                            color: msg.sender === 'user' ? '#fff' : 'rgba(255,255,255,0.9)',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap' // Preserves line breaks and spaces
                        }}>

                            {msg.isInsight && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: msg.type === 'warning' ? '#fde047' : msg.type === 'success' ? '#4ade80' : '#fca5a5' }}>
                                    {msg.type === 'warning' && <AlertTriangle size={14} />}
                                    {msg.type === 'success' && <CheckCircle2 size={14} />}
                                    {(!msg.type || msg.type === 'suggestion') && <Lightbulb size={14} />}
                                    <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase' }}>{msg.title}</span>
                                </div>
                            )}
                            {parseMarkdown(msg.text)}

                            {/* Render Flashcard Option if present */}
                            {msg.isFlashcardOption && (
                                <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ fontWeight: '800', color: '#c39a6b', marginBottom: '4px' }}>{msg.phrase}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '8px' }}>{msg.translation}</div>
                                    <button
                                        onClick={() => handleSend(null, null, { type: 'SAVE_FLASHCARD', payload: msg })}
                                        className="hover-bright"
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            background: 'rgba(212, 163, 115, 0.2)',
                                            color: '#c39a6b',
                                            border: '1px solid rgba(212, 163, 115, 0.3)',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                    >
                                        <Bot size={14} /> Add to Phrasebook
                                    </button>
                                </div>
                            )}

                            {msg.question && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontStyle: 'italic', color: '#94a3b8' }}>
                                    {msg.question}
                                </div>
                            )}
                        </div>
                    ))}
                    {isThinking && (
                        <div style={{
                            alignSelf: 'flex-start',
                            maxWidth: '85%',
                            padding: '10px 14px',
                            borderRadius: '12px 12px 12px 2px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                            <Loader2 size={14} className="spin" />
                            <Loader2 size={14} className="spin" />
                            <span>{thinkingMessage || 'Analyzing user data...'}</span>
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                {/* Quick Insights Bar (Optional) */}
                {insights.length > 0 && messages.length < 5 && (
                    <div style={{ padding: '8px 16px', display: 'flex', gap: '8px', overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        {insights.map(insight => (
                            <button
                                key={insight.id}
                                onClick={() => handleSend(null, insight)}
                                style={{
                                    whiteSpace: 'nowrap',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer'
                                }}
                            >
                                {insight.title}
                            </button>
                        ))}
                    </div>
                )}
            </>
        )}

        {/* Input */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Talk to Warhead..."
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: 'white',
                        fontSize: '13px',
                        outline: 'none',
                    }}
                />
                <button
                    onClick={() => handleSend()}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        width: '36px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#fff'
                    }}
                >
                    <Send size={14} />
                </button>
            </div>
        </div>
    </div>
);

const WarheadChat = ({ mode = 'floating', isOpen: externalIsOpen, onOpenChange }) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);

    // Use external isOpen if provided (controlled), otherwise use internal state (uncontrolled)
    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
    const setIsOpen = onOpenChange || setInternalIsOpen;
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab');
    const insights = useAIAnalyst();



    const { state, setApiKey, dispatch } = useStore(); // Need dispatch for actions
    const [isThinking, setIsThinking] = useState(false);
    const [thinkingMessage, setThinkingMessage] = useState('Analyzing user data...');
    const [showSettings, setShowSettings] = useState(false);
    const [tempKey, setTempKey] = useState('');
    const [dimensions, setDimensions] = useState({ width: 400, height: 600 });
    const isResizing = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const startDims = useRef({ width: 0, height: 0 });

    // Resize Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing.current) return;
            setDimensions(prev => ({
                width: Math.max(300, Math.min(800, prev.width + e.movementX)),
                height: Math.max(400, Math.min(900, prev.height - e.movementY)) // Pull up to grow
            }));
        };
        const handleMouseUp = () => { isResizing.current = false; };

        if (isOpen) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isOpen]);

    useEffect(() => {
        if (state.apiKey) setTempKey(state.apiKey);
    }, [state.apiKey]);

    // --- SESSION & PERSISTENCE ---
    const activeSessionId = state.activeSessionId;
    const currentSession = activeSessionId ? state.chatSessions[activeSessionId] : null;

    // Use global messages or fallback to empty array (will init on open)
    const messages = currentSession?.messages || [];

    // Auto-create session if none exists when opening or first load
    useEffect(() => {
        if (!activeSessionId && isOpen) {
            const newId = Date.now().toString();
            dispatch({
                type: 'CREATE_CHAT_SESSION',
                payload: {
                    id: newId,
                    title: 'New Operation',
                    initialMessage: { id: 1, text: "I'm Warhead. I now have long-term memory. What's the mission?", sender: 'ai' }
                }
            });
        }
    }, [activeSessionId, isOpen, dispatch]);

    // Add top insight as a proactive message when chat opens or insights change
    // Modified: Only add if session has just started (length 1) and we haven't already added an insight
    // Add top insight as a proactive message when chat opens or insights change
    // Modified: Only add if session has just started (length 1) and we haven't already added an insight
    useEffect(() => {
        if (insights.length > 0 && messages.length === 1 && activeSessionId) {
            const topInsight = insights[0];
            const potentialId = 'proactive-' + topInsight.id;

            // Check if we already have this specific insight message to prevent duplicates
            const alreadyExists = messages.some(m => m.id === potentialId);
            if (alreadyExists) return;

            const insightMsg = {
                id: potentialId,
                text: topInsight.description,
                sender: 'ai',
                isInsight: true,
                type: topInsight.type,
                title: topInsight.title,
                question: topInsight.question
            };
            dispatch({ type: 'ADD_MESSAGE_TO_SESSION', payload: { sessionId: activeSessionId, message: insightMsg } });
        }
    }, [insights, messages, activeSessionId, dispatch]);

    const [inputValue, setInputValue] = useState('');
    const endRef = useRef(null);

    const scrollToBottom = () => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    };



    // Resize Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing.current) return;

            setDimensions(prev => {
                const deltaX = startPos.current.x - e.clientX;
                const deltaY = startPos.current.y - e.clientY;

                const newDims = { ...prev };
                const dir = isResizing.current;

                if (dir === 'nw' || dir === 'w') {
                    newDims.width = Math.max(320, Math.min(1000, startDims.current.width + deltaX));
                }
                if (dir === 'nw' || dir === 'n') {
                    newDims.height = Math.max(400, Math.min(1000, startDims.current.height + deltaY));
                }
                return newDims;
            });
        };
        const handleMouseUp = () => { isResizing.current = false; };

        if (isOpen) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isOpen]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (text = null, insight = null, localAction = null) => {
        // Handle Local Actions (like "Add to Flashcard")
        if (localAction) {
            if (localAction.type === 'SAVE_FLASHCARD') {
                const msg = localAction.payload;
                // Try to find a target folder
                // Heuristic: Check if there's a folder matching the language, or just pick the first one with "Language" skill
                // For now, let's implement a simple "Add to most recent or first available folder" logic
                // Or better, just trigger the same action as in the modal.
                // Since this is main chat, we might not have a "current folder".
                // Let's search for a folder that matches the target language.

                // For simplicity in this iteration: Add to the first folder found for that language, or just the first folder overall.
                const folders = Object.values(state.flashcardFolders || {});
                if (folders.length > 0) {
                    // In a real app we might want a folder picker. Here we'll just grab the first one to be "magic".
                    const targetFolder = folders[0];

                    const newCard = {
                        id: crypto.randomUUID(),
                        front: msg.phrase,
                        back: msg.translation,
                        audioOverride: msg.audioOverride || '',
                        example: msg.example || '',
                        exampleTranslation: msg.exampleTranslation || '',
                        level: 0,
                        easeFactor: 2.5,
                        interval: 0,
                        nextReview: new Date().toISOString(),
                        createdAt: new Date().toISOString()
                    };

                    const updatedCards = [newCard, ...(targetFolder.cards || [])];
                    dispatch({
                        type: 'UPDATE_FLASHCARD_FOLDER',
                        payload: { id: targetFolder.id, updates: { cards: updatedCards } }
                    });

                    // Update UI to show saved
                    // We can't easily update the message state in place without a re-render/fetch pattern, 
                    // but we can dispatch a "SYSTEM MESSAGE" to confirm.
                    const confirmMsg = { id: Date.now(), text: `Saved "${msg.phrase}" to ${targetFolder.name}.`, sender: 'system', isInsight: true, type: 'success', title: 'Saved' };
                    if (activeSessionId) {
                        dispatch({ type: 'ADD_MESSAGE_TO_SESSION', payload: { sessionId: activeSessionId, message: confirmMsg } });
                    }
                }
            }
            return;
        }

        const value = text || inputValue;
        if (!value.trim() && !insight) return;

        if (value.trim()) {
            const userMsg = { id: Date.now(), text: value, sender: 'user' };
            // setMessages(prev => [...prev, userMsg]); // Removed local
            if (activeSessionId) {
                dispatch({ type: 'ADD_MESSAGE_TO_SESSION', payload: { sessionId: activeSessionId, message: userMsg } });
            }
            setInputValue('');

            // GEMINI or RULE-BASED LOGIC
            if (state.apiKey) {
                // USE GENUINE AI
                setIsThinking(true);
                try {
                    // ---------------------------------------------------------
                    // 1. INTENT DETECTION & INSTRUCTION SWITCHING
                    // ---------------------------------------------------------
                    const lowerVal = value.toLowerCase();
                    const isNonEnglish = /[^\x00-\x7F]/.test(value);
                    const isWordRequest = value.split(' ').length <= 4;
                    const isTutorIntent = isNonEnglish ||
                        isWordRequest ||
                        lowerVal.includes('translate') ||
                        lowerVal.includes('translation') ||
                        lowerVal.includes('say in') ||
                        lowerVal.includes('meaning of') ||
                        lowerVal.includes('flashcard') ||
                        lowerVal.includes('phrase for') ||
                        lowerVal.includes('how do you say') ||
                        lowerVal.includes('what is');

                    let systemContext = '';
                    let tempThinkingMsg = 'Analyzing...';
                    let sendHistory = [];

                    // ---------------------------------------------------------
                    // 2. LOGICAL DAY RESET (Context Window Cleaning)
                    // ---------------------------------------------------------
                    // Filter messages to only include those from the current "Logical Day" (post 4am)
                    // This keeps the context window clean while preserving long-term memory in other ways.
                    const getLogicalDate = (date) => {
                        const d = new Date(date);
                        d.setHours(d.getHours() - 4);
                        return d.toISOString().split('T')[0];
                    };
                    const currentLogicalDate = getLogicalDate(new Date());

                    // We also include the LAST 20 messages regardless of day, to keep immediate flow?
                    // No, strict reset requested. "reset every day at 4am".
                    // But we must include the message we just added! (which isn't in 'messages' var yet due to closure)
                    // So we take current 'messages', filter them, AND append current userMsg.

                    const relevantHistory = messages.filter(m => {
                        // If message doesn't have a timestamp, assume it's old/invalid or rely on ID if timestamp-like
                        // Our IDs are Date.now(), so we can use them.
                        const time = m.createdAt ? new Date(m.createdAt) : new Date(parseInt(m.id)); // Fallback to ID timestamp
                        return getLogicalDate(time) === currentLogicalDate;
                    });

                    // Add the new message to history passed to AI
                    sendHistory = [...relevantHistory, userMsg];

                    if (isTutorIntent) {
                        // --- TUTOR MODE ---
                        tempThinkingMsg = 'Consulting Language Matrix...';
                        setThinkingMessage(tempThinkingMsg);

                        systemContext = `
                            You are Warhead, a tactical language tutor.
                            
                            DYNAMIC MODE:
                            1. If the user asks for a TRANSLATION, specific KEYWORD, or provides a foreign word, return a JSON object for a flashcard.
                            2. If the user asks "WHY", "HOW", or for an EXPLANATION, reply in conversational text (but keep it concise).
                            3. You can Mix both: Provide a short explanation AND a flashcard JSON if appropriate.

                            JSON SCHEMA (Use ONLY for specific phrase/word requests):
                            {
                                "phrase": "Target Phrase (Native Script)",
                                "translation": "English Meaning",
                                "example": "Context Sentence (Native)",
                                "exampleTranslation": "Context Sentence (English)",
                                "audioOverride": "Phonetic override if needed (e.g. Arabic dialect)",
                                "response": "Optional chatty response to accompany the flashcard"
                            }
                            
                            IMPORTANT: If the user provides a word in another language, your "phrase" should be that word, and "translation" should be the English meaning.
                            Do not output chatty preamble before the JSON if you are only returning JSON.
                        `;
                    } else {
                        // --- ANALYST MODE ---
                        tempThinkingMsg = 'Accessing Behavioral Database...';
                        setThinkingMessage(tempThinkingMsg);

                        const anchorDate = new Date('2026-01-01T00:00:00');
                        const todayDate = new Date();
                        const diffDays = Math.floor((todayDate - anchorDate) / (1000 * 60 * 60 * 24));
                        const cycleDay = ((diffDays % 3) + 3) % 3; // Ensure positive
                        const dayTypes = ['work1', 'work2', 'light'];
                        const currentDayType = dayTypes[cycleDay];

                        // DYNAMIC CONTEXT LOADING
                        const analysisKeywords = ['pattern', 'trend', 'analy', 'history', 'past', 'week', 'month', 'correlat', 'stat', 'summary', 'report', 'why', 'review', 'insight'];
                        const needsDeepContext = analysisKeywords.some(k => lowerVal.includes(k));

                        let finalContextData = {};

                        if (needsDeepContext) {
                            setThinkingMessage("Deep Scan: Analyzing 30-day history...");
                            const userHistory = flattenState(state).slice(-30);
                            const wealthContext = Object.values(state.wealthItems || {}).map(i => `${i.name} ($${i.monthlyPayment}/mo)`);
                            const timeBlockContext = Object.values(state.timeBlocks || {}).map(tb => `${tb.title} (${tb.scheduledDate} ${tb.startTime})`);
                            finalContextData = {
                                mode: "DEEP_DEEP_ANALYSIS",
                                dailyLogs: userHistory,
                                recurringExpenses: wealthContext,
                                timeBlocks: timeBlockContext
                            };
                        } else {
                            // Operational Context (Light)
                            const todayLog = flattenState(state).slice(-1);
                            finalContextData = {
                                mode: "OPERATIONAL",
                                currentStatus: {
                                    activeTasks: Object.values(state.tasks || {}).filter(t => !t.isCompleted).map(t => t.title),
                                    todayLog: todayLog[0] || {}
                                }
                            };
                        }

                        systemContext = `
                            You are Warhead, an elite behavioral analyst.
                            
                            USER CONTEXT DATA:
                            ${JSON.stringify(finalContextData)}

                            CURRENT DATE: ${new Date().toLocaleDateString()} (${currentDayType.toUpperCase()})
                            
                            LONG-TERM MEMORY:
                            ${(state.warheadMemory || []).join('\n')}

                            INSTRUCTIONS:
                            1. Analyze the USER CONTEXT DATA to answer the query.
                            2. TONE: "Ruthless Intelligence, Chill Delivery".
                            3. FORMAT: Return VALID JSON ONLY.
                            
                            JSON SCHEMA:
                            {
                                "thought": "Internal reasoning.",
                                "response": "Conversational reply.",
                                "actions": [ 
                                    { "type": "ADD_TASK", "payload": {...} },
                                    { "type": "ADJUST_TASK_TIME", "payload": { "taskId": "...", "stopTimeStr": "ISO_STRING or HH:mm" } }
                                ]
                            }

                            Note: If the user seems to be asking for a translation instead of behavioral analysis, you can also return the FLASHCARD JSON SCHEMA instead:
                            {
                                "phrase": "...",
                                "translation": "...",
                                "example": "...",
                                "exampleTranslation": "...",
                                "response": "..."
                            }

                            Note: If the user says they stopped a task earlier, use ADJUST_TASK_TIME.
                        `;
                    }

                    // ---------------------------------------------------------
                    // 3. CALL AI
                    // ---------------------------------------------------------
                    // Note: We pass [] as the 4th arg (userQuery) because we already appended it to sendHistory
                    const rawResponse = await callOpenRouter(state.apiKey, systemContext, sendHistory, null);

                    let responseText = rawResponse;
                    let thoughtText = null;
                    let actionsToRun = [];
                    let flashcardData = null;

                    // ---------------------------------------------------------
                    // 4. RESPONSE PARSING
                    // ---------------------------------------------------------
                    try {
                        let cleanJson = rawResponse.trim();

                        // Resilient JSON extraction
                        const firstOpen = cleanJson.indexOf('{');
                        const lastClose = cleanJson.lastIndexOf('}');

                        if (firstOpen !== -1 && lastClose !== -1) {
                            cleanJson = cleanJson.substring(firstOpen, lastClose + 1);
                            const parsed = JSON.parse(cleanJson);

                            // Helper to detect if it's a flashcard
                            if (parsed.phrase && parsed.translation) {
                                flashcardData = parsed;
                                // If there's also an "explanation" or "response" field, use it as text. 
                                // Otherwise, use a default text.
                                responseText = parsed.response || parsed.explanation || "Transmission received. Flashcard compiled.";
                            }
                            // Analyst format
                            else if (parsed.response) {
                                responseText = parsed.response;
                                if (parsed.thought) thoughtText = parsed.thought;
                                if (parsed.actions) actionsToRun = parsed.actions;
                            }
                        }
                    } catch (e) {
                        // Fallback: Use raw response if it's not JSON (likely just chatty Tutor)
                        responseText = rawResponse;
                    }


                    if (activeSessionId) {
                        const aiMsg = {
                            id: Date.now() + 1,
                            text: responseText,
                            thought: thoughtText,
                            sender: 'ai',
                            // Attach flashcard data if present
                            isFlashcardOption: !!flashcardData,
                            phrase: flashcardData?.phrase,
                            translation: flashcardData?.translation,
                            example: flashcardData?.example,
                            exampleTranslation: flashcardData?.exampleTranslation,
                            audioOverride: flashcardData?.audioOverride
                        };
                        dispatch({ type: 'ADD_MESSAGE_TO_SESSION', payload: { sessionId: activeSessionId, message: aiMsg } });
                    }

                    // Execute Actions (Analyst Mode)
                    if (actionsToRun && actionsToRun.length > 0) {
                        actionsToRun.forEach(action => {
                            if (action.type === 'ADD_TASK') {
                                // Find a default objective in the target area
                                const targetAreaId = action.payload.areaId || Object.keys(state.areas)[0];
                                const areaObjectives = Object.values(state.objectives).filter(obj => {
                                    const skill = state.skills[obj.skillId];
                                    return skill && skill.areaId === targetAreaId;
                                });

                                const targetObjectiveId = areaObjectives[0]?.id;
                                if (targetObjectiveId) {
                                    dispatch({
                                        type: 'ADD_TASK',
                                        payload: {
                                            id: crypto.randomUUID(),
                                            objectiveId: targetObjectiveId,
                                            title: action.payload.title,
                                            scheduledDate: action.payload.scheduledDate,
                                            startTime: action.payload.startTime,
                                            duration: action.payload.duration
                                        }
                                    });
                                }
                            } else if (action.type === 'ADD_HABIT') {
                                // Find a default skill in the target area
                                const targetAreaId = action.payload.areaId || Object.keys(state.areas)[0];
                                const areaSkills = Object.values(state.skills).filter(s => s.areaId === targetAreaId);
                                const targetSkillId = areaSkills[0]?.id; // Fallback to first skill or undefined

                                if (targetSkillId) {
                                    dispatch({
                                        type: 'ADD_HABIT',
                                        payload: {
                                            id: crypto.randomUUID(),
                                            skillIds: [targetSkillId],
                                            name: action.payload.name,
                                            category: 'integrating',
                                            targetDailyCount: action.payload.targetDailyCount || 1
                                        }
                                    });
                                }
                            } else if (action.type === 'ADD_TIME_BLOCK') {
                                const targetAreaId = action.payload.areaId || Object.keys(state.areas)[0];
                                dispatch({
                                    type: 'ADD_TIME_BLOCK',
                                    payload: {
                                        id: crypto.randomUUID(),
                                        areaId: targetAreaId,
                                        title: action.payload.title
                                    }
                                });
                            } else if (action.type === 'SCHEDULE_TASK') {
                                dispatch({
                                    type: 'UPDATE_TASK',
                                    payload: {
                                        id: action.payload.id,
                                        updates: {
                                            scheduledDate: action.payload.dateStr,
                                            startTime: action.payload.timeStr,
                                            duration: action.payload.duration || 60
                                        }
                                    }
                                });
                            } else if (action.type === 'SCHEDULE_TIME_BLOCK') {
                                dispatch({
                                    type: 'UPDATE_TIME_BLOCK',
                                    payload: {
                                        id: action.payload.id,
                                        updates: {
                                            scheduledDate: action.payload.dateStr,
                                            startTime: action.payload.timeStr,
                                            duration: action.payload.duration || 120
                                        }
                                    }
                                });
                            } else if (action.type === 'UPDATE_ROUTINE_TEMPLATE') {
                                dispatch({
                                    type: 'UPDATE_ROUTINE_TEMPLATE',
                                    payload: {
                                        dayType: action.payload.dayType,
                                        blocks: action.payload.blocks
                                    }
                                });
                            } else if (action.type === 'SAVE_MEMORY') {
                                dispatch({ type: 'ADD_WARHEAD_MEMORY', payload: action.payload });
                            } else if (action.type === 'ADJUST_TASK_TIME') {
                                // If stopTimeStr is HH:mm, convert to full ISO for today
                                let stopTime = action.payload.stopTimeStr;
                                if (stopTime.match(/^\d{1,2}:\d{2}$/)) {
                                    const now = new Date();
                                    const [h, m] = stopTime.split(':');
                                    now.setHours(parseInt(h), parseInt(m), 0, 0);
                                    stopTime = now.toISOString();
                                }
                                dispatch({
                                    type: 'ADJUST_TASK_TIME',
                                    payload: { taskId: action.payload.taskId, stopTimeStr: stopTime }
                                });
                            }
                        });
                        if (responseText) {
                            // responseText += `\n\n[SYSTEM: Executed ${actionsToRun.length} command(s)]`; 
                            // Don't append to text, just done.
                        }
                    }

                    // REMOVED DUPLICATE DISPATCH
                } catch (error) {
                    console.error("Warhead Chat Error:", error);
                    const errorMsg = { id: Date.now() + 1, text: `Error: ${error.message}`, sender: 'ai', type: 'warning' };
                    // setMessages(prev => [...prev, errorMsg]);
                    if (activeSessionId) {
                        dispatch({ type: 'ADD_MESSAGE_TO_SESSION', payload: { sessionId: activeSessionId, message: errorMsg } });
                    }
                } finally {
                    setIsThinking(false);
                }

            } else {
                // FALLBACK TO RULES (Original Code)
                setTimeout(() => {
                    let responseText = "I've noted that. I'm still learning your patterns, but I'll factor this info into my next analysis.";

                    const lowerValue = value.toLowerCase();

                    // Belief correlation queries
                    if (lowerValue.includes('belief') || lowerValue.includes('manifestation') || lowerValue.includes('correlation')) {
                        const beliefContext = getBeliefsAnalysisContext(state);
                        if (beliefContext.includes('No beliefs')) {
                            responseText = "You haven't started tracking any beliefs yet. Head to the Beliefs tracker to begin logging your SATS sessions and manifestation work.";
                        } else {
                            const beliefs = Object.values(state.beliefs || {});
                            if (beliefs.length > 0) {
                                const topBelief = beliefs[0];
                                const analysis = analyzeNaturalnessProgress(topBelief);
                                responseText = `I'm tracking ${beliefs.length} belief${beliefs.length > 1 ? 's' : ''}. Your naturalness ratings range from ${analysis.average}/10 on average. The trend is ${analysis.trend}. Keep logging your SATS sessions daily so I can correlate your belief work with unusual events in your journal.`;
                            }
                        }
                    } else if (lowerValue.includes('unusual event') || lowerValue.includes('synchronicity') || lowerValue.includes('bridge')) {
                        const allEvents = [];
                        Object.entries(state.journal || {}).forEach(([date, entry]) => {
                            if (entry.unusualEvents && entry.unusualEvents.length > 0) {
                                entry.unusualEvents.forEach(event => {
                                    allEvents.push({ date, description: event.description });
                                });
                            }
                        });

                        if (allEvents.length === 0) {
                            responseText = "You haven't logged any unusual events in your journal yet. When synchronicities or manifestations happen, log them there and I'll automatically analyze which beliefs might be correlated.";
                        } else {
                            const latest = allEvents[allEvents.length - 1];
                            const correlations = suggestEventCorrelations(latest.date, latest.description, state.beliefs || {});

                            if (correlations.length > 0) {
                                const match = correlations[0];
                                const lgMap = {
                                    'detached': 'completely detached',
                                    'letting-go': 'letting go',
                                    'slight-obsession': 'slightly obsessed',
                                    'very-obsessed': 'very obsessed'
                                };
                                const lgStatus = lgMap[match.latestSession.lettingGoStatus] || 'in an unknown state';
                                const daysText = match.latestSession.daysAgo === 0 ? 'Same day' : `${match.latestSession.daysAgo} day${match.latestSession.daysAgo > 1 ? 's' : ''} earlier`;

                                responseText = `I noticed a pattern: "${latest.description}" (${latest.date}) might correlate with your belief "${match.beliefStatement}". ${daysText}, you had a session with naturalness ${match.latestSession.naturalness}/10 while ${lgStatus}. This timing suggests a possible connection.`;
                            } else {
                                responseText = `You've logged ${allEvents.length} unusual event${allEvents.length > 1 ? 's' : ''}. I'm analyzing patterns between your belief work and these manifestations. Log more SATS sessions to improve correlation accuracy.`;
                            }
                        }
                    } else if (lowerValue.includes('help') || lowerValue.includes('insight')) {
                        responseText = insights.length > 0
                            ? `I currently have ${insights.length} insights for you. The most important one is about ${insights[0].title}.`
                            : "I'm still gathering data to find meaningful patterns. Keep logging!";
                    }

                    const aiMsg = { id: Date.now() + 1, text: responseText, sender: 'ai' };
                    setMessages(prev => [...prev, aiMsg]);
                }, 800);
            } // End else
        } else if (insight) {
            const insightMsg = {
                id: Date.now(),
                text: insight.description,
                sender: 'ai',
                isInsight: true,
                type: insight.type,
                title: insight.title,
                question: insight.question
            };
            setMessages(prev => [...prev, insightMsg]);
        }
    };



    const handleRefresh = () => {
        const newId = Date.now().toString();
        dispatch({
            type: 'CREATE_CHAT_SESSION',
            payload: {
                id: newId,
                title: 'Operation ' + new Date().toLocaleTimeString(),
                initialMessage: {
                    id: 1,
                    text: "Tactical Refresh initiated. Previous chat archived. Ready for new orders.",
                    sender: 'ai'
                }
            }
        });
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: newId });
    };

    const chatProps = {
        messages, inputValue, setInputValue, handleSend, mode, setIsOpen, endRef, insights,
        isThinking, showSettings, setShowSettings, apiKey: state.apiKey, tempKey, setTempKey,
        saveKey: () => setApiKey(tempKey),
        onRefresh: handleRefresh
    };

    // Floating Mode Logic
    if (mode === 'floating') {
        if (location.pathname === '/warhead' || activeTab === 'warhead') return null;

        return (

            <div
                onClick={() => !isOpen && setIsOpen(true)}
                className="liquid-glass"
                style={{
                    position: 'fixed',
                    // Morphing Coordinates
                    bottom: '24px', // Anchored to bottom
                    right: '24px',
                    width: isOpen ? `${dimensions.width}px` : '48px',
                    height: isOpen ? `${dimensions.height}px` : '48px',
                    borderRadius: isOpen ? '16px' : '50%',

                    // Visuals
                    zIndex: 9999,
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: isOpen ? '0 20px 40px rgba(0,0,0,0.4)' : '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
                    background: isOpen ? 'rgba(30, 30, 30, 0.2)' : 'rgba(212, 163, 115, 0.2)', // Lighter glass
                    overflow: 'hidden',
                    cursor: isOpen ? 'default' : 'pointer',

                    // The Magic Transition
                    transition: isResizing.current ? 'none' : 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
                }}
            >
                {/* 1. CLOSED STATE CONTENT (The Sparkle Icon) */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: isOpen ? 0 : 1,
                    transform: isOpen ? 'scale(0.5)' : 'scale(1)',
                    transition: 'all 0.4s ease',
                    pointerEvents: 'none', // Never blocks clicks
                    color: '#e7d7c1'
                }}>
                    <Sparkles size={24} />
                </div>

                {/* 2. OPEN STATE CONTENT (The Chat) */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    opacity: isOpen ? 1 : 0,
                    // transform: isOpen ? 'scale(1)' : 'scale(1.1)', // Subtle zoom in effect
                    transition: 'opacity 0.4s ease 0.1s', // Slight delay to let box expand first
                    pointerEvents: isOpen ? 'auto' : 'none',
                    display: 'flex', flexDirection: 'column'
                }}>
                    {/* Resize Handles (Only active when open) */}
                    {isOpen && (
                        <>
                            <div
                                onMouseDown={(e) => {
                                    isResizing.current = 'nw';
                                    startPos.current = { x: e.clientX, y: e.clientY };
                                    startDims.current = { width: dimensions.width, height: dimensions.height };
                                    e.preventDefault();
                                    e.stopPropagation(); // Prevent ensuring click doesn't bubble if needed
                                }}
                                style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', cursor: 'nw-resize', zIndex: 10001 }}
                            />
                            <div
                                onMouseDown={(e) => {
                                    isResizing.current = 'n';
                                    startPos.current = { x: e.clientX, y: e.clientY };
                                    startDims.current = { width: dimensions.width, height: dimensions.height };
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                style={{ position: 'absolute', top: 0, left: '20px', right: 0, height: '10px', cursor: 'n-resize', zIndex: 10000 }}
                            />
                            <div
                                onMouseDown={(e) => {
                                    isResizing.current = 'w';
                                    startPos.current = { x: e.clientX, y: e.clientY };
                                    startDims.current = { width: dimensions.width, height: dimensions.height };
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                style={{ position: 'absolute', top: '20px', bottom: 0, left: 0, width: '10px', cursor: 'w-resize', zIndex: 10000 }}
                            />
                        </>
                    )}

                    <ChatContent {...chatProps} />
                </div>
            </div>
        );
    }

    // Embedded Mode Logic
    return (
        <div className="liquid-glass" style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '300px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.05)',
            overflow: 'hidden'
        }}>
            <ChatContent {...chatProps} />
        </div>
    );
};

export default WarheadChat;
