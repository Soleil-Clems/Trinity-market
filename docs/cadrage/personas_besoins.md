# C-01 · Personas, besoins & secteur d'activité — Time Manager

Oct 6, 2026 · @Tanguy

## Résumé

Nous positionnons Trinity Market comme un **e-commerçant B2C pure player** (maison, électroménager et high-tech grand public), qui opère lui-même son entrepôt et son service client. Ce choix explique pourquoi la gestion du temps est devenue critique : horaires postés, pics saisonniers et équipes mixtes sur site / télétravail.

Nous retenons 5 personas : une conseillère service client, un préparateur de commandes, une développeuse en hybride, une manager d'équipe et un responsable RH-paie. Trois besoins dominent :

1. **Pointer en moins de 5 secondes**, où que l'on travaille (entrepôt, bureau, domicile).
2. **Des heures justes et traçables** : chaque correction est motivée et historisée, car une erreur de paie déclenche un conflit social.
3. **Voir les dérives avant qu'elles coûtent** : heures supplémentaires, retards sur les créneaux, dépassements des durées légales pendant les pics.

Ces besoins fixent 3 KPIs (heures sup vs contrat, ponctualité sur créneau, conformité légale) et 4 décisions produit : pas de géolocalisation, heure fixée par le serveur, corrections tracées, connexion Microsoft par défaut.

## Secteur d'activité retenu

Trinity Market est un **e-commerçant B2C pure player** : il vend en ligne des produits maison, électroménager et high-tech grand public, en France. Il ne sous-traite ni sa logistique ni son service client : il possède un entrepôt et un centre de relation client, ce qui donne leur sens aux départements Opérations et Service client.

### Organisation supposée des 600 employés

| Département | Effectif estimé | Mode de travail | Horaires | Enjeu temps de travail |
| --- | --- | --- | --- | --- |
| Opérations (entrepôt, transport, planification) | 240 | Sur site ; planificateurs en hybride | Postes 6h-13h / 13h-20h | Pics saisonniers, durées maximales, pauses |
| Service client | 180 | Hybride (3 j domicile / 2 j site) | Créneaux 8h-21h, samedi inclus | Ponctualité sur créneau, couverture des plages |
| IT | 110 | Hybride | Horaires variables, plage fixe 10h-16h | Oublis de pointage, astreintes |
| Finance | 45 | Hybride | Horaires de bureau | Pics de clôture mensuelle |
| RH | 25 | Hybride | Horaires de bureau | Fiabilité des données de paie |

Ces effectifs sont des hypothèses de travail, cohérentes avec une entreprise de 600 personnes de ce secteur. Ils servent à dimensionner les données de démo et les KPIs.

### Pourquoi ce secteur

- **Il colle au sujet.** Le sujet parle de « digital retail », de 5 départements dont Opérations et Service client, et de travail hybride. Un e-commerçant avec entrepôt est le seul modèle où ces 3 éléments coexistent naturellement.
- **Il rend le problème réel.** Black Friday, Noël et les soldes multiplient le volume de commandes. Les heures supplémentaires explosent, les durées légales sont frôlées, et une erreur de comptage se paie en conflit social : c'est exactement le risque de « grève » évoqué par le sujet.
- **Il explique la croissance.** Passer de 600 à plus de 2000 employés en 3 ans est typique d'une scale-up e-commerce. Il faut aussi absorber des renforts saisonniers : le besoin « le manager enregistre les employés » devient central.
- **Il met l'application à l'épreuve.** On doit servir à la fois un préparateur sur un terminal partagé en entrepôt, une conseillère depuis son domicile et un développeur en horaires variables. Une app qui marche pour ces trois profils marchera partout.
- **Il produit des KPIs défendables.** Ponctualité sur créneau, heures sup vs contrat et conformité légale ont un impact direct sur le service client, la masse salariale et le risque juridique.

### Alternatives écartées

