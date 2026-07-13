const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Accept larger JSON bodies (for base64 images)
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!GEMINI_KEY) console.warn('Warning: GEMINI_API_KEY not set. Set it in your Render environment variables.');

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/ask', async (req, res) => {
  try {
    if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set on server.' });

    const payload = req.body || {};
    const model = payload.model || DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    // Build the parts for this request
    const parts = [];
    if (payload.user) parts.push({ text: payload.user });

    // If the client sent a photo, include it alongside the text (Gemini supports this natively)
    if (payload.photo_b64) {
      parts.push({
        inline_data: {
          mime_type: payload.mime_type || 'image/jpeg',
          data: payload.photo_b64
        }
      });
    }

    const body = {
      contents: [{ role: 'user', parts }]
    };

    if (payload.system) {
      body.system_instruction = { parts: [{ text: payload.system }] };
    }

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('Gemini error:', data);
      return res.status(r.status).json(data);
    }

    const assistantText = (data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text) || '';

    // Return in the same shape the frontend expects: { content: [{type:'text', text: '...'}] }
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
