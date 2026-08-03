// --- DuckDuckGo Web Search Helper ---
async function fetchDuckDuckGoSearch(query) {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const data = await response.json();

    let summary = "";

    // Abstract text (Direct Answer)
    if (data.AbstractText) {
      summary += `Abstract (${data.AbstractSource}): ${data.AbstractText}\n`;
    }

    // Related Topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topics = data.RelatedTopics
        .slice(0, 4)
        .filter(t => t.Text)
        .map(t => `- ${t.Text}`)
        .join("\n");
      if (topics) summary += `Related Knowledge:\n${topics}\n`;
    }

    return summary.trim();
  } catch (err) {
    console.error("DuckDuckGo API Error:", err);
    return null;
  }
}

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

    // Extract latest user query for DuckDuckGo
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const searchData = await fetchDuckDuckGoSearch(lastUserMessage);

    const timeContext = `[CURRENT REAL-WORLD DATE AND TIME]: ${formattedTimeStr} (${targetTimeZone}). You MUST use this real-time clock whenever asked for current date, time, year, or temporal context.`;
    
    let combinedSystemPrompt = systemPrompt ? `${systemPrompt}\n\n${timeContext}` : timeContext;
    
    if (searchData) {
      combinedSystemPrompt += `\n\n[LIVE DUCKDUCKGO SEARCH DATA]\n${searchData}\nUse this live search data to answer the request if relevant.`;
    }

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
