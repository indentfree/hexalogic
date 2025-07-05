// hexgrid.test.js

// Ce fichier suppose que HexGridGame est accessible dans le contexte global (par exemple via <script> dans tests.html)

// Utilitaire pour initialiser un jeu de test
function initTestGame(gridSize) {
    // Supprimer l'ancien SVG s'il existe
    const oldSvg = document.getElementById('hexGridSvg');
    if (oldSvg) {
        oldSvg.remove();
    }
    
    // Créer un nouvel élément SVG temporaire unique pour ce test
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tempSvg.id = 'hexGridSvg';
    tempSvg.style.position = 'absolute';
    tempSvg.style.left = '-9999px';
    tempSvg.style.width = '600px'; // Largeur fixe pour les tests
    tempSvg.style.height = '400px'; // Hauteur fixe pour les tests
    document.body.appendChild(tempSvg);
    
    // Créer l'instance avec la taille de grille en paramètre
    const game = new HexGridGame(gridSize);
    
    // Générer la grille avec un callback pour s'assurer qu'elle est prête
    game.generateGrid(() => {
        // Callback vide - la grille est maintenant générée de manière synchrone
    });
    return game;
}

// Configuration QUnit pour éviter les exécutions parallèles
QUnit.config.autostart = false;

QUnit.module('HexaLogic Grid Tests', {
    afterEach: function() {
        // Nettoyer tous les SVGs temporaires créés par les tests
        const tempSvgs = document.querySelectorAll('svg[id^="hexGridSvg_"]');
        tempSvgs.forEach(svg => {
            if (svg.parentNode) {
                svg.parentNode.removeChild(svg);
            }
        });
        
        // Nettoyer aussi le SVG principal s'il existe
        const mainSvg = document.getElementById('hexGridSvg');
        if (mainSvg) {
            mainSvg.remove();
        }
    }
});

// Démarrer les tests une fois que tout est prêt
document.addEventListener('DOMContentLoaded', function() {
    QUnit.start();
});

QUnit.test('Test 1: Cellule centrale pour grille de côté 4', function(assert) {
    const game = initTestGame(4);
    const cells = game.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
    let centralCell = null;
    for (let cell of cells) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        if (row === 4 && col === 4) {
            centralCell = cell;
            break;
        }
    }
    assert.ok(centralCell, 'Cellule centrale (4,4) doit exister');
    if (centralCell) {
        const centralId = centralCell.dataset.hexNumber;
        const centralRow = centralCell.dataset.row;
        const centralCol = centralCell.dataset.col;
        assert.equal(centralRow, '4', 'Cellule centrale doit avoir row=4');
        assert.equal(centralCol, '4', 'Cellule centrale doit avoir col=4');
        assert.equal(centralId, '19', 'Cellule centrale doit avoir ID=19');
    }
});

QUnit.test('Test 2: Cellules avec row=4 pour grille de côté 4', function(assert) {
    const game = initTestGame(4);
    const cells = game.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
    const expectedIds = ['16', '17', '18', '19', '20', '21', '22'];
    const row4Cells = [];
    const foundIds = [];
    for (let cell of cells) {
        const id = cell.dataset.hexNumber;
        const row = parseInt(cell.dataset.row);
        if (expectedIds.includes(id)) {
            foundIds.push(id);
            if (row === 4) {
                row4Cells.push({ id: id, row: row, col: cell.dataset.col });
            } else {
                assert.fail(`Cellule ID ${id} a row=${row} au lieu de row=4`);
            }
        }
    }
    assert.equal(foundIds.length, expectedIds.length, `Toutes les cellules avec IDs 16-22 doivent être trouvées. Attendu: ${expectedIds.length}, Trouvé: ${foundIds.length}`);
    assert.equal(row4Cells.length, expectedIds.length, `Toutes les cellules avec IDs 16-22 doivent avoir row=4. Attendu: ${expectedIds.length}, Trouvé: ${row4Cells.length}`);
});