| Alternative | Pourquoi nous l'écartons |
| --- | --- |
| Commerce physique (réseau de magasins) | Contredit « digital retail » ; le pointage y repose déjà sur des badgeuses en magasin. |
| Éditeur de logiciel / SaaS | Population surtout cadre au forfait-jours : on compte des jours, pas des heures. Le pointage et les KPIs perdent leur intérêt. |
| Marketplace sans logistique | Pas d'équipes postées : le département Opérations n'aurait plus de sens et le besoin de suivi horaire s'effondre. |

## Méthodologie

Trinity Market est fictive : nos personas sont des **proto-personas**, construits à partir du sujet, du fonctionnement réel du e-commerce et du droit du travail français. Nous les validons ensuite par 5 entretiens courts de 15 minutes, avant la fin du sprint 1.

Cibles d'entretien : une personne en centre d'appels ou service client, une en entrepôt ou logistique, une en hybride avec horaires variables, une qui encadre une équipe, une qui gère la paie ou les RH.

### Guide d'entretien

1. Comment votre temps de travail est-il suivi aujourd'hui ? Qu'est-ce qui vous agace dans ce système ?
2. Racontez la dernière fois qu'une erreur d'heures vous a concerné. Comment a-t-elle été corrigée ?
3. Où êtes-vous et sur quel appareil au moment d'arriver ou de partir ?
4. Qu'aimeriez-vous savoir sur vos heures sans avoir à le demander ?
5. (Managers, RH) Quelle information vous manque pour piloter votre équipe ? Que vérifiez-vous avant la paie ?
6. (Tous) Qu'est-ce qui vous dérangerait dans une application de pointage ?

Chaque réponse qui contredit une hypothèse est reportée dans la section « Hypothèses à valider » et peut modifier le backlog.

## Personas

Trois personas utilisent l'application en rôle **employé**, deux en rôle **manager**. Chacun représente une contrainte différente que l'application doit absorber.

### 1. Camille Martin — conseillère service client

29 ans, CDI 35 h, hybride (3 jours à domicile, 2 sur site). Créneaux tournants 8h-16h ou 13h-21h, un samedi sur deux. Travaille sur PC portable avec un softphone.

- **Objectifs** : commencer son créneau à l'heure ; récupérer ou se faire payer ses heures de Black Friday.
- **Frustrations** : un tableur rempli à la main le vendredi ; des heures sup de décembre réglées avec deux mois de retard ; un retard reproché alors que son PC mettait 5 minutes à démarrer.
- **Besoins dans l'app** : pointer depuis le navigateur avant d'ouvrir la téléphonie ; voir son compteur de la semaine et ses heures sup en temps réel ; demander une correction quand elle conteste une heure.

### 2. Karim Benali — préparateur de commandes

41 ans, CDI 35 h, 100 % sur site à l'entrepôt. Poste du matin 6h-13h, samedis travaillés en période de pic. Pas de PC : un smartphone personnel ou la tablette partagée à l'entrée.

- **Objectifs** : être payé exactement pour ses heures, surtout en période de pic.
- **Frustrations** : une feuille d'émargement papier recopiée avec des erreurs ; une file d'attente pour signer ; des gants et des mains souvent occupées.
- **Besoins dans l'app** : un bouton unique, grand, utilisable sur mobile en 5 secondes ; des libellés courts doublés d'icônes ; son total de la semaine visible sans naviguer.

### 3. Léa Nguyen — développeuse

33 ans, CDI 35 h en horaires variables (plage fixe 10h-16h), hybride. Astreintes ponctuelles le soir.

- **Objectifs** : zéro friction ; ne pas y penser.
- **Frustrations** : elle oublie de pointer son départ ; elle refuse un énième mot de passe.
- **Besoins dans l'app** : connexion Microsoft ; un signalement quand une session est restée ouverte ; une correction rapide ; une interface entièrement utilisable au clavier.

### 4. Sophie Lambert — manager service client

38 ans, encadre 16 conseillers répartis entre domicile et site. Doit intégrer 6 renforts saisonniers en novembre.

