export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider, apiKey, model, messages = [], systemPrompt, userTimeZone } = req.body || {};

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required.' });
    }

    const modelName = model || (provider === 'google' ? 'gemini-3.6-flash' : 'gpt-5.6-luna');
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

    if (provider === 'google') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      
      const contents = messages.map(m => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content || '' }]
      }));

      const payload = {
        systemInstruction: {
          parts: [{ text: combinedSystemPrompt }]
        },
        contents: contents
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({ 
          error: data.error?.message || `Google API error (${response.status})` 
        });
      }

      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

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
          model: modelName,
          messages: formattedMessages
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({ 
          error: data.error?.message || `OpenAI API error (${response.status})` 
        });
      }

      replyText = data.choices?.[0]?.message?.content || 'No response generated.';
    }

    return res.status(200).json({ reply: replyText });

  } catch (err) {
    console.error("API Route Execution Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