QUnit.test('Test 3: Vérification de la structure de la grille', function(assert) {
    const game = initTestGame(4);
    const cells = game.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
    assert.ok(cells.length > 0, 'La grille doit contenir des cellules de jeu');
    for (let cell of cells) {
        const row = cell.dataset.row;
        const col = cell.dataset.col;
        const id = cell.dataset.hexNumber;
        assert.ok(row !== undefined, `Cellule ID ${id} doit avoir une coordonnée row`);
        assert.ok(col !== undefined, `Cellule ID ${id} doit avoir une coordonnée col`);
        assert.ok(id !== undefined, `Cellule doit avoir un ID`);
        assert.ok(!isNaN(parseInt(row)), `Row de la cellule ID ${id} doit être un nombre`);
        assert.ok(!isNaN(parseInt(col)), `Col de la cellule ID ${id} doit être un nombre`);
    }
});

QUnit.test('Test 4: Vérification des coordonnées uniques', function(assert) {
    const game = initTestGame(4);
    const cells = game.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
    const coordinates = new Set();
    for (let cell of cells) {
        const coord = `${cell.dataset.row},${cell.dataset.col}`;
        const id = cell.dataset.hexNumber;
        if (coordinates.has(coord)) {
            assert.fail(`Coordonnées ${coord} dupliquées pour l'ID ${id}`);
        }
        coordinates.add(coord);
    }
    assert.ok(true, 'Toutes les coordonnées sont uniques');
});

QUnit.test('Test 5: Règles de voisinage pour cellule ID=19 (grille niveau 4)', function(assert) {
    const game = initTestGame(4);
    const cell19 = game.findCellById(19);
    assert.ok(cell19, 'Cellule ID=19 doit exister');
    if (cell19) {
        const row = parseInt(cell19.dataset.row);
        const col = parseInt(cell19.dataset.col);
        assert.equal(row, 4, 'Cellule ID=19 doit avoir row=4');
        assert.equal(col, 4, 'Cellule ID=19 doit avoir col=4');
        const neighborIds = game.getNeighborIdsById(19);
        const expectedNeighbors = [12, 13, 20, 26, 25, 18];
        assert.equal(neighborIds.length, expectedNeighbors.length, `Cellule ID=19 doit avoir ${expectedNeighbors.length} voisins`);
        for (const expectedId of expectedNeighbors) {
            assert.ok(neighborIds.includes(expectedId), `Voisin ID=${expectedId} doit être présent`);
        }
        for (const actualId of neighborIds) {
            assert.ok(expectedNeighbors.includes(actualId), `Voisin ID=${actualId} ne devrait pas être présent`);
        }
    }
});

QUnit.test('Test 6: Vérification générale des règles de voisinage', function(assert) {
    const game = initTestGame(4);
    const cells = game.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
    for (const cell of cells) {
        const id = parseInt(cell.dataset.hexNumber);
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const neighborIds = game.getNeighborIdsByCoords(row, col);
        assert.ok(neighborIds.length >= 3, `Cellule ID=${id} doit avoir au moins 3 voisins`);
        assert.ok(neighborIds.length <= 6, `Cellule ID=${id} doit avoir au maximum 6 voisins`);
        for (const neighborId of neighborIds) {
            const neighborCell = game.findCellById(neighborId);
            assert.ok(neighborCell, `Voisin ID=${neighborId} de la cellule ID=${id} doit exister`);
            assert.equal(neighborCell.dataset.type, 'game', `Voisin ID=${neighborId} doit être une cellule de jeu`);
        }
    }
});

