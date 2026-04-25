/**
 * NightHub — Script d'extraction des abonnements YouTube
 *
 * UTILISATION :
 * 1. Ouvrir https://www.youtube.com/feed/channels
 * 2. Attendre que la page soit chargée
 * 3. Coller ce script dans la console Chrome (F12 → Console)
 * 4. Le script scroll automatiquement pour tout charger (~30 sec)
 * 5. À la fin, un JSON est copié dans le presse-papier et affiché dans la console
 * 6. Coller ce fichier dans NightHub Settings → YouTube → Importer depuis Google Takeout CSV
 *    (le format est compatible avec l'import Takeout : channelId + title)
 */

(async () => {
  console.log('[NightHub] Démarrage de l\'extraction des abonnements YouTube...');

  // --- Étape 1 : Scroll pour charger tous les abonnements ---
  let prevCount = 0;
  let stable = 0;

  while (stable < 3) {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 1500));

    const items = document.querySelectorAll('ytd-channel-renderer, ytd-grid-channel-renderer');
    if (items.length === prevCount) {
      stable++;
    } else {
      stable = 0;
      prevCount = items.length;
    }
    console.log(`[NightHub] Chargement... ${items.length} chaînes trouvées`);
  }

  // --- Étape 2 : Extraire les chaînes ---
  const selectors = [
    'ytd-channel-renderer',
    'ytd-grid-channel-renderer',
    'ytd-browse #contents ytd-item-section-renderer ytd-channel-renderer',
  ];

  let renderers = [];
  for (const sel of selectors) {
    renderers = Array.from(document.querySelectorAll(sel));
    if (renderers.length > 0) break;
  }

  if (renderers.length === 0) {
    // Fallback: look for channel links directly
    renderers = Array.from(document.querySelectorAll('a[href*="/channel/"], a[href^="/@"]'));
  }

  const seen = new Set();
  const channels = [];

  for (const el of renderers) {
    // Try to find channel link inside the renderer
    const link = el.tagName === 'A'
      ? el
      : el.querySelector('a#main-link, a#channel-name, a[href*="/channel/"], a[href^="/@"]');

    if (!link) continue;

    const href = link.getAttribute('href') || '';

    // Extract channel ID from /channel/UCxxxxxx
    const idMatch = href.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
    // Extract handle from /@handle
    const handleMatch = href.match(/\/@([^/?#]+)/);

    // Extract channel title
    const titleEl = el.querySelector('#channel-title, #text, yt-formatted-string, #channel-handle');
    const title = (titleEl?.textContent || link.textContent || href).trim().replace(/\s+/g, ' ');

    if (idMatch) {
      const channelId = idMatch[1];
      if (!seen.has(channelId)) {
        seen.add(channelId);
        channels.push({
          channelId,
          channelUrl: `http://www.youtube.com/channel/${channelId}`,
          title: title || channelId,
          handle: handleMatch ? `@${handleMatch[1]}` : null,
        });
      }
    } else if (handleMatch) {
      const handle = handleMatch[1];
      if (!seen.has(handle)) {
        seen.add(handle);
        channels.push({
          channelId: null,
          channelUrl: `https://www.youtube.com/@${handle}`,
          title: title || `@${handle}`,
          handle: `@${handle}`,
        });
      }
    }
  }

  if (channels.length === 0) {
    console.error('[NightHub] Aucune chaîne trouvée. Assurez-vous d\'être sur https://www.youtube.com/feed/channels');
    return;
  }

  // --- Étape 3 : Formater pour NightHub ---

  // Format Takeout CSV (compatible avec le bouton "Google Takeout CSV" dans NightHub)
  const csvLines = ['Channel Id,Channel Url,Channel Title'];
  const handlesList = [];

  for (const c of channels) {
    if (c.channelId) {
      csvLines.push(`${c.channelId},${c.channelUrl},${c.title}`);
    }
    if (c.handle) {
      handlesList.push(c.handle);
    }
  }

  const csv = csvLines.join('\n');
  const channelsWithId = channels.filter(c => c.channelId).length;
  const channelsHandleOnly = channels.filter(c => !c.channelId && c.handle).length;

  // --- Étape 4 : Copier dans le presse-papier ---
  try {
    await navigator.clipboard.writeText(csv);
    console.log('%c[NightHub] ✅ CSV copié dans le presse-papier !', 'color: #34D399; font-weight: bold');
  } catch (e) {
    console.warn('[NightHub] Impossible de copier automatiquement. Copiez le CSV ci-dessous manuellement.');
  }

  console.log(`%c[NightHub] ${channels.length} abonnements extraits`, 'color: #c0c1ff; font-weight: bold; font-size: 14px');
  console.log(`  → ${channelsWithId} avec Channel ID (import Takeout CSV)`);
  console.log(`  → ${channelsHandleOnly} avec @handle seulement`);
  console.log('');
  console.log('%cIMPORT dans NightHub :', 'color: #5de6ff; font-weight: bold');
  console.log('  1. Ouvrir NightHub → Settings (⚙) → YouTube');
  console.log('  2. Cliquer "Google Takeout CSV"');
  console.log('  3. Créer un fichier .csv avec le contenu copié et l\'importer');
  console.log('');

  if (handlesList.length > 0) {
    console.log('%cHandles (@) pour import manuel :', 'color: #ffb783');
    console.log(handlesList.join(','));
  }

  console.log('%cCSV complet :', 'color: #908fa0');
  console.log(csv);

  // Return data for programmatic use
  return { channels, csv, handlesList };
})();
