// backend/src/routes/generateReport.js
import dotenv from 'dotenv';
dotenv.config();

export const generateReportRoute = async (req, res) => {
  try {
    const { prompt, model = 'claude-sonnet-4-20250514', max_tokens = 2000 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('Calling Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Claude API request failed',
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('Claude API response received successfully');
    
    res.json(data);
  } catch (error) {
    console.error('Error in generateReportRoute:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};