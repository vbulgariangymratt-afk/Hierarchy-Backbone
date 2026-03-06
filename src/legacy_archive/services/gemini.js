/**
 * Service for interacting with Google's Gemini API.
 * Uses the API key stored in the user's local state.
 */

// Gemini 1.5 Flash is ideal: Free tier, massive context window (2M tokens), fast.
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export const callGemini = async (apiKey, systemContext, userHistory, userQuery) => {
    try {
        if (!apiKey) throw new Error("No API Key provided");

        const prompt = {
            contents: [
                {
                    role: "user",
                    parts: [{
                        text: `
SYSTEM CONTEXT:
${systemContext}

USER DATA HISTORY (Time-Series):
${JSON.stringify(userHistory)}

CURRENT USER QUERY:
${userQuery}

INSTRUCTIONS:
You are Warhead, an advanced AI behavioral analyst.
1. Analyze the provided USER DATA HISTORY to find patterns, correlations, and insights relevant to the query.
2. Be direct, professional, yet slightly intense/military in tone (your persona is "Warhead").
3. Use the data to back up your claims. Quote specific dates or stats if possible.
4. Keep the response concise but insightful.
                        `
                    }]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
            }
        };

        const response = await fetch(`${API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(prompt)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("No response content from Gemini");

        return text;

    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
};
