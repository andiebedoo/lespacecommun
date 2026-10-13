// Scripts communs à toutes les pages.

// Menu mobile
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('menu-mobile');
if (menuBtn && menu) {
  const basculerMenu = (ouvert) => {
    menu.classList.toggle('hidden', !ouvert);
    menuBtn.setAttribute('aria-expanded', ouvert);
    menuBtn.querySelector('.icon-open').classList.toggle('hidden', ouvert);
    menuBtn.querySelector('.icon-close').classList.toggle('hidden', !ouvert);
  };
  menuBtn.addEventListener('click', () => basculerMenu(menu.classList.contains('hidden')));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => basculerMenu(false)));
}

// Filtre de l'équipe : affiche les praticiens qui correspondent à au moins un critère coché
const filtres = document.querySelectorAll('#filtres input');
const fiches = document.querySelectorAll('article[data-tags]');
const aucun = document.getElementById('aucun');
filtres.forEach((f) => f.addEventListener('change', () => {
  const actifs = [...filtres].filter((x) => x.checked).map((x) => x.value);
  let visibles = 0;
  fiches.forEach((fiche) => {
    const tags = fiche.dataset.tags.split(' ');
    fiche.hidden = actifs.length > 0 && !actifs.some((a) => tags.includes(a));
    if (!fiche.hidden) visibles += 1;
  });
  if (aucun) aucun.hidden = visibles > 0;
}));

// Ouvre la fiche ciblée par l'ancre (equipe.html#andie)
if (location.hash) {
  const fiche = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  const cible = fiche && fiche.querySelector('details');
  if (cible) cible.open = true;
}

document.querySelectorAll('[data-annee]').forEach((el) => { el.textContent = new Date().getFullYear(); });
