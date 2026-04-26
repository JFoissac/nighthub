/**
 * NightHub — Script d'extraction des follows X (Twitter)
 *
 * UTILISATION :
 * 1. Ouvrir https://x.com/{votre_pseudo}/following
 * 2. Attendre que la page soit chargée
 * 3. Coller ce script dans la console Chrome (F12 → Console)
 * 4. Le script scroll automatiquement (~30 sec selon le nombre de follows)
 * 5. Les @handles sont copiés dans le presse-papier
 * 6. Coller dans NightHub Settings → Twitter → Accounts (séparés par virgule)
 */

(async () => {
  if (!window.location.pathname.includes('/following')) {
    console.error('[NightHub] Erreur : allez sur https://x.com/{votre_pseudo}/following avant de lancer ce script.');
    return;
  }

  console.log('[NightHub] Démarrage de l\'extraction des follows X...');

  // --- Étape 1 : Scroll progressif + extraction à chaque itération ---
  // X utilise un virtual scroll : seules ~30 cellules sont dans le DOM à un instant T.
  // Il faut donc extraire les handles au fur et à mesure du scroll.
  const handles = new Set();
  let prevCount = 0;
  let stable = 0;

  function extractHandlesFromCells() {
    const cells = document.querySelectorAll('[data-testid="UserCell"]');
    for (const cell of cells) {
      // Le handle (@pseudo) est dans un <span> ou <div> qui commence par @
      const allText = cell.querySelectorAll('span, div');
      for (const el of allText) {
        const text = el.textContent?.trim() || '';
        if (text.startsWith('@') && text.length > 1 && text.length < 50 && !text.includes(' ')) {
          handles.add(text);
          break;
        }
      }
    }
    return cells.length;
  }

  // Extraction initiale avant de commencer le scroll
  extractHandlesFromCells();

  while (stable < 4) {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 1800));

    const cellCount = extractHandlesFromCells();
    if (cellCount === prevCount) {
      stable++;
    } else {
      stable = 0;
      prevCount = cellCount;
    }
    console.log(`[NightHub] Chargement... ${cellCount} cellules visibles | ${handles.size} handles uniques extraits`);
  }

  // --- Étape 2 : Fallback si aucun handle trouvé ---
  if (handles.size === 0) {
    const profileLinks = document.querySelectorAll('a[href^="/"][role="link"]');
    for (const link of profileLinks) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/^\/([a-zA-Z0-9_]{1,15})$/);
      if (match && !['home', 'explore', 'notifications', 'messages', 'search', 'i', 'settings'].includes(match[1])) {
        handles.add(`@${match[1]}`);
      }
    }
  }

  if (handles.size === 0) {
    console.error('[NightHub] Aucun compte trouvé. Assurez-vous d\'être sur la page /following de votre compte.');
    return;
  }

  const csv = [...handles].join(',');

  // --- Étape 3 : Copier dans le presse-papier ---
  try {
    await navigator.clipboard.writeText(csv);
    console.log('%c[NightHub] ✅ Handles copiés dans le presse-papier !', 'color: #34D399; font-weight: bold');
  } catch (e) {
    console.warn('[NightHub] Impossible de copier automatiquement. Copiez manuellement ci-dessous.');
  }

  console.log(`%c[NightHub] ${handles.size} comptes extraits`, 'color: #c0c1ff; font-weight: bold; font-size: 14px');
  console.log('');
  console.log('%cIMPORT dans NightHub :', 'color: #5de6ff; font-weight: bold');
  console.log('  1. Ouvrir NightHub → Settings (⚙) → Twitter');
  console.log('  2. Coller dans le champ "Twitter Accounts" (séparés par virgule)');
  console.log('');
  console.log('%cHandles :', 'color: #908fa0');
  console.log(csv);

  return { handles: [...handles], csv };
})();
