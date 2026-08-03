export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider, apiKey, messages = [], systemPrompt, userTimeZone } = req.body || {};

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required.' });
    }

    // 🧗 GOOGLE & OPENAI MODEL FALLBACK LADDERS
    const GEMINI_LADDER = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
      'gemma-2-27b-it',
      'gemma-2-9b-it'
    ];

    const OPENAI_LADDER = [
      'gpt-5.6-luna',
      'gpt-5.5-instant',
      'gpt-4o-mini',
      'gpt-4o'
    ];

    const modelLadder = provider === 'google' ? GEMINI_LADDER : OPENAI_LADDER;
    const targetTimeZone = userTimeZone || 'America/New_York';

    let formattedTimeStr = '';
    try {
      const now = new Date();
      formattedTimeStr = now.toLocaleString('en-US', {
        timeZone: targetTimeZone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      formattedTimeStr = new Date().toISOString();
    }

    const timeContext = `[CURRENT REAL-WORLD DATE AND TIME]: ${formattedTimeStr} (${targetTimeZone}). You MUST use this real-time clock whenever asked for current date, time, year, or temporal context.`;
    const combinedSystemPrompt = systemPrompt ? `${systemPrompt}\n\n${timeContext}` : timeContext;

    let replyText = '';
    let lastError = null;
    let successfulModel = null;

    // --- 🔄 FALLBACK LADDER EXECUTION ---
    for (const currentModel of modelLadder) {
      try {
        console.log(`[LoganGPT API] Trying ${provider.toUpperCase()} model: ${currentModel}`);

        if (provider === 'google') {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
          
          const contents = messages.map(m => ({
            role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.content || '' }]
          }));

          const payload = {
            systemInstruction: {
              parts: [{ text: combinedSystemPrompt }]
            },
            contents: contents,
            // Only add search grounding for standard Gemini models (Gemma models don't support google_search tool)
            ...(currentModel.startsWith('gemini') ? { tools: [{ google_search: {} }] } : {})
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
          }

          replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
          successfulModel = currentModel;
          break; // Success! Exit loop

        } else {
          // OpenAI Execution
          const endpoint = 'https://api.openai.com/v1/chat/completions';
          
          const formattedMessages = [
            { role: 'system', content: combinedSystemPrompt },
            ...messages
          ];

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: currentModel,
              messages: formattedMessages
            })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
          }

          replyText = data.choices?.[0]?.message?.content || 'No response generated.';
          successfulModel = currentModel;
          break; // Success! Exit loop
        }

      } catch (err) {
        console.warn(`[LoganGPT API] Model ${currentModel} failed: ${err.message}. Trying next model...`);
        lastError = err.message;
      }
    }

    if (!successfulModel) {
      return res.status(500).json({ 
        error: `All models in ${provider.toUpperCase()} fallback ladder failed. Last error: ${lastError}` 
      });
    }

    return res.status(200).json({ reply: replyText, usedModel: successfulModel });

  } catch (err) {
    console.error("API Route Execution Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
