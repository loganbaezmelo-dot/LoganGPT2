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
    
    const personaInstruction = systemPrompt && systemPrompt.trim() 
      ? systemPrompt.trim() 
      : "You are LoganGPT, an enterprise AI workspace.";

    const combinedSystemPrompt = `${personaInstruction}\n\nSTRICT OUTPUT REQUIREMENT:\nDo not print analysis, outlines, user echo, or metadata. Output ONLY the direct final chat response to the user.\n\n${timeContext}`;

    let rawContents = messages.map(m => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content || '' }]
    })).filter(c => c.parts[0].text.trim() !== '');

    const sanitizedContents = [];
    for (const msg of rawContents) {
      if (sanitizedContents.length > 0 && sanitizedContents[sanitizedContents.length - 1].role === msg.role) {
        sanitizedContents[sanitizedContents.length - 1].parts[0].text += `\n${msg.parts[0].text}`;
      } else {
        sanitizedContents.push({ role: msg.role, parts: [{ text: msg.parts[0].text }] });
      }
    }

    if (sanitizedContents.length === 0) {
      sanitizedContents.push({ role: 'user', parts: [{ text: 'Hi' }] });
    }

    let replyText = '';
    let lastError = null;
    let successfulModel = null;

    for (const currentModel of modelLadder) {
      try {
        console.log(`[LoganGPT API] Trying ${provider.toUpperCase()} model: ${currentModel}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        if (provider === 'google') {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
          
          const isStandardGemini = currentModel.startsWith('gemini');
          const payload = {
            systemInstruction: {
              parts: [{ text: combinedSystemPrompt }]
            },
            contents: sanitizedContents,
            generationConfig: {
              temperature: 0.7,
              topP: 0.95,
              maxOutputTokens: 2048,
              thinkingConfig: {
                thinkingBudget: 0 // Disables internal reasoning/planning leaks in Flash output
              }
            },
            ...(isStandardGemini ? { tools: [{ google_search: {} }] } : {})
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
          }

          // Strip any accidental thought prefixes if returned in parts
          const parts = data.candidates?.[0]?.content?.parts || [];
          const textParts = parts.filter(p => !p.thought).map(p => p.text);
          replyText = textParts.join('').trim() || parts.map(p => p.text).join('').trim();

          if (replyText) {
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
              messages: formattedMessages,
              temperature: 0.7
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          
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
        const errorMsg = err.name === 'AbortError' ? 'Request timed out after 25s' : err.message;
        console.warn(`[LoganGPT API] Model ${currentModel} failed: ${errorMsg}. Trying next model...`);
        lastError = errorMsg;
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