- **Objectifs** : couvrir chaque créneau ; tenir le budget d'heures sup ; intégrer vite les nouveaux.
- **Frustrations** : elle découvre les retards en fin de semaine ; elle compile trois fichiers ; elle ne sait pas qui est réellement en poste à un instant donné.
- **Besoins dans l'app** : voir qui est présent maintenant ; les moyennes journalières et hebdomadaires de l'équipe sur une période ; la ponctualité par créneau ; le tableau de bord de chaque membre ; créer un employé en moins d'une minute ; corriger un oubli avec un motif.

### 5. Marc Dubois — responsable RH et paie

50 ans, pilote la paie des 600 salariés et prépare la montée à 2000. Principal interlocuteur de l'inspection du travail et du CSE.

- **Objectifs** : une paie juste du premier coup ; aucun contentieux sur les heures sup ; être prêt en cas de contrôle.
- **Frustrations** : relancer les managers chaque fin de mois ; des données incohérentes entre équipes ; un litige prud'homal sur des heures sup non tracées.
- **Besoins dans l'app** : des KPIs à l'échelle de l'entreprise ; des alertes sur les durées légales ; l'historique de chaque correction ; un export pour la paie ; des relevés conservés même quand un compte est supprimé.

### Parties prenantes sans persona

| Acteur | Ce qu'il exige de l'application |
| --- | --- |
| DSI / RSSI | Connexion via les comptes Microsoft existants, mots de passe protégés, accès cloisonnés par rôle |
| DPO | Minimisation des données, durées de conservation, droits d'accès et d'effacement |
| CSE | Être informé et consulté avant le déploiement d'un outil qui contrôle l'activité des salariés |

## User stories priorisées

13 stories sont en **Must** : elles forment le périmètre minimal livré à la keynote et couvrent toutes les exigences du sujet. Les Should s'ajoutent si le planning le permet ; les Won't sont des refus assumés, justifiés par le droit.

| ID | Persona | En tant que… je veux… afin de… | Priorité |
| --- | --- | --- | --- |
| US-01 | Karim, Camille | En tant qu'employé, je veux pointer mon arrivée et mon départ en un geste, sur mobile ou PC, afin de ne plus remplir de feuille. | Must |
| US-02 | Camille | En tant qu'employée, je veux voir mes heures du jour, de la semaine et mon écart au contrat, afin de vérifier ma paie. | Must |
| US-03 | Léa | En tant qu'employée, je veux me connecter avec mon compte Microsoft, afin de ne pas gérer un mot de passe de plus. | Must |
| US-04 | Tous | En tant qu'utilisateur, je veux modifier mes informations et supprimer mon compte, afin de garder la maîtrise de mes données. | Must |
| US-05 | Sophie | En tant que manager, je veux créer un employé et l'ajouter à mon équipe, afin qu'un saisonnier pointe dès son premier jour. | Must |
| US-06 | Sophie | En tant que manager, je veux gérer mes équipes et leurs membres, afin de refléter l'organisation réelle. | Must |
| US-07 | Sophie | En tant que manager, je veux les moyennes journalières et hebdomadaires de mon équipe sur une période, afin de détecter une surcharge. | Must |
| US-08 | Sophie | En tant que manager, je veux consulter les heures et le tableau de bord d'un membre, afin de préparer un entretien factuel. | Must |
| US-09 | Sophie | En tant que manager, je veux corriger un pointage avec un motif obligatoire, afin que la paie soit juste et la correction traçable. | Must |
| US-10 | Sophie | En tant que manager, je veux suivre la ponctualité par rapport aux créneaux, afin de garantir la couverture du service client. | Must |
| US-11 | Marc | En tant que RH, je veux suivre les heures sup par rapport au contrat, par équipe, afin de maîtriser la masse salariale. | Must |
| US-12 | Marc | En tant que RH, je veux que chaque correction soit historisée, afin de répondre à un contrôle ou un litige. | Must |
| US-13 | Marc | En tant que RH, je veux que les relevés restent conservés après la suppression d'un compte, afin de respecter mes obligations légales. | Must |
| US-14 | Léa | En tant qu'employée, je veux être avertie d'une session restée ouverte, afin de la corriger avant la paie. | Should |
| US-15 | Camille | En tant qu'employée, je veux demander une correction en expliquant pourquoi, afin de contester une heure sans passer par un mail. | Should |
| US-16 | Sophie | En tant que manager, je veux voir qui est en poste maintenant, afin de réagir à un créneau découvert. | Should |
| US-17 | Marc | En tant que RH, je veux être alerté des dépassements de durées légales, afin d'agir avant l'infraction. | Should |
| US-18 | Marc | En tant que RH, je veux exporter les heures d'une période en CSV, afin d'alimenter la paie sans ressaisie. | Should |
| US-19 | Karim | En tant que préparateur, je veux pointer avec un badge sur une borne à l'entrée de l'entrepôt, afin de ne pas sortir mon téléphone. | Could |
| US-20 | Sophie | En tant que manager, je veux qu'un assistant IA résume les tendances de mon équipe, afin de gagner du temps d'analyse. | Could |
| US-21 | — | Géolocaliser l'employé au moment du pointage. | Won't |
| US-22 | — | Pointer par empreinte digitale ou reconnaissance faciale. | Won't |

