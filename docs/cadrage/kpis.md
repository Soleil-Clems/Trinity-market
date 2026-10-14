# C-02 · Choix & définition des KPIs — Time Manager

## Résumé

Le sujet impose au moins 2 KPIs pour aider les managers à superviser l'entreprise. Nous en retenons 3, issus des besoins identifiés dans [C-01](personas_besoins.md) :

| # | KPI | Statut | Persona servi |
| --- | --- | --- | --- |
| 1 | Heures sup vs contrat | Ferme | Marc, Camille |
| 2 | Conformité légale | Ferme | Marc, Karim |
| 3 | Ponctualité sur créneau | Sous condition | Sophie |

Les KPIs 1 et 2 se calculent avec les seuls pointages et les heures contractuelles : ils sont garantis pour la keynote. Le KPI 3 dépend d'une donnée qui n'existe pas encore, l'horaire prévu, et sera livré une fois la gestion des créneaux tranchée.

## Règles communes

- Une session restée ouverte (départ oublié) est exclue des calculs et signalée à part.
- Les journées et les semaines sont découpées dans le fuseau horaire de l'employé.
- Une semaine va du lundi au dimanche.
- Une session qui traverse minuit est répartie sur les deux jours.

## KPI 1 · Heures sup vs contrat

| Point | Définition |
| --- | --- |
| Formule | Pour chaque employé et chaque semaine : heures pointées − heures du contrat. Si le résultat est positif, ce sont des heures supplémentaires ; sinon on compte 0. Sur une période, on additionne les heures supplémentaires de chaque semaine. |
| Données sources | Pointages (arrivée, départ), heures contractuelles hebdomadaires de l'employé. |
| Granularité | Semaine. |
| Périmètre | Employé, équipe (somme des membres), entreprise. |
| Seuil d'alerte | Plus de 8 h supplémentaires pour un employé sur une semaine. |

**Besoin couvert.** Marc doit maîtriser la masse salariale et éviter les litiges sur des heures non tracées. Camille veut vérifier que ses heures de Black Friday sont bien comptées.

**Exemple.** Contrat de 35 h, 41 h pointées dans la semaine : 6 h supplémentaires.

## KPI 2 · Conformité légale

| Point | Définition |
| --- | --- |
| Formule | Journées sans infraction ÷ journées travaillées, en pourcentage. Le nombre d'infractions est aussi affiché règle par règle. |
| Données sources | Pointages uniquement. |
| Granularité | Jour, agrégé sur la période choisie. |
| Périmètre | Employé, équipe, entreprise. |
| Seuil d'alerte | Toute infraction est signalée le jour même. |

Une journée est en infraction dans l'un de ces cas :

| Règle | Infraction si |
| --- | --- |
| Durée quotidienne maximale | Plus de 10 h travaillées dans la journée |
| Repos quotidien | Moins de 11 h entre le départ précédent et l'arrivée |
| Pause | Plus de 6 h de travail sans interruption d'au moins 20 min |

Le plafond de 48 h par semaine est une règle hebdomadaire : il est affiché comme un compteur séparé (« semaines au-delà de 48 h ») et n'entre pas dans le pourcentage journalier.

**Besoin couvert.** Marc doit être prêt en cas de contrôle de l'inspection du travail. Karim subit les dépassements pendant les pics d'activité en entrepôt.

**Exemple.** 20 journées travaillées dans le mois, dont 2 au-delà de 10 h : 90 % de conformité.

## KPI 3 · Ponctualité sur créneau

| Point | Définition |
| --- | --- |
| Formule | Arrivées à l'heure ÷ arrivées comptées, en pourcentage. Une arrivée est à l'heure si le premier pointage du jour a lieu au plus tard 5 min après l'horaire prévu. |
| Données sources | Pointages, horaire prévu (absent du modèle de données à ce jour). |
| Granularité | Jour, agrégé à la semaine. |
| Périmètre | Équipe ; employé dans le tableau de bord du manager. Réservé aux équipes à créneaux (Service client, Opérations). |
| Seuil d'alerte | Moins de 90 % sur la semaine. |

Seuls les jours où l'employé a pointé sont comptés. Un jour sans pointage est une absence et non un retard : il relève de la table `absences`.

**Besoin couvert.** Sophie doit garantir la couverture de chaque créneau du service client et découvre aujourd'hui les retards en fin de semaine.

**Exemple.** 20 arrivées dans la semaine pour un créneau débutant à 8 h, dont 17 avant 8 h 05 : 85 % de ponctualité.

**Condition.** Ce KPI vaut ce que vaut la donnée « horaire prévu ». Avec un horaire unique par équipe, il est faux pour les créneaux tournants ; avec un créneau par employé et par jour, il est juste mais demande une saisie de planning.

## KPI écarté

**Taux de présence** (jours pointés ÷ jours ouvrés attendus). Déterminer les jours « attendus » demande les congés, les RTT, les arrêts maladie et les temps partiels. Il a été écarté parce que l'application ne collectait pas ces données. Avec la table `absences`, il redevient calculable ; il reste écarté à ce stade, et sa réintroduction est à décider en équipe. Les arrêts maladie y sont rangés dans le type « autre », pour ne faire entrer aucune donnée de santé dans le périmètre RGPD.

## Impacts sur le modèle de données (C-04)

| Donnée | Nécessaire à | État |
| --- | --- | --- |
| Arrivée et départ de chaque session | KPI 1, 2, 3 | Prévu |
| Heures contractuelles hebdomadaires par employé | KPI 1 | Prévu |
| Fuseau horaire par employé | KPI 1, 2, 3 | Prévu |
| Horaire prévu (par équipe ou par employé) | KPI 3 | À trancher |
| Absences (congés payés, RTT, autres) | Écart au contrat du résumé d'heures (B-10) | Proposé, à valider |

La table `absences` (employé, date de début, date de fin, type, auteur de la saisie) n'entre dans le calcul d'aucun des 3 KPIs. Elle sert à ne pas compter une semaine de congés comme des heures dues : chaque jour d'absence en semaine retire un cinquième du contrat hebdomadaire des heures attendues. Le type se limite à congés payés, RTT ou autre, sans motif médical.

## Écarts par rapport à C-01

- Le plafond de 48 h par semaine, cité dans les contraintes légales de C-01, est ajouté au KPI 2 sous forme de compteur.
- Le KPI 3 divise par les arrivées comptées et non par les arrivées attendues.
- Le suivi des absences est ajouté au modèle de données, alors que C-01 ne le prévoit pas.
