// Espace gérante : prépare le lien récapitulatif et l'email de confirmation d'un RDV.
// Rien n'est envoyé ni enregistré : tout se passe dans le navigateur.

(() => {
const { lireRdv, montant, texteRdv, rdvLienPsy, deNom } = window.ECPaiement;
const { paiement } = window.EC;
const formG = document.getElementById('g-form');
const champ = (nom) => formG.elements[nom];

function lienPatient() {
  const q = new URLSearchParams();
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
  document.getElementById('g-lien').value = url;
  document.getElementById('g-apercu').href = url;

  const prenom = champ('prenom').value.trim();
  const lieu = rdv.l === 'visio' ? 'en téléconsultation : le lien de la visio vous est envoyé par email avant la séance' : `${t.lieu} — ${t.adresse}`;
  const email = [
    `Bonjour${prenom ? ` ${prenom}` : ''},`,
    '',
    'Je vous confirme votre rendez-vous :',
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
  document.getElementById('g-sms').value = `Bonjour${prenom ? ` ${prenom}` : ''}, votre RDV à L'Espace Commun est confirmé le ${t.date} à ${t.heure} avec ${t.psy}. Récapitulatif : ${url}`;
  const sujet = 'Confirmation de votre rendez-vous — L\'Espace Commun';
  document.getElementById('g-mailto').href = `mailto:${encodeURIComponent(champ('email').value.trim())}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(email)}`;
}

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
mettreAJour();
})();
