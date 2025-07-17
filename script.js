class HexGridGame {
    constructor(gridSize = null) {
        this.initializeElements();
        
        // Utiliser le paramètre gridSize s'il est fourni, sinon utiliser les valeurs par défaut
        if (gridSize !== null) {
            this.gridSize = gridSize;
        } else if (this.gridSizeInput) {
            this.gridSize = parseInt(this.gridSizeInput.value);
        } else {
            this.gridSize = 4; // Valeur par défaut
        }
        
        this.selectedHexes = new Set();
        this.score = 0;
        this.grid = [];
        this.mode = 'game'; // Forcer le mode par défaut à GAME
        
        // Système de suivi des coups
        this.moveCount = 0;
        this.moveHistory = [];
        
        // Système de graines déterministes
        this.currentSeed = null;
        this.currentGameId = null;
        
        this.bindEvents();
        // NE PAS générer la grille ici, attendre window.onload
        this.bindModeToggle();
        this.updateYamlExport();
        this.setYamlExportVisibility();
        this.setControlsVisibility();
        // Dans le constructeur de HexGridGame, après initializeElements :
        const gridSelector = document.getElementById('gridSelector');
        if (gridSelector) gridSelector.style.display = '';
        // Au tout début du script, ou dans le constructeur de HexGridGame, s'assurer que le message de victoire est caché par défaut :
        // Par exemple, dans le constructeur :
        // const msgDiv = document.getElementById('victoryMsg');
        // if (msgDiv) msgDiv.style.display = 'none';
        this.debugMode = false;
        // Activer debug via l'URL
        if (window.location.search.includes('debug=true')) {
            this.debugMode = true;
        }
    }
    
    initializeElements() {
        this.hexGridSvg = document.getElementById('hexGridSvg');
        if (!this.hexGridSvg) {
            // Pour les tests, créer un SVG temporaire
            this.hexGridSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this.hexGridSvg.id = 'hexGridSvg';
            this.hexGridSvg.style.width = '600px';
            this.hexGridSvg.style.height = '400px';
            document.body.appendChild(this.hexGridSvg);
        }
        this.hexTooltip = document.getElementById('hexTooltip');
        this.newGameBtn = document.getElementById('generateGrid');
        this.clearBtn = document.getElementById('clearGrid');
        this.gridSizeInput = document.getElementById('gridSize');
        this.controlsDiv = document.querySelector('.controls');
    }
    
    bindEvents() {
        // Événements pour les boutons (seulement si les éléments existent)
        if (this.newGameBtn) {
            this.newGameBtn.addEventListener('click', () => this.generateGrid());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearGrid());
        }
        
        // Événements pour les contrôles de taille (seulement si les éléments existent)
        if (this.gridSizeInput) {
            this.gridSizeInput.addEventListener('change', () => {
                this.gridSize = parseInt(this.gridSizeInput.value);
                this.generateGrid();
            });
        }
        
        // Responsive : régénérer la grille à chaque resize
        window.addEventListener('resize', () => this.resizeGrid());
        
        // Gestion du menu hamburger
        this.bindHamburgerMenu();
    }
    
    // Redimensionnement de la grille en préservant l'état des cellules
    resizeGrid() {
        // Sauvegarder l'état actuel des cellules de jeu
        const gameCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="game"]'));
        const gameCellStates = new Map();
        
        gameCells.forEach(cell => {
            const key = `${cell.dataset.row},${cell.dataset.col}`;
            gameCellStates.set(key, {
                state: cell.dataset.state,
                zoneId: cell.dataset.zoneId,
                fill: cell.getAttribute('fill')
            });
        });
        
        // Sauvegarder l'état actuel des cellules de contraintes
        const constraintCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
        const constraintStates = new Map();
        
        constraintCells.forEach(cell => {
            const key = `${cell.dataset.row},${cell.dataset.col}`;
            constraintStates.set(key, {
                expected_black: cell.dataset.expected_black,
                actual_black: cell.dataset.actual_black,
                constraint_id: cell.dataset.constraint_id
            });
        });
        
        // Sauvegarder les données des zones isolées
        const isolatedZones = { ...this.isolatedZoneColors };
        
        // Régénérer la grille
        this.generateGrid(() => {
            // Restaurer l'état des cellules de jeu
            const newGameCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="game"]'));
            newGameCells.forEach(cell => {
                const key = `${cell.dataset.row},${cell.dataset.col}`;
                const savedState = gameCellStates.get(key);
                if (savedState) {
                    cell.dataset.state = savedState.state;
                    cell.dataset.zoneId = savedState.zoneId;
                    cell.setAttribute('fill', savedState.fill);
                }
            });
            
            // Restaurer l'état des cellules de contraintes
            const newConstraintCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
            newConstraintCells.forEach(cell => {
                const key = `${cell.dataset.row},${cell.dataset.col}`;
                const savedState = constraintStates.get(key);
                if (savedState) {
                    cell.dataset.expected_black = savedState.expected_black;
                    cell.dataset.actual_black = savedState.actual_black;
                    cell.dataset.constraint_id = savedState.constraint_id;
                }
            });
            
            // Restaurer les zones isolées
            this.isolatedZoneColors = isolatedZones;
            
            // Mettre à jour l'affichage des contraintes
            this.updateConstraintTexts();
            this.updateConstraintColors();
            
            // Ne pas redémarrer l'animation automatiquement lors du resize
            // this.startZoneColorAnimation();
        });
    }

    generateGrid(callback = null) {
        // Cacher le message de victoire à chaque régénération
        const msgDiv = document.getElementById('victoryMsg');
        if (msgDiv) msgDiv.style.display = 'none';
        
        // Réinitialiser le compteur de coups si c'est une nouvelle grille (pas un resize)
        if (!callback || !callback.toString().includes('resize')) {
            this.moveCount = 0;
            this.moveHistory = [];
            this.updateMoveCounter();
        }
        
        this.clearGrid();
        const svg = this.hexGridSvg;
        svg.innerHTML = '';
        // Synchroniser la largeur du SVG avec celle de son parent
        svg.style.width = '100%';
        svg.style.height = 'auto';
        
        // Fonction pour générer la grille (synchrone)
        const generateGridContent = () => {
            // Obtenir la largeur du SVG (avec fallback pour les tests)
            let svgWidth = svg.clientWidth;
            if (!svgWidth || svgWidth === 0) {
                // Pour les tests ou si le layout n'est pas encore prêt
                svgWidth = 600; // Valeur par défaut
            }
            
            const N = this.gridSize;
            this.isGridEven = (N % 2 === 0); // Mettre à jour isGridEven à chaque changement de taille
            const maxHexes = 2 * N - 1 + 2;
            // Calcul compact : chaque hexagone occupe hexSize, pas de marge entre
            const hexSize = Math.floor(svgWidth / maxHexes);
            this.hexSize = hexSize;
            const w = this.hexSize;
            const h = Math.sqrt(3) / 2 * w;
            let margeLeft = Math.floor((svgWidth - (maxHexes * hexSize)) / 2);
            let margeRight = Math.ceil((svgWidth - (maxHexes * hexSize)) / 2);
            margeLeft = Math.max(0, margeLeft);
            margeRight = Math.max(0, margeRight);
            const extendedN = N + 1;
            const totalRows = 2 * extendedN - 1;
            svg.setAttribute('height', (totalRows - 1) * w * 0.866 + w);
            this.grid = [];
            let hexNumber = 1;
            
            // Créer tous les hexagones
            const hexCells = [];
            for (let row = 0; row < totalRows; row++) {
                const hexesInRow = extendedN + Math.min(row, totalRows - 1 - row);
                const offset = Math.abs(extendedN - 1 - row);
                // Décalage horizontal pour centrer la ligne
                const leftMargin = margeLeft + (offset * w) / 2;
                for (let col = 0; col < hexesInRow; col++) {
                    // Coordonnée du centre
                    const cx = leftMargin + col * w + w / 2;
                    const cy = row * w * 0.866 + w / 2;
                    const polygon = this.createHexPolygon(cx, cy, w / 2 - 0.5);
                    const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    hex.setAttribute('points', polygon);
                    // Déterminer si c'est une cellule de bordure (contrainte) ou de jeu
                    const isBorderCell = this.isBorderCell(row, col, extendedN, totalRows);
                    let isUselessCell = false;
                    if (isBorderCell) {
                        isUselessCell = this.isUselessConstraintCell(row, col, extendedN, totalRows);
                    }
                    // Calculer les coordonnées (row,col) dans un système rectangulaire complet
                    const logicalRow = row;
                    const logicalCol = col + Math.floor(offset / 2);
                    // Stocker les informations de base
                    hex.dataset.row = logicalRow;
                    hex.dataset.col = logicalCol;
                    hex.dataset.cx = cx;
                    hex.dataset.cy = cy;
                    hex.dataset.type = isBorderCell ? (isUselessCell ? 'useless' : 'constraint') : 'game';
                    if (isBorderCell && isUselessCell) {
                        hex.setAttribute('fill', '#9b59b6');
                        hex.setAttribute('stroke', '#8e44ad');
                        hex.setAttribute('stroke-width', '1');
                        hex.setAttribute('pointer-events', 'none');
                    } else if (isBorderCell) {
                        hex.dataset.state = 0; // GRIS
                        hex.setAttribute('fill', '#b2bec3');
                        hex.setAttribute('stroke', '#b2bec3');
                        hex.setAttribute('stroke-width', '1');
                    } else {
                        hex.setAttribute('cursor', 'pointer');
                        hex.dataset.hexNumber = hexNumber;
                        if (this.mode === 'edit') {
                            hex.dataset.state = 2; // BLANC
                            hex.setAttribute('fill', '#fff');
                            delete hex.dataset.zoneId;
                        } else {
                            hex.dataset.state = 0; // GRIS
                            const zoneColor = hex.dataset.zoneId ? this.getZoneColor(hex.dataset.zoneId) : '#b2bec3';
                            hex.setAttribute('fill', zoneColor);
                        }
                        hex.setAttribute('stroke', 'none');
                        hex.setAttribute('stroke-width', '0');
                        hexNumber++;
                    }
                    hexCells.push(hex);
                    svg.appendChild(hex);
                }
            }
            
            // Propagation IJK récursive depuis la cellule centrale
            this.affecterEtVerifierIJKRecursif(this.gridSize, this.gridSize, 0, 0, 0);
            this.assignConstraintIds();
            this.addSimpleTextsAndEvents(hexCells);
            this.updateDisplay();
            this.updateYamlExport();
            this.updateZoneBorders();
            
            // Appeler le callback si fourni
            if (callback) {
                callback();
            }
        };
        
        // Si un callback est fourni, exécuter immédiatement (pour les tests)
        if (callback) {
            generateGridContent();
        } else {
            // Sinon, attendre le layout (comportement normal)
            setTimeout(generateGridContent, 0);
        }
    }
    

    
    createHexPolygon(cx, cy, r) {
        let points = [];
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 180 * (60 * i - 30);
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            points.push(`${x},${y}`);
        }
        return points.join(' ');
    }
    
    cycleHexState(hex) {
        let state = parseInt(hex.dataset.state);
        const prevState = state;
        state = (state + 1) % 3;
        hex.dataset.state = state;
        
        // Enregistrer le coup dans l'historique
        this.recordMove(hex, prevState, state);
        if (state === 0) {
            // Si la cellule a un zoneId, appliquer la même couleur à toute la zone
            let color;
            if (hex.dataset.zoneId) {
                // Récupérer tous les voisins de la zone
                const allZoneCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="game"][data-zone-id="' + hex.dataset.zoneId + '"]'));
                const neighborZoneIds = new Set();
                allZoneCells.forEach(cell => {
                    const row = parseInt(cell.dataset.row);
                    const col = parseInt(cell.dataset.col);
                    const neighbors = this.getNeighborsByCoords(row, col)
                        .map(([nrow, ncol]) => this.findCellByCoords(nrow, ncol))
                        .filter(ncell => ncell && ncell.dataset.zoneId && ncell.dataset.zoneId !== hex.dataset.zoneId);
                    neighbors.forEach(ncell => neighborZoneIds.add(ncell.dataset.zoneId));
                });
                // Récupérer les couleurs des zones voisines
                const neighborColors = Array.from(neighborZoneIds).map(zid => {
                    if (zid.startsWith('ISO')) {
                        return this.isolatedZoneColors && this.isolatedZoneColors[zid] ? this.isolatedZoneColors[zid] : '#b2bec3';
                    } else {
                        return this.getZoneColor(zid);
                    }
                });
                color = this.generateDistinctColor(neighborColors);
                // Appliquer à toutes les cellules de la zone
                allZoneCells.forEach(cell => {
                    cell.setAttribute('fill', color);
                });
            } else {
                // Isolée : couleur unique, différente des voisins
                const row = parseInt(hex.dataset.row);
                const col = parseInt(hex.dataset.col);
                const neighbors = this.getNeighborsByCoords(row, col)
                    .map(([nrow, ncol]) => this.findCellByCoords(nrow, ncol))
                    .filter(ncell => ncell && ncell.dataset.zoneId && ncell.dataset.zoneId !== hex.dataset.zoneId);
                const neighborColors = neighbors.map(ncell => {
                    if (ncell.dataset.zoneId && ncell.dataset.zoneId.startsWith('ISO')) {
                        return this.isolatedZoneColors && this.isolatedZoneColors[ncell.dataset.zoneId] ? this.isolatedZoneColors[ncell.dataset.zoneId] : '#b2bec3';
                    } else if (ncell.dataset.zoneId) {
                        return this.getZoneColor(ncell.dataset.zoneId);
                    } else {
                        return '#b2bec3';
                    }
                });
                color = this.generateDistinctColor(neighborColors);
                hex.setAttribute('fill', color);
            }
            hex.setAttribute('stroke', 'none');
            hex.setAttribute('stroke-width', '0');
        } else if (state === 1) {
            hex.setAttribute('fill', '#222'); // noir
            hex.setAttribute('stroke', 'none');
            hex.setAttribute('stroke-width', '0');
        } else {
            hex.setAttribute('fill', '#fff'); // blanc
            hex.setAttribute('stroke', 'none');
            hex.setAttribute('stroke-width', '0');
        }
        // Incrémenter/décrémenter actual_black sur les contraintes I, J, K
        const i = parseInt(hex.dataset.i);
        const j = parseInt(hex.dataset.j);
        const k = parseInt(hex.dataset.k);
        const constraintCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
        constraintCells.forEach(cell => {
            const type = cell.dataset.constraintId ? cell.dataset.constraintId[0] : null;
            if (!type) return;
            let match = false;
            if (type === 'I' && parseInt(cell.dataset.i) === i) match = true;
            if (type === 'J' && parseInt(cell.dataset.j) === j) match = true;
            if (type === 'K' && parseInt(cell.dataset.k) === k) match = true;
            if (match) {
                let val = parseInt(cell.dataset.actual_black || '0');
                if (prevState !== 1 && state === 1) val++;
                if (prevState === 1 && state !== 1) val--;
                cell.dataset.actual_black = val;
            }
        });
        this.updateConstraintTexts();
        this.updateConstraintColors();
        if (this.mode === 'edit') {
            this.updateYamlExport();
        }
        this.updateZoneBorders();
        
        // Vérifier la progression si on est en mode jeu
        if (this.mode === 'game') {
            this.checkAndSaveProgress();
        }
    }
    
    updateDisplay() {
        // Suppression : plus de selectedCountSpan ni scoreSpan à mettre à jour
    }
    
    clearGrid() {
        this.hexGridSvg.innerHTML = '';
        this.selectedHexes.clear();
        this.grid = [];
        this.updateDisplay();
    }
    
    // Déterminer si une cellule est sur le bord de la grille étendue
    isBorderCell(row, col, N, totalRows) {
        const hexesInRow = N + Math.min(row, totalRows - 1 - row);
        const offset = Math.abs(N - 1 - row);
        // Cellule de bordure si :
        // - Première ou dernière ligne
        // - Première ou dernière colonne de sa ligne
        return row === 0 || row === totalRows - 1 || col === 0 || col === hexesInRow - 1;
    }
    
    // Déterminer si une cellule de bordure est inutile pour les contraintes
    isUselessConstraintCell(row, col, N, totalRows) {
        const hexesInRow = N + Math.min(row, totalRows - 1 - row);
        const centerRow = Math.floor(totalRows / 2);
        
        // 1. Première cellule à gauche sur la première ligne
        if (row === 0 && col === 0) {
            return true;
        }
        
        // 2. Première cellule à gauche sur la dernière ligne
        if (row === totalRows - 1 && col === 0) {
            return true;
        }
        
        // 3. Dernière cellule à droite sur la ligne centrale
        if (row === centerRow && col === hexesInRow - 1) {
            return true;
        }
        
        return false;
    }
    
    // Méthode simplifiée pour ajouter les textes et événements
    addSimpleTextsAndEvents(hexCells) {
        hexCells.forEach(hex => {
            const cx = parseFloat(hex.dataset.cx);
            const cy = parseFloat(hex.dataset.cy);
            if (hex.dataset.type === 'game') {
                this.addSimpleCellEvents(hex);
                // Ajout : en mode GAME, un clic sur une cellule de jeu désactive la mise en évidence
                if (this.mode === 'game') {
                    hex.addEventListener('click', () => {
                        this.clearNeighborHighlight();
                    });
                }
            } else if (hex.dataset.type === 'constraint' || hex.dataset.type === 'useless') {
                if (hex.dataset.type === 'constraint') {
                    // Affichage principal :
                    const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    valueText.setAttribute('x', cx);
                    valueText.setAttribute('y', cy + 5);
                    valueText.setAttribute('text-anchor', 'middle');
                    valueText.setAttribute('font-size', this.hexSize / 2.5);
                    valueText.setAttribute('fill', '#fff');
                    valueText.setAttribute('pointer-events', 'none');
                    valueText.classList.add('constraint-value');
                    valueText.dataset.row = hex.dataset.row;
                    valueText.dataset.col = hex.dataset.col;
                    // En mode jeu : afficher expected_black, sinon actual_black
                    if (this.mode === 'game' && hex.dataset.expected_black !== undefined) {
                        valueText.textContent = hex.dataset.expected_black;
                    } else {
                        valueText.textContent = hex.dataset.actual_black || hex.dataset.currentValue || '0';
                    }
                    this.hexGridSvg.appendChild(valueText);
                    // Double-clic debug
                    hex.addEventListener('dblclick', (e) => {
                        if (this.debugMode) {
                            e.stopPropagation();
                            this.showConstraintDebugPopup(hex);
                        }
                    });
                }
                // Ajout : en mode GAME, clic sur contrainte = highlight
                if (this.mode === 'game' && hex.dataset.type === 'constraint') {
                    hex.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (hex.dataset.constraintId) {
                            const type = hex.dataset.constraintId[0];
                            const val = parseInt(hex.dataset.constraintId.slice(1));
                            this.highlightGameCellsByConstraint(type, val);
                        }
                    });
                }
                hex.addEventListener('mouseenter', (e) => {
                    this.showSimpleTooltip(e, hex);
                });
                hex.addEventListener('mouseleave', () => {
                    this.hideTooltip();
                    // Ne pas clear la highlight sur mouseleave, pour la rendre persistante après clic
                });
            }
        });
    }
    
    // Méthode simplifiée pour ajouter les événements à une cellule
    addSimpleCellEvents(hex) {
        hex.addEventListener('click', () => {
            if (this.mode === 'edit') {
                // Alterner uniquement entre BLANC (2) et NOIR (1), sans zone
                let state = parseInt(hex.dataset.state);
                const prevState = state;
                state = (state === 2) ? 1 : 2;
                hex.dataset.state = state;
                if (state === 1) {
                    hex.setAttribute('fill', '#222'); // noir
                } else {
                    hex.setAttribute('fill', '#fff'); // blanc
                }
                hex.setAttribute('stroke', 'none');
                hex.setAttribute('stroke-width', '0');
                this.recordMove(hex, prevState, state);
                this.updateAllActualBlack && this.updateAllActualBlack();
                this.updateConstraintColors && this.updateConstraintColors();
                this.updateYamlExport && this.updateYamlExport();
            } else {
                // Comportement normal (zones, cycle 3 états)
                const zoneId = hex.dataset.zoneId;
                if (zoneId) {
                    // ... gestion zone ...
                    const allZoneCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="game"][data-zone-id="' + zoneId + '"]'));
                    let state = parseInt(hex.dataset.state);
                    const prevState = state;
                    const newState = (state + 1) % 3;
                    this.recordZoneMove(allZoneCells, prevState, newState);
                    let color;
                    if (newState === 0) {
                        // ... couleur zone ...
                        const neighborZoneIds = new Set();
                        allZoneCells.forEach(cell => {
                            const row = parseInt(cell.dataset.row);
                            const col = parseInt(cell.dataset.col);
                            const neighbors = this.getNeighborsByCoords(row, col)
                                .map(([nrow, ncol]) => this.findCellByCoords(nrow, ncol))
                                .filter(ncell => ncell && ncell.dataset.zoneId && ncell.dataset.zoneId !== zoneId);
                            neighbors.forEach(ncell => neighborZoneIds.add(ncell.dataset.zoneId));
                        });
                        const neighborColors = Array.from(neighborZoneIds).map(zid => {
                            if (zid.startsWith('ISO')) {
                                return this.isolatedZoneColors && this.isolatedZoneColors[zid] ? this.isolatedZoneColors[zid] : '#b2bec3';
                            } else {
                                return this.getZoneColor(zid);
                            }
                        });
                        color = this.generateDistinctColor(neighborColors);
                    }
                    allZoneCells.forEach(cell => {
                        cell.dataset.state = newState;
                        if (newState === 0) {
                            cell.setAttribute('fill', color);
                            cell.setAttribute('stroke', 'none');
                            cell.setAttribute('stroke-width', '0');
                        } else if (newState === 1) {
                            cell.setAttribute('fill', '#222'); // noir
                            cell.setAttribute('stroke', 'none');
                            cell.setAttribute('stroke-width', '0');
                        } else {
                            cell.setAttribute('fill', '#fff'); // blanc
                            cell.setAttribute('stroke', 'none');
                            cell.setAttribute('stroke-width', '0');
                        }
                    });
                    this.updateAllActualBlack();
                    this.updateConstraintColors();
                    if (this.mode === 'edit') {
                        this.updateYamlExport();
                    }
                    if (this.mode === 'game') {
                        this.checkAndSaveProgress();
                    }
                } else {
                    this.cycleHexState(hex);
                }
            }
        });
        hex.addEventListener('mouseenter', (e) => {
            this.showSimpleTooltip(e, hex);
            if (this.mode === 'edit') {
                this.highlightNeighbors(hex);
            }
        });
        hex.addEventListener('mouseleave', () => {
            this.hideTooltip();
            this.clearNeighborHighlight();
        });
    }
    
    // Méthode simplifiée pour afficher le tooltip
    showSimpleTooltip(e, hex) {
        if (this.mode === 'game') return; // Pas de tooltip en mode GAME
        const tooltip = this.hexTooltip;
        if (!tooltip) return;
        // Données de debug SVG
        const svg = this.hexGridSvg;
        const svgWidth = svg.clientWidth;
        const svgHeight = svg.clientHeight;
        const N = this.gridSize;
        const maxHexes = 2 * N;
        const hexSize = this.hexSize;
        let margeLeft = Math.floor((svgWidth - (maxHexes * hexSize)) / 2);
        let margeRight = Math.ceil((svgWidth - (maxHexes * hexSize)) / 2);
        const cx = hex.dataset.cx ? Math.round(parseFloat(hex.dataset.cx)) : '?';
        const cy = hex.dataset.cy ? Math.round(parseFloat(hex.dataset.cy)) : '?';
        const svgAttrWidth = svg.width && svg.width.baseVal ? svg.width.baseVal.value : '?';
        const parentWidth = svg.parentNode && svg.parentNode.clientWidth ? svg.parentNode.clientWidth : '?';
        let warning = '';
        if (margeLeft < 0) warning = `<div style='color:red'><b>⚠️ Marge négative !</b></div>`;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 16) + 'px';
        tooltip.style.top = (e.clientY + 16) + 'px';
        let html = '';
        if (hex.dataset.type === 'game') {
            html += `
                <div>Cellule de jeu</div>
                <div>ID: <b>${hex.dataset.hexNumber ?? '?'}</b></div>
                <div>Position: (row=${hex.dataset.row}, col=${hex.dataset.col})</div>
                <div>Coordonnées IJK: (i=${hex.dataset.i}, j=${hex.dataset.j}, k=${hex.dataset.k})</div>
                <div>État: ${this.getStateName(hex.dataset.state)}</div>
                ${hex.dataset.zoneId && this.mode !== 'game' ? `<div>Zone: <b>${hex.dataset.zoneId}</b></div>` : ''}
            `;
        } else if (hex.dataset.type === 'constraint') {
            let extra = '';
            if (this.mode === 'game') {
                extra = `<div>expected_black: <b>${hex.dataset.expected_black ?? '?'}</b></div><div>actual_black: <b>${hex.dataset.actual_black ?? '?'}</b></div>`;
            } else {
                extra = `<div>actual_black: <b>${hex.dataset.actual_black ?? '?'}</b></div>`;
            }
            html += `
                <div>Cellule contrainte</div>
                <div>Position: (row=${hex.dataset.row}, col=${hex.dataset.col})</div>
                <div>Coordonnées IJK: (i=${hex.dataset.i}, j=${hex.dataset.j}, k=${hex.dataset.k})</div>
                <div>ID contrainte: ${hex.dataset.constraintId ?? ''}</div>
                ${extra}
            `;
            if (hex.dataset.constraintId) {
                const type = hex.dataset.constraintId[0];
                const val = parseInt(hex.dataset.constraintId.slice(1));
                this.highlightGameCellsByConstraint(type, val);
            }
        } else {
            html += `
                <div>${hex.dataset.type}</div>
                <div>Position: (row=${hex.dataset.row}, col=${hex.dataset.col})</div>
                <div>Coordonnées IJK: (i=${hex.dataset.i}, j=${hex.dataset.j}, k=${hex.dataset.k})</div>
                ${hex.dataset.constraintId ? `<div>ID contrainte: ${hex.dataset.constraintId}</div>` : ''}
            `;
        }
        // Ajout debug SVG
        html += `
            <hr style='margin:4px 0;'>
            <div><b>Debug SVG</b></div>
            <div>SVG: ${svgWidth} x ${svgHeight}</div>
            <div>SVG attr width: ${svgAttrWidth}</div>
            <div>Parent width: ${parentWidth}</div>
            <div>Max cellules ligne centrale: ${maxHexes}</div>
            <div>hexSize: ${hexSize}px</div>
            <div>marge gauche: ${margeLeft}px, marge droite: ${margeRight}px</div>
            ${warning}
            <div>cellule (cx,cy): (${cx}, ${cy})</div>
        `;
        tooltip.innerHTML = html;
    }
    
    hideTooltip() {
        this.hexTooltip.style.display = 'none';
    }
    
    // Calculer les voisins d'une cellule basée sur ses coordonnées (row,col)
    getNeighborsByCoords(row, col) {
        // Directions pour odd-r offset (ordre : haut-gauche, haut-droite, droite, bas-droite, bas-gauche, gauche)
        const evenRowDirections = [
            [-1,  0], // haut-gauche
            [-1, +1], // haut-droite
            [ 0, +1], // droite
            [+1, +1], // bas-droite
            [+1,  0], // bas-gauche
            [ 0, -1]  // gauche
        ];
        const oddRowDirections = [
            [-1, -1], // haut-gauche
            [-1,  0], // haut-droite
            [ 0, +1], // droite
            [+1,  0], // bas-droite
            [+1, -1], // bas-gauche
            [ 0, -1]  // gauche
        ];
        const isEvenRow = row % 2 === 0;
        let directions;
        if (this.isGridEven) {
            directions = isEvenRow ? oddRowDirections : evenRowDirections;
        } else {
            directions = isEvenRow ? evenRowDirections : oddRowDirections;
        }
        return directions.map(([dr, dc]) => [row + dr, col + dc]);
    }
    
    // Trouver les IDs des voisins d'une cellule par ses coordonnées
    getNeighborIdsByCoords(row, col) {
        const neighborCoords = this.getNeighborsByCoords(row, col);
        const neighborIds = [];
        
        for (const [nRow, nCol] of neighborCoords) {
            const neighborCell = this.findCellByCoords(nRow, nCol);
            if (neighborCell && neighborCell.dataset.type === 'game') {
                neighborIds.push(parseInt(neighborCell.dataset.hexNumber));
            }
        }
        
        return neighborIds;
    }
    
    // Trouver une cellule par ses coordonnées
    findCellByCoords(row, col) {
        const cells = this.hexGridSvg.querySelectorAll('polygon');
        for (const cell of cells) {
            if (parseInt(cell.dataset.row) === row && parseInt(cell.dataset.col) === col) {
                return cell;
            }
        }
        return null;
    }
    
    // Trouver les voisins d'une cellule par son ID
    getNeighborIdsById(cellId) {
        const cell = this.findCellById(cellId);
        if (!cell) {
            return [];
        }
        
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        return this.getNeighborIdsByCoords(row, col);
    }
    
    // Trouver une cellule par son ID
    findCellById(cellId) {
        const cells = this.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
        for (const cell of cells) {
            if (parseInt(cell.dataset.hexNumber) === cellId) {
                return cell;
            }
        }
        return null;
    }
    
    // Mettre en évidence les voisins d'une cellule
    highlightNeighbors(hex) {
        // Effacer toute mise en évidence précédente
        this.clearNeighborHighlight();
        
        // Mettre en évidence la cellule survolée
        hex.setAttribute('stroke', '#ff6b35');
        hex.setAttribute('stroke-width', '3');
        
        // Trouver les voisins
        const row = parseInt(hex.dataset.row);
        const col = parseInt(hex.dataset.col);
        const neighborIds = this.getNeighborIdsByCoords(row, col);
        
        // Mettre en évidence chaque voisin
        for (const neighborId of neighborIds) {
            const neighborCell = this.findCellById(neighborId);
            if (neighborCell) {
                neighborCell.setAttribute('stroke', '#2980b9');
                neighborCell.setAttribute('stroke-width', '2');
            }
        }
        
        // Stocker les références pour pouvoir les effacer plus tard
        this.highlightedCells = [hex];
        for (const neighborId of neighborIds) {
            const neighborCell = this.findCellById(neighborId);
            if (neighborCell) {
                this.highlightedCells.push(neighborCell);
            }
        }
    }
    
    // Effacer la mise en évidence des voisins
    clearNeighborHighlight() {
        if (this.highlightedCells) {
            for (const cell of this.highlightedCells) {
                // Restaurer l'apparence normale selon le type de cellule
                if (cell.dataset.type === 'game') {
                    const state = parseInt(cell.dataset.state);
                    if (state === 0) {
                        const zoneColor = cell.dataset.zoneId ? this.getZoneColor(cell.dataset.zoneId) : '#b2bec3';
                        cell.setAttribute('fill', zoneColor);
                        cell.setAttribute('stroke', 'none');
                        cell.setAttribute('stroke-width', '0');
                    } else if (state === 1) {
                        cell.setAttribute('stroke', 'none');
                        cell.setAttribute('stroke-width', '0');
                    } else {
                        cell.setAttribute('stroke', 'none');
                        cell.setAttribute('stroke-width', '0');
                    }
                } else if (cell.dataset.type === 'constraint') {
                    cell.setAttribute('stroke', '#b2bec3');
                    cell.setAttribute('stroke-width', '1');
                }
            }
            this.highlightedCells = null;
        }
    }
    
    // Affecte récursivement les coordonnées IJK à toute la grille
    affecterEtVerifierIJKRecursif(row, col, i, j, k) {
        const cell = this.findCellByCoords(row, col);
        if (!cell) return;
        
        // Si la cellule n'a pas encore de coordonnées, on les affecte
        if (cell.dataset.i === undefined || cell.dataset.j === undefined || cell.dataset.k === undefined) {
            cell.dataset.i = i;
            cell.dataset.j = j;
            cell.dataset.k = k;
        } else {
            // Si déjà affecté, on ne propage pas plus loin
            return;
        }
        
        // Propager aux voisins
        const voisins = this.getNeighborsByCoords(row, col);
        for (let d = 0; d < voisins.length; d++) {
            const [nrow, ncol] = voisins[d];
            // Règles d'affectation selon l'ordre des directions
            let ni = i, nj = j, nk = k;
            if (d === 0) { // haut-gauche
                nj = j + 1; nk = k - 1;
            } else if (d === 1) { // haut-droite
                ni = i + 1; nj = j + 1;
            } else if (d === 2) { // droite
                ni = i + 1; nk = k + 1;
            } else if (d === 3) { // bas-droite
                nj = j - 1; nk = k + 1;
            } else if (d === 4) { // bas-gauche
                ni = i - 1; nj = j - 1;
            } else if (d === 5) { // gauche
                ni = i - 1; nk = k - 1;
            }
            this.affecterEtVerifierIJKRecursif(nrow, ncol, ni, nj, nk);
        }
    }
    
    // Assigne les IDs de contrainte (K, I, J) aux cellules de contrainte du bord
    assignConstraintIds() {
        const crownCells = this.listCrownCells();
        if (crownCells.length === 0) return;

        // Trouver les indices des cellules USELESS
        const uselessIndices = crownCells
            .map((cell, index) => ({ cell, index }))
            .filter(({ cell }) => cell.type === 'useless')
            .map(({ index }) => index);

        if (uselessIndices.length < 3) return;

        const [useless1, useless2, useless3] = uselessIndices;

        // Section K : entre USELESS1 et USELESS2
        for (let i = useless1 + 1; i < useless2; i++) {
            const cell = crownCells[i];
            if (cell.type === 'constraint') {
                const k = parseInt(this.findCellByCoords(cell.row, cell.col).dataset.k);
                this.findCellByCoords(cell.row, cell.col).dataset.constraintId = `K${k >= 0 ? '+' : ''}${k}`;
            }
        }

        // Section I : entre USELESS2 et USELESS3
        for (let i = useless2 + 1; i < useless3; i++) {
            const cell = crownCells[i];
            if (cell.type === 'constraint') {
                const i_val = parseInt(this.findCellByCoords(cell.row, cell.col).dataset.i);
                this.findCellByCoords(cell.row, cell.col).dataset.constraintId = `I${i_val >= 0 ? '+' : ''}${i_val}`;
            }
        }

        // Section J : entre USELESS3 et la fin
        for (let i = useless3 + 1; i < crownCells.length; i++) {
            const cell = crownCells[i];
            if (cell.type === 'constraint') {
                const j = parseInt(this.findCellByCoords(cell.row, cell.col).dataset.j);
                this.findCellByCoords(cell.row, cell.col).dataset.constraintId = `J${j >= 0 ? '+' : ''}${j}`;
            }
        }
    }

    listCrownCells() {
        // Liste toutes les cellules de la couronne dans l'ordre des aiguilles d'une montre
        const cells = Array.from(this.hexGridSvg.querySelectorAll('polygon'));
        const N = this.gridSize;
        const extendedN = N + 1;
        const totalRows = 2 * extendedN - 1;

        // Trouver toutes les cellules de la couronne (constraint + useless)
        const crownCells = cells.filter(cell => 
            cell.dataset.type === 'constraint' || cell.dataset.type === 'useless'
        );

        // Trouver la première cellule USELESS (la plus à gauche de la première ligne)
        const startCell = crownCells.find(cell => 
            cell.dataset.type === 'useless' && parseInt(cell.dataset.row) === 0
        );
        if (!startCell) return [];

        const result = [];
        const visited = new Set();
        let current = startCell;

        // Parcourir la couronne jusqu'à revenir au point de départ ou jusqu'à ce qu'on ait visité toutes les cellules
        do {
            const row = parseInt(current.dataset.row);
            const col = parseInt(current.dataset.col);
            const type = current.dataset.type;
            result.push({
                row: row,
                col: col,
                type: type,
                coords: `(${row},${col})`
            });
            visited.add(current);
            // Trouver le prochain voisin de la couronne non visité
            const neighbors = this.getNeighborsByCoords(row, col);
            const neighborCells = neighbors.map(([nrow, ncol]) => this.findCellByCoords(nrow, ncol));
            const crownNeighbors = neighborCells.filter(cell => 
                cell && (cell.dataset.type === 'constraint' || cell.dataset.type === 'useless') && !visited.has(cell)
            );
            current = crownNeighbors[0] || null;
            // Si on n'a plus de voisin non visité, on a fini
            if (!current) break;
        } while (current !== startCell && visited.size < crownCells.length);

        // Vérification de cohérence
        result.forEach(cell => {
            const svgCell = this.findCellByCoords(cell.row, cell.col);
            if (!svgCell) {
                console.error(`Erreur couronne : cellule absente dans le SVG (row=${cell.row}, col=${cell.col})`);
            } else if (svgCell.dataset.type !== 'useless' && svgCell.dataset.type !== 'constraint') {
                console.error(`Erreur couronne : type inattendu (row=${cell.row}, col=${cell.col}) : ${svgCell.dataset.type}`);
            }
        });
        return result;
    }

    listCrownCellsOriginal() {
        // Liste toutes les cellules de la couronne dans l'ordre des aiguilles d'une montre
        const cells = Array.from(this.hexGridSvg.querySelectorAll('polygon'));
        const N = this.gridSize;
        const extendedN = N + 1;
        const totalRows = 2 * extendedN - 1;

        // Trouver toutes les cellules de la couronne (constraint + useless)
        const crownCells = cells.filter(cell => 
            cell.dataset.type === 'constraint' || cell.dataset.type === 'useless'
        );

        // Trouver la première cellule USELESS (la plus à gauche de la première ligne)
        const startCell = crownCells.find(cell => 
            cell.dataset.type === 'useless' && parseInt(cell.dataset.row) === 0
        );
        if (!startCell) return [];

        const result = [];
        const visited = new Set();
        let current = startCell;

        // Parcourir la couronne jusqu'à revenir au point de départ ou jusqu'à ce qu'on ait visité toutes les cellules
        do {
            const row = parseInt(current.dataset.row);
            const col = parseInt(current.dataset.col);
            const type = current.dataset.type;
            result.push({
                row: row,
                col: col,
                type: type,
                coords: `(${row},${col})`
            });
            visited.add(current);
            // Trouver le prochain voisin de la couronne non visité
            const neighbors = this.getNeighborsByCoords(row, col);
            const neighborCells = neighbors.map(([nrow, ncol]) => this.findCellByCoords(nrow, ncol));
            const crownNeighbors = neighborCells.filter(cell => 
                cell && (cell.dataset.type === 'constraint' || cell.dataset.type === 'useless') && !visited.has(cell)
            );
            current = crownNeighbors[0] || null;
            // Si on n'a plus de voisin non visité, on a fini
            if (!current) break;
        } while (current !== startCell && visited.size < crownCells.length);

        // Vérification de cohérence
        result.forEach(cell => {
            const svgCell = this.findCellByCoords(cell.row, cell.col);
            if (!svgCell) {
                console.error(`Erreur couronne : cellule absente dans le SVG (row=${cell.row}, col=${cell.col})`);
            } else if (svgCell.dataset.type !== 'useless' && svgCell.dataset.type !== 'constraint') {
                console.error(`Erreur couronne : type inattendu (row=${cell.row}, col=${cell.col}) : ${svgCell.dataset.type}`);
            }
        });
        return result;
    }

    getCellInfo(row, col) {
        const svgCell = this.findCellByCoords(row, col);
        return {
            row,
            col,
            type: svgCell ? svgCell.dataset.type : undefined
        };
    }

    // Mettre en évidence les cellules de jeu ayant la même coordonnée que la contrainte
    highlightGameCellsByConstraint(type, val) {
        this.clearNeighborHighlight();
        const cells = this.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
        const highlighted = [];
        cells.forEach(cell => {
            const i = parseInt(cell.dataset.i);
            const j = parseInt(cell.dataset.j);
            const k = parseInt(cell.dataset.k);
            let match = false;
            if (type === 'I' && i === val) match = true;
            if (type === 'J' && j === val) match = true;
            if (type === 'K' && k === val) match = true;
            if (match) {
                cell.setAttribute('stroke', '#e17055');
                cell.setAttribute('stroke-width', '3');
                highlighted.push(cell);
            }
        });
        this.highlightedCells = highlighted;
    }

    bindModeToggle() {
        const toggleBtn = document.getElementById('toggleModeBtn');
        const selector = document.getElementById('gridSelector');
        if (toggleBtn) {
            toggleBtn.textContent = 'Mode: ' + (this.mode === 'edit' ? 'Edit' : 'Game');
            toggleBtn.addEventListener('click', () => {
                // Cacher le message de victoire lors du changement de mode
                const msgDiv = document.getElementById('victoryMsg');
                if (msgDiv) msgDiv.style.display = 'none';
                this.mode = (this.mode === 'edit') ? 'game' : 'edit';
                toggleBtn.textContent = 'Mode: ' + (this.mode === 'edit' ? 'Edit' : 'Game');
                this.setControlsVisibility();
                this.updateYamlExport();
                this.setYamlExportVisibility();
                if (this.mode === 'game') {
                    if (selector) {
                        selector.style.display = '';
                        this.populateGridSelector();
                    }
                    if (window.GRIDS_DEFINITION && window.GRIDS_DEFINITION.length > 0) {
                        this.loadGridFromConf(window.GRIDS_DEFINITION[0]);
                    }
                } else {
                    if (selector) selector.style.display = 'none';
                    this.generateGrid();
                }
            });
        }
        if (selector) {
            selector.addEventListener('change', () => {
                const idx = selector.selectedIndex;
                if (window.GRIDS_DEFINITION && window.GRIDS_DEFINITION[idx]) {
                    this.mode = 'game';
                    this.loadGridFromConf(window.GRIDS_DEFINITION[idx]);
                    this.setYamlExportVisibility();
                    // Afficher la conf YAML d'origine dans le textarea
                    const conf = window.GRIDS_DEFINITION[idx];
                    let yaml = 'textual_grid: |\n';
                    yaml += conf.textual_grid.split('\n').map(l => '  ' + l).join('\n') + '\n';
                    yaml += 'constraints:\n';
                    yaml += '  K: [' + (conf.constraints?.K?.join(', ') ?? '') + ']\n';
                    yaml += '  I: [' + (conf.constraints?.I?.join(', ') ?? '') + ']\n';
                    yaml += '  J: [' + (conf.constraints?.J?.join(', ') ?? '') + ']\n';
                    const yamlExport = document.getElementById('yamlExport');
                    if (yamlExport) yamlExport.value = yaml;
                }
            });
        }
    }

    populateGridSelector() {
        const selector = document.getElementById('gridSelector');
        if (!selector || !window.GRIDS_DEFINITION) return;
        selector.innerHTML = '';
        window.GRIDS_DEFINITION.forEach((grid, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = grid.name;
            selector.appendChild(opt);
        });
        selector.selectedIndex = 0;
        // Charger la première grille par défaut
        this.loadGridFromConf(window.GRIDS_DEFINITION[0]);
    }

    loadGridFromConf(conf) {
        // Générer la grille à partir de textual_grid et constraints
        if (conf.textual_grid) {
            this.generateGridFromTextualGrid(conf.textual_grid, conf.constraints, conf.textual_zones);
            // Si on est en mode jeu, forcer toutes les cellules de jeu à GRIS
            if (this.mode === 'game') {
                const gameCells = this.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
                gameCells.forEach(cell => {
                    cell.dataset.state = 0;
                    const zoneColor = cell.dataset.zoneId ? this.getZoneColor(cell.dataset.zoneId) : '#b2bec3';
                    cell.setAttribute('fill', zoneColor);
                    cell.setAttribute('stroke', 'none');
                    cell.setAttribute('stroke-width', '0');
                });
                // Calculer les contraintes une première fois après réinitialisation
                this.updateAllActualBlack();
                // Réappliquer les contraintes depuis la config après la génération et la réinitialisation
                if (conf.constraints) {
                    this.initConstraintsFromConf(conf.constraints);
                }
                this.updateAllActualBlack();
                this.updateConstraintColors();
            }
        } else {
            this.generateGrid();
        }
    }

    generateGridFromTextualGrid(textual, constraints, textual_zones) {
        // Cacher le message de victoire à chaque régénération
        const msgDiv = document.getElementById('victoryMsg');
        if (msgDiv) msgDiv.style.display = 'none';
        this.clearGrid();
        const N = this.gridSize = this.detectGridSizeFromTextualGrid(textual);
        this.isGridEven = (N % 2 === 0);
        const svg = this.hexGridSvg;
        svg.innerHTML = '';
        // Synchroniser la largeur du SVG avec celle de son parent
        svg.style.width = '100%';
        svg.style.height = 'auto';
        // PAS d'attribut width
        const svgWidth = svg.clientWidth;
        const maxHexes = 2 * N - 1 + 2;
        const hexSize = Math.floor(svgWidth / maxHexes);
        this.hexSize = hexSize;
        const w = this.hexSize;
        const h = Math.sqrt(3) / 2 * w;
        let margeLeft = Math.floor((svgWidth - (maxHexes * hexSize)) / 2);
        let margeRight = Math.ceil((svgWidth - (maxHexes * hexSize)) / 2);
        margeLeft = Math.max(0, margeLeft);
        margeRight = Math.max(0, margeRight);
        const extendedN = N + 1;
        const totalRows = 2 * extendedN - 1;
        svg.setAttribute('height', (totalRows - 1) * w * 0.866 + w);
        this.grid = [];
        let hexNumber = 1;
        // Initialisation : toutes les cellules de jeu sont GRIS
        const hexCells = [];
        for (let row = 0; row < totalRows; row++) {
            const hexesInRow = extendedN + Math.min(row, totalRows - 1 - row);
            const offset = Math.abs(extendedN - 1 - row);
            const leftMargin = margeLeft + (offset * w) / 2;
            for (let col = 0; col < hexesInRow; col++) {
                const cx = leftMargin + col * w + w / 2;
                const cy = row * w * 0.866 + w / 2;
                const polygon = this.createHexPolygon(cx, cy, w / 2 - 0.5);
                const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                hex.setAttribute('points', polygon);
                const isBorderCell = this.isBorderCell(row, col, extendedN, totalRows);
                let isUselessCell = false;
                if (isBorderCell) {
                    isUselessCell = this.isUselessConstraintCell(row, col, extendedN, totalRows);
                }
                const logicalRow = row;
                const logicalCol = col + Math.floor(offset / 2);
                hex.dataset.row = logicalRow;
                hex.dataset.col = logicalCol;
                hex.dataset.cx = cx;
                hex.dataset.cy = cy;
                hex.dataset.type = isBorderCell ? (isUselessCell ? 'useless' : 'constraint') : 'game';
                if (isBorderCell && isUselessCell) {
                    hex.setAttribute('fill', '#9b59b6');
                    hex.setAttribute('stroke', '#8e44ad');
                    hex.setAttribute('stroke-width', '1');
                    hex.setAttribute('pointer-events', 'none');
                } else if (isBorderCell) {
                    hex.dataset.state = 0; // GRIS
                    hex.setAttribute('fill', '#b2bec3');
                    hex.setAttribute('stroke', '#b2bec3');
                    hex.setAttribute('stroke-width', '1');
                } else {
                    hex.setAttribute('cursor', 'pointer');
                    hex.dataset.hexNumber = hexNumber;
                    if (this.mode === 'edit') {
                        hex.dataset.state = 2; // BLANC
                        hex.setAttribute('fill', '#fff');
                        delete hex.dataset.zoneId;
                    } else {
                        hex.dataset.state = 0; // GRIS
                        const zoneColor = hex.dataset.zoneId ? this.getZoneColor(hex.dataset.zoneId) : '#b2bec3';
                        hex.setAttribute('fill', zoneColor);
                    }
                    hex.setAttribute('stroke', 'none');
                    hex.setAttribute('stroke-width', '0');
                    hexNumber++;
                }
                hexCells.push(hex);
                svg.appendChild(hex);
            }
        }
        // --- Affectation séquentielle des zoneId à partir de textual_zones ---
        if (textual_zones) {
            const zoneChars = textual_zones.replace(/\s|\r|\n/g, '');
            const gameCells = hexCells.filter(hex => hex.dataset.type === 'game');
            for (let i = 0; i < gameCells.length && i < zoneChars.length; i++) {
                const char = zoneChars[i];
                if (char && char !== '.') {
                    gameCells[i].dataset.zoneId = char;
                } else {
                    delete gameCells[i].dataset.zoneId;
                }
            }
        }
        // Forcer toutes les cellules de jeu à GRIS au démarrage (sauf en mode EDIT)
        if (this.mode !== 'edit') {
            const gameCells = hexCells.filter(hex => hex.dataset.type === 'game');
            for (const cell of gameCells) {
                cell.dataset.state = 0;
                cell.setAttribute('fill', '#b2bec3');
            }
        }
        
        this.addSimpleTextsAndEvents(hexCells);
        this.updateDisplay();
        this.affecterEtVerifierIJKRecursif(this.gridSize, this.gridSize, 0, 0, 0);
        this.assignConstraintIds();
        // Appliquer les contraintes si fournies (mode GAME)
        if (constraints) {
            this.initConstraintsFromConf(constraints);
        }
        // Initialiser actual_black à 0 pour toutes les contraintes
        const constraintCells = this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]');
        constraintCells.forEach(cell => { cell.dataset.actual_black = 0; });
        this.updateConstraintTexts();
        this.updateConstraintColors();
                    this.updateZoneBorders();
            this.updateYamlExport();
            // Animation désactivée par défaut
            // this.startZoneColorAnimation();
            
            // S'assurer que les contrôles de jeu sont bien positionnés
            this.repositionGameControls();
    }

    detectGridSizeFromTextualGrid(textual) {
        // Détecte la taille N à partir du nombre de lignes
        const lines = textual.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        return Math.floor((lines.length + 1) / 2);
    }

    initConstraintsFromConf(constraints) {
        const crownCells = this.listCrownCells();
        const uselessIndices = crownCells
            .map((cell, index) => ({ cell, index }))
            .map(({ index }) => index)
            .sort((a, b) => a - b);

        let allExpectedTmp = [[0], constraints.K, [0], constraints.I, [0], constraints.J];
        let allExpected = allExpectedTmp.flat();
        
        // Affectation réelle
        crownCells.forEach((cell, idx) => {
            const svgCell = this.findCellByCoords(cell.row, cell.col);
            if (svgCell) {
                const val = allExpected[idx];
                svgCell.dataset.expected_black = (val !== undefined && val !== null) ? val : '';
            }
        });
        this.updateConstraintTexts();
        this.updateConstraintColors();
    }

    // Recalcule actual_black pour toutes les contraintes (en mode jeu)
    updateAllActualBlack() {
        const constraintCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
        const gameCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="game"]'));
        constraintCells.forEach(constraint => {
            const type = constraint.dataset.constraintId ? constraint.dataset.constraintId[0] : null;
            let valBlack = 0;
            let valWhite = 0;
            let cellCount = 0;
            // Pour zoneStates
            const zoneMap = new Map();
            if (type) {
                const i = parseInt(constraint.dataset.i);
                const j = parseInt(constraint.dataset.j);
                const k = parseInt(constraint.dataset.k);
                gameCells.forEach(cell => {
                    const state = parseInt(cell.dataset.state);
                    const zoneId = cell.dataset.zoneId || null;
                    if (type === 'I' && parseInt(cell.dataset.i) === i) {
                        cellCount++;
                        if (state === 1) valBlack++;
                        if (state === 2) valWhite++;
                        if (zoneId) {
                            if (!zoneMap.has(zoneId)) zoneMap.set(zoneId, []);
                            zoneMap.get(zoneId).push(state);
                        }
                    }
                    if (type === 'J' && parseInt(cell.dataset.j) === j) {
                        cellCount++;
                        if (state === 1) valBlack++;
                        if (state === 2) valWhite++;
                        if (zoneId) {
                            if (!zoneMap.has(zoneId)) zoneMap.set(zoneId, []);
                            zoneMap.get(zoneId).push(state);
                        }
                    }
                    if (type === 'K' && parseInt(cell.dataset.k) === k) {
                        cellCount++;
                        if (state === 1) valBlack++;
                        if (state === 2) valWhite++;
                        if (zoneId) {
                            if (!zoneMap.has(zoneId)) zoneMap.set(zoneId, []);
                            zoneMap.get(zoneId).push(state);
                        }
                    }
                });
            }
            constraint.dataset.actual_black = valBlack;
            constraint.dataset.actual_white = valWhite;
            constraint.dataset.cell_count = cellCount;
            // Calculer zoneStates
            const zoneStates = [];
            for (const [zoneId, states] of zoneMap.entries()) {
                // Si toutes les cellules sont GRIS (0), state=0
                let allSame = true;
                let first = states[0];
                for (let s of states) {
                    if (s !== first) { allSame = false; break; }
                }
                let state = 0;
                if (allSame) {
                    state = first; // 0=GRIS, 1=NOIR, 2=BLANC
                } // sinon state=0 (mixte ou indéfini)
                // Si toutes GRIS, state=0
                zoneStates.push({ zoneId, count: states.length, state });
            }
            constraint.zoneStates = zoneStates;
        });
        // Mettre à jour l'affichage SVG
        this.updateConstraintTexts();
    }

    // Met à jour les textes SVG (actual_black et expected_black) pour chaque contrainte
    updateConstraintTexts() {
        const constraintCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
        constraintCells.forEach(constraint => {
            const row = constraint.dataset.row;
            const col = constraint.dataset.col;
            const valueText = this.hexGridSvg.querySelector(`text.constraint-value[data-row='${row}'][data-col='${col}']`);
            if (valueText) {
                if (this.mode === 'game' && constraint.dataset.expected_black !== undefined && constraint.dataset.expected_black !== '') {
                    valueText.textContent = constraint.dataset.expected_black;
                } else {
                    valueText.textContent = constraint.dataset.actual_black || '0';
                    valueText.setAttribute('fill', '#fff');
                }
            }
        });
        this.updateHintBtn && this.updateHintBtn();
        this.updateConstraintColors();
    }

    updateConstraintColors() {
        const cells = this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]');
        let allOk = true;
        cells.forEach(cell => {
            const expected = cell.dataset.expected_black;
            const current = cell.dataset.actual_black;
            // Trouver le texte associé à la contrainte
            const row = cell.dataset.row;
            const col = cell.dataset.col;
            const valueText = this.hexGridSvg.querySelector(`text.constraint-value[data-row='${row}'][data-col='${col}']`);
            if (this.mode === 'game' && expected !== undefined && expected !== '') {
                const exp = parseInt(expected);
                const act = parseInt(current || '0');
                if (this.debugMode) {
                    // Couleur du texte selon actualWhite/cellCount/expectedBlack
                    const actualWhite = parseInt(cell.dataset.actual_white || '0');
                    const cellCount = parseInt(cell.dataset.cell_count || '0');
                    const expectedBlack = parseInt(cell.dataset.expected_black || '0');
                    const targetWhite = cellCount - expectedBlack;
                    if (valueText) {
                        if (actualWhite === targetWhite) {
                            valueText.setAttribute('fill', '#27ae60'); // vert
                            cell.setAttribute('stroke', '#27ae60');
                            cell.setAttribute('stroke-width', '3');
                        } else if (actualWhite > targetWhite) {
                            valueText.setAttribute('fill', '#e74c3c'); // rouge
                            cell.setAttribute('stroke', '#e74c3c');
                            cell.setAttribute('stroke-width', '3');
                        } else {
                            valueText.setAttribute('fill', '#222'); // noir
                            cell.setAttribute('stroke', '#b2bec3');
                            cell.setAttribute('stroke-width', '1');
                        }
                    }
                } else {
                    // Logique d'origine : texte blanc si vert/rouge, noir sinon
                    if (act < exp) {
                        if (valueText) valueText.setAttribute('fill', '#222'); // texte noir
                    } else if (act === exp) {
                        if (valueText) valueText.setAttribute('fill', '#fff'); // texte blanc
                    } else {
                        if (valueText) valueText.setAttribute('fill', '#fff'); // texte blanc
                    }
                    cell.setAttribute('stroke', '#b2bec3');
                    cell.setAttribute('stroke-width', '1');
                }
                if (act < exp) {
                    cell.setAttribute('fill', '#fff'); // blanc
                    allOk = false;
                } else if (act === exp) {
                    cell.setAttribute('fill', '#27ae60'); // vert
                } else {
                    cell.setAttribute('fill', '#e74c3c'); // rouge
                    allOk = false;
                }
            } else {
                cell.setAttribute('fill', '#ff0000');
                if (valueText) valueText.setAttribute('fill', '#fff'); // texte blanc
                cell.setAttribute('stroke', '#b2bec3');
                cell.setAttribute('stroke-width', '1');
            }
        });
        if (this.mode === 'game') {
            this.showVictoryMessage(allOk);
        }
    }

    showVictoryMessage(allOk) {
        let msgDiv = document.getElementById('victoryMsg');
        if (!msgDiv) {
            msgDiv = document.createElement('div');
            msgDiv.id = 'victoryMsg';
            msgDiv.style.position = 'fixed';
            msgDiv.style.top = '50%';
            msgDiv.style.left = '50%';
            msgDiv.style.transform = 'translate(-50%, -50%)';
            msgDiv.style.background = 'rgba(39,174,96,0.75)';
            msgDiv.style.color = 'white';
            msgDiv.style.padding = '32px 48px 32px 48px';
            msgDiv.style.fontSize = '1em';
            msgDiv.style.borderRadius = '18px';
            msgDiv.style.zIndex = 2000;
            msgDiv.style.display = 'none';
            msgDiv.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
            msgDiv.style.textAlign = 'center';
            msgDiv.style.minWidth = '320px';
            msgDiv.style.maxWidth = '90vw';
            msgDiv.style.maxHeight = '80vh';
            msgDiv.style.overflow = 'auto';
            // Bouton X pour fermer
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '12px';
            closeBtn.style.right = '18px';
            closeBtn.style.background = 'transparent';
            closeBtn.style.color = 'white';
            closeBtn.style.fontSize = '1.5em';
            closeBtn.style.border = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.zIndex = 2100;
            closeBtn.onclick = () => { msgDiv.style.display = 'none'; };
            msgDiv.appendChild(closeBtn);
            // Bouton NEXT
            const nextBtn = document.createElement('button');
            nextBtn.id = 'nextLevelBtn';
            nextBtn.textContent = 'NEXT →';
            nextBtn.style.marginTop = '32px';
            nextBtn.style.padding = '12px 32px';
            nextBtn.style.fontSize = '1.2em';
            nextBtn.style.background = '#fff';
            nextBtn.style.color = '#27ae60';
            nextBtn.style.border = 'none';
            nextBtn.style.borderRadius = '8px';
            nextBtn.style.cursor = 'pointer';
            nextBtn.style.fontWeight = 'bold';
            nextBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
            nextBtn.onmouseenter = () => { nextBtn.style.background = '#e8f5e8'; };
            nextBtn.onmouseleave = () => { nextBtn.style.background = '#fff'; };
            nextBtn.onclick = () => {
                msgDiv.style.display = 'none';
                this.goToNextLevel && this.goToNextLevel();
            };
            msgDiv.appendChild(nextBtn);
            document.body.appendChild(msgDiv);
        }
        if (allOk) {
            // Nettoyer le contenu sauf les boutons
            msgDiv.innerHTML = '';
            // Bouton X
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '12px';
            closeBtn.style.right = '18px';
            closeBtn.style.background = 'transparent';
            closeBtn.style.color = 'white';
            closeBtn.style.fontSize = '1.5em';
            closeBtn.style.border = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.zIndex = 2100;
            closeBtn.onclick = () => { msgDiv.style.display = 'none'; };
            msgDiv.appendChild(closeBtn);
            // Message
            const msg = document.createElement('div');
            msg.textContent = 'Gagné !';
            msg.style.margin = '32px 0 16px 0';
            msg.style.fontWeight = 'bold';
            msg.style.fontSize = '1em';
            msgDiv.appendChild(msg);
            // Bouton NEXT
            const nextBtn = document.createElement('button');
            nextBtn.id = 'nextLevelBtn';
            nextBtn.textContent = 'NEXT →';
            nextBtn.style.marginTop = '32px';
            nextBtn.style.padding = '12px 32px';
            nextBtn.style.fontSize = '1.2em';
            nextBtn.style.background = '#fff';
            nextBtn.style.color = '#27ae60';
            nextBtn.style.border = 'none';
            nextBtn.style.borderRadius = '8px';
            nextBtn.style.cursor = 'pointer';
            nextBtn.style.fontWeight = 'bold';
            nextBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
            nextBtn.onmouseenter = () => { nextBtn.style.background = '#e8f5e8'; };
            nextBtn.onmouseleave = () => { nextBtn.style.background = '#fff'; };
            nextBtn.onclick = () => {
                msgDiv.style.display = 'none';
                this.goToNextLevel && this.goToNextLevel();
            };
            msgDiv.appendChild(nextBtn);
            msgDiv.style.display = '';
        } else {
            msgDiv.style.display = 'none';
        }
    }

    // Aller au niveau suivant
    goToNextLevel() {
        if (!this.currentGameId) return;
        const { size, gameNumber } = this.parseGameId(this.currentGameId);
        const nextLevel = gameNumber + 1;
        const nextGameId = `${size}-${nextLevel}`;
        this.generateGridFromGameId(nextGameId);
    }

    updateYamlExport() {
        const gameCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="game"]')).map(cell => ({
            i: parseInt(cell.dataset.i),
            j: parseInt(cell.dataset.j),
            k: parseInt(cell.dataset.k),
            state: parseInt(cell.dataset.state),
            row: parseInt(cell.dataset.row),
            col: parseInt(cell.dataset.col)
        }));
        // Génération textual_grid
        const rows = gameCells.map(c => c.row);
        const minRow = Math.min(...rows);
        const maxRow = Math.max(...rows);
        let textual_grid = '';
        for (let r = minRow; r <= maxRow; r++) {
            const lineCells = gameCells.filter(c => c.row === r);
            if (lineCells.length === 0) continue;
            lineCells.sort((a, b) => a.col - b.col);
            // Décalage centré : abs((N-1) - (r - minRow))
            const lineIdx = r - minRow;
            const offset = Math.abs(this.gridSize - 1 - lineIdx);
            let line = ' '.repeat(offset);
            line += lineCells.map(c => {
                if (c.state === 1) return '1';
                if (c.state === 0) return '.';
                if (c.state === 2) return '0';
                return '.';
            }).join(' ');
            textual_grid += line + '\n';
        }
        // Génération des contraintes K, I, J dans l'ordre de la couronne
        const crownCells = this.listCrownCells();
        const uselessIndices = crownCells
            .map((cell, index) => ({ cell, index }))
            .filter(({ cell }) => cell.type === 'useless')
            .map(({ index }) => index);
        let constraints = { K: [], I: [], J: [] };
        if (uselessIndices.length === 3) {
            const constraintCells = this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]');
            // En mode edit, on exporte actual_black comme expected_black
            if (this.mode === 'edit') {
                let idxK = 0, idxI = 0, idxJ = 0;
                for (let i = uselessIndices[0] + 1; i < uselessIndices[1]; i++) {
                    const cell = crownCells[i];
                    if (cell.type === 'constraint') {
                        const svgCell = this.findCellByCoords(cell.row, cell.col);
                        constraints.K[idxK++] = parseInt(svgCell.dataset.actual_black || '0');
                    }
                }
                for (let i = uselessIndices[1] + 1; i < uselessIndices[2]; i++) {
                    const cell = crownCells[i];
                    if (cell.type === 'constraint') {
                        const svgCell = this.findCellByCoords(cell.row, cell.col);
                        constraints.I[idxI++] = parseInt(svgCell.dataset.actual_black || '0');
                    }
                }
                for (let i = uselessIndices[2] + 1; i < crownCells.length; i++) {
                    const cell = crownCells[i];
                    if (cell.type === 'constraint') {
                        const svgCell = this.findCellByCoords(cell.row, cell.col);
                        constraints.J[idxJ++] = parseInt(svgCell.dataset.actual_black || '0');
                    }
                }
            } else {
                // En mode jeu, on exporte les valeurs attendues
                let idxK = 0, idxI = 0, idxJ = 0;
                for (let i = uselessIndices[0] + 1; i < uselessIndices[1]; i++) {
                    const cell = crownCells[i];
                    if (cell.type === 'constraint') {
                        const svgCell = this.findCellByCoords(cell.row, cell.col);
                        constraints.K[idxK++] = parseInt(svgCell.dataset.expected_black || '0');
                    }
                }
                for (let i = uselessIndices[1] + 1; i < uselessIndices[2]; i++) {
                    const cell = crownCells[i];
                    if (cell.type === 'constraint') {
                        const svgCell = this.findCellByCoords(cell.row, cell.col);
                        constraints.I[idxI++] = parseInt(svgCell.dataset.expected_black || '0');
                    }
                }
                for (let i = uselessIndices[2] + 1; i < crownCells.length; i++) {
                    const cell = crownCells[i];
                    if (cell.type === 'constraint') {
                        const svgCell = this.findCellByCoords(cell.row, cell.col);
                        constraints.J[idxJ++] = parseInt(svgCell.dataset.expected_black || '0');
                    }
                }
            }
        }
        // Export YAML compact
        let yaml = 'textual_grid: |\n';
        yaml += textual_grid.split('\n').map(l => '  ' + l).join('\n') + '\n';
        yaml += 'constraints:\n';
        yaml += '  K: [' + constraints.K.join(', ') + ']\n';
        yaml += '  I: [' + constraints.I.join(', ') + ']\n';
        yaml += '  J: [' + constraints.J.join(', ') + ']\n';
        const yamlExport = document.getElementById('yamlExport');
        if (yamlExport) yamlExport.value = yaml;
    }

    getStateName(state) {
        if (state === undefined || state === null) return 'INCONNU';
        state = parseInt(state);
        if (state === 0) return 'INCONNU (GRIS)';
        if (state === 1) return 'NOIR';
        if (state === 2) return 'BLANC';
        return 'INCONNU';
    }

    // Génère une couleur unique, très contrastée et bien répartie pour chaque zoneId (lettre)
    getZoneColor(zoneId) {
        if (!zoneId) return null;
        // Générer une palette HSL de 30 couleurs bien réparties
        const N = 30;
        const palette = [];
        for (let i = 0; i < N; i++) {
            // Décalage pour éviter que 0 et N/2 soient trop proches
            const hue = (i * 360 / N + (180 / N)) % 360;
            palette.push(`hsl(${hue}, 70%, 55%)`);
        }
        // Mélange de Fisher-Yates déterministe pour l'ordre d'accès
        function shuffledIndices(n) {
            const arr = Array.from({length: n}, (_, i) => i);
            for (let i = n - 1; i > 0; i--) {
                // Utilise un mélange déterministe basé sur i
                const j = (i * 13 + 7) % n;
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }
        const shuffled = shuffledIndices(N);
        // Hash simple
        let hash = 0;
        for (let i = 0; i < zoneId.length; i++) {
            hash = (hash * 31 + zoneId.charCodeAt(i)) % 100000;
        }
        const paletteIndex = shuffled[hash % N];
        return palette[paletteIndex];
    }

    // Génère une couleur aléatoire (vive ou pastel) différente des couleurs voisines (différence de teinte >= 30°)
    generateDistinctColor(neighborColors) {
        function getHue(color) {
            // color format: hsl(hue, ...)
            const match = color.match(/hsl\((\d+),/);
            return match ? parseInt(match[1]) : null;
        }
        let attempts = 0;
        while (attempts < 20) {
            const isPastel = Math.random() < 0.7;
            const hue = Math.floor(Math.random() * 360);
            const sat = isPastel ? 70 : 90;
            const lum = isPastel ? 80 : 55;
            const color = `hsl(${hue}, ${sat}%, ${lum}%)`;
            const hueDiffOk = neighborColors.every(c => {
                const h = getHue(c);
                if (h === null) return true;
                let diff = Math.abs(hue - h);
                if (diff > 180) diff = 360 - diff;
                return diff >= 30;
            });
            if (hueDiffOk) return color;
            attempts++;
        }
        // Si pas trouvé, retourne quand même la dernière couleur
        return `hsl(${Math.floor(Math.random() * 360)}, 80%, 70%)`;
    }

    // Applique une couleur de contour unique à chaque zoneId (palette), peu importe l'état
    updateZoneBorders() {
        // Supprimer les anciens segments de bordure de zone (s'il y en a)
        const oldBorders = this.hexGridSvg.querySelectorAll('line.zone-border');
        oldBorders.forEach(line => line.remove());
        // Supprimer les anciens hexagones de fond de zone
        const oldZoneBg = this.hexGridSvg.querySelectorAll('polygon.zone-background');
        oldZoneBg.forEach(bg => bg.remove());
        // Pour chaque cellule de jeu, aucune bordure par défaut
        const gameCells = this.hexGridSvg.querySelectorAll('polygon[data-type="game"]');
        gameCells.forEach(cell => {
            cell.setAttribute('stroke', 'none');
            cell.setAttribute('stroke-width', '0');
        });
    }

    setYamlExportVisibility() {
        const yamlExport = document.getElementById('yamlExport');
        if (yamlExport) {
            yamlExport.style.display = (this.mode === 'edit') ? '' : 'none';
        }
    }

    setControlsVisibility() {
        if (this.controlsDiv) {
            this.controlsDiv.style.display = (this.mode === 'edit') ? '' : 'none';
        }
    }

    // Génère une grille aléatoire, affecte les contraintes et crée des zones de 2 à 5 cellules consécutives de même état
    generateRandomPuzzle() {
        // 0. Choisir N aléatoirement entre 3 et 10 et régénérer la grille
        const N = Math.floor(Math.random() * 8) + 3; // 3 à 10 inclus
        this.gridSize = N;
        
        // Réinitialiser le compteur de coups
        this.moveCount = 0;
        this.moveHistory = [];
        this.updateMoveCounter();
        
        // Effacer l'ID_JEU actuel
        this.currentGameId = null;
        this.currentSeed = null;
        
        // Mettre à jour l'affichage de l'ID
        this.updateGameIdDisplay();
        
        this.generateGrid(() => {
            // 1. Mettre toutes les cellules de jeu à un état aléatoire (NOIR ou BLANC)
            const gameCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="game"]'));
            gameCells.forEach(cell => {
                // 1 ou 2 (NOIR ou BLANC)
                const state = Math.random() < 0.5 ? 1 : 2;
                cell.dataset.state = state;
                if (state === 1) {
                    cell.setAttribute('fill', '#222');
                } else {
                    cell.setAttribute('fill', '#fff');
                }
                cell.setAttribute('stroke', 'none');
                cell.setAttribute('stroke-width', '0');
                delete cell.dataset.zoneId;
            });
            // 2. Créer les zones de 2 à N/2 cellules consécutives de même état
            this.createZonesForCurrentStates(gameCells, N);
            // 3. Mettre à jour actual_black pour chaque contrainte
            this.updateAllActualBlack();
            // 4. Copier actual_black dans expected_black pour chaque contrainte
            const constraintCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
            constraintCells.forEach(cell => {
                cell.dataset.expected_black = cell.dataset.actual_black;
            });
            // 5. Remettre toutes les cellules de jeu à GRIS
            gameCells.forEach(cell => {
                cell.dataset.state = 0;
                let fillColor;
                if (cell.dataset.zoneId && cell.dataset.zoneId.startsWith('ISO')) {
                    fillColor = this.isolatedZoneColors[cell.dataset.zoneId];
                } else if (cell.dataset.zoneId) {
                    fillColor = this.getZoneColor(cell.dataset.zoneId);
                } else {
                    fillColor = '#b2bec3'; // fallback gris si jamais
                }
                cell.setAttribute('fill', fillColor);
                cell.setAttribute('stroke', 'none');
                cell.setAttribute('stroke-width', '0');
            });
            // 6. Mettre à jour l'affichage des contraintes et l'export YAML
            this.updateConstraintTexts();
            // Remettre à 0 toutes les valeurs actual_black des contraintes
            const constraintCells2 = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
            constraintCells2.forEach(cell => { cell.dataset.actual_black = 0; });
            this.updateConstraintColors();
            this.updateYamlExport();
            //this.updateConstraintColors();
            // Animation désactivée par défaut
            // this.startZoneColorAnimation();
            
            // S'assurer que les contrôles de jeu sont bien positionnés
            this.repositionGameControls();
        });
    }

    // Génère une grille déterministe basée sur une graine
    generateSeededPuzzle(seed) {
        // Réinitialiser le compteur de coups
        this.moveCount = 0;
        this.moveHistory = [];
        this.updateMoveCounter();
        
        // Créer un générateur de nombres aléatoires basé sur la graine
        const random = this.seededRandom(seed);
        
        this.generateGrid(() => {
            // 1. Mettre toutes les cellules de jeu à un état déterministe (NOIR ou BLANC)
            const gameCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="game"]'));
            gameCells.forEach(cell => {
                // Utiliser le générateur déterministe au lieu de Math.random()
                const state = random() < 0.5 ? 1 : 2;
                cell.dataset.state = state;
                if (state === 1) {
                    cell.setAttribute('fill', '#222');
                } else {
                    cell.setAttribute('fill', '#fff');
                }
                cell.setAttribute('stroke', 'none');
                cell.setAttribute('stroke-width', '0');
                delete cell.dataset.zoneId;
            });
            
            // 2. Créer les zones de 2 à N/2 cellules consécutives de même état
            this.createZonesForCurrentStates(gameCells, this.gridSize);
            
            // 3. Mettre à jour actual_black pour chaque contrainte
            this.updateAllActualBlack();
            
            // 4. Copier actual_black dans expected_black pour chaque contrainte
            const constraintCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
            constraintCells.forEach(cell => {
                cell.dataset.expected_black = cell.dataset.actual_black;
            });
            
            // 5. Remettre toutes les cellules de jeu à GRIS
            gameCells.forEach(cell => {
                cell.dataset.state = 0;
                let fillColor;
                if (cell.dataset.zoneId && cell.dataset.zoneId.startsWith('ISO')) {
                    fillColor = this.isolatedZoneColors[cell.dataset.zoneId];
                } else if (cell.dataset.zoneId) {
                    fillColor = this.getZoneColor(cell.dataset.zoneId);
                } else {
                    fillColor = '#b2bec3'; // fallback gris si jamais
                }
                cell.setAttribute('fill', fillColor);
                cell.setAttribute('stroke', 'none');
                cell.setAttribute('stroke-width', '0');
            });
            
            // 6. Mettre à jour l'affichage des contraintes et l'export YAML
            this.updateConstraintTexts();
            // Remettre à 0 toutes les valeurs actual_black des contraintes
            const constraintCells2 = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
            constraintCells2.forEach(cell => { cell.dataset.actual_black = 0; });
            this.updateConstraintColors();
            this.updateYamlExport();
            //this.updateConstraintColors();
            // Animation désactivée par défaut
            // this.startZoneColorAnimation();
            
            // S'assurer que les contrôles de jeu sont bien positionnés
            this.repositionGameControls();
            this.updateAllActualBlack();
        });
    }

    // Crée des zones de 2 à maxZoneSize cellules consécutives de même état
    createZonesForCurrentStates(gameCells, N) {
        //const maxZoneSize = Math.max(2, Math.floor(N / 2)+2);
        const maxZoneSize = N+2;
        
        // Génère des zoneId : A, B, ..., Z, AA, AB, ...
        function* zoneIdGenerator() {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let n = 0;
            while (true) {
                let id = '';
                let x = n;
                do {
                    id = letters[x % 26] + id;
                    x = Math.floor(x / 26) - 1;
                } while (x >= 0);
                yield id;
                n++;
            }
        }
        const gen = zoneIdGenerator();
        // Pour les zones isolées (taille 1)
        let isoCount = 1;
        this.isolatedZoneColors = {};
        // Réinitialiser les zoneId
        gameCells.forEach(cell => { delete cell.dataset.zoneId; });
        const visited = new Set();
        for (const cell of gameCells) {
            if (visited.has(cell)) continue;
            const state = parseInt(cell.dataset.state);
            if (state !== 1 && state !== 2) continue;
            // BFS pour regrouper les cellules de même état
            const cluster = [];
            const queue = [cell];
            visited.add(cell);
            while (queue.length > 0 && cluster.length < maxZoneSize) {
                const current = queue.shift();
                cluster.push(current);
                const row = parseInt(current.dataset.row);
                const col = parseInt(current.dataset.col);
                const neighbors = this.getNeighborsByCoords(row, col)
                    .map(([nrow, ncol]) => this.findCellByCoords(nrow, ncol))
                    .filter(ncell => ncell && !visited.has(ncell) && ncell.dataset.type === 'game' && parseInt(ncell.dataset.state) === state);
                for (const ncell of neighbors) {
                    if (cluster.length < maxZoneSize) {
                        queue.push(ncell);
                        visited.add(ncell);
                    }
                }
            }
            if (cluster.length < 2) {
                // Zone isolée (taille 1)
                const isoId = 'ISO' + (isoCount++);
                const hue = Math.floor(Math.random() * 360);
                // Couleur pastel uniquement
                const sat = 70; // Saturation pastel
                const lum = 80; // Luminosité pastel
                const color = `hsl(${hue}, ${sat}%, ${lum}%)`;
                this.isolatedZoneColors[isoId] = color;
                for (const zcell of cluster) {
                    zcell.dataset.zoneId = isoId;
                }
                continue;
            }
            // Attribuer un zoneId à ce cluster
            const zoneId = gen.next().value;
            for (const zcell of cluster) {
                zcell.dataset.zoneId = zoneId;
            }
        }
        // Après la création des zones, colorer toutes les cellules sans zoneId (oubliées)
        for (const cell of gameCells) {
            if (!cell.dataset.zoneId) {
                const isoId = 'ISO' + (isoCount++);
                const hue = Math.floor(Math.random() * 360);
                const sat = 70; // Saturation pastel
                const lum = 80; // Luminosité pastel
                const color = `hsl(${hue}, ${sat}%, ${lum}%)`;
                this.isolatedZoneColors[isoId] = color;
                cell.dataset.zoneId = isoId;
            }
        }
    }

    // Animation des couleurs des zones à l'état 0 (GRIS)
    startZoneColorAnimation() {
        if (this._zoneColorAnimInterval) return;
        this.zoneAnimStyle = this.zoneAnimStyle || {};
        this._zoneColorAnimInterval = setInterval(() => {
            const now = Date.now();
            // Regrouper les cellules de jeu à l'état 0 par zoneId
            const gameCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="game"]'));
            const zones = {};
            gameCells.forEach(cell => {
                if (parseInt(cell.dataset.state) === 0 && cell.dataset.zoneId) {
                    if (!zones[cell.dataset.zoneId]) zones[cell.dataset.zoneId] = [];
                    zones[cell.dataset.zoneId].push(cell);
                }
            });
            Object.entries(zones).forEach(([zoneId, cells]) => {
                // Teinte cyclique selon le temps et le zoneId
                // Pour chaque zone, un déphasage pour éviter que toutes les zones changent en même temps
                const base = parseInt(zoneId.replace(/[^0-9A-Z]/g, ''), 36) || 0;
                
                // Extraire la teinte initiale de la couleur de la zone
                let initialHue = 0;
                if (zoneId.startsWith('ISO')) {
                    // Pour les zones isolées, extraire la teinte de la couleur stockée
                    const initialColor = this.isolatedZoneColors[zoneId];
                    if (initialColor) {
                        const match = initialColor.match(/hsl\((\d+),/);
                        initialHue = match ? parseInt(match[1]) : 0;
                    }
                } else {
                    // Pour les zones normales, extraire la teinte de getZoneColor
                    const initialColor = this.getZoneColor(zoneId);
                    if (initialColor) {
                        const match = initialColor.match(/hsl\((\d+),/);
                        initialHue = match ? parseInt(match[1]) : 0;
                    }
                }
                
                const direction = base % 2 === 0 ? 1 : -1; // Sens alterné selon le zoneId
                const t = ((now / 100 * direction) + initialHue) % 360;
                // Style stable par zone - uniquement pastel
                if (!this.zoneAnimStyle[zoneId]) {
                    this.zoneAnimStyle[zoneId] = {
                        sat: 90, // Saturation pastel fixe
                        lum: 75  // Luminosité pastel fixe
                    };
                }
                const {sat, lum} = this.zoneAnimStyle[zoneId];
                const color = `hsl(${Math.floor(t)}, ${sat}%, ${lum}%)`;
                cells.forEach(cell => {
                    cell.setAttribute('fill', color);
                });
            });
        }, 60); // 60 ms pour une animation fluide
    }

    stopZoneColorAnimation() {
        if (this._zoneColorAnimInterval) {
            clearInterval(this._zoneColorAnimInterval);
            this._zoneColorAnimInterval = null;
        }
    }

    // Bascule l'animation ON/OFF
    toggleZoneColorAnimation() {
        if (this._zoneColorAnimInterval) {
            this.stopZoneColorAnimation();
            return false; // Animation arrêtée
        } else {
            this.startZoneColorAnimation();
            return true; // Animation démarrée
        }
    }

    // Enregistre un coup dans l'historique
    recordMove(hex, prevState, newState) {
        console.log(`Recording move: ${prevState} -> ${newState}`);
        this.moveCount++;
        this.moveHistory.push({
            type: 'single',
            hex: hex,
            row: parseInt(hex.dataset.row),
            col: parseInt(hex.dataset.col),
            prevState: prevState,
            newState: newState,
            prevFill: hex.getAttribute('fill'),
            zoneId: hex.dataset.zoneId
        });
        this.updateMoveCounter();
    }

    // Enregistre un coup de zone dans l'historique
    recordZoneMove(zoneCells, prevState, newState) {
        console.log(`Recording zone move: ${prevState} -> ${newState} for ${zoneCells.length} cells`);
        this.moveCount++;
        this.moveHistory.push({
            type: 'zone',
            cells: zoneCells.map(cell => ({
                hex: cell,
                row: parseInt(cell.dataset.row),
                col: parseInt(cell.dataset.col),
                prevState: prevState,
                newState: newState,
                prevFill: cell.getAttribute('fill'),
                zoneId: cell.dataset.zoneId
            }))
        });
        this.updateMoveCounter();
    }

    // Annule le dernier coup
    undoLastMove() {
        console.log(`Undo called. History length: ${this.moveHistory.length}`);
        if (this.moveHistory.length === 0) {
            console.log('No moves to undo');
            return;
        }
        
        const lastMove = this.moveHistory.pop();
        this.moveCount--;
        
        if (lastMove.type === 'zone') {
            console.log(`Undoing zone move: ${lastMove.cells.length} cells`);
            // Restaurer toutes les cellules de la zone
            lastMove.cells.forEach(cellData => {
                const hex = cellData.hex;
                hex.dataset.state = cellData.prevState;
                
                // Restaurer l'apparence selon l'état
                if (cellData.prevState === 0) {
                    // État gris - restaurer la couleur de zone
                    if (cellData.zoneId && cellData.zoneId.startsWith('ISO')) {
                        hex.setAttribute('fill', this.isolatedZoneColors[cellData.zoneId] || '#b2bec3');
                    } else if (cellData.zoneId) {
                        hex.setAttribute('fill', this.getZoneColor(cellData.zoneId));
                    } else {
                        hex.setAttribute('fill', '#b2bec3');
                    }
                } else if (cellData.prevState === 1) {
                    hex.setAttribute('fill', '#222'); // noir
                } else {
                    hex.setAttribute('fill', '#fff'); // blanc
                }
            });
        } else {
            console.log(`Undoing single move: ${lastMove.newState} -> ${lastMove.prevState}`);
            // Restaurer une seule cellule
            const hex = lastMove.hex;
            hex.dataset.state = lastMove.prevState;
            
            // Restaurer l'apparence selon l'état
            if (lastMove.prevState === 0) {
                // État gris - restaurer la couleur de zone
                if (lastMove.zoneId && lastMove.zoneId.startsWith('ISO')) {
                    hex.setAttribute('fill', this.isolatedZoneColors[lastMove.zoneId] || '#b2bec3');
                } else if (lastMove.zoneId) {
                    hex.setAttribute('fill', this.getZoneColor(lastMove.zoneId));
                } else {
                    hex.setAttribute('fill', '#b2bec3');
                }
            } else if (lastMove.prevState === 1) {
                hex.setAttribute('fill', '#222'); // noir
            } else {
                hex.setAttribute('fill', '#fff'); // blanc
            }
        }
        
        // Mettre à jour les contraintes
        this.updateAllActualBlack();
        this.updateConstraintTexts();
        this.updateConstraintColors();
        
        this.updateMoveCounter();
    }

    // Met à jour l'affichage du compteur de coups
    updateMoveCounter() {
        const moveCounter = document.getElementById('moveCounter');
        if (moveCounter) {
            moveCounter.textContent = `Coups: ${this.moveCount}`;
        } else {
            console.log('moveCounter element not found');
        }
        console.log(`Move count updated: ${this.moveCount}`);
    }

    // Met à jour l'affichage de l'ID du jeu
    updateGameIdDisplay() {
        const gameIdDisplay = document.getElementById('gameIdDisplay');
        if (gameIdDisplay) {
            if (this.currentGameId) {
                gameIdDisplay.textContent = `ID: ${this.currentGameId}`;
                gameIdDisplay.style.color = '#333';
            } else {
                gameIdDisplay.textContent = 'ID: Aléatoire';
                gameIdDisplay.style.color = '#666';
            }
        }
        
        // Mettre à jour le titre
        this.updatePageTitle();
    }

    // Met à jour le titre de la page
    updatePageTitle() {
        const titleElement = document.querySelector('h1');
        if (titleElement) {
            if (this.currentGameId) {
                titleElement.textContent = `HexaLogic - ${this.currentGameId}`;
            } else {
                titleElement.textContent = 'HexaLogic';
            }
        }
    }

    // Force le repositionnement des contrôles de jeu en dessous de la grille
    repositionGameControls() {
        const gameControls = document.getElementById('gameControls');
        const gridContainer = document.querySelector('.grid-container');
        
        if (gameControls && gridContainer) {
            // Retirer le conteneur de son emplacement actuel
            if (gameControls.parentNode) {
                gameControls.parentNode.removeChild(gameControls);
            }
            // Le replacer après le grid-container
            gridContainer.parentNode.insertBefore(gameControls, gridContainer.nextSibling);
        }
    }

    // Génère une graine à partir d'un numéro de jeu
    generateSeedFromGameNumber(gameNumber) {
        // Hash simple mais déterministe
        let hash = 0;
        const str = gameNumber.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // Parse un ID_JEU (ex: "5-42")
    parseGameId(gameId) {
        const match = gameId.match(/^(\d+)-(\d+)$/);
        if (!match) {
            throw new Error(`Format d'ID_JEU invalide: ${gameId}. Format attendu: taille-numero`);
        }
        return {
            size: parseInt(match[1]),
            gameNumber: parseInt(match[2])
        };
    }

    // Génère une grille à partir d'un ID_JEU
    generateGridFromGameId(gameId) {
        try {
            const { size, gameNumber } = this.parseGameId(gameId);
            const seed = this.generateSeedFromGameNumber(gameNumber);
            
            this.currentGameId = gameId;
            this.currentSeed = seed;
            this.gridSize = size;
            
            console.log(`Génération de la grille ${gameId} avec la graine ${seed}`);
            
            // Mettre à jour l'URL
            this.updateUrlWithGameId(gameId);
            
            // Mettre à jour l'affichage de l'ID
            this.updateGameIdDisplay();
            
            // Générer la grille avec la graine
            this.generateSeededPuzzle(seed);
            
        } catch (error) {
            console.error('Erreur lors de la génération de la grille:', error.message);
            // Fallback vers une grille aléatoire
            this.generateRandomPuzzle();
        }
    }

    // Met à jour l'URL avec l'ID_JEU
    updateUrlWithGameId(gameId) {
        const url = new URL(window.location);
        url.searchParams.set('game', gameId);
        window.history.replaceState({}, '', url);
    }

    // Récupère l'ID_JEU depuis l'URL
    getGameIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('game');
    }

    // Générateur de nombres aléatoires basé sur une graine
    seededRandom(seed) {
        // Implémentation simple d'un générateur de nombres aléatoires
        let state = seed;
        return function() {
            state = (state * 9301 + 49297) % 233280;
            return state / 233280;
        };
    }

    // Gestion du menu hamburger
    bindHamburgerMenu() {
        const hamburgerIcon = document.getElementById('hamburgerIcon');
        const menuOverlay = document.getElementById('menuOverlay');
        const menuButtons = document.querySelectorAll('.menu-btn');

        // Toggle du menu
        hamburgerIcon.addEventListener('click', () => {
            this.toggleMenu();
            this.updateMenuProgress();
            this.updateHintBtn && this.updateHintBtn();
        });

        // Fermer le menu en cliquant sur l'overlay
        menuOverlay.addEventListener('click', (e) => {
            if (e.target === menuOverlay) {
                this.closeMenu();
                this.updateHintBtn && this.updateHintBtn();
            }
        });

        // Gestion des boutons du menu
        menuButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                const size = btn.dataset.size;
                
                switch (action) {
                    case 'grid':
                        this.generateGridBySize(parseInt(size));
                        break;
                    case 'random':
                        this.generateRandomPuzzle();
                        break;
                    case 'custom-id':
                        this.promptForGameId();
                        break;
                    case 'toggle-mode':
                        this.toggleMode();
                        break;
                    case 'toggle-animation':
                        this.toggleAnimation();
                        break;
                    case 'close':
                        this.closeMenu();
                        break;
                }
            });
        });
        // Ajouter le bouton DEBUG si pas déjà présent
        let debugBtn = document.getElementById('debugModeBtn');
        if (!debugBtn) {
            debugBtn = document.createElement('button');
            debugBtn.id = 'debugModeBtn';
            debugBtn.className = 'menu-btn';
            debugBtn.textContent = this.debugMode ? 'Mode DEBUG : ON' : 'Mode DEBUG : OFF';
            debugBtn.style.background = this.debugMode ? '#27ae60' : '';
            debugBtn.onclick = () => {
                this.debugMode = !this.debugMode;
                debugBtn.textContent = this.debugMode ? 'Mode DEBUG : ON' : 'Mode DEBUG : OFF';
                debugBtn.style.background = this.debugMode ? '#27ae60' : '';
            };
            // Ajouter dans la dernière section du menu hamburger
            const menuSections = document.querySelectorAll('.menu-section');
            if (menuSections.length > 0) {
                menuSections[menuSections.length - 1].appendChild(debugBtn);
            } else {
                menuOverlay.appendChild(debugBtn);
            }
        }
        // Ajouter le bouton HINT si pas déjà présent
        let hintBtn = document.getElementById('hintBtn');
        if (!hintBtn) {
            hintBtn = document.createElement('button');
            hintBtn.id = 'hintBtn';
            hintBtn.className = 'menu-btn';
            hintBtn.style.background = '#f8f9fa';
            hintBtn.style.color = '#333';
            hintBtn.style.fontWeight = 'bold';
            hintBtn.onclick = () => { this.showHint(); };
            // Ajouter dans la dernière section du menu hamburger
            const menuSections = document.querySelectorAll('.menu-section');
            if (menuSections.length > 0) {
                menuSections[menuSections.length - 1].appendChild(hintBtn);
            } else {
                menuOverlay.appendChild(hintBtn);
            }
        }
        // Boutons HINT séparés
        let hintEasyBtn = document.getElementById('hintEasyBtn');
        if (!hintEasyBtn) {
            hintEasyBtn = document.createElement('button');
            hintEasyBtn.id = 'hintEasyBtn';
            hintEasyBtn.className = 'menu-btn';
            hintEasyBtn.style.background = '#f8f9fa';
            hintEasyBtn.style.color = '#333';
            hintEasyBtn.style.fontWeight = 'bold';
            hintEasyBtn.onclick = () => { this.showHintType('easy'); };
            const menuSections = document.querySelectorAll('.menu-section');
            if (menuSections.length > 0) {
                menuSections[menuSections.length - 1].appendChild(hintEasyBtn);
            } else {
                menuOverlay.appendChild(hintEasyBtn);
            }
        }
        let hintMediumBtn = document.getElementById('hintMediumBtn');
        if (!hintMediumBtn) {
            hintMediumBtn = document.createElement('button');
            hintMediumBtn.id = 'hintMediumBtn';
            hintMediumBtn.className = 'menu-btn';
            hintMediumBtn.style.background = '#f8f9fa';
            hintMediumBtn.style.color = '#333';
            hintMediumBtn.style.fontWeight = 'bold';
            hintMediumBtn.onclick = () => { this.showHintType('medium'); };
            const menuSections = document.querySelectorAll('.menu-section');
            if (menuSections.length > 0) {
                menuSections[menuSections.length - 1].appendChild(hintMediumBtn);
            } else {
                menuOverlay.appendChild(hintMediumBtn);
            }
        }
        let hintHardBtn = document.getElementById('hintHardBtn');
        if (!hintHardBtn) {
            hintHardBtn = document.createElement('button');
            hintHardBtn.id = 'hintHardBtn';
            hintHardBtn.className = 'menu-btn';
            hintHardBtn.style.background = '#f8f9fa';
            hintHardBtn.style.color = '#333';
            hintHardBtn.style.fontWeight = 'bold';
            hintHardBtn.onclick = () => { this.showHintType('hard'); };
            const menuSections = document.querySelectorAll('.menu-section');
            if (menuSections.length > 0) {
                menuSections[menuSections.length - 1].appendChild(hintHardBtn);
            } else {
                menuOverlay.appendChild(hintHardBtn);
            }
        }
        this.updateHintBtn && this.updateHintBtn();
    }

    // Génère une grille de taille spécifique
    generateGridBySize(size) {
        this.gridSize = size;
        
        // Récupérer le dernier niveau complété pour cette taille
        const lastCompleted = this.getLastCompletedLevel(size);
        const nextLevel = lastCompleted + 1;
        
        // Générer la grille avec le niveau suivant
        const gameId = `${size}-${nextLevel}`;
        this.generateGridFromGameId(gameId);
        
        this.closeMenu();
    }

    // Demande un ID de jeu
    promptForGameId() {
        const gameId = prompt('Entrez l\'ID du jeu (format: taille-numero, ex: 5-42):');
        if (gameId && gameId.trim()) {
            this.generateGridFromGameId(gameId.trim());
        }
        this.closeMenu();
    }

    // Bascule le mode EDIT/GAME
    toggleMode() {
        this.mode = this.mode === 'edit' ? 'game' : 'edit';
        this.updateModeButton();
        this.setYamlExportVisibility();
        this.setControlsVisibility();
        this.closeMenu();
        if (this.mode === 'edit') {
            this.generateGrid();
        }
    }

    // Bascule l'animation
    toggleAnimation() {
        const isOn = this.toggleZoneColorAnimation();
        this.updateAnimationButton(isOn);
        this.closeMenu();
    }

    // Ouvre le menu
    openMenu() {
        const hamburgerIcon = document.getElementById('hamburgerIcon');
        const menuOverlay = document.getElementById('menuOverlay');
        hamburgerIcon.classList.add('active');
        menuOverlay.classList.add('active');
    }

    // Ferme le menu
    closeMenu() {
        const hamburgerIcon = document.getElementById('hamburgerIcon');
        const menuOverlay = document.getElementById('menuOverlay');
        hamburgerIcon.classList.remove('active');
        menuOverlay.classList.remove('active');
    }

    // Toggle le menu
    toggleMenu() {
        const menuOverlay = document.getElementById('menuOverlay');
        if (menuOverlay.classList.contains('active')) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    // Met à jour le bouton du mode
    updateModeButton() {
        const modeBtn = document.querySelector('[data-action="toggle-mode"]');
        if (modeBtn) {
            modeBtn.textContent = this.mode === 'edit' ? 'Mode GAME' : 'Mode EDIT';
        }
    }

    // Met à jour le bouton de l'animation
    updateAnimationButton(isOn) {
        const animBtn = document.querySelector('[data-action="toggle-animation"]');
        if (animBtn) {
            animBtn.textContent = isOn ? 'Animation OFF' : 'Animation ON';
        }
    }

    // Met à jour l'affichage de la progression dans le menu
    updateMenuProgress() {
        const sizes = [3, 4, 5, 7, 9];
        
        sizes.forEach(size => {
            const btn = document.querySelector(`[data-action="grid"][data-size="${size}"]`);
            if (btn) {
                const lastCompleted = this.getLastCompletedLevel(size);
                const nextLevel = lastCompleted + 1;
                btn.textContent = `Grille d'ordre ${size} (Niveau ${nextLevel})`;
                
                // Ajouter un indicateur visuel si des niveaux sont complétés
                if (lastCompleted > 0) {
                    btn.style.background = '#e8f5e8';
                    btn.style.borderColor = '#28a745';
                } else {
                    btn.style.background = '#f8f9fa';
                    btn.style.borderColor = '#dee2e6';
                }
            }
        });
    }

    // Récupère le dernier niveau complété pour une taille donnée
    getLastCompletedLevel(size) {
        const key = `hexalogic_completed_${size}`;
        const completed = localStorage.getItem(key);
        return completed ? parseInt(completed) : 0;
    }

    // Enregistre un niveau complété
    saveCompletedLevel(size, level) {
        const key = `hexalogic_completed_${size}`;
        const currentMax = this.getLastCompletedLevel(size);
        
        // Ne sauvegarder que si c'est un nouveau record
        if (level > currentMax) {
            localStorage.setItem(key, level.toString());
            console.log(`Niveau ${size}-${level} complété ! Nouveau record pour la taille ${size}`);
            return true;
        }
        return false;
    }

    // Vérifie si une grille est complétée et sauvegarde la progression
    checkAndSaveProgress() {
        if (!this.currentGameId) return;
        
        const { size, gameNumber } = this.parseGameId(this.currentGameId);
        
        // Vérifier si toutes les contraintes sont satisfaites
        const constraintCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
        const allConstraintsMet = constraintCells.every(cell => {
            const expected = parseInt(cell.dataset.expected_black || '0');
            const actual = parseInt(cell.dataset.actual_black || '0');
            return expected === actual;
        });
        
        if (allConstraintsMet) {
            const isNewRecord = this.saveCompletedLevel(size, gameNumber);
            if (isNewRecord) {
                this.showVictoryMessage(true);
            } else {
                this.showVictoryMessage(false);
            }
        }
    }

    showConstraintDebugPopup(constraint) {
        let popup = document.getElementById('debugConstraintPopup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'debugConstraintPopup';
            popup.style.position = 'fixed';
            popup.style.top = '50%';
            popup.style.left = '50%';
            popup.style.transform = 'translate(-50%, -50%)';
            popup.style.background = 'rgba(44,62,80,0.92)';
            popup.style.color = 'white';
            popup.style.padding = '24px 32px';
            popup.style.fontSize = '1em';
            popup.style.borderRadius = '12px';
            popup.style.zIndex = 3000;
            popup.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
            popup.style.textAlign = 'center';
            popup.style.minWidth = '260px';
            popup.style.maxWidth = '90vw';
            popup.style.maxHeight = '80vh';
            popup.style.overflow = 'auto';
            // Bouton X pour fermer
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '8px';
            closeBtn.style.right = '16px';
            closeBtn.style.background = 'transparent';
            closeBtn.style.color = 'white';
            closeBtn.style.fontSize = '1.2em';
            closeBtn.style.border = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.zIndex = 3100;
            closeBtn.onclick = () => { popup.style.display = 'none'; };
            popup.appendChild(closeBtn);
            document.body.appendChild(popup);
        }
        // Remplir le contenu
        popup.innerHTML = '';
        // Bouton X
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '8px';
        closeBtn.style.right = '16px';
        closeBtn.style.background = 'transparent';
        closeBtn.style.color = 'white';
        closeBtn.style.fontSize = '1.2em';
        closeBtn.style.border = 'none';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.zIndex = 3100;
        closeBtn.onclick = () => { popup.style.display = 'none'; };
        popup.appendChild(closeBtn);
        // Titre
        const title = document.createElement('div');
        title.textContent = 'DEBUG CONTRAINTE';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '1.1em';
        title.style.marginBottom = '18px';
        popup.appendChild(title);
        // Infos
        const infos = document.createElement('div');
        infos.innerHTML = `
            <div><b>actualBlack</b> : ${constraint.dataset.actual_black}</div>
            <div><b>actualWhite</b> : ${constraint.dataset.actual_white}</div>
            <div><b>cellCount</b> : ${constraint.dataset.cell_count}</div>
            <div><b>hintEasy</b> : ${this.hintEasyList && this.hintEasyList.includes(constraint) ? 'true' : 'false'}</div>
            <div><b>hintMedium</b> : ${this.hintMediumList && this.hintMediumList.some(h => h.constraint === constraint) ? 'true' : 'false'}</div>
            <div><b>hintHard</b> : false</div>
        `;
        popup.appendChild(infos);
        // Affichage zoneStates
        if (constraint.zoneStates && constraint.zoneStates.length > 0) {
            const zoneDiv = document.createElement('div');
            zoneDiv.style.marginTop = '18px';
            zoneDiv.innerHTML = '<b>Zones sur la contrainte :</b>';
            const table = document.createElement('table');
            table.style.margin = '8px auto';
            table.style.borderCollapse = 'collapse';
            table.innerHTML = '<tr><th style="padding:2px 8px;">Zone</th><th style="padding:2px 8px;">Count</th><th style="padding:2px 8px;">État</th></tr>';
            for (const zs of constraint.zoneStates) {
                let stateTxt = zs.state === 1 ? 'NOIR' : zs.state === 2 ? 'BLANC' : '?';
                const tr = document.createElement('tr');
                tr.innerHTML = `<td style="padding:2px 8px;">${zs.zoneId}</td><td style="padding:2px 8px;">${zs.count}</td><td style="padding:2px 8px;">${stateTxt}</td>`;
                table.appendChild(tr);
            }
            zoneDiv.appendChild(table);
            popup.appendChild(zoneDiv);
        }
        popup.style.display = '';
    }

    updateHintBtn() {
        const hintBtn = document.getElementById('hintBtn');
        if (!hintBtn) return;
        const constraints = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="constraint"]'));
        let nbHintEasy = 0, nbHintMedium = 0, nbHintHard = 0;
        this.hintEasyList = [];
        this.hintMediumList = [];
        this.hintHardList = [];
        constraints.forEach(constraint => {
            const actualWhite = parseInt(constraint.dataset.actual_white || '0');
            const actualBlack = parseInt(constraint.dataset.actual_black || '0');
            const expectedBlack = parseInt(constraint.dataset.expected_black || '0');
            const cellCount = parseInt(constraint.dataset.cell_count || '0');
            // HintEasy
            if (
                ((actualWhite === (cellCount - expectedBlack)) || (actualBlack === expectedBlack)) &&
                (actualWhite + actualBlack < cellCount)
            ) {
                nbHintEasy++;
                this.hintEasyList.push(constraint);
            }
            // HintMedium
            if (constraint.zoneStates && constraint.zoneStates.length > 0) {
                // Chercher la zone la plus grande (et unique)
                let maxCount = 0, maxZones = [];
                for (const zs of constraint.zoneStates) {
                    if (zs.state === 0) {
                        if (zs.count > maxCount) {
                            maxCount = zs.count;
                            maxZones = [zs];
                        } else if (zs.count === maxCount) {
                            maxZones.push(zs);
                        }
                    }
                }
                if (maxZones.length === 1) {
                    const zs = maxZones[0];
                    // Règle 1 : zone doit être blanche
                    if (zs.count + actualBlack > expectedBlack) {
                        nbHintMedium++;
                        this.hintMediumList.push({constraint, zs, type: 'white'});
                    }
                    // Règle 2 : zone doit être noire
                    if (zs.count + actualWhite > (cellCount - expectedBlack)) {
                        nbHintMedium++;
                        this.hintMediumList.push({constraint, zs, type: 'black'});
                    }
                }
            }
            // HintHard : à implémenter plus tard
        });
        // ...
        const hintEasyBtn = document.getElementById('hintEasyBtn');
        if (hintEasyBtn) hintEasyBtn.textContent = `HINT EASY (${nbHintEasy})`;
        const hintMediumBtn = document.getElementById('hintMediumBtn');
        if (hintMediumBtn) hintMediumBtn.textContent = `HINT MEDIUM (${nbHintMedium})`;
        const hintHardBtn = document.getElementById('hintHardBtn');
        if (hintHardBtn) hintHardBtn.textContent = `HINT HARD (${nbHintHard})`;
        this.nbHintEasy = nbHintEasy;
        this.nbHintMedium = nbHintMedium;
        this.nbHintHard = nbHintHard;
    }

    showHintType(type) {
        if (type === 'easy') {
            if (this.hintEasyList && this.hintEasyList.length > 0) {
                const chosen = this.hintEasyList[Math.floor(Math.random() * this.hintEasyList.length)];
                if (chosen && chosen.dataset.constraintId) {
                    const t = chosen.dataset.constraintId[0];
                    const v = parseInt(chosen.dataset.constraintId.slice(1));
                    this.highlightGameCellsByConstraint(t, v);
                    this.showHintPopup && this.showHintPopup("Indice facile : cette ligne peut être complétée.");
                    return;
                }
            }
            this.showHintPopup && this.showHintPopup("Aucun indice facile disponible");
        } else if (type === 'medium') {
            if (this.hintMediumList && this.hintMediumList.length > 0) {
                const chosen = this.hintMediumList[Math.floor(Math.random() * this.hintMediumList.length)];
                if (chosen && chosen.constraint && chosen.constraint.dataset.constraintId) {
                    const t = chosen.constraint.dataset.constraintId[0];
                    const v = parseInt(chosen.constraint.dataset.constraintId.slice(1));
                    this.highlightGameCellsByConstraint(t, v);
                    let msg = `Indice moyen : la zone la plus grande doit être ` + (chosen.type === 'white' ? 'BLANCHE' : 'NOIRE') + ".";
                    this.showHintPopup && this.showHintPopup(msg);
                    return;
                }
            }
            this.showHintPopup && this.showHintPopup("Aucun indice moyen disponible");
        } else if (type === 'hard') {
            if (this.hintHardList && this.hintHardList.length > 0) {
                // Placeholder pour HintHard
                this.showHintPopup && this.showHintPopup("Indice difficile : à venir.");
                return;
            }
            this.showHintPopup && this.showHintPopup("Aucun indice difficile disponible");
        }
    }

    showHint() {
        // Priorité : Easy > Medium > Hard
        if (this.hintEasyList && this.hintEasyList.length > 0) {
            const chosen = this.hintEasyList[Math.floor(Math.random() * this.hintEasyList.length)];
            if (chosen && chosen.dataset.constraintId) {
                const type = chosen.dataset.constraintId[0];
                const val = parseInt(chosen.dataset.constraintId.slice(1));
                this.highlightGameCellsByConstraint(type, val);
                this.showHintPopup && this.showHintPopup("Indice facile : une ligne est proche d'être complétée.");
                return;
            }
        }
        if (this.hintMediumList && this.hintMediumList.length > 0) {
            const chosen = this.hintMediumList[Math.floor(Math.random() * this.hintMediumList.length)];
            if (chosen && chosen.constraint && chosen.constraint.dataset.constraintId) {
                const type = chosen.constraint.dataset.constraintId[0];
                const val = parseInt(chosen.constraint.dataset.constraintId.slice(1));
                this.highlightGameCellsByConstraint(type, val);
                let msg = `Indice moyen : la zone ${chosen.zs.zoneId} doit être ` + (chosen.type === 'white' ? 'BLANCHE' : 'NOIRE') + ".";
                this.showHintPopup && this.showHintPopup(msg);
                return;
            }
        }
        if (this.hintHardList && this.hintHardList.length > 0) {
            // Placeholder pour HintHard
            this.showHintPopup && this.showHintPopup("Indice difficile : à venir.");
            return;
        }
        this.showHintPopup && this.showHintPopup("Aucun indice disponible");
    }

    showHintPopup(msg) {
        let popup = document.getElementById('hintPopup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'hintPopup';
            popup.style.position = 'fixed';
            popup.style.top = '50%';
            popup.style.left = '50%';
            popup.style.transform = 'translate(-50%, -50%)';
            popup.style.background = 'rgba(44,62,80,0.92)';
            popup.style.color = 'white';
            popup.style.padding = '24px 32px';
            popup.style.fontSize = '1em';
            popup.style.borderRadius = '12px';
            popup.style.zIndex = 3000;
            popup.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
            popup.style.textAlign = 'center';
            popup.style.minWidth = '260px';
            popup.style.maxWidth = '90vw';
            popup.style.maxHeight = '80vh';
            popup.style.overflow = 'auto';
            // Bouton X pour fermer
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '8px';
            closeBtn.style.right = '16px';
            closeBtn.style.background = 'transparent';
            closeBtn.style.color = 'white';
            closeBtn.style.fontSize = '1.2em';
            closeBtn.style.border = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.zIndex = 3100;
            closeBtn.onclick = () => { popup.style.display = 'none'; };
            popup.appendChild(closeBtn);
            document.body.appendChild(popup);
        }
        popup.innerHTML = '';
        // Bouton X
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '8px';
        closeBtn.style.right = '16px';
        closeBtn.style.background = 'transparent';
        closeBtn.style.color = 'white';
        closeBtn.style.fontSize = '1.2em';
        closeBtn.style.border = 'none';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.zIndex = 3100;
        closeBtn.onclick = () => { popup.style.display = 'none'; };
        popup.appendChild(closeBtn);
        // Message
        const msgDiv = document.createElement('div');
        msgDiv.textContent = msg;
        msgDiv.style.margin = '32px 0 16px 0';
        msgDiv.style.fontWeight = 'bold';
        msgDiv.style.fontSize = '1em';
        popup.appendChild(msgDiv);
        popup.style.display = '';
    }
}

