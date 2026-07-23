// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { provider, apiKey, messages, model, systemPrompt } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required.' });
  }

  try {
    if (provider === 'google') {
      const activeModel = model || 'gemini-2.5-flash';
      const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

      // Format context history for Gemini REST API
      const formattedContents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      // Ensure history starts with user role
      while (formattedContents.length > 0 && formattedContents[0].role === 'model') {
        formattedContents.shift();
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: formattedContents,
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        return res.status(response.status).json({ error: data.error?.message || 'Google API error' });
      }

      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
      return res.status(200).json({ reply: replyText });

    } else {
      // Default: OpenAI Provider
      const activeModel = model || 'gpt-4o-mini';
      const requestMessages = systemPrompt 
        ? [{ role: 'system', content: systemPrompt }, ...messages] 
        : messages;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: activeModel,
          messages: requestMessages
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        return res.status(response.status).json({ error: data.error?.message || 'OpenAI API error' });
      }

      const replyText = data.choices?.[0]?.message?.content || "No response generated.";
      return res.status(200).json({ reply: replyText });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server request failed.' });
  }
}
