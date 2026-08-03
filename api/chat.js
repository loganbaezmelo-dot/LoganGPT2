// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { provider, apiKey, messages, model, systemPrompt, userTimeZone } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required.' });
  }

  // Fallback map for common user inputs to valid IANA timezone identifiers
  const activeZone = userTimeZone || 'UTC';

  let currentDate = '';
  let currentTime = '';

  try {
    currentDate = new Date().toLocaleDateString('en-US', { 
      timeZone: activeZone,
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    currentTime = new Date().toLocaleTimeString('en-US', {
      timeZone: activeZone,
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    // Fallback if invalid timezone string is passed
    currentDate = new Date().toLocaleDateString('en-US', { 
      timeZone: 'UTC',
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    currentTime = new Date().toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Format label nicely for the AI instruction
  let zoneLabel = activeZone;
  if (activeZone === 'America/New_York') zoneLabel = 'Eastern Time (US)';
  if (activeZone === 'America/Chicago') zoneLabel = 'Central Time (US)';
  if (activeZone === 'America/Denver') zoneLabel = 'Mountain Time (US)';
  if (activeZone === 'America/Los_Angeles') zoneLabel = 'Pacific Time (US)';

  // System instruction telling the AI how to handle date, time, and timezone prompts
  const dateInstruction = activeZone === 'UTC'
    ? `CURRENT REAL-WORLD DATE & TIME: ${currentDate} at ${currentTime} (UTC).\nNOTE: You are currently using UTC time by default. Whenever the user asks about the date or time, state that you are using UTC and ask what timezone they use so they can customize it.`
    : `CURRENT REAL-WORLD DATE & TIME: ${currentDate} at ${currentTime} (${zoneLabel}). Note: Use "${zoneLabel}" or the appropriate current daylight/standard abbreviation (e.g. EDT in summer) when reporting the time.`;

  const fullSystemPrompt = `${systemPrompt || ''}\n\n${dateInstruction}`;

  try {
    if (provider === 'google') {
      const activeModel = model || 'gemini-2.5-flash';
      const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

      const formattedContents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      while (formattedContents.length > 0 && formattedContents[0].role === 'model') {
        formattedContents.shift();
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: formattedContents,
          systemInstruction: { parts: [{ text: fullSystemPrompt }] }
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        return res.status(response.status).json({ error: data.error?.message || 'Google API error' });
      }

      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
      return res.status(200).json({ reply: replyText });

    } else {
      const activeModel = model || 'gpt-4o-mini';
      const requestMessages = [
        { role: 'system', content: fullSystemPrompt },
        ...messages
      ];

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