// Initialiser le jeu quand la page est chargée
window.addEventListener('load', () => {
    const game = new HexGridGame();
    game.populateGridSelector();
    
    // Vérifier s'il y a un ID_JEU dans l'URL
    const gameIdFromUrl = game.getGameIdFromUrl();
    if (gameIdFromUrl) {
        console.log(`Chargement de la grille depuis l'URL: ${gameIdFromUrl}`);
        game.generateGridFromGameId(gameIdFromUrl);
    } else if (window.GRIDS_DEFINITION && window.GRIDS_DEFINITION.length > 0) {
        game.loadGridFromConf(window.GRIDS_DEFINITION[0]);
    } else {
        game.generateGrid();
    }
    // Initialisation des boutons du menu
    game.updateModeButton();
    game.updateAnimationButton(false);
    game.updateGameIdDisplay();
    game.updateMenuProgress();
    
    // Créer un conteneur pour les éléments de jeu en dessous de la grille
    if (!document.getElementById('gameControls')) {
        const gameControls = document.createElement('div');
        gameControls.id = 'gameControls';
        gameControls.style.margin = '20px 8px';
        gameControls.style.textAlign = 'center';
        gameControls.style.position = 'relative';
        gameControls.style.display = 'block';
        gameControls.style.width = '100%';
        gameControls.style.clear = 'both';
        
        // Ajout de l'ID du jeu actuel
        const gameIdDisplay = document.createElement('div');
        gameIdDisplay.id = 'gameIdDisplay';
        gameIdDisplay.textContent = 'ID: Aucun';
        gameIdDisplay.style.margin = '8px';
        gameIdDisplay.style.fontSize = '14px';
        gameIdDisplay.style.color = '#666';
        gameIdDisplay.style.display = 'inline-block';
        
        // Ajout du compteur de coups
        const moveCounter = document.createElement('div');
        moveCounter.id = 'moveCounter';
        moveCounter.textContent = 'Coups: 0';
        moveCounter.style.margin = '8px';
        moveCounter.style.fontWeight = 'bold';
        moveCounter.style.fontSize = '16px';
        moveCounter.style.display = 'inline-block';
        
        // Ajout du bouton retour arrière
        const undoBtn = document.createElement('button');
        undoBtn.id = 'undoBtn';
        undoBtn.textContent = '← Retour arrière';
        undoBtn.style.margin = '8px';
        undoBtn.onclick = () => game.undoLastMove();
        
        // Ajouter les éléments au conteneur
        gameControls.appendChild(gameIdDisplay);
        gameControls.appendChild(moveCounter);
        gameControls.appendChild(undoBtn);
        
        // Insérer le conteneur après le grid-container
        const gridContainer = document.querySelector('.grid-container');
        if (gridContainer) {
            // Insérer après le grid-container
            gridContainer.parentNode.insertBefore(gameControls, gridContainer.nextSibling);
        } else {
            // Fallback : insérer à la fin du body
            document.body.appendChild(gameControls);
        }
    }
}); 