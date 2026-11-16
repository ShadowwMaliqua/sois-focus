# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Electron (Windows, Linux, macOS), JavaScript sans framework, HTML/CSS statiques dans `src/`. 100 % hors-ligne : CSP `style-src 'self'`, polices et modèles embarqués en local (`src/vendor`).

## Users
Une seule personne, le propriétaire du projet : il travaille des heures devant son PC et se laisse distraire par son téléphone. L'app reste surtout en arrière-plan (barre système) ; la fenêtre s'ouvre pour voir l'état en direct, régler la sensibilité ou consulter les stats de la session. Le dépôt GitHub est public, d'autres pourront l'installer.

## Product Purpose
Coach anti-distraction : la webcam (analyse 100 % locale, rien n'est enregistré ni envoyé) détecte un téléphone en main, un regard détourné de l'écran ou une absence du poste, puis alerte : bords de l'écran qui rougissent, bip, notification système (« Dépose ton tel ! »). Succès = rester concentré plus longtemps, sans être agacé par de fausses alertes.

## Positioning
Pas de voix de synthèse ni de gamification : un rappel visuel direct, sur tout l'écran, plus un score de session honnête. Fonctionne hors-ligne, installable partout, code ouvert.

## Operating Context
Fenêtre souvent à côté ou derrière l'outil de travail principal. Éclairage variable (bureau, soir). La caméra est la source ; l'aperçu vidéo miroir sert à vérifier cadrage et détection. Panneau de debug utile pendant le réglage.

## Capabilities and Constraints
- Démarrer/arrêter, pause, calibrer la position (tête et regard).
- Trois détections activables : téléphone, regard ailleurs, absence.
- Alertes : bords rouges (fenêtres transparentes sur chaque écran), bip, notification ; délai de tolérance, intervalle de rappel et sensibilité réglables ; lancement au démarrage.
- Stats de session : temps focus, score %, distractions par type, durée.
- Interface en français. Doit rester lisible avec la fenêtre étroite (≥ 760 px).
- Les ids/éléments lus par `src/app.js` doivent subsister (ou app.js est adapté).

## Brand Commitments
Nom : « Sois Focus ». Alerte rouge sur les bords de l'écran voulue par l'utilisateur (taille réduite à sa demande). Pas de voix synthétique.

## Evidence on Hand
Aucun témoignage ni chiffre. Dépôt : https://github.com/ShadowwMaliqua/sois-focus. Icône générée `build/icon.png` (cible verte sur fond sombre) : remplaçable.

## Product Principles
1. L'état (focus / distrait) se lit en une demi-seconde, sans lire de texte.
2. La caméra est locale et l'interface le montre sans dramatiser.
3. Alerter sans punir : sobre quand tout va bien, net quand il faut agir.
4. Les réglages sont à portée de main mais jamais devant la caméra.

## Accessibility & Inclusion
L'état ne repose pas uniquement sur la couleur (texte + icône). Contrastes suffisants, mouvement réduit respecté (`prefers-reduced-motion`), clavier utilisable.
