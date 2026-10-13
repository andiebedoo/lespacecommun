// Formulaire de candidature : envoi par FormSubmit à l'adresse du centre.
const form = document.getElementById('form-candidature');
const merci = document.getElementById('form-merci');
const erreur = document.getElementById('form-erreur');

// Les cases à cocher multiples sont regroupées en une seule ligne dans l'email.
function regrouper(donnees) {
  const sortie = new FormData();
  [...new Set(donnees.keys())].forEach((cle) => sortie.append(cle, donnees.getAll(cle).join(', ')));
  return sortie;
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!form.reportValidity()) return;
  merci.hidden = true;
  erreur.hidden = true;
  const bouton = form.querySelector('button[type="submit"]');
  bouton.disabled = true;
  bouton.textContent = 'Envoi en cours…';
  try {
    const rep = await fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: regrouper(new FormData(form)),
    });
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok || String(data.success) !== 'true') throw new Error(data.message || rep.status);
    merci.hidden = false;
    form.reset();
  } catch (err) {
    erreur.hidden = false;
  } finally {
    bouton.disabled = false;
    bouton.textContent = 'Envoyer ma candidature';
  }
});
