# 🎯 Sois Focus

Ton coach anti-distraction. Ta webcam surveille (**100 % en local**) et une voix te dit **« Sois focus ! »** dès que tu te laisses distraire.

## Ce qu'il détecte
- 📱 **Téléphone / tablette** dans ton champ de vision (détection d'objets).
- 👀 **Regard ailleurs** : tête tournée, baissée, ou regard fortement baissé (points du visage MediaPipe).
- 🚪 **Absence du poste** : plus de visage devant la caméra.

## Comment il réagit
Voix française, bip sonore et notification système, avec un **délai de tolérance** réglable (3 s par défaut) et un rappel périodique tant que tu restes distrait. Stats de session : temps focus, score, nombre de distractions.

## Confidentialité
- Les images ne quittent **jamais** ton ordinateur : pas d'enregistrement, pas d'envoi réseau.
- Les modèles d'IA sont embarqués : l'app fonctionne **hors ligne**.
- Fermer la fenêtre réduit l'app dans la barre système ; la surveillance continue jusqu'à « Quitter ».

## Installer
Télécharge l'installeur de ton système dans les [**Releases**](../../releases) :

| Système | Fichier |
|---|---|
| Windows | `Sois Focus Setup x.y.z.exe` (installeur) ou version portable |
| Linux | `.AppImage` (`chmod +x` puis lancer) ou `.deb` |
| macOS | `.dmg` |

> Les installeurs ne sont pas signés : Windows SmartScreen / macOS Gatekeeper peuvent demander une confirmation (« Informations complémentaires → Exécuter quand même », ou clic droit → Ouvrir sur macOS).

## Développer
```bash
npm install        # installe aussi les modèles IA (script postinstall)
npm start          # lance l'app
npm run dist       # construit l'installeur pour ton système (dossier dist/)
```
Si Electron n'est pas téléchargé (scripts npm bloqués) : `node node_modules/electron/install.js`.

### Publier une version
```bash
git tag v1.0.0 && git push origin v1.0.0
```
GitHub Actions construit alors les installeurs Windows, Linux et macOS et les attache à la release.

> Le workflow est rangé dans `ci-pending/release.yml` en attendant que le jeton GitHub ait le droit « workflow ». Pour l'activer : `gh auth refresh -h github.com -s workflow`, puis `mkdir -p .github/workflows && git mv ci-pending/release.yml .github/workflows/` et pousse.

## Interface
« La Copie d'examen » : papier Seyès, marge rouge, encre bleue. Ton focus est noté **sur 20**, la marge change de trait selon l'état (pleine, pointillée, doublée) et chaque distraction apparaît comme une remarque du correcteur. Polices embarquées : Playwrite FR Moderne et Atkinson Hyperlegible Next (licence SIL OFL).

## Stack
Electron · MediaPipe Tasks Vision (Face Landmarker + EfficientDet-Lite0) · JavaScript sans framework.

## Licence
MIT

## 🧰 Skills & ressources disponibles
- **Design / UI** : `design-taste-frontend`, `minimalist-ui`, `redesign-existing-projects`, `brandkit` ; `/impeccable init` puis `/impeccable <commande>` (audit, polish, critique, animate…) ; `ui-ux-pro-max`.
- **DESIGN.md prêts à l'emploi** : `~/.claude/design-md-library/design-md/<site>/`.
- **Navigateur / tests** : `playwright-skill`, `claude-in-chrome`.
- **Recherche internet** : `agent-reach` (`agent-reach doctor`).
- **SEO / Marketing** (page de présentation, lancement) : `claude-seo:*`, `marketing-skills:*`.
