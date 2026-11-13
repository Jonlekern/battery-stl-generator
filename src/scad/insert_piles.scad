// ===========================================================================
// Bibliothèque Insert Piles
//
// Dessine un insert de tiroir à partir de la liste `zones` définie plus haut.
// Aucun calcul de placement ici : chaque zone arrive déjà positionnée.
// Toutes les dimensions sont en millimètres.
// ===========================================================================

$fn = 48;

BANDE = (mode_etiquettes == "aucune") ? 0 : 8; // bande d'étiquette à l'avant d'une zone
CHANFREIN = min(0.6, paroi / 4);
RAYON_COIN = 2;   // coins des poches rectangulaires
PAROI_BAC = 1.6;
RELIEF = 0.6;     // épaisseur du relief ou de la gravure des étiquettes
ENCOCHE_BOUTON = 0.30; // hauteur du bloc au droit d'une encoche, en part du diamètre
ENCOCHE_RECT_RAYON = 7;
POLICE = "Liberation Sans:style=Bold";
DEPASSE = 1;      // les découpes dépassent du dessus pour une coupe franche

// --- Lecture d'une zone ----------------------------------------------------
function z_genre(z) = z[0];
function z_x(z) = z[1];
function z_y(z) = z[2];
function z_largeur(z) = z[3];
function z_profondeur(z) = z[4];
function z_hauteur(z) = z[5];
function z_colonnes(z) = z[6];
function z_rangees(z) = z[7];
function z_tournee(z) = z[8];
function z_pas_x(z) = z[9];
function z_pas_y(z) = z[10];
function z_a(z) = z[11];
function z_b(z) = z[12];
function z_prof_alveole(z) = z[13];
function z_texte(z) = z[14];
function z_hauteur_texte(z) = z[15];

// --- Alvéoles ----------------------------------------------------------------
// Chaque module est dessiné autour de l'origine : le centre de l'alvéole, à son fond.

// Trou rond pour une pile cylindrique debout.
module alveole_cyl(diametre, profondeur) {
  cylinder(d = diametre, h = profondeur + DEPASSE);
  // Chanfrein à 45° en haut, pour guider la pile.
  translate([0, 0, profondeur - CHANFREIN])
    cylinder(d1 = diametre, d2 = diametre + 2 * (CHANFREIN + DEPASSE), h = CHANFREIN + DEPASSE);
}

module rectangle_arrondi(lx, ly) {
  r = min(RAYON_COIN, lx / 2 - 0.01, ly / 2 - 0.01);
  offset(r = r) square([lx - 2 * r, ly - 2 * r], center = true);
}

// Poche à coins arrondis pour une pile rectangulaire debout.
module alveole_rect(lx, ly, profondeur) {
  linear_extrude(profondeur + DEPASSE) rectangle_arrondi(lx, ly);
  translate([0, 0, profondeur - CHANFREIN]) hull() {
    linear_extrude(0.001) rectangle_arrondi(lx, ly);
    translate([0, 0, CHANFREIN + DEPASSE])
      linear_extrude(0.001) offset(r = CHANFREIN + DEPASSE) rectangle_arrondi(lx, ly);
  }
}

// Fente pour une pile bouton sur la tranche. Le diamètre est en X, l'épaisseur
// en Y. Le fond est arrondi pour épouser la pile.
module alveole_bouton(diametre, epaisseur, profondeur) {
  translate([0, 0, diametre / 2])
    rotate([90, 0, 0]) cylinder(d = diametre, h = epaisseur, center = true);
  translate([-diametre / 2, -epaisseur / 2, diametre / 2])
    cube([diametre, epaisseur, max(profondeur - diametre / 2, 0) + DEPASSE]);
}

// Encoches d'une pile bouton : aux deux bouts de la fente, le bloc est abaissé
// pour dégager les bords de la pile, qu'on pince entre deux doigts.
// `pas_long` et `pas_ep` sont les pas de la case dans le sens de la longueur
// et de l'épaisseur. La découpe déborde largement de la case : elle rejoint
// celle des cases voisines, et c'est l'emprise de la zone qui l'arrête net.
module encoche_bouton(diametre, diametre_pile, pas_long, pas_ep, profondeur) {
  bas = ENCOCHE_BOUTON * diametre_pile;
  debut = diametre / 4;
  fin = pas_long / 2 + paroi / 2 + DEPASSE;
  largeur = pas_ep + paroi + 2 * DEPASSE;
  for (cote = [-1, 1])
    translate([cote > 0 ? debut : -fin, -largeur / 2, bas])
      cube([fin - debut, largeur, profondeur - bas + DEPASSE]);
}

// Encoches d'une poche rectangulaire : un demi-cylindre au milieu de chaque
// petit côté, sur la moitié haute de la poche.
module encoche_rect(lx, ly, profondeur) {
  centres = (lx >= ly) ? [[-lx / 2, 0], [lx / 2, 0]] : [[0, -ly / 2], [0, ly / 2]];
  for (c = centres)
    translate([c[0], c[1], profondeur / 2])
      cylinder(r = ENCOCHE_RECT_RAYON, h = profondeur / 2 + DEPASSE);
}

