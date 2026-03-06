/**
 * Service for interacting with OpenRouter API.
 * Uses the API key stored in the user's local state.
 */

const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

export const callOpenRouter = async (apiKey, systemContext, messages = [], userQuery = null) => {
    try {
        if (!apiKey) throw new Error("No API Key provided");

        const trimmedKey = apiKey ? apiKey.trim() : '';

        // Construct the full message chain
        const apiMessages = [
            {
                role: "system",
                content: systemContext
            },
            ...messages.map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.text || JSON.stringify(m) // Fallback for complex objects if any
            }))
        ];

        // Add the new user query if provided (it might be already in messages, but this supports the old signature style too)
        if (userQuery) {
            apiMessages.push({
                role: "user",
                content: userQuery
            });
        }

        const requestBody = {
            model: MODEL,
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 8192
        };

        console.log("DeepSeek Request Payload:", JSON.stringify(requestBody, null, 2));

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${trimmedKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("OpenRouter API Error Response:", response.status, JSON.stringify(errorData, null, 2));
            throw new Error(errorData.error?.message || JSON.stringify(errorData) || `API Error: ${response.status}`);
        }

        const data = await response.json();
        console.log("OpenRouter Raw Response:", data);

        const text = data.choices?.[0]?.message?.content;

        if (!text) throw new Error(`No response content from OpenRouter. Raw data: ${JSON.stringify(data)}`);

        return text;

    } catch (error) {
        console.error("OpenRouter API Error:", error);
        throw error;
    }
};
