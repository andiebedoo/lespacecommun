// Prise de rendez-vous en ligne : choix du créneau, récapitulatif, envoi.
// La demande est envoyée par FormSubmit à l'adresse du centre, qui confirme ensuite.

const { motifs, psys, tarifs } = window.EC;
const form = document.getElementById('form-rdv');
const $ = (id) => document.getElementById(id);

const JOURS_VISIBLES = 7;
const JOURS_MAX = 35;
const HEURES = Array.from({ length: 14 }, (_, i) => 8 + i); // 8 h → 21 h (dernière séance)
// Fermeture des centres : du vendredi 17 h au dimanche 11 h.
const ouvert = (jour, h) => {
  const j = jour.getDay(); // 0 = dimanche, 5 = vendredi, 6 = samedi
  if (j === 6) return false;
  if (j === 5) return h < 17;
  if (j === 0) return h >= 11;
  return true;
};
// Tarif majoré à partir de 20 h et le week-end.
const majore = (jour, h) => h >= 20 || jour.getDay() === 0 || jour.getDay() === 6;

let decalage = 0;
let jourChoisi = null;
let heureChoisie = null;

const aujourdhui = new Date();
aujourdhui.setHours(0, 0, 0, 0);
const ajouterJours = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const memeJour = (a, b) => a && b && a.getTime() === b.getTime();
const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const fmtCourt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

function heuresDisponibles(jour) {
  const heures = HEURES.filter((h) => ouvert(jour, h));
  if (!memeJour(jour, aujourdhui)) return heures;
  const limite = new Date().getHours() + 2; // au moins 2 h de délai
  return heures.filter((h) => h >= limite);
}

function dessinerJours() {
  const conteneur = $('jours');
  conteneur.innerHTML = '';
  const debut = ajouterJours(aujourdhui, decalage);
  $('mois').textContent = fmtMois.format(debut);
  for (let i = 0; i < JOURS_VISIBLES; i += 1) {
    const jour = ajouterJours(debut, i);
    const complet = heuresDisponibles(jour).length === 0;
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = complet;
    b.setAttribute('aria-pressed', memeJour(jour, jourChoisi));
    b.className = 'flex flex-col items-center rounded-xl border border-border py-3 text-sm transition-colors hover:border-sage/40 disabled:cursor-not-allowed disabled:opacity-30 aria-pressed:border-sage aria-pressed:bg-sage aria-pressed:text-sage-foreground';
    b.innerHTML = `<span class="text-[11px] uppercase tracking-wider opacity-70">${fmtCourt.format(jour).replace('.', '')}</span><span class="font-serif text-lg">${jour.getDate()}</span>`;
    b.setAttribute('aria-label', fmtJour.format(jour));
    b.addEventListener('click', () => { jourChoisi = jour; heureChoisie = null; dessinerJours(); dessinerCreneaux(); majRecap(); });
    conteneur.appendChild(b);
  }
  $('jours-prec').disabled = decalage === 0;
  $('jours-suiv').disabled = decalage + JOURS_VISIBLES >= JOURS_MAX;
}

function dessinerCreneaux() {
  const conteneur = $('creneaux');
  conteneur.innerHTML = '';
  if (!jourChoisi) {
    conteneur.innerHTML = '<p class="col-span-full text-sm text-muted-foreground">Choisissez d\'abord un jour.</p>';
    return;
  }
  heuresDisponibles(jourChoisi).forEach((h) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', h === heureChoisie);
    b.className = 'relative rounded-md py-2 text-sm ring-1 ring-border transition-colors hover:bg-secondary aria-pressed:bg-sage aria-pressed:text-sage-foreground aria-pressed:ring-sage';
    b.innerHTML = `${String(h).padStart(2, '0')}:00${majore(jourChoisi, h) ? '<span class="absolute top-1 right-1 size-1.5 rounded-full bg-clay" title="Tarif soir / week-end"></span>' : ''}`;
    b.addEventListener('click', () => { heureChoisie = h; dessinerCreneaux(); majRecap(); });
    conteneur.appendChild(b);
  });
}

function valeurRadio(nom) {
  const r = form.querySelector(`input[name="${nom}"]:checked`);
  return r ? r.value : '';
}

function tarifDeBase() {
  const cle = $('champ-motif').value;
  const motif = motifs[cle];
  if (motif && motif.type === 'bilan') return [tarifs.bilan, 'le bilan complet'];
  if (jourChoisi && heureChoisie !== null && majore(jourChoisi, heureChoisie)) return [tarifs.majore, 'soir / week-end'];
  if (cle === 'emdr') return [tarifs.emdr, 'la séance'];
  if (valeurRadio('pour qui') === 'Pour mon enfant') return [tarifs.enfant, '40 min'];
  return [tarifs.consultation, '45 min'];
}

// Consultation à domicile : frais de déplacement en plus, à la charge du patient.
const domicile = () => Boolean(form.querySelector('input[data-lieu="domicile"]:checked'));

function tarif() {
  const [prix, detail] = tarifDeBase();
  const bilan = (motifs[$('champ-motif').value] || {}).type === 'bilan'; // pas de réduction sur les bilans
  if (!bilan && form.querySelector('input[name="tarif jeunes"]').checked) {
    const reduit = Math.round(parseInt(prix, 10) * (1 - tarifs.reduction / 100));
    return `${reduit} € · tarif réduit −${tarifs.reduction} %${domicile() ? ' + déplacement (15 € Paris, 25 € petite couronne)' : ''}`;
  }
  return `${prix} · ${detail}${domicile() ? ' + déplacement (15 € Paris, 25 € petite couronne)' : ''}`;
}

