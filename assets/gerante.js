// Espace gérante : prépare le lien récapitulatif et l'email de confirmation d'un RDV,
// attribue un numéro de réservation et tient le registre de facturation des psychologues.
// Rien n'est envoyé : tout se passe dans le navigateur. Le registre (sans nom de patient)
// est conservé dans le stockage local de ce navigateur.

(() => {
const { lireRdv, montant, texteRdv, rdvLienPsy, deNom, TYPES } = window.ECPaiement;
const { paiement, psys } = window.EC;
const formG = document.getElementById('g-form');
const champ = (nom) => formG.elements[nom];
const REGISTRE = 'ec-registre-facturation';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function lireRegistre() {
  try { return JSON.parse(localStorage.getItem(REGISTRE)) || []; } catch (e) { return []; }
}
function ecrireRegistre(lignes) {
  try { localStorage.setItem(REGISTRE, JSON.stringify(lignes)); return true; } catch (e) { return false; }
}

// Numéro de réservation : EC-AAMM-XXXX (mois du RDV + 4 caractères aléatoires).
let suffixe = '';
function nouveauSuffixe() {
  const deja = new Set(lireRegistre().map((x) => x.n.slice(-4)));
  do {
    const v = crypto.getRandomValues(new Uint8Array(4));
    suffixe = Array.from(v, (x) => ALPHABET[x % ALPHABET.length]).join('');
  } while (deja.has(suffixe));
}
function reference() {
  const d = champ('d').value;
  const aamm = /^\d{4}-\d{2}/.test(d) ? `${d.slice(2, 4)}${d.slice(5, 7)}` : '';
  return aamm ? `EC-${aamm}-${suffixe}` : '';
}

function lienPatient() {
  const q = new URLSearchParams();
  if (reference()) q.set('n', reference());
  ['d', 'h', 'l', 'p', 't'].forEach((k) => q.set(k, champ(k).value));
  q.set('r', champ('r').checked ? '1' : '0');
  if (champ('l').value === 'idf' && champ('a').value.trim()) q.set('a', champ('a').value.trim());
  return { q, url: `${paiement.site}/paiement.html?${q.toString()}` };
}

function mettreAJour() {
  document.getElementById('g-adresse').hidden = champ('l').value !== 'idf';
  const bilan = champ('t').value === 'bilan'; // pas de réduction sur les bilans
  champ('r').disabled = bilan;
  if (bilan) champ('r').checked = false;
  const { q, url } = lienPatient();
  const rdv = lireRdv(q);
  const alerte = document.getElementById('g-alerte');
  if (!rdv) {
    document.getElementById('g-montant').textContent = '—';
    document.getElementById('g-lien').value = '';
    document.getElementById('g-email').value = '';
    document.getElementById('g-psy-msg').value = '';
    document.getElementById('g-ref').textContent = '—';
    alerte.textContent = 'Indiquez la date et l\'heure du rendez-vous.';
    return;
  }
  const t = texteRdv(rdv);
  const enLigne = rdv.l === 'visio' && Boolean(rdvLienPsy(rdv));
  const qui = rdv.p ? t.psy : 'votre psychologue';
  let reglement;
  if (rdv.l !== 'visio') {
    reglement = `Le règlement se fait directement auprès ${deNom(qui)}, le jour de la séance, au cabinet : en espèces ou par carte.`;
    alerte.textContent = 'Paiement au cabinet : espèces ou carte, directement au psychologue.';
  } else if (enLigne) {
    reglement = `Le règlement se fait directement auprès ${deNom(qui)}, par carte, via le lien de paiement sécurisé de la page ci-dessous.`;
    alerte.textContent = 'Téléconsultation : paiement par carte via le lien du psychologue.';
  } else {
    reglement = `Le règlement se fait directement auprès ${deNom(qui)}, par carte : le lien de paiement sécurisé vous sera transmis avant la séance.`;
    alerte.textContent = 'Téléconsultation : ce psychologue n\'a pas de lien de paiement sur le site. Pensez à transmettre au patient son lien de paiement.';
  }
  document.getElementById('g-montant').textContent = `${montant(rdv)} €`;
  document.getElementById('g-ref').textContent = rdv.n;
  document.getElementById('g-lien').value = url;
  document.getElementById('g-apercu').href = url;

  const prenom = champ('prenom').value.trim();
  const lieu = rdv.l === 'visio' ? 'en téléconsultation : le lien de la visio vous est envoyé par email avant la séance' : `${t.lieu} — ${t.adresse}`;
  const email = [
    `Bonjour${prenom ? ` ${prenom}` : ''},`,
    '',
    `Je vous confirme votre rendez-vous (n° de réservation ${rdv.n}) :`,
    `• le ${t.date} à ${t.heure}`,
    `• avec ${t.psy}`,
    `• ${lieu}`,
    `• ${t.seance} : ${t.montant}`,
    '',
    `${reglement} Retrouvez le récapitulatif de votre rendez-vous (et ajoutez-le à votre agenda) ici :`,
    url,
    '',
    'En cas d\'empêchement, merci de me prévenir au moins 48 h à l\'avance.',
    '',
    'Bien à vous,',
    paiement.gerante,
    'Gérante — L\'Espace Commun',
    paiement.email,
  ].join('\n');
  document.getElementById('g-email').value = email;
  document.getElementById('g-sms').value = `Bonjour${prenom ? ` ${prenom}` : ''}, votre RDV à L'Espace Commun est confirmé le ${t.date} à ${t.heure} avec ${t.psy} (réservation ${rdv.n}). Récapitulatif : ${url}`;
  const sujet = 'Confirmation de votre rendez-vous — L\'Espace Commun';
  const contact = [champ('prenom').value.trim(), champ('email').value.trim()].filter(Boolean).join(' · ');
  document.getElementById('g-psy-msg').value = [
    `Bonjour${rdv.p ? ` ${psys[rdv.p].nom.split(' ')[0]}` : ''},`,
    '',
    `Nouveau rendez-vous confirmé — réservation ${rdv.n} :`,
    `• le ${t.date} à ${t.heure}`,
    `• ${rdv.l === 'visio' ? 'en téléconsultation' : `${t.lieu} — ${t.adresse}`}`,
    `• ${t.seance} : ${t.montant}`,
    contact ? `• patient : ${contact}` : '',
    '',
    'Merci de noter le numéro de réservation : c\'est lui, et non le nom du patient, qui figurera sur la facture mensuelle du centre.',
  ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  document.getElementById('g-enregistre').textContent = lireRegistre().some((x) => x.n === rdv.n) ? 'Déjà dans le registre (un nouvel ajout le met à jour).' : '';
  document.getElementById('g-mailto').href = `mailto:${encodeURIComponent(champ('email').value.trim())}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(email)}`;
}

// --- Registre de facturation ---
const moisRegistre = document.getElementById('r-mois');
const psyRegistre = document.getElementById('r-psy');

function lignesFiltrees() {
  return lireRegistre()
    .filter((x) => (!moisRegistre.value || x.d.startsWith(moisRegistre.value)) && (!psyRegistre.value || x.p === psyRegistre.value))
    .sort((a, b) => `${a.d}${a.h}`.localeCompare(`${b.d}${b.h}`));
}
const nomPsy = (id) => (psys[id] ? psys[id].nom : 'Non attribué');
const dateCourte = (x) => `${x.d.split('-').reverse().join('/')} ${x.h}`;

function afficherRegistre() {
  const corps = document.getElementById('r-lignes');
  const lignes = lignesFiltrees();
  corps.replaceChildren(...lignes.map((x) => {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-border';
    [x.n, dateCourte(x), nomPsy(x.p), TYPES[x.t] ? TYPES[x.t].libelle : x.t, paiement.lieux[x.l] || x.l, `${x.montant} €`].forEach((v, i) => {
      const td = document.createElement('td');
      td.className = `p-3${i === 0 ? ' font-mono' : ''}${i === 5 ? ' text-right' : ''}`;
      td.textContent = v;
      tr.appendChild(td);
    });
    const td = document.createElement('td');
    td.className = 'p-3 text-right';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'text-xs text-muted-foreground underline';
    b.textContent = 'Retirer';
    b.addEventListener('click', () => {
      if (!window.confirm(`Retirer la réservation ${x.n} du registre ?`)) return;
      ecrireRegistre(lireRegistre().filter((y) => y.n !== x.n));
      afficherRegistre();
      mettreAJour();
    });
    td.appendChild(b);
    tr.appendChild(td);
    return tr;
  }));
  const total = lignes.reduce((s, x) => s + x.montant, 0);
  document.getElementById('r-total').textContent = lignes.length
    ? `${lignes.length} séance${lignes.length > 1 ? 's' : ''} · ${total} € encaissés par ${psyRegistre.value ? nomPsy(psyRegistre.value) : 'les psychologues'}.`
    : 'Aucune réservation pour cette sélection.';
}

document.getElementById('g-enregistrer').addEventListener('click', () => {
  const rdv = lireRdv(lienPatient().q);
  const info = document.getElementById('g-enregistre');
  if (!rdv) { info.textContent = 'Indiquez d\'abord la date et l\'heure du rendez-vous.'; return; }
  const ligne = { n: rdv.n, d: rdv.d, h: rdv.h, p: rdv.p, t: rdv.t, l: rdv.l, r: rdv.r, montant: montant(rdv) };
  const ok = ecrireRegistre([...lireRegistre().filter((x) => x.n !== rdv.n), ligne]);
  info.textContent = ok ? `Réservation ${rdv.n} ajoutée au registre ✓` : 'Enregistrement impossible : le stockage du navigateur est désactivé.';
  moisRegistre.value = rdv.d.slice(0, 7);
  afficherRegistre();
});

document.getElementById('g-nouveau').addEventListener('click', () => {
  const psy = champ('p').value;
  formG.reset();
  champ('p').value = psy;
  nouveauSuffixe();
  mettreAJour();
});

document.getElementById('r-export').addEventListener('click', () => {
  const lignes = lignesFiltrees();
  const cel = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [
    ['N° de réservation', 'Date', 'Heure', 'Psychologue', 'Séance', 'Lieu', 'Tarif réduit', 'Montant (€)'],
    ...lignes.map((x) => [x.n, x.d.split('-').reverse().join('/'), x.h, nomPsy(x.p), TYPES[x.t] ? TYPES[x.t].libelle : x.t, paiement.lieux[x.l] || x.l, x.r ? 'oui' : 'non', x.montant]),
  ].map((l) => l.map(cel).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `registre-${moisRegistre.value || 'complet'}${psyRegistre.value ? `-${psyRegistre.value}` : ''}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
moisRegistre.addEventListener('change', afficherRegistre);
psyRegistre.addEventListener('change', afficherRegistre);
moisRegistre.value = new Date().toISOString().slice(0, 7);

formG.addEventListener('input', mettreAJour);
formG.addEventListener('change', mettreAJour);
document.querySelectorAll('[data-copier]').forEach((b) => b.addEventListener('click', async () => {
  const texte = document.getElementById(b.dataset.copier).value;
  if (!texte) return;
  const avant = b.textContent;
  try {
    await navigator.clipboard.writeText(texte);
    b.textContent = 'Copié ✓';
  } catch (e) {
    b.textContent = 'Copie impossible';
  }
  setTimeout(() => { b.textContent = avant; }, 1600);
}));
nouveauSuffixe();
mettreAJour();
afficherRegistre();
})();
