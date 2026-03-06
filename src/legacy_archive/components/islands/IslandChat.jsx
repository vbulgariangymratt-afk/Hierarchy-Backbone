import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Check, Volume2, Loader2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { callOpenRouter } from '../../services/openrouter';
import { speak } from '../../utils/tts';
import { getTodayString } from '../../utils/dateUtils';

const IslandChat = ({ habit, onSaveCard, onSaveChat }) => {
    const { state } = useStore();

    const getAdjustedToday = () => getTodayString();

    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const endRef = useRef(null);

    // Initialize/Reset Logic
    useEffect(() => {
        const today = getAdjustedToday();
        if (habit.chatHistory && habit.chatLastUpdated === today) {
            setMessages(habit.chatHistory);
        } else {
            const initial = [
                {
                    id: 1,
                    text: `I'm Warhead, your tactical language tutor. I'm here to help you master the "${habit.name}" context. Tell me what you want to say in English, and I'll translate it into your target language.`,
                    sender: 'ai'
                }
            ];
            setMessages(initial);
            if (onSaveChat) onSaveChat(initial, today);
        }
    }, [habit.id]); // Re-run if habit changes

    // Correctly find the parent Area by traversing Habit -> Skill -> Area
    const getParentArea = () => {
        const sId = habit.skillId || (habit.skillIds && habit.skillIds[0]);
        const skill = sId ? state.skills[sId] : Object.values(state.skills || {}).find(s => (s.habitIds || []).includes(habit.id));
        if (skill && skill.areaId) {
            return state.areas[skill.areaId];
        }
        return null;
    };

    const parentArea = getParentArea();

    const handleSpeak = (text, audioOverride) => {
        // Force the Area name as context so the speaker knows the target language
        speak(audioOverride || text, parentArea?.name || habit.name);
    };

    const scrollToBottom = () => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    const handleSend = async () => {
        if (!inputValue.trim() || isThinking) return;

        const today = getAdjustedToday();
        const userMsg = { id: Date.now(), text: inputValue, sender: 'user' };
        const withUser = [...messages, userMsg];
        setMessages(withUser);
        if (onSaveChat) onSaveChat(withUser, today);

        const query = inputValue;
        setInputValue('');
        setIsThinking(true);

        try {
            // Robust Language Detection
            let targetLang = 'your target language';
            const sId = habit.skillId || (habit.skillIds && habit.skillIds[0]);
            const skill = sId ? state.skills[sId] : Object.values(state.skills || {}).find(s => (s.habitIds || []).includes(habit.id));

            if (skill) {
                const area = skill.areaId ? state.areas[skill.areaId] : null;
                const skillName = skill.name.toLowerCase();
                const areaName = area ? area.name.toLowerCase() : '';
                const hName = habit.name.toLowerCase();

                if (skillName.includes('ukr') || areaName.includes('ukr') || hName.includes('ukr')) targetLang = 'Ukrainian';
                else if (skillName.includes('rus') || areaName.includes('rus') || hName.includes('rus')) targetLang = 'Russian';
                else if (skillName.includes('can') || areaName.includes('can') || hName.includes('can') || hName.includes('hong')) targetLang = 'Cantonese';
                else if (skillName.includes('ara') || areaName.includes('ara') || hName.includes('ara') || hName.includes('emi')) targetLang = 'Arabic';
                else if (skillName.includes('spa') || areaName.includes('spa') || hName.includes('spa')) targetLang = 'Spanish';
                else if (area) targetLang = area.name;
            }

            const isCantonese = targetLang.toLowerCase().includes('can') || habit.name.toLowerCase().includes('hong');
            const isArabic = targetLang.toLowerCase().includes('ara') || targetLang.toLowerCase().includes('emi');
            const isSlavic = targetLang.toLowerCase().includes('ukr') || targetLang.toLowerCase().includes('rus');

            const systemContext = `
                You are Warhead, a tactical language tutor.
                TARGET LANGUAGE: ${targetLang}
                CONTEXT: "${habit.name}".
                
                STRICT DIRECTIVE: YOU MUST RETURN ONLY A VALID JSON OBJECT. 
                NO PREAMBLE. NO "INCOMING TRANSMISSION". NO CONVERSATIONAL TEXT OUTSIDE THE JSON.
                
                REVERSE MODE: If the user provides a word/phrase in ${targetLang}, you MUST:
                1. Put that word in the "phrase" field.
                2. Put the English meaning in the "translation" field.
                3. Provide the explanation and example as usual.

                EXAMPLE CORRECT RESPONSE (User says "избегать"):
                {
                    "explanation": "A common verb for avoiding something.",
                    "phrase": "избегать",
                    "translation": "to avoid / to evade",
                    "example": "Я стараюсь избегать конфликтов.",
                    "exampleTranslation": "I try to avoid conflicts."
                }

                ${isCantonese ? `CANTONESE RULE: YOU MUST: 1. Include Jyutping romanization in parentheses for ALL Cantonese text in "phrase" and "example" (e.g., "你好 (nei5 hou2)"). 2. Provide an "audioOverride" field containing ONLY the Chinese characters (no Jyutping or parentheses).` : ''}
                
                ${isArabic ? `ARABIC DIALECT RULE: YOU MUST provide an "audioOverride" field in ARABIC SCRIPT. 
                RULES: 1. Feminine 'K' -> 'T-Sh' (تش) (e.g. "حالچ" -> "حالتش"). 2. Use sukun (ْ) to stop MSA 'a' endings. 3. DO NOT change Kh (خ) or H (ح).` : ''}
                
                ${isSlavic ? `SLAVIC RULE: YOU MUST USE ONLY NATIVE CYRILLIC CHARACTERS for "phrase" and "example". DO NOT PROVIDE TRANSLITERATION. (e.g., use "Привіт" never "Pryvit").` : ''}
                
                JSON SCHEMA:
                {
                    "explanation": "Context about the word choice.",
                    "phrase": "Native Script (Include Jyutping if Cantonese)",
                    "audioOverride": "Clean version for TTS.",
                    "translation": "English translation.",
                    "example": "Native Script (Include Jyutping if Cantonese)",
                    "exampleTranslation": "English translation of example."
                }
            `;

            // Pass full history (withUser) and NO extra query (null) because query is effectively the last message in withUser
            const rawResponse = await callOpenRouter(state.apiKey, systemContext, withUser, null);

            let parsed;
            try {
                const firstBracket = rawResponse.indexOf('{');
                const lastBracket = rawResponse.lastIndexOf('}');

                if (firstBracket !== -1 && lastBracket !== -1) {
                    const jsonStr = rawResponse.substring(firstBracket, lastBracket + 1);
                    parsed = JSON.parse(jsonStr);
                } else {
                    throw new Error("No JSON found");
                }
            } catch (e) {
                // INTELLIGENT FALLBACK: If AI just talked, we harvest the text
                const cleanText = rawResponse.replace(/```json|```|{|}/g, '').trim();

                // Try to find common patterns for "meaning" or "translation"
                const meaningRegex = /(?:means|meaning|translation|to)\s*[:\s]*["']?([^.\n"']+)["']?/i;
                const transMatch = rawResponse.match(meaningRegex);

                // If it's a Slavic word or has non-ascii, it's likely the phrase
                const hasNonAscii = /[^\x00-\x7F]/.test(query);

                parsed = {
                    explanation: cleanText.length > 200 ? cleanText.substring(0, 200) + "..." : cleanText,
                    phrase: hasNonAscii ? query : "Analysis Pending",
                    translation: transMatch ? transMatch[1].trim() : "See Response Below",
                    example: "",
                    exampleTranslation: ""
                };

                // If the whole response is short, just use it as the translation
                if (!transMatch && cleanText.length < 50) {
                    parsed.translation = cleanText;
                }
            }

            const aiMsg = {
                id: Date.now() + 1,
                text: parsed.explanation || `In your target language, a natural way to say that in the context of "${habit.name}" is:`,
                phrase: parsed.phrase,
                audioOverride: parsed.audioOverride,
                translation: parsed.translation,
                example: parsed.example,
                exampleTranslation: parsed.exampleTranslation,
                sender: 'ai',
                isFlashcardOption: true
            };

            const withAI = [...withUser, aiMsg];
            setMessages(withAI);
            if (onSaveChat) onSaveChat(withAI, today);

        } catch (error) {
            const errorMsg = { id: Date.now(), text: `Tactical Error: ${error.message}`, sender: 'ai' };
            const withError = [...withUser, errorMsg];
            setMessages(withError);
            if (onSaveChat) onSaveChat(withError, today);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px' }}>
                {messages.map(msg => (
                    <div key={msg.id} style={{
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        padding: '12px 16px',
                        borderRadius: msg.sender === 'user' ? '28px 28px 8px 28px' : '28px 28px 28px 8px',
                        background: msg.sender === 'user' ? 'rgba(212, 163, 115, 0.08)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '15px',
                        lineHeight: '1.7',
                        position: 'relative',
                        boxShadow: msg.sender === 'user' ? '0 10px 30px rgba(0,0,0,0.2)' : 'none',
                        color: msg.sender === 'user' ? '#fff' : 'rgba(255,255,255,0.8)',
                    }}>
                        {msg.text}
                        {msg.isFlashcardOption && (
                            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div>
                                        <div style={{ fontWeight: '800', color: '#c39a6b', fontSize: '16px', marginBottom: '2px' }}>{msg.phrase}</div>
                                        <div style={{ fontSize: '13px', opacity: 0.5, marginBottom: '8px' }}>{msg.translation}</div>
                                        {msg.example && (
                                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '8px' }}>
                                                <div style={{ fontSize: '14px', color: '#fff', fontStyle: 'italic' }}>"{msg.example}"</div>
                                                <div style={{ fontSize: '12px', opacity: 0.4 }}>{msg.exampleTranslation}</div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {msg.audioOverride && (habit.name.toLowerCase().includes('arabic') || habit.name.toLowerCase().includes('emirati') || habit.name.toLowerCase().includes('gulf')) && (
                                            <div title="This phrase is phonetically adjusted for Emirati pronunciation." style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(212, 163, 115, 0.15)', border: '1px solid rgba(212, 163, 115, 0.3)', color: '#c39a6b', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', height: 'fit-content' }}>
                                                Dialect Armor
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleSpeak(msg.phrase, msg.audioOverride)}
                                            style={{ background: 'rgba(212, 163, 115, 0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c39a6b', cursor: 'pointer' }}
                                        >
                                            <Volume2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        onSaveCard(msg.phrase, msg.translation, msg.example, msg.exampleTranslation, msg.audioOverride);
                                        const updated = messages.map(m => m.id === msg.id ? { ...m, saved: true } : m);
                                        setMessages(updated);
                                        if (onSaveChat) onSaveChat(updated, getAdjustedToday());
                                    }}
                                    disabled={msg.saved}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '12px',
                                        background: msg.saved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(212, 163, 115, 0.1)',
                                        color: msg.saved ? '#34d399' : '#c39a6b',
                                        border: msg.saved ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(212, 163, 115, 0.2)',
                                        cursor: msg.saved ? 'default' : 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {msg.saved ? <><Check size={14} /> Recorded</> : <><Plus size={14} /> Add to Phrasebook</>}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {isThinking && (
                    <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '28px 28px 28px 8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                        <Loader2 size={14} className="spin" />
                        Analyzing context...
                    </div>
                )}
                <div ref={endRef} />
            </div>

            <div style={{ display: 'flex', gap: '15px', padding: '12px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)' }}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Message Warhead..."
                    style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        outline: 'none',
                        fontSize: '15px',
                        fontWeight: '500'
                    }}
                />
                <button
                    onClick={handleSend}
                    style={{
                        background: 'linear-gradient(135deg, #d4a373, #b08968)',
                        border: 'none',
                        borderRadius: '16px',
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white',
                        boxShadow: '0 8px 20px rgba(212, 163, 115, 0.3)',
                        transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <Send size={22} />
                </button>
            </div>
        </div>
    );
};

export default IslandChat;
