// Paiement d'un rendez-vous confirmé.
// Le lien envoyé au patient décrit la séance, sans aucune donnée personnelle :
//   paiement.html?d=2026-10-20&h=10:00&l=paris&p=andie&t=adulte&r=0&a=
// d : date, h : heure, l : lieu, p : psychologue, t : type (adulte|enfant|emdr|bilan),
// r : 1 si tarif réduit 18 – 25 ans (jamais appliqué aux bilans), a : adresse du cabinet (lieu « idf »).
// Le montant est recalculé ici à partir des tarifs du site, jamais lu dans le lien.

const { tarifs, psys, paiement } = window.EC;
const MEMOIRE = 'ec-rdv-paiement';

const TYPES = {
  adulte: { libelle: 'Consultation adulte / ado', duree: 45 },
  enfant: { libelle: 'Consultation enfant', duree: 40 },
  emdr: { libelle: 'Séance d\'EMDR', duree: 45 },
  bilan: { libelle: 'Bilan psychologique complet', duree: 60 },
};

const euros = (txt) => parseInt(txt, 10);
const majuscule = (txt) => txt.charAt(0).toUpperCase() + txt.slice(1);
// « auprès de Viva », mais « auprès d'Andie »
const deNom = (nom) => (/^[aeiouyéèêh]/i.test(nom) ? `d'${nom}` : `de ${nom}`);

function lireRdv(params) {
  const d = params.get('d') || '';
  const h = params.get('h') || '';
  const t = params.get('t') || 'adulte';
  const l = params.get('l') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(h) || !TYPES[t] || !paiement.lieux[l]) return null;
  const [an, mois, jour] = d.split('-').map(Number);
  const [hh, mm] = h.split(':').map(Number);
  const debut = new Date(an, mois - 1, jour, hh, mm);
  if (Number.isNaN(debut.getTime())) return null;
  return {
    d, h, t, l, debut,
    p: psys[params.get('p')] ? params.get('p') : '',
    r: params.get('r') === '1',
    a: (params.get('a') || '').slice(0, 160),
  };
}

// Réduction jeunes adultes : jamais sur les bilans.
const reduit = (rdv) => rdv.r && rdv.t !== 'bilan';

// Même règle que la prise de RDV : bilan, puis tarif soir / week-end, puis type de séance.
function montant(rdv) {
  const jourSemaine = rdv.debut.getDay();
  const majore = rdv.debut.getHours() >= 20 || jourSemaine === 0 || jourSemaine === 6;
  let base;
  if (rdv.t === 'bilan') base = euros(tarifs.bilan);
  else if (majore) base = euros(tarifs.majore);
  else if (rdv.t === 'emdr') base = euros(tarifs.emdr);
  else if (rdv.t === 'enfant') base = euros(tarifs.enfant);
  else base = euros(tarifs.consultation);
  return reduit(rdv) ? Math.round(base * (1 - tarifs.reduction / 100)) : base;
}

function texteRdv(rdv) {
  const type = TYPES[rdv.t];
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(rdv.debut);
  const heure = rdv.h.replace(':', ' h ').replace(' h 00', ' h');
  const adresse = rdv.l === 'visio'
    ? 'Le lien de la visio vous est envoyé par email avant la séance.'
    : (paiement.adresses[rdv.l] || rdv.a || 'L\'adresse du cabinet vous est communiquée par email.');
  return {
    date,
    heure,
    psy: rdv.p ? psys[rdv.p].nom : 'Votre psychologue',
    seance: rdv.t === 'bilan' ? type.libelle : `${type.libelle} · ${type.duree} min`,
    lieu: paiement.lieux[rdv.l],
    adresse,
    montant: `${montant(rdv)} €${reduit(rdv) ? ' (tarif réduit)' : ''}`,
  };
}

function rdvLienPsy(rdv) {
  // Lien de paiement propre au psychologue (c'est lui qui facture), s'il en a un.
  const liens = (rdv.p && psys[rdv.p].liens) || {};
  const lien = liens[String(montant(rdv))];
  if (!lien) return '';
  // Référence du RDV : seulement comprise par les liens Stripe.
  if (!lien.includes('stripe.com')) return lien;
  const ref = `${rdv.d}_${rdv.h.replace(':', 'h')}_${rdv.p || 'reseau'}_${rdv.t}`;
  return `${lien}${lien.includes('?') ? '&' : '?'}client_reference_id=${encodeURIComponent(ref)}`;
}

