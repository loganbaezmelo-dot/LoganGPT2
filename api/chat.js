export const config = {
  maxDuration: 60, // Extends Vercel Serverless Function timeout
};

// Helper function to extract search keywords and query the Wikipedia REST API safely
async function fetchWikipediaContext(userText) {
  try {
    if (!userText || typeof userText !== 'string' || userText.trim().length < 3) return null;

    // Skip search entirely for app generation, game building, or code requests
    const lower = userText.toLowerCase();
    if (
      lower.includes('make an app') || 
      lower.includes('build a game') || 
      lower.includes('create a canvas') || 
      lower.includes('generate code') ||
      lower.includes('lines of code')
    ) {
      return null;
    }

    const stopWords = new Set([
      'what', 'is', 'a', 'the', 'how', 'about', 'tell', 'me', 'who', 'where',
      'when', 'why', 'can', 'you', 'give', 'information', 'on', 'about', 'for',
      'does', 'do', 'did', 'would', 'could', 'should', 'with', 'and', 'or', 'in', 
      'was', 'released', 'make', 'an', 'app', 'out', 'display', 'screen'
    ]);

    const sanitizedText = userText.replace(/[^\w\s]/gi, '');
    const words = sanitizedText ? sanitizedText.split(/\s+/) : [];
    const keywords = words.filter(w => w.length > 1 && !stopWords.has(w.toLowerCase())).join(' ');

    if (!keywords || keywords.trim().length === 0) return null;

    // Timeout signal for Wikipedia API (3 seconds max)
    const wikiController = new AbortController();
    const wikiTimeout = setTimeout(() => wikiController.abort(), 3000);

    // 1. Search Wikipedia for matching page titles
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keywords)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'LoganGPT/1.0 (https://logan-gpt.vercel.app)' },
      signal: wikiController.signal
    });

    if (!searchRes.ok) {
      clearTimeout(wikiTimeout);
      return null;
    }

    const searchData = await searchRes.json();
    const topResult = searchData.query?.search?.[0]?.title;

    if (!topResult) {
      clearTimeout(wikiTimeout);
      return null;
    }

    // 2. Fetch article summary
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topResult)}`;
    const summaryRes = await fetch(summaryUrl, {
      headers: { 'User-Agent': 'LoganGPT/1.0 (https://logan-gpt.vercel.app)' },
      signal: wikiController.signal
    });

    clearTimeout(wikiTimeout);

    if (!summaryRes.ok) return null;
    const summaryData = await summaryRes.json();

    if (summaryData.extract) {
      return `[WIKIPEDIA CONTEXT FOR '${topResult}']: ${summaryData.extract}`;
    }

    return null;
  } catch (err) {
    console.warn('[Wikipedia Search Bypassed]:', err.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider = 'google', apiKey, messages = [], systemPrompt, userTimeZone } = req.body || {};

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json({ error: 'API key is required.' });
    }

    const cleanKey = apiKey.trim();

    const GEMINI_LADDER = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    const OPENAI_LADDER = [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-3.5-turbo'
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

    // Limit active chat history to recent 10 messages
    const recentMessages = Array.isArray(messages) && messages.length > 10 
      ? messages.slice(-10) 
      : (Array.isArray(messages) ? messages : []);

    const lastUserMessageObj = recentMessages.slice().reverse().find(m => m.role === 'user');
    const lastUserText = typeof lastUserMessageObj?.content === 'string' ? lastUserMessageObj.content : '';

    const isPersonaActive = systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim().length > 0 && !systemPrompt.includes("enterprise AI workspace");

    let wikiContext = null;
    if (!isPersonaActive && lastUserText) {
      wikiContext = await fetchWikipediaContext(lastUserText);
    }

    const timeContext = `[CURRENT REAL-WORLD DATE AND TIME]: ${formattedTimeStr} (${targetTimeZone}).`;
    
    const personaInstruction = systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim() 
      ? systemPrompt.trim() 
      : "You are LoganGPT, an enterprise AI workspace.";

    const imageFormattingRules = `\n\nIMAGE GENERATION INSTRUCTIONS:\nWhen the user asks to generate, create, or draw an image, return ONLY a Markdown image tag using Pollinations AI with the high-quality Flux model params like this:\n![Generated Image](https://image.pollinations.ai/prompt/<URL_ENCODED_PROMPT_HERE>?model=flux&nologo=true)`;

    const elicitationRules = `\n\nSUGGESTION BUTTONS / ELICITATIONS:\nWhen offering logical next steps, options, or follow-up prompts to the user, you may optionally include an ElicitationsGroup block using this exact format:\n<ElicitationsGroup message="Where should we take this next?">\n  <Elicitation label="Option Label Here" query="Exact text to send when clicked" />\n  <Elicitation label="Another Option" query="Another exact prompt to send" />\n</ElicitationsGroup>`;

    const combinedSystemPrompt = `${personaInstruction}\n\nSTRICT BEHAVIOR RULES:\n1. Adopt the identity, tone, and character specified above.\n2. Output ONLY the direct in-character response to the user. Never print internal planning logs, analysis steps, or self-dialogue.${imageFormattingRules}${elicitationRules}\n\n${timeContext}${wikiContext ? `\n\n${wikiContext}` : ''}`;

    let rawContents = recentMessages.map(m => {
      const parts = [];
      if (m.content) parts.push({ text: String(m.content) });
      
      // Vision payload handling for base64 inline images
      if (m.image && typeof m.image === 'string' && m.image.includes(';base64,')) {
        const [meta, base64Data] = m.image.split(';base64,');
        const mimeType = meta.replace('data:', '') || 'image/png';
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data
          }
        });
      }

      return {
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: parts.length > 0 ? parts : [{ text: ' ' }]
      };
    }).filter(c => c.parts.length > 0);

    const sanitizedContents = [];
    for (const msg of rawContents) {
      if (sanitizedContents.length > 0 && sanitizedContents[sanitizedContents.length - 1].role === msg.role) {
        sanitizedContents[sanitizedContents.length - 1].parts.push(...msg.parts);
      } else {
        sanitizedContents.push(msg);
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
        const timeoutId = setTimeout(() => controller.abort(), 55000);

        if (provider === 'google') {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${cleanKey}`;

          const generationConfig = {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 2048
          };

          const payload = {
            systemInstruction: {
              parts: [{ text: combinedSystemPrompt }]
            },
            contents: sanitizedContents,
            generationConfig: generationConfig
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

          const candidate = data.candidates?.[0];
          const finishReason = candidate?.finishReason;

          const parts = candidate?.content?.parts || [];
          const textParts = parts.filter(p => !p.thought).map(p => p.text || '');
          replyText = textParts.join('').trim() || parts.map(p => p.text || '').join('').trim();

          if (!replyText) {
            throw new Error(`Model returned empty text (Finish reason: ${finishReason || 'UNKNOWN'})`);
          }

          successfulModel = currentModel;
          break;

        } else {
          const endpoint = 'https://api.openai.com/v1/chat/completions';
          
          const formattedMessages = [
            { role: 'system', content: combinedSystemPrompt },
            ...recentMessages.map(m => ({
              role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
              content: m.content || ''
            }))
          ];

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cleanKey}`
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
          
          if (!replyText.trim()) {
            throw new Error('Model returned empty text.');
          }

          successfulModel = currentModel;
          break;
        }

      } catch (err) {
        const errorMsg = err.name === 'AbortError' ? 'Request timed out after 55s' : err.message;
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
