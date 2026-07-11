const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Accept larger JSON bodies (for base64 images)
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

if (!OPENAI_KEY) console.warn('Warning: OPENAI_API_KEY not set. Set it in your Render environment variables.');

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/ask', async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set on server.' });

    const payload = req.body || {};

    // If the client sent an image for analysis, we currently require a vision-capable OpenAI model
    if (payload.photo_b64) {
      const visionModel = process.env.OPENAI_VISION_MODEL; // optional
      if (!visionModel) {
        return res.status(400).json({ content: [{ type: 'text', text: 'Photo analysis is not enabled on this server. To enable it, set OPENAI_VISION_MODEL to a vision-capable model name in your Render environment variables.' }] });
      }

      // Placeholder: implement vision analysis if you have access.
      return res.status(501).json({ content: [{ type: 'text', text: 'Photo analysis requested but not implemented on this server yet. Please contact the maintainer to enable vision model support.' }] });
    }

    // Build messages for OpenAI chat completion
    const messages = [];
    if (payload.system) messages.push({ role: 'system', content: payload.system });
    if (payload.user) messages.push({ role: 'user', content: payload.user });
    if (payload.messages && Array.isArray(payload.messages)) {
      // Accept pre-built messages if supplied
      payload.messages.forEach((m) => {
        if (m.role && m.content) messages.push(m);
      });
    }

    const model = payload.model || DEFAULT_MODEL;
    const body = {
      model,
      messages,
      max_tokens: payload.max_tokens || 400,
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.7
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('OpenAI error:', data);
      // Proxy the error status and body back to the client
      return res.status(r.status).json(data);
    }

    const assistantText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? data.choices[0].message.content : '';

    // Return in the same shape the frontend expects: { content: [{type:'text', text: '...'}], raw: <openai response> }
    return res.json({ content: [{ type: 'text', text: assistantText }], raw: data });
  } catch (err) {
    console.error('Server error in /api/ask:', err);
    return res.status(500).json({ error: String(err) });
  }
});

// Serve static files from the repo root so the same Render service can host frontend + proxy
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
