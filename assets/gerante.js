// Espace gérante : prépare le lien de paiement et l'email de confirmation d'un RDV.
// Rien n'est envoyé ni enregistré : tout se passe dans le navigateur.

(() => {
const { lireRdv, montant, texteRdv, lienStripe } = window.ECPaiement;
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
  const enLigne = Boolean(lienStripe(rdv));
  alerte.textContent = enLigne
    ? 'Le patient pourra payer maintenant par carte, ou le jour de la séance en espèces.'
    : 'Paiement en ligne pas encore activé pour ce montant : le patient réglera auprès du psychologue.';
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
    enLigne
      ? 'Vous pouvez payer maintenant par carte, en ligne et de façon sécurisée, ou payer le jour de la séance en espèces. Retrouvez le récapitulatif et le paiement ici :'
      : `${rdv.l === 'visio' ? 'Votre psychologue vous indiquera comment régler avant la séance.' : 'Le règlement se fait le jour de la séance, en espèces, auprès de votre psychologue.'} Retrouvez le récapitulatif de votre rendez-vous (et ajoutez-le à votre agenda) ici :`,
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
  document.getElementById('g-sms').value = `Bonjour${prenom ? ` ${prenom}` : ''}, votre RDV à L'Espace Commun est confirmé le ${t.date} à ${t.heure} avec ${t.psy}. Récapitulatif${enLigne ? ' et paiement' : ''} : ${url}`;
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
