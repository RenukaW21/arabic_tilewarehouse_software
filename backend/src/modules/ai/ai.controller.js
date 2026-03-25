const { processAI } = require('./ai.service');

exports.handleAIQuery = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await processAI(query.trim(), req.tenantId);
    res.json({ answer: result });
  } catch (err) {
    console.error('[AI Controller]', err);
    res.status(500).json({ error: 'AI error' });
  }
};