/**
 * NightHub — Script d'extraction des follows Twitch
 *
 * UTILISATION :
 * 1. Être connecté sur https://www.twitch.tv
 * 2. Ouvrir la console Chrome (F12 → Console)
 * 3. Coller ce script
 * 4. Les logins des chaînes sont copiés dans le presse-papier
 * 5. Coller dans NightHub Settings → Twitch → Channels (séparés par virgule)
 *
 * Méthode : utilise le même endpoint GQL que le site Twitch.
 * Requiert d'être connecté (lit le auth-token depuis les cookies).
 */

(async () => {
  console.log('[NightHub] Démarrage de l\'extraction des follows Twitch...');

  const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

  // Lire le token d'authentification depuis les cookies
  const authToken = document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('auth-token='))
    ?.split('=')?.[1];

  if (!authToken) {
    console.error('[NightHub] Non connecté à Twitch. Connectez-vous sur twitch.tv avant de lancer ce script.');
    return;
  }

  const gqlHeaders = {
    'Client-Id': CLIENT_ID,
    'Content-Type': 'application/json',
    'Authorization': `OAuth ${authToken}`,
  };

  // Récupérer l'utilisateur courant
  const meRes = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: gqlHeaders,
    body: JSON.stringify({ query: 'query { currentUser { id login displayName } }' }),
  });

  const meData = await meRes.json();
  const me = meData?.data?.currentUser;

  if (!me) {
    console.error('[NightHub] Impossible de récupérer le profil utilisateur. Essayez de vous reconnecter.');
    return;
  }

  console.log(`[NightHub] Connecté en tant que : ${me.displayName} (${me.login})`);

  // Récupérer tous les follows avec pagination
  const channels = [];
  let cursor = null;

  do {
    const query = `query GetFollows($userId: ID!, $after: Cursor) {
      user(id: $userId) {
        follows(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges { node { id login displayName } }
        }
      }
    }`;

    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: gqlHeaders,
      body: JSON.stringify({ query, variables: { userId: me.id, after: cursor } }),
    });

    const data = await res.json();
    const follows = data?.data?.user?.follows;

    if (!follows) {
      console.error('[NightHub] Erreur lors de la récupération des follows. Réponse GQL:', JSON.stringify(data));
      break;
    }

    const edges = follows.edges || [];
    channels.push(...edges.map(e => e.node.login));

    console.log(`[NightHub] ${channels.length} follows chargés...`);

    cursor = follows.pageInfo?.hasNextPage ? follows.pageInfo.endCursor : null;
    if (cursor) await new Promise(r => setTimeout(r, 300));

  } while (cursor);

  if (channels.length === 0) {
    console.warn('[NightHub] Aucun follow trouvé.');
    return;
  }

  const csv = channels.join(',');

  // Copier dans le presse-papier
  try {
    await navigator.clipboard.writeText(csv);
    console.log('%c[NightHub] ✅ Follows copiés dans le presse-papier !', 'color: #34D399; font-weight: bold');
  } catch (e) {
    console.warn('[NightHub] Impossible de copier automatiquement. Copiez manuellement ci-dessous.');
  }

  console.log(`%c[NightHub] ${channels.length} follows extraits`, 'color: #c0c1ff; font-weight: bold; font-size: 14px');
  console.log('');
  console.log('%cIMPORT dans NightHub :', 'color: #5de6ff; font-weight: bold');
  console.log('  1. Ouvrir NightHub → Settings (⚙) → Twitch');
  console.log('  2. Coller dans "Twitch Channels" et cliquer Sauvegarder');
  console.log('');
  console.log('%cChannels :', 'color: #908fa0');
  console.log(csv);

  return { channels, csv };
})();
