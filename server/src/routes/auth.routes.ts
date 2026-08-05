import { Router, Request, Response } from 'express';
import { youtubeService, twitchService } from '../services/backend.runtime';

const router = Router();

// YouTube OAuth
router.get('/youtube', (req: Request, res: Response) => {
  const authUrl = youtubeService.getAuthUrl();
  res.redirect(authUrl);
});

router.get('/youtube/callback', async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.send(`
      <html><body style="background:#0A0A0F;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
        <div style="text-align:center"><h1>Error</h1><p>No authorization code received</p>
        <button onclick="window.close()" style="padding:8px 24px;background:#6366F1;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:16px">Close</button></div>
      </body></html>
    `);
  }

  const success = await youtubeService.exchangeCodeForTokens(code);

  res.send(`
    <html><body style="background:#0A0A0F;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
      <div style="text-align:center">
        <h1>${success ? 'YouTube Connected!' : 'Connection Failed'}</h1>
        <p>${success ? 'You can close this window.' : 'Please try again.'}</p>
        <script>${success ? 'setTimeout(() => window.close(), 2000);' : ''}</script>
        <button onclick="window.close()" style="padding:8px 24px;background:#6366F1;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:16px">Close</button>
      </div>
    </body></html>
  `);
});

// Twitch OAuth
router.get('/twitch', (req: Request, res: Response) => {
  const authUrl = twitchService.getAuthUrl();
  res.redirect(authUrl);
});

router.get('/twitch/callback', async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.send(`
      <html><body style="background:#0A0A0F;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
        <div style="text-align:center"><h1>Error</h1><p>No authorization code received</p>
        <button onclick="window.close()" style="padding:8px 24px;background:#6366F1;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:16px">Close</button></div>
      </body></html>
    `);
  }

  const success = await twitchService.exchangeCodeForTokens(code);

  res.send(`
    <html><body style="background:#0A0A0F;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
      <div style="text-align:center">
        <h1>${success ? 'Twitch Connected!' : 'Connection Failed'}</h1>
        <p>${success ? 'You can close this window.' : 'Please try again.'}</p>
        <script>${success ? 'setTimeout(() => window.close(), 2000);' : ''}</script>
        <button onclick="window.close()" style="padding:8px 24px;background:#6366F1;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:16px">Close</button>
      </div>
    </body></html>
  `);
});

// Auth status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const [youtubeConnected, twitchConnected] = await Promise.all([
      youtubeService.isConnected(),
      twitchService.isConnected(),
    ]);

    res.json({
      youtube: youtubeConnected,
      twitch: twitchConnected,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get auth status' });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { provider } = req.body;

    if (provider === 'youtube') {
      await youtubeService.disconnect();
    } else if (provider === 'twitch') {
      await twitchService.disconnect();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;