US-19 et US-20 correspondent aux bonus du sujet (module physique, module IA). US-21 et US-22 sont refusées pour les raisons expliquées dans la section suivante.

## Contraintes légales

L'application doit mesurer le temps de façon fiable **sans surveiller plus que nécessaire**. Le droit du travail fixe ce qu'il faut compter ; le RGPD et la CNIL fixent comment le collecter.

### Droit du travail : ce que l'application doit compter et signaler

| Règle | Référence | Conséquence dans l'application |
| --- | --- | --- |
| L'employeur doit mesurer la durée de travail journalière par un système objectif, fiable et accessible | CJUE, 14 mai 2019, C-55/18 (CCOO) | Raison d'être de l'outil ; heure fixée par le serveur ; chaque employé voit ses propres relevés |
| Durée légale : 35 h par semaine | C. trav. L3121-27 | Base du calcul des heures sup (KPI 1) |
| Maximum 10 h par jour et 48 h par semaine ; 44 h en moyenne sur 12 semaines | L3121-18, L3121-20, L3121-22 | Alertes de dépassement (KPI 3) |
| Repos quotidien de 11 h consécutives | L3131-1 | Alerte si moins de 11 h entre un départ et l'arrivée suivante |
| Pause de 20 min dès 6 h de travail | L3121-16 | Signalement des journées de plus de 6 h sans interruption |
| Heures sup majorées de 25 % (8 premières) puis 50 %, à défaut d'accord | L3121-36 | Heures sup ventilées par semaine civile |
| Documents de décompte du temps tenus à disposition de l'inspection pendant 1 an ; salaires réclamables sur 3 ans | D3171-16, L3245-1 | Relevés conservés 3 ans, y compris après suppression d'un compte (anonymisation) |
| Information et consultation du CSE avant tout outil de contrôle de l'activité ; information préalable de chaque salarié | L2312-38, L1222-4 | Prérequis au déploiement, à mentionner à la keynote |

### RGPD et CNIL : comment collecter