QUnit.test('Test 7: Diagnostic des voisins de la cellule ID=13', function(assert) {
    const game = initTestGame(4);
    const cell13 = game.findCellById(13);
    assert.ok(cell13, 'Cellule ID=13 doit exister');
    if (cell13) {
        const row = parseInt(cell13.dataset.row);
        const col = parseInt(cell13.dataset.col);
        const neighborIds = game.getNeighborIdsById(13);
        const expectedNeighbors = [7, 8, 14, 20, 19, 12];
        assert.equal(neighborIds.length, expectedNeighbors.length, `Cellule ID=13 doit avoir ${expectedNeighbors.length} voisins`);
        for (const expectedId of expectedNeighbors) {
            assert.ok(neighborIds.includes(expectedId), `Voisin ID=${expectedId} doit être présent`);
        }
        for (const actualId of neighborIds) {
            assert.ok(expectedNeighbors.includes(actualId), `Voisin ID=${actualId} ne devrait pas être présent`);
        }
        // Vérifier les doublons
        const duplicates = neighborIds.filter((id, index) => neighborIds.indexOf(id) !== index);
        assert.ok(duplicates.length === 0, 'Il ne devrait pas y avoir de doublons dans les voisins');
    }
});

QUnit.test('Test 8: Cellule ID=1 a toujours i=0 (grille 4 et 5)', function(assert) {
    [4, 5].forEach(function(gridSize) {
        const game = initTestGame(gridSize);
        const cell1 = game.findCellById(1);
        assert.ok(cell1, `Cellule ID=1 doit exister pour grille de côté ${gridSize}`);
        if (cell1) {
            const i = parseInt(cell1.dataset.i);
            assert.equal(i, 0, `Cellule ID=1 doit avoir i=0 pour grille de côté ${gridSize} (trouvé i=${i})`);
        }
    });
});

QUnit.test('Test 9: Cellule ID=N a toujours k=0 et j=N-1 (grille 4 et 5)', function(assert) {
    [4, 5].forEach(function(N) {
        const game = initTestGame(N);
        const cellN = game.findCellById(N);
        assert.ok(cellN, `Cellule ID=${N} doit exister pour grille de côté ${N}`);
        if (cellN) {
            const k = parseInt(cellN.dataset.k);
            const j = parseInt(cellN.dataset.j);
            assert.equal(k, 0, `Cellule ID=${N} doit avoir k=0 pour grille de côté ${N} (trouvé k=${k})`);
            assert.equal(j, N-1, `Cellule ID=${N} doit avoir j=${N-1} pour grille de côté ${N} (trouvé j=${j})`);
        }
    });
});

QUnit.test('Test constraintId: première ligne K, dernière ligne I (grille 4 et 5)', function(assert) {
    [4, 5].forEach(function(N) {
        const game = initTestGame(N);
        const cells = game.hexGridSvg.querySelectorAll('polygon');
        const extendedN = N + 1;
        const totalRows = 2 * extendedN - 1;
        // Première ligne
        const firstRowConstraints = Array.from(cells).filter(cell => cell.dataset.type === 'constraint' && parseInt(cell.dataset.row) === 0);
        firstRowConstraints.forEach(cell => {
            assert.ok(cell.dataset.constraintId && cell.dataset.constraintId.startsWith('K'), `Première ligne: constraintId doit commencer par K (trouvé: ${cell.dataset.constraintId})`);
        });
        // Dernière ligne
        const lastRowConstraints = Array.from(cells).filter(cell => cell.dataset.type === 'constraint' && parseInt(cell.dataset.row) === (totalRows - 1));
        lastRowConstraints.forEach(cell => {
            assert.ok(cell.dataset.constraintId && cell.dataset.constraintId.startsWith('I'), `Dernière ligne: constraintId doit commencer par I (trouvé: ${cell.dataset.constraintId})`);
        });
    });
});