module alveole(z) {
  genre = z_genre(z);
  p = z_prof_alveole(z);
  if (genre == "cyl") {
    alveole_cyl(z_a(z) + jeu, p);
  } else if (genre == "rect") {
    lx = (z_tournee(z) ? z_b(z) : z_a(z)) + jeu;
    ly = (z_tournee(z) ? z_a(z) : z_b(z)) + jeu;
    alveole_rect(lx, ly, p);
    if (encoches) encoche_rect(lx, ly, p);
  } else if (genre == "bouton") {
    pas_long = z_tournee(z) ? z_pas_y(z) : z_pas_x(z);
    pas_ep = z_tournee(z) ? z_pas_x(z) : z_pas_y(z);
    rotate([0, 0, z_tournee(z) ? 90 : 0]) {
      alveole_bouton(z_a(z) + jeu, z_b(z) + jeu, p);
      if (encoches) encoche_bouton(z_a(z) + jeu, z_a(z), pas_long, pas_ep, p);
    }
  }
}

// --- Zones -------------------------------------------------------------------

// Centre de l'alvéole (i, j) dans le repère de la zone.
function centre_alveole(z, i, j) = [
  paroi / 2 + (i + 0.5) * z_pas_x(z),
  BANDE + paroi / 2 + (j + 0.5) * z_pas_y(z)
];

// Tout ce qu'on retire du bloc d'une zone, dans le repère de la zone.
module decoupes_zone(z) {
  if (z_genre(z) == "bac") {
    translate([PAROI_BAC, PAROI_BAC, fond])
      cube([z_largeur(z) - 2 * PAROI_BAC, z_profondeur(z) - 2 * PAROI_BAC, z_hauteur(z) - fond + DEPASSE]);
  } else {
    for (i = [0 : z_colonnes(z) - 1], j = [0 : z_rangees(z) - 1]) {
      c = centre_alveole(z, i, j);
      translate([c[0], c[1], z_hauteur(z) - z_prof_alveole(z)]) alveole(z);
    }
  }
}

// La plaque de fond et les blocs des zones, moins les alvéoles.
module corps_sans_gravure() {
  difference() {
    union() {
      cube([insert[0], insert[1], fond]);
      for (z = zones) translate([z_x(z), z_y(z), 0]) cube([z_largeur(z), z_profondeur(z), z_hauteur(z)]);
    }
    for (z = zones) translate([z_x(z), z_y(z), 0]) intersection() {
      // Les découpes d'une zone ne débordent jamais sur la zone voisine,
      // ni sur sa propre bande d'étiquette.
      avant = (z_genre(z) == "bac") ? 0 : BANDE;
      translate([0, avant, 0])
        cube([z_largeur(z), z_profondeur(z) - avant, z_hauteur(z) + DEPASSE]);
      decoupes_zone(z);
    }
  }
}

// --- Étiquettes --------------------------------------------------------------

// Où se pose le texte d'une zone, dans le repère de la zone : [x, y, z de la surface].
// Piles : au milieu de la bande avant, sur le dessus. Bac : à l'avant, sur le fond.
function position_etiquette(z) = (z_genre(z) == "bac")
  ? [z_largeur(z) / 2, PAROI_BAC + 2 + z_hauteur_texte(z) / 2, fond]
  : [z_largeur(z) / 2, BANDE / 2, z_hauteur(z)];

// Le volume des textes. En relief, il est posé sur la surface. En gravé, il
// occupe les RELIEF mm sous la surface. `surplus` le prolonge vers le haut.
module etiquettes(surplus = 0) {
  for (z = zones) if (z_texte(z) != "") {
    p = position_etiquette(z);
    dessous = (mode_etiquettes == "grave") ? RELIEF : 0;
    translate([z_x(z) + p[0], z_y(z) + p[1], p[2] - dessous])
      linear_extrude(RELIEF + surplus)
        text(z_texte(z), size = z_hauteur_texte(z), font = POLICE, halign = "center", valign = "center");
  }
}

module corps() {
  if (mode_etiquettes == "grave") {
    difference() {
      corps_sans_gravure();
      etiquettes(surplus = DEPASSE);
    }
  } else {
    corps_sans_gravure();
  }
}

// --- Pièce demandée ----------------------------------------------------------
// "corps"      : l'insert sans le volume des étiquettes (gravé le cas échéant).
// "etiquettes" : le texte seul, pour l'imprimer dans une autre couleur.
// "tout"       : l'insert en une seule pièce.
module insert() {
  if (piece == "etiquettes") {
    etiquettes();
  } else if (piece == "tout" && mode_etiquettes == "relief") {
    union() {
      corps();
      etiquettes();
    }
  } else {
    corps();
  }
}

insert();
