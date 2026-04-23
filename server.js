const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json({ type: '*/*' }));

// Your Slack webhook URL - we'll fill this in after Render is set up
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Pull the fields out of the Neat Pulse payload
    const blocks = body.blocks || [];
    
    // Find the status block
    const statusBlock = blocks.find(b => 
      b.text && b.text.text && b.text.text.includes('Status')
    );
    
    // Find the header block
    const headerBlock = blocks.find(b => b.type === 'header');
    
    // Find device, room and location blocks
    const deviceBlock = blocks.find(b => 
      b.text && b.text.text && b.text.text.includes('Device:')
    );
    const roomBlock = blocks.find(b => 
      b.text && b.text.text && b.text.text.includes('Room:')
    );
    const locationBlock = blocks.find(b => 
      b.text && b.text.text && b.text.text.includes('Location:')
    );

    // Find the Pulse deep link button
    const actionsBlock = blocks.find(b => b.type === 'actions');
    const pulseUrl = actionsBlock?.elements?.[0]?.url || 'https://pulse.neat.no';

    // Determine if connected or disconnected for color coding
    const statusText = statusBlock?.text?.text || '';
    const isDisconnected = statusText.includes('connected -> disconnected');
    const color = isDisconnected ? '#FF0000' : '#00C851'; // Red or Green

    // Build the clean values
    const header = headerBlock?.text?.text || 'Neat Device Event';
    const device = deviceBlock?.text?.text?.replace('*Device*:\n ', '') || 'Unknown';
    const room = roomBlock?.text?.text?.replace('*Room*:\n ', '') || 'Unknown';
    const location = locationBlock?.text?.text?.replace('*Location*:\n ', '') || 'Unknown';
    const status = statusText.replace('*Status*:\n ', '') || 'Unknown';

    // Build the Slack message with color bar
    const slackMessage = {
      attachments: [
        {
          color: color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: header
              }
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Device:*\n${device}` },
                { type: 'mrkdwn', text: `*Room:*\n${room}` },
                { type: 'mrkdwn', text: `*Status:*\n${status}` },
                { type: 'mrkdwn', text: `*Location:*\n${location}` }
              ]
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Open in Pulse' },
                  url: pulseUrl,
                  style: isDisconnected ? 'danger' : 'primary'
                }
              ]
            }
          ]
        }
      ]
    };

    // Send to Slack
    await axios.post(SLACK_WEBHOOK_URL, slackMessage);
    
    console.log(`Event received: ${header} | Status: ${status}`);
    res.status(200).send('OK');

  } catch (error) {
    console.error('Error processing webhook:', error.message);
    res.status(500).send('Error');
  }
});

// Health check endpoint so Render knows the server is running
app.get('/', (req, res) => {
  res.send('Neat Pulse Webhook Receiver is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
