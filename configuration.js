// hexgrid.conf.js

window.GRIDS_DEFINITION = [
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