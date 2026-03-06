const languageConfig = {
    'cantonese': {
        locale: 'zh-HK',
        voices: ['Sin-ji', 'Siri', 'Ting-Ting', 'Yuk-Chi'],
        engine: 'google'
    },
    'arabic': {
        locale: 'ar-AE',
        voices: ['Maged', 'Laila', 'Siri', 'Tarik'],
        engine: 'google'
    },
    'ukrainian': {
        locale: 'uk-UA',
        voices: ['Lesya', 'Siri'],
        engine: 'google'
    },
    'russian': {
        locale: 'ru-RU',
        voices: ['Milena', 'Siri', 'Yuri'],
        engine: 'google'
    },
    'spanish': {
        locale: 'es-ES',
        voices: ['Siri', 'Monica', 'Jorge'],
        engine: 'local'
    },
    'english': {
        locale: 'en-US',
        voices: ['Siri', 'Samantha', 'Alex'],
        engine: 'murf',
        murfVoiceId: 'en-US-marcus'
    }
};

const MURF_API_KEY = 'ap2_a5942948-570c-424a-9b04-8ee565ab826b';

const playMurfAudio = async (text, voiceId) => {
    try {
        const response = await fetch('https://api.murf.ai/v1/speech/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': MURF_API_KEY
            },
            body: JSON.stringify({
                text: text,
                voiceId: voiceId,
                format: 'MP3'
            })
        });
        const data = await response.json();
        if (data.encodedAudio) {
            const audio = new Audio(`data:audio/mp3;base64,${data.encodedAudio}`);
            audio.play();
            return true;
        }
        return false;
    } catch (e) {
        console.error("Murf API Error:", e);
        return false;
    }
};

export const speak = (text, langContext = null) => {
    if (!text) return;

    // 1. SPECIALIZED ROUTING (Context Priority)
    let targetLang = 'english';
    const ctx = (langContext || '').toLowerCase();

    // Primary Filter: Area/Skill Context
    if (ctx.includes('ukrainian')) targetLang = 'ukrainian';
    else if (ctx.includes('russian')) targetLang = 'russian';
    else if (ctx.includes('cantonese') || ctx.includes('hong kong')) targetLang = 'cantonese';
    else if (ctx.includes('arabic') || ctx.includes('emirati') || ctx.includes('gulf')) targetLang = 'arabic';
    else if (ctx.includes('spanish')) targetLang = 'spanish';
    else {
        // Secondary Filter: Deep Phonetic Heuristics (for transliteration)
        const lowerText = text.toLowerCase();
        const hasSlavicTriggers = /shch|vza|iy|ovych|enko|ivka|iyt|yty/.test(lowerText);

        if (/[\u0400-\u04FF]/.test(text) || hasSlavicTriggers) {
            targetLang = ctx.includes('ukr') ? 'ukrainian' : 'russian';
        } else if (/[\u4e00-\u9fa5]/.test(text)) targetLang = 'cantonese';
        else if (/[\u0600-\u06FF]/.test(text)) targetLang = 'arabic';
    }

    console.log(`[TTS ROUTING] Language: ${targetLang.toUpperCase()} | Context: "${langContext}"`);

    const config = languageConfig[targetLang];

    // 2. Specialized Engine Selection
    if (config.engine === 'murf') {
        const audioText = text.replace(/\(.*\)/g, '').trim();
        console.log(`[TTS ENGINE] Using Premium Murf.ai Engine for ${targetLang}`);
        playMurfAudio(audioText, config.murfVoiceId).then(success => {
            if (!success) {
                console.warn("[TTS ENGINE] Murf failed, falling back to Local");
                performLocalSpeak(text, targetLang);
            }
        });
    } else if (config.engine === 'google') {
        // Strip parentheticals (like Jyutping or English notes) for the actual audio
        const audioText = text.replace(/\(.*\)/g, '').trim();
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(audioText)}&tl=${config.locale}&client=tw-ob`;

        console.log(`[TTS ENGINE] Using High-Fidelity Google Engine for ${targetLang}`);
        const audio = new Audio(url);
        audio.play().catch(e => {
            console.warn(`[TTS ENGINE] Google failed for ${targetLang}, falling back to Local`, e);
            performLocalSpeak(text, targetLang);
        });
    } else {
        console.log(`[TTS ENGINE] Using Local Native Engine for ${targetLang}`);
        performLocalSpeak(text, targetLang);
    }
};

const performLocalSpeak = (text, lang) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // 1. Clean text (remove Jyutping or English notes in parens)
    const audioText = text.replace(/\(.*\)/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(audioText);
    const voices = window.speechSynthesis.getVoices();
    const config = languageConfig[lang] || languageConfig['english'];

    // 2. STICKY VOICE MATCHING
    // First priority: Exact locale match + Name match
    let selectedVoice = voices.find(v => {
        const vLang = v.lang.replace('_', '-').toLowerCase();
        const matchesLocale = vLang === config.locale.toLowerCase();
        const matchesName = config.voices.some(name => v.name.toLowerCase().includes(name.toLowerCase()));
        return matchesLocale && matchesName;
    });

    // Second priority: Just locale match
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.replace('_', '-').toLowerCase() === config.locale.toLowerCase());
    }

    // Third priority: Name match across locales
    if (!selectedVoice) {
        selectedVoice = voices.find(v => config.voices.some(name => v.name.toLowerCase().includes(name.toLowerCase())));
    }

    if (selectedVoice) {
        console.log(`[TTS LOCAL] SUCCESS: Using ${selectedVoice.name} (${selectedVoice.lang}) for ${lang}`);
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    } else {
        console.warn(`[TTS LOCAL] WARNING: No native voice found for ${lang}, forcing locale ${config.locale}`);
        utterance.lang = config.locale;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
};
