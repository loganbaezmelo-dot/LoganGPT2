export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider, apiKey, messages = [], systemPrompt, userTimeZone } = req.body || {};

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required.' });
    }

    const GEMINI_LADDER = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemma-4-31b-it',
      'gemma-4-26b-a4b-it'
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
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      formattedTimeStr = new Date().toISOString();
    }

    const timeContext = `[CURRENT REAL-WORLD DATE AND TIME]: ${formattedTimeStr} (${targetTimeZone}).`;
    
    const baseSystemInstruction = systemPrompt || "You are LoganGPT, an enterprise AI workspace.";
    const combinedSystemPrompt = `${baseSystemInstruction}\n\nCRITICAL DIRECTIVE: Never output internal thoughts, planning logs, analysis steps, or drafted outlines. Speak directly to the user.\n\n${timeContext}`;

    let replyText = '';
    let lastError = null;
    let successfulModel = null;

    for (const currentModel of modelLadder) {
      try {
        console.log(`[LoganGPT API] Trying ${provider.toUpperCase()} model: ${currentModel}`);

        if (provider === 'google') {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
          
          // Map user messages safely
          const contents = messages.map(m => ({
            role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.content || '' }]
          }));

          // If the last message is from the user, force a model prefix turn to block thinking blocks
          if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
            contents.push({
              role: 'model',
              parts: [{ text: "Hello!" }] // Prefills the response start to cut off internal reasoning
            });
          }

          const isStandardGemini = currentModel.startsWith('gemini');
          const payload = {
            systemInstruction: {
              parts: [{ text: combinedSystemPrompt }]
            },
            contents: contents,
            ...(isStandardGemini ? { tools: [{ google_search: {} }] } : {})
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

          const rawCandidate = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          // Prepend "Hello!" back if it was used as a prefill anchor
          replyText = rawCandidate.startsWith('Hello!') ? rawCandidate : `Hello! ${rawCandidate}`;
          
          if (replyText.trim()) {
            successfulModel = currentModel;
            break;
          }
        } else {
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

          replyText = data.choices?.[0]?.message?.content || '';
          if (replyText.trim()) {
            successfulModel = currentModel;
            break;
          }
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