QUnit.test('Test debug: diagnostic des cellules de la couronne (grille 3)', function(assert) {
    const game = initTestGame(3);
    const cells = game.hexGridSvg.querySelectorAll('polygon');
    
    // Compter les différents types de cellules
    let uselessCount = 0;
    let constraintCount = 0;
    let gameCount = 0;
    
    cells.forEach(cell => {
        if (cell.dataset.type === 'useless') {
            uselessCount++;
        } else if (cell.dataset.type === 'constraint') {
            constraintCount++;
        } else if (cell.dataset.type === 'game') {
            gameCount++;
        }
    });
    
    // Vérifier qu'il y a des cellules USELESS
    assert.ok(uselessCount > 0, `Il doit y avoir des cellules USELESS (trouvé: ${uselessCount})`);
    
    // Vérifier qu'il y a des cellules de contrainte
    assert.ok(constraintCount > 0, `Il doit y avoir des cellules de contrainte (trouvé: ${constraintCount})`);
    
    // Chercher spécifiquement la cellule USELESS de départ
    const startCell = Array.from(cells).find(cell => 
        cell.dataset.type === 'useless' && 
        parseInt(cell.dataset.row) === 0 && 
        parseInt(cell.dataset.col) === 1
    );
    
    assert.ok(startCell, 'La cellule USELESS de départ (0,1) doit exister');
    
    if (startCell) {
        // Vérifier les voisins de la cellule de départ
        const row = parseInt(startCell.dataset.row);
        const col = parseInt(startCell.dataset.col);
        const neighbors = game.getNeighborsByCoords(row, col);
        
        const neighborCells = neighbors.map(([nrow, ncol]) => game.findCellByCoords(nrow, ncol));
        const crownNeighbors = neighborCells.filter(cell => 
            cell && (cell.dataset.type === 'constraint' || cell.dataset.type === 'useless')
        );
    }
});

QUnit.test('Test listCrownCells: ordre des cellules de la couronne (grille 3)', function(assert) {
    const game = initTestGame(3);
    const crownCells = game.listCrownCells();
    
    // Vérifier que la liste n'est pas vide
    assert.ok(crownCells.length > 0, 'La liste des cellules de la couronne ne doit pas être vide');
    
    // Vérifier que la première cellule est USELESS et à la position (0,1)
    assert.equal(crownCells[0].type, 'useless', 'La première cellule doit être de type useless');
    assert.equal(crownCells[0].row, 0, 'La première cellule doit être sur la ligne 0');
    assert.equal(crownCells[0].col, 1, 'La première cellule doit être sur la colonne 1');
    
    // Vérifier que toutes les cellules sont de type constraint ou useless
    crownCells.forEach((cell, index) => {
        assert.ok(cell.type === 'constraint' || cell.type === 'useless', 
            `Cellule ${index} (${cell.coords}) doit être de type constraint ou useless`);
    });
    
    // Vérifier que la liste se termine par la cellule de départ
    const lastCell = crownCells[crownCells.length - 1];
    assert.equal(lastCell.row, 1, 'La dernière cellule doit être sur la ligne 1');
    assert.equal(lastCell.col, 1, 'La dernière cellule doit être sur la colonne 1');
    

});

QUnit.test('Test listCrownCells: ordre des cellules de la couronne (grille 4)', function(assert) {
    const game = initTestGame(4);
    const crownCells = game.listCrownCells();
    
    // Vérifier que la liste n'est pas vide
    assert.ok(crownCells.length > 0, 'La liste des cellules de la couronne ne doit pas être vide');
    
    // Vérifier que la première cellule est USELESS et sur la première ligne
    assert.equal(crownCells[0].type, 'useless', 'La première cellule doit être de type useless');
    assert.equal(crownCells[0].row, 0, 'La première cellule doit être sur la ligne 0');
    
    // Vérifier que toutes les cellules sont de type constraint ou useless
    crownCells.forEach((cell, index) => {
        assert.ok(cell.type === 'constraint' || cell.type === 'useless', 
            `Cellule ${index} (${cell.coords}) doit être de type constraint ou useless`);
    });
    

});

QUnit.test('Test nombre hexagonal centré : cohérence du nombre de cellules de jeu', function(assert) {
    function centeredHexNumber(N) {
        return 3 * N * (N - 1) + 1;
    }
    [4, 5].forEach(function(N) {
        const game = initTestGame(N);
        const cells = game.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
        const expected = centeredHexNumber(N);
        assert.equal(cells.length, expected, `Pour N=${N}, il doit y avoir ${expected} cellules de type 'game' (trouvé: ${cells.length})`);
    });
});

