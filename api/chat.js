export const config = {
  maxDuration: 60,
};

async function fetchWikipediaContext(userText) {
  try {
    if (!userText || typeof userText !== 'string' || userText.trim().length < 3) return null;

    const lower = userText.toLowerCase();
    if (
      lower.includes('make an app') || 
      lower.includes('build a game') || 
      lower.includes('create a canvas') || 
      lower.includes('generate code')
    ) {
      return null;
    }

    const stopWords = new Set([
      'what', 'is', 'a', 'the', 'how', 'about', 'tell', 'me', 'who', 'where',
      'when', 'why', 'can', 'you', 'give', 'information', 'on', 'about', 'for',
      'does', 'do', 'did', 'would', 'could', 'should', 'with', 'and', 'or', 'in', 
      'was', 'released', 'make', 'an', 'app', 'out', 'display', 'screen'
    ]);

    const words = userText.replace(/[^\w\s]/gi, '').split(/\s+/);
    const keywords = words.filter(w => w.length > 1 && !stopWords.has(w.toLowerCase())).join(' ');

    if (!keywords || keywords.trim().length === 0) return null;

    const wikiController = new AbortController();
    const wikiTimeout = setTimeout(() => wikiController.abort(), 3000);

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
    const { provider, apiKey, messages = [], systemPrompt, userTimeZone } = req.body || {};

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required.' });
    }

    // Google Gemini Fallback Ladder with 3.8 and 3.7 Flash
    const GEMINI_LADDER = [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ];

    // OpenAI Fallback Ladder with GPT-5.6 Sol, Terra, and Luna
    const OPENAI_LADDER = [
      'gpt-5.6-sol',
      'gpt-5.6-terra',
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

    const recentMessages = messages.length > 10 ? messages.slice(-10) : messages;

    const lastUserMessageObj = recentMessages.slice().reverse().find(m => m.role === 'user');
    const lastUserText = typeof lastUserMessageObj?.content === 'string' ? lastUserMessageObj.content : '';

    const isPersonaActive = systemPrompt && systemPrompt.trim().length > 0 && !systemPrompt.includes("enterprise AI workspace");

    let wikiContext = null;
    if (!isPersonaActive && lastUserText) {
      wikiContext = await fetchWikipediaContext(lastUserText);
    }

    const timeContext = `[CURRENT REAL-WORLD DATE AND TIME]: ${formattedTimeStr} (${targetTimeZone}).`;
    
    const personaInstruction = systemPrompt && systemPrompt.trim() 
      ? systemPrompt.trim() 
      : "You are LoganGPT, an enterprise AI workspace.";

    const imageFormattingRules = `\n\nIMAGE GENERATION INSTRUCTIONS:\nWhen the user asks to generate, create, or draw an image, return ONLY a Markdown image tag using Pollinations AI with the high-quality Flux model params like this:\n![Generated Image](https://image.pollinations.ai/prompt/<URL_ENCODED_PROMPT_HERE>?model=flux&nologo=true)`;

    const accuracyRules = `\n\nHARDWARE SPECIFICATION GUARDS:\n- Verify hardware differences carefully. For example, the base Nintendo Switch 2 features an 8-inch LCD screen, whereas the Nintendo Switch OLED model is a previous-generation variant. Do not mix specs between hardware revisions or generations.`;

    const elicitationRules = `\n\nSUGGESTION BUTTONS / ELICITATIONS:\nWhen offering logical next steps, options, or follow-up prompts to the user, you may optionally include an ElicitationsGroup block using this exact format:\n<ElicitationsGroup message="Where should we take this next?">\n  <Elicitation label="Option Label Here" query="Exact text to send when clicked" />\n  <Elicitation label="Another Option" query="Another exact prompt to send" />\n</ElicitationsGroup>`;

    const combinedSystemPrompt = `${personaInstruction}\n\nSTRICT BEHAVIOR RULES:\n1. Adopt the identity, tone, and character specified above.\n2. Output ONLY the direct in-character response to the user. Never print internal planning logs, analysis steps, or self-dialogue.${imageFormattingRules}${accuracyRules}${elicitationRules}\n\n${timeContext}${wikiContext ? `\n\n${wikiContext}` : ''}`;

    let rawContents = recentMessages.map(m => {
      const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
      const parts = [];

      if (m.image) {
        const matches = m.image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        }
      }

      if (m.content) {
        parts.push({ text: m.content });
      }

      return { role, parts };
    }).filter(c => c.parts.length > 0);

    const sanitizedContents = [];
    for (const msg of rawContents) {
      if (sanitizedContents.length > 0 && sanitizedContents[sanitizedContents.length - 1].role === msg.role) {
        sanitizedContents[sanitizedContents.length - 1].parts.push(...msg.parts);
      } else {
        sanitizedContents.push({ role: msg.role, parts: [...msg.parts] });
      }
    }

    if (sanitizedContents.length === 0) {
      sanitizedContents.push({ role: 'user', parts: [{ text: 'Hi' }] });
    }

    let streamEstablished = false;

    for (const currentModel of modelLadder) {
      try {
        if (provider === 'google') {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:streamGenerateContent?alt=sse&key=${apiKey}`;
          
          const isStandardGemini = currentModel.startsWith('gemini');
          const isGemini25 = currentModel.includes('2.5');

          const generationConfig = {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 2048
          };

          if (isGemini25) {
            generationConfig.thinkingConfig = { thinkingBudget: 0 };
          }

          const payload = {
            systemInstruction: { parts: [{ text: combinedSystemPrompt }] },
            contents: sanitizedContents,
            generationConfig: generationConfig,
            ...(isStandardGemini ? { tools: [{ googleSearch: {} }] } : {})
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errDetail = await response.text();
            throw new Error(errDetail);
          }

          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          streamEstablished = true;

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  const candidate = parsed.candidates?.[0];
                  const parts = candidate?.content?.parts || [];
                  const textChunk = parts.filter(p => !p.thought).map(p => p.text).join('');

                  if (textChunk) {
                    res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
                  }
                } catch (err) {
                  // Skip incomplete chunks
                }
              }
            }
          }

          res.write(`data: [DONE]\n\n`);
          return res.end();

        } else {
          const endpoint = 'https://api.openai.com/v1/chat/completions';
          
          const formattedMessages = [
            { role: 'system', content: combinedSystemPrompt },
            ...recentMessages.map(m => {
              if (m.image) {
                return {
                  role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
                  content: [
                    { type: 'text', text: m.content || '' },
                    { type: 'image_url', image_url: { url: m.image } }
                  ]
                };
              }
              return {
                role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
                content: m.content || ''
              };
            })
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
              temperature: 0.7,
              stream: true
            })
          });

          if (!response.ok) {
            const errDetail = await response.text();
            throw new Error(errDetail);
          }

          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          streamEstablished = true;

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(dataStr);
                  const chunk = parsed.choices?.[0]?.delta?.content || '';
                  if (chunk) {
                    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
                  }
                } catch (err) {
                  // Skip incomplete chunks
                }
              }
            }
          }

          res.write(`data: [DONE]\n\n`);
          return res.end();
        }

      } catch (err) {
        console.warn(`[LoganGPT Stream] Model ${currentModel} failed: ${err.message}. Trying next model...`);
        if (streamEstablished) {
          res.write(`data: ${JSON.stringify({ text: "\n\n*[Stream disconnected]*" })}\n\n`);
          return res.end();
        }
      }
    }

    return res.status(500).json({ error: 'All models failed to stream response.' });

  } catch (err) {
    console.error("API Route Execution Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