- **Pas de géolocalisation.** Le Conseil d'État juge qu'elle n'est licite pour contrôler la durée du travail que si aucun autre moyen n'existe, même moins efficace ([CE, 15 décembre 2017, n° 403776](https://cms.law/fr/fra/a-la-une/geolocalisation-et-controle-du-temps-de-travail-rien-n-est-permis-ou-presque)). La Cour de cassation l'a rappelé le 18 mars 2026 ([analyse](https://kohenavocats.fr/?p=2124552)). Un pointage déclaratif suffit : US-21 est refusée.
- **Pas de biométrie.** Pour le seul contrôle des horaires, la CNIL juge une pointeuse par empreinte ou reconnaissance faciale excessive ([même source](https://kohenavocats.fr/?p=2124552)) : US-22 est refusée.
- **Minimisation.** On ne collecte que l'identité professionnelle, les heures d'arrivée et de départ, et le motif d'une correction. Pas d'adresse IP conservée avec le pointage, pas de capture d'écran ni de suivi d'activité.
- **Accès cloisonnés.** Un manager ne voit que ses équipes ; un employé ne voit que ses données.
- **Droits des personnes.** Accès et export de ses données ; suppression traduite en anonymisation, car la conservation des relevés est une obligation légale.

Les articles du Code du travail sont cités de mémoire et doivent être vérifiés sur Légifrance avant la keynote.

## Des besoins aux features et aux KPIs

Chaque KPI répond à une frustration précise d'un persona : c'est le fil que la keynote doit dérouler.

### Les 3 KPIs retenus (entrée de la tâche C-02)

| KPI | Formule | Persona servi | Seuil d'alerte proposé |
| --- | --- | --- | --- |
| 1. Heures sup vs contrat | Heures réelles de la semaine − heures contractuelles, cumulées sur la période, par employé et par équipe | Marc (masse salariale), Camille (paie) | Plus de 8 h sup sur une semaine |
| 2. Ponctualité sur créneau | Arrivées au plus tard 5 min après l'horaire théorique ÷ arrivées attendues | Sophie (couverture du service client) | Moins de 90 % sur la semaine |
| 3. Conformité légale | Journées sans dépassement (10 h/j, 11 h de repos, pause) ÷ journées travaillées, détaillée par règle | Marc (risque juridique), Karim (pics) | Toute infraction remontée le jour même |

Le KPI 2 ne s'applique qu'aux équipes à créneaux (Service client, Opérations). Pour les horaires variables, il se calcule sur le début de la plage fixe.

### Décisions produit issues des besoins

| Décision | Pourquoi | Tâches impactées |
| --- | --- | --- |
| Un seul bouton de pointage, grand, en tête de l'écran mobile | Karim pointe avec les mains occupées ; objectif de 5 secondes | F-06, C-06 |
| Heure fixée par le serveur, jamais par le client | Exigence de fiabilité (CJUE) ; empêche un pointage antidaté | B-09 |
| Toute correction exige un motif et reste historisée | Litiges de Marc ; contestations de Camille | B-09, B-13 |
| Signalement des sessions restées ouvertes, sans clôture automatique | Oublis de Léa ; une clôture silencieuse fausserait la paie | B-09, F-07 |
| Connexion Microsoft mise en avant sur l'écran de login | Refus d'un mot de passe de plus ; exigence DSI | B-05, F-03 |
| Création d'un employé en moins d'une minute par le manager | Renforts saisonniers de Sophie | B-07, F-08 |
| Ni géolocalisation ni biométrie | Jurisprudence et CNIL | Toutes |
| Anonymisation à la suppression d'un compte | Conservation légale des relevés vs droit à l'effacement | B-13 |
| Libellés courts doublés d'icônes, contraste AA | Profils variés, dont des non-francophones natifs en entrepôt | F-02, F-15 |

## Hypothèses à valider

Ces points peuvent modifier le modèle de données ou le backlog : ils doivent être tranchés avant la fin du sprint 1, le 16 octobre.

- [ ] Mener les 5 entretiens et reporter ici chaque hypothèse contredite.
- [ ] Confirmer que la population suivie est à 35 h. Les cadres au forfait-jours comptent des jours, pas des heures : ils pointeraient sans KPI horaire.
- [ ] Trancher le rôle de Marc (RH) : manager rattaché à toutes les équipes, ou troisième rôle « admin » au-delà des deux imposés par le sujet.
- [ ] Choisir la gestion des créneaux : un horaire théorique par équipe (simple, prévu dans C-04) ou un vrai planning par employé (plus juste pour le service client, mais plus long).
- [ ] Définir le pointage sur la tablette partagée de l'entrepôt : reconnexion à chaque passage, ou badge NFC en bonus (US-19).
- [ ] Valider les seuils d'alerte des KPIs avec un manager interrogé.
