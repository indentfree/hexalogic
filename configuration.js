// hexgrid.conf.js
window.DIFFICULTIES = {
  "EASY" : 1,
  "NORMAL" : 0,
  "HARD" : -1,
  "HARDER" : -2,
  "INSANE" : -3,
  "DEMON" : -4
}

window.GRIDS_DEFINITION = [
  {
    name: "SMILE",

    textual_grid: `
        1 0 0 0 0 0 1
       0 1 0 0 0 0 1 0
      0 0 1 1 1 1 1 0 0
     0 0 1 0 0 0 0 1 0 0
    0 0 1 0 1 0 1 0 1 0 0
   0 0 1 0 0 0 0 0 0 1 0 0
  0 0 1 0 0 0 1 0 0 0 1 0 0
   0 0 1 0 1 0 0 1 0 1 0 0
    0 0 1 0 1 1 1 0 1 0 0
     0 0 1 0 0 0 0 1 0 0
      0 0 1 1 1 1 1 0 0
       0 0 0 1 1 0 0 0
        0 0 1 1 1 0 0
    `,
    textual_zones : `
        A a a b c c U
       d A a a c c U L
      Y d A A O O N L L
     B e à x x y y M # #
    e e à x P y Q y _ @ @
   Z e C w v v v u u K @ ~
  f f C w w w R u u u K q q
   f g C s I w u J u H q r
    g g C s I I J t H q r
     g h X s t t t H p p
      i j X X E F G p p
       k k W S S V o o
        k l S S T m n
    `,
    constraints: {
      K: [1, 1, 5, 2, 3, 3, 7, 3, 6, 4, 6, 0, 0],
      I: [1, 1, 5, 2, 3, 3, 7, 3, 6, 4, 6, 0, 0],
      J: [3, 2, 5, 2, 5, 4, 3, 2, 4, 2, 5, 2, 2]
    }
  },
  {
    name: "Grille 6x6 test",

    textual_grid: `
       . . 1 1 . 1
      . . . 1 . . 1
     . . . 1 1 . 1 1
    1 1 1 1 1 1 1 . 1
   1 . . . 1 1 . . . .
  . . . . . 1 . . . . .
   . . . . 1 1 . . . .
    . . . 1 . 1 . . .
     . . 1 0 0 1 . .
      1 1 . . . 1 1
       1 . . . . 1
    `,
    textual_zones : `
       X X A A . B
      Y X X A . . B
     Y Y Y D D . C C
    E E F F D D D . C
   E . Z . F G . . . .
  . N Z Z Z G . M M M J
   . N . Z G . . M M J
    . N . K . I . . J
     . . K H H I . J
      L L . W . I 1
       L W W W . I
    `,
    constraints: {
      K: [2, 1, 2, 4, 4, 9, 4, 2, 2, 1, 2],
      I: [4, 1, 2, 4, 4, 8, 2, 2, 2, 2, 2],
      J: [2, 4, 2, 2, 2, 1, 3, 8, 4, 2, 3]
    }
  },
  {
    name: "Grille 3x3 motif",
    textual_grid: `
      1 . 1
     . . . .
    1 . 1 . 1
     . . . .
      1 . 1
    `,
    textual_zones: `
      A . D
     A A E D
    C F E E D
     C F B B
      C F B
    `,
    constraints: {
      K: [3, 2, 2, 2, 3],
      I: [3, 1, 4, 1, 3],
      J: [2, 3, 2, 3, 2]
    }
  },
  {
    name: "Grille 4x4 exemple",
    textual_grid: `
      1 . . .
      . 1 1 1 1
    . . 1 . . .
    . . . 1 . . .
    1 1 1 1 . .
      . . . 1 .
      . . . .
    `,
    textual_zones: `
      . . . .
      . . . . .
    . . . . . .
    . . . . . . .
    . . . . . .
      . . . . .
      . . . .
    `,
    constraints: {
      K: [1, 2, 3, 3, 2, 1, 0],
      I: [1, 1, 1, 6, 1, 1, 1],
      J: [0, 1, 4, 1, 1, 4, 1]
    }
  }
];