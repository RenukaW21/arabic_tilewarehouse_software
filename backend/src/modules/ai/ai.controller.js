const { processAI } = require('./ai.service');

exports.handleAIQuery = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const userContext = {
      userId: req.user?.id ?? null,
      role:   req.user?.role ?? 'user',
      name:   req.user?.name ?? '',
    };

    const result = await processAI(query.trim(), req.tenantId, userContext);
    res.json({ answer: result });
  } catch (err) {
    console.error('[AI Controller]', err);
    res.status(500).json({ error: 'AI error' });
  }
};