QUnit.test('Vérifications globales pour N=3,4,5,6', function(assert) {
    function centeredHexNumber(N) {
        return 3 * N * (N - 1) + 1;
    }
    [3, 4, 5, 6].forEach(function(N) {
        const game = initTestGame(N);
        const cells = game.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
        // 1. Cellule centrale (row,col) = (N,N) et (i,j,k) = (0,0,0)
        const centralCell = Array.from(cells).find(cell => parseInt(cell.dataset.row) === N && parseInt(cell.dataset.col) === N);
        assert.ok(centralCell, `N=${N}: La cellule centrale (row,col)=(${N},${N}) doit exister`);
        if (centralCell) {
            const i = parseInt(centralCell.dataset.i);
            const j = parseInt(centralCell.dataset.j);
            const k = parseInt(centralCell.dataset.k);
            assert.equal(i, 0, `N=${N}: La cellule centrale doit avoir i=0 (trouvé i=${i})`);
            assert.equal(j, 0, `N=${N}: La cellule centrale doit avoir j=0 (trouvé j=${j})`);
            assert.equal(k, 0, `N=${N}: La cellule centrale doit avoir k=0 (trouvé k=${k})`);
            // Vérification de l'ID de la cellule centrale
            const expectedCentralId = ((centeredHexNumber(N) - 1) / 2) + 1;
            const actualCentralId = parseInt(centralCell.dataset.hexNumber);
            assert.equal(actualCentralId, expectedCentralId, `N=${N}: La cellule centrale doit avoir l'ID=${expectedCentralId} (trouvé ID=${actualCentralId})`);
        }
        // 2. Nombre de cellules de type GAME
        const expectedCount = centeredHexNumber(N);
        assert.equal(cells.length, expectedCount, `N=${N}: Il doit y avoir ${expectedCount} cellules de type 'game' (trouvé: ${cells.length})`);
        // 3. Cellule ID=1 doit avoir i=0
        const cell1 = game.findCellById(1);
        assert.ok(cell1, `N=${N}: Cellule ID=1 doit exister`);
        if (cell1) {
            const i1 = parseInt(cell1.dataset.i);
            assert.equal(i1, 0, `N=${N}: Cellule ID=1 doit avoir i=0 (trouvé i=${i1})`);
        }
        // 4. Cellule ID=N doit avoir k=0
        const cellN = game.findCellById(N);
        assert.ok(cellN, `N=${N}: Cellule ID=${N} doit exister`);
        if (cellN) {
            const kN = parseInt(cellN.dataset.k);
            assert.equal(kN, 0, `N=${N}: Cellule ID=${N} doit avoir k=0 (trouvé k=${kN})`);
        }
        // 5. Cellule ID=centeredHexNumber(N) doit avoir i=0
        const maxId = centeredHexNumber(N);
        const cellMax = game.findCellById(maxId);
        assert.ok(cellMax, `N=${N}: Cellule ID=${maxId} doit exister`);
        if (cellMax) {
            const iMax = parseInt(cellMax.dataset.i);
            assert.equal(iMax, 0, `N=${N}: Cellule ID=${maxId} doit avoir i=0 (trouvé i=${iMax})`);
        }
        // 6. Toutes les cellules de la ligne centrale doivent avoir j=0
        const centralRowCells = Array.from(cells).filter(cell => parseInt(cell.dataset.row) === N);
        assert.ok(centralRowCells.length > 0, `N=${N}: Il doit y avoir des cellules sur la ligne centrale row=${N}`);
        centralRowCells.forEach(cell => {
            const j = parseInt(cell.dataset.j);
            assert.equal(j, 0, `N=${N}: Cellule ID=${cell.dataset.hexNumber} sur la ligne centrale doit avoir j=0 (trouvé j=${j})`);
        });
    });
}); 

 