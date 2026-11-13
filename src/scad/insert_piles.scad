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

module alveole(z) {
  genre = z_genre(z);
  p = z_prof_alveole(z);
  if (genre == "cyl") {
    alveole_cyl(z_a(z) + jeu, p);
  } else if (genre == "rect") {
    lx = (z_tournee(z) ? z_b(z) : z_a(z)) + jeu;
    ly = (z_tournee(z) ? z_a(z) : z_b(z)) + jeu;
    alveole_rect(lx, ly, p);
  } else if (genre == "bouton") {
    rotate([0, 0, z_tournee(z) ? 90 : 0]) alveole_bouton(z_a(z) + jeu, z_b(z) + jeu, p);
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
module corps() {
  difference() {
    union() {
      cube([insert[0], insert[1], fond]);
      for (z = zones) translate([z_x(z), z_y(z), 0]) cube([z_largeur(z), z_profondeur(z), z_hauteur(z)]);
    }
    for (z = zones) translate([z_x(z), z_y(z), 0]) intersection() {
      // Les découpes d'une zone ne débordent jamais sur la zone voisine.
      cube([z_largeur(z), z_profondeur(z), z_hauteur(z) + DEPASSE]);
      decoupes_zone(z);
    }
  }
}

module insert() {
  corps();
}

insert();