function majRecap() {
  const motif = motifs[$('champ-motif').value];
  $('r-motif').textContent = motif ? motif.libelle : '—';
  $('r-psy').textContent = valeurRadio('praticien') || 'Sans préférence';
  $('r-lieu').textContent = valeurRadio('lieu') || '—';
  $('note-domicile').hidden = !domicile();
  const creneau = jourChoisi && heureChoisie !== null
    ? `${fmtJour.format(jourChoisi)} à ${heureChoisie} h` : '—';
  $('r-creneau').textContent = creneau;
  $('r-tarif').textContent = tarif();
  $('champ-date').value = jourChoisi ? fmtJour.format(jourChoisi) : '';
  $('champ-heure').value = heureChoisie !== null ? `${heureChoisie}:00` : '';
  $('champ-tarif').value = tarif();
}

function majMotif() {
  const cle = $('champ-motif').value;
  const motif = motifs[cle];
  // Met en avant les praticiens qui accompagnent ce motif
  Object.entries(psys).forEach(([id, p]) => {
    const badge = form.querySelector(`[data-reco="${id}"]`);
    if (badge) badge.hidden = !p.slugs.includes(cle);
  });
  const lien = $('lien-motif');
  if (motif && motif.lien) {
    lien.innerHTML = `Pour mieux comprendre : <a href="${motif.lien}" class="text-sage underline underline-offset-4" target="_blank">lire la page ${motif.libelle}</a>`;
    lien.hidden = false;
  } else if (cle === 'urgence') {
    lien.innerHTML = 'Nous essayons de vous recevoir <strong>dans la journée si un psychologue est disponible</strong> ; le choix du créneau est facultatif. Nous ne prenons pas en charge les situations de crise : en cas de danger, appelez le 15, le 112 ou le 3114, ou rendez-vous aux urgences (<a href="urgences.html" class="underline">contacts d\'urgence</a>).';
    lien.hidden = false;
  } else {
    lien.hidden = true;
  }
  majRecap();
}

// Pré-remplissage depuis l'URL : rdv.html?motif=tdah&psy=viva&lieu=visio
const params = new URLSearchParams(location.search);
if (params.get('motif') && motifs[params.get('motif')]) $('champ-motif').value = params.get('motif');
if (params.get('psy')) {
  const r = form.querySelector(`input[data-psy="${CSS.escape(params.get('psy'))}"]`);
  if (r) r.checked = true;
}
if (params.get('lieu')) {
  const r = form.querySelector(`input[data-lieu="${CSS.escape(params.get('lieu'))}"]`);
  if (r) r.checked = true;
}

// Lieux proposés : seulement ceux du psychologue choisi (tous si « Sans préférence »).
function majLieux() {
  const choisi = form.querySelector('input[name="praticien"]:checked');
  const psy = choisi && psys[choisi.dataset.psy];
  form.querySelectorAll('input[data-lieu]').forEach((r) => {
    const propose = !psy || psy.lieux.includes(r.dataset.lieu);
    r.closest('label').style.display = propose ? '' : 'none';
    r.disabled = !propose;
    if (!propose && r.checked) r.checked = false;
  });
  const lieux = psy ? psy.lieux.length : 0;
  $('note-lieux').textContent = psy ? `${choisi.value} consulte ${lieux > 1 ? 'dans ces lieux' : 'à cet endroit'}. Pour voir tous les lieux du réseau, choisissez « Sans préférence ».` : '';
  $('note-lieux').hidden = !psy;
}
form.querySelectorAll('input[name="praticien"]').forEach((r) => r.addEventListener('change', () => { majLieux(); majRecap(); }));
majLieux();

$('jours-prec').addEventListener('click', () => { decalage = Math.max(0, decalage - JOURS_VISIBLES); dessinerJours(); });
$('jours-suiv').addEventListener('click', () => { decalage += JOURS_VISIBLES; dessinerJours(); });
$('champ-motif').addEventListener('change', majMotif);
form.addEventListener('change', (ev) => { if (ev.target.id !== 'champ-motif') majRecap(); });

dessinerJours();
dessinerCreneaux();
majMotif();

// Envoi
const alerte = $('form-alerte');
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('form-merci').hidden = true;
  $('form-erreur').hidden = true;

  const urgence = $('champ-motif').value === 'urgence';
  let manque = '';
  if (!$('champ-motif').value) manque = 'Choisissez un motif de consultation.';
  else if (!valeurRadio('lieu')) manque = 'Choisissez un lieu : cabinet, domicile ou téléconsultation.';
  else if (!urgence && (!jourChoisi || heureChoisie === null)) manque = 'Choisissez un jour et un horaire.';
  else if (!$('champ-tel').value.trim() && !$('champ-email').value.trim()) manque = 'Indiquez votre numéro de mobile et/ou votre email : c\'est là que vous recevrez la confirmation du rendez-vous.';
  else if (!form.checkValidity()) manque = 'Complétez vos coordonnées et acceptez d\'être recontacté.';
  if (manque) {
    alerte.textContent = manque;
    alerte.hidden = false;
    form.reportValidity();
    return;
  }
  alerte.hidden = true;

  const bouton = form.querySelector('button[type="submit"]');
  bouton.disabled = true;
  bouton.textContent = 'Envoi en cours…';
  try {
    const rep = await fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    });
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok || String(data.success) !== 'true') throw new Error(data.message || rep.status);
    $('form-merci').hidden = false;
    form.reset();
    jourChoisi = null;
    heureChoisie = null;
    dessinerJours();
    dessinerCreneaux();
    majMotif();
  } catch (err) {
    $('form-erreur').hidden = false;
  } finally {
    bouton.disabled = false;
    bouton.textContent = 'Envoyer ma demande';
  }
});