function fichierAgenda(rdv) {
  const t = texteRdv(rdv);
  const fin = new Date(rdv.debut.getTime() + TYPES[rdv.t].duree * 60000);
  const f = (x) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}T${String(x.getHours()).padStart(2, '0')}${String(x.getMinutes()).padStart(2, '0')}00`;
  const echap = (x) => x.replace(/[\\,;]/g, (c) => `\\${c}`);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//L Espace Commun//RDV//FR', 'BEGIN:VEVENT',
    `UID:${rdv.d}-${rdv.h}-${rdv.p}@lespacecommun.fr`,
    `DTSTART:${f(rdv.debut)}`, `DTEND:${f(fin)}`,
    `SUMMARY:${echap(`Séance avec ${t.psy} — L'Espace Commun`)}`,
    `LOCATION:${echap(rdv.l === 'visio' ? 'Téléconsultation' : t.adresse)}`,
    `DESCRIPTION:${echap(`${t.seance}. En cas d'empêchement, prévenez au moins 48 h avant : ${paiement.email}`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Rappel de séance', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rendez-vous-espace-commun.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function memoriser(params) {
  try { sessionStorage.setItem(MEMOIRE, params.toString()); } catch (e) { /* stockage indisponible */ }
}
function relire() {
  try { return new URLSearchParams(sessionStorage.getItem(MEMOIRE) || ''); } catch (e) { return new URLSearchParams(); }
}

// Page patient
if (document.getElementById('p-contenu')) {
  const params = new URLSearchParams(location.search);
  const rdv = lireRdv(params);
  if (!rdv) {
    document.getElementById('p-invalide').hidden = false;
  } else {
    const t = texteRdv(rdv);
    const ecrire = (id, txt) => { document.getElementById(id).textContent = txt; };
    ecrire('p-date', majuscule(t.date));
    ecrire('p-heure', `à ${t.heure}`);
    ecrire('p-psy', t.psy);
    ecrire('p-seance', t.seance);
    ecrire('p-lieu', t.lieu);
    ecrire('p-adresse', t.adresse);
    ecrire('p-montant', t.montant);

    // Le patient règle directement son psychologue :
    // au cabinet en espèces ou par carte ; en visio par carte (lien du psychologue) ou virement.
    const qui = rdv.p ? psys[rdv.p].nom : 'votre psychologue';
    const passe = rdv.debut < new Date();
    const lien = rdvLienPsy(rdv);
    const payer = document.getElementById('p-payer');
    if (rdv.l === 'visio') {
      if (lien && !passe) {
        payer.href = lien;
        payer.hidden = false;
        payer.addEventListener('click', () => memoriser(params));
        document.getElementById('p-securite').hidden = false;
        ecrire('p-virement-texte', `${qui} vous transmet ses coordonnées bancaires sur simple demande.`);
        document.getElementById('p-virement').hidden = false;
      } else {
        ecrire('p-surplace-titre', 'Régler votre téléconsultation');
        ecrire('p-surplace-texte', `Directement auprès ${deNom(qui)}, par carte ou par virement bancaire : ${qui} vous transmet ses coordonnées de paiement avant la séance.`);
        document.getElementById('p-surplace').hidden = false;
      }
    } else {
      ecrire('p-surplace-titre', 'Payer le jour de la séance');
      ecrire('p-surplace-texte', `Directement auprès ${deNom(qui)}, au cabinet, en espèces ou par carte. Rien d'autre à faire d'ici là.`);
      document.getElementById('p-surplace').hidden = false;
    }
    document.getElementById('p-agenda').addEventListener('click', () => fichierAgenda(rdv));
    document.getElementById('p-contenu').hidden = false;
  }
}

// Page de remerciement (retour du prestataire de paiement)
if (document.getElementById('m-rappel')) {
  const rdv = lireRdv(relire());
  if (rdv) {
    const t = texteRdv(rdv);
    document.getElementById('m-date').textContent = `${majuscule(t.date)} à ${t.heure}`;
    document.getElementById('m-lieu').textContent = `${t.psy} · ${t.lieu}`;
    document.getElementById('m-rappel').hidden = false;
    const bouton = document.getElementById('p-agenda');
    bouton.hidden = false;
    bouton.addEventListener('click', () => fichierAgenda(rdv));
  }
}

window.ECPaiement = { lireRdv, montant, texteRdv, rdvLienPsy, deNom, TYPES };
