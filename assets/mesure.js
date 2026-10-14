// Mesure d'audience Google Analytics, chargée uniquement avec l'accord du visiteur
// (recommandations CNIL : refus aussi simple que l'acceptation, choix conservé 13 mois au plus).
(() => {
  const ID = document.currentScript.dataset.ga;
  const CLE = 'ec-consentement-mesure';
  const DUREE = 13 * 30 * 24 * 3600 * 1000;
  const bandeau = document.getElementById('bandeau-cookies');
  if (!ID || !bandeau) return;

  const lire = () => {
    try {
      const v = JSON.parse(localStorage.getItem(CLE));
      return v && Date.now() - v.date < DUREE ? v.choix : null;
    } catch (e) { return null; }
  };
  const ecrire = (choix) => {
    try { localStorage.setItem(CLE, JSON.stringify({ choix, date: Date.now() })); } catch (e) { /* stockage indisponible */ }
  };

  let charge = false;
  const charger = () => {
    if (charge) return;
    charge = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID);
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;
    document.head.appendChild(s);
  };
  // Retrait du consentement : suppression des cookies Google Analytics du domaine.
  const effacer = () => {
    document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => n.startsWith('_ga')).forEach((n) => {
      [location.hostname, `.${location.hostname.replace(/^www\./, '')}`].forEach((d) => {
        document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${d}`;
      });
      document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  };
  const montrer = (visible) => { bandeau.hidden = !visible; };

  const choix = lire();
  if (choix === 'oui') charger();
  else if (choix === null) montrer(true);

  bandeau.querySelector('[data-cookies="oui"]').addEventListener('click', () => { ecrire('oui'); montrer(false); charger(); });
  bandeau.querySelector('[data-cookies="non"]').addEventListener('click', () => {
    ecrire('non');
    montrer(false);
    effacer();
    if (charge) location.reload();
  });
  document.querySelectorAll('[data-gerer-cookies]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); montrer(true); }));
})();
