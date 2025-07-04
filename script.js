class HexGridGame {
    constructor() {
        this.initializeElements();
        
        // Utiliser des valeurs par défaut si les éléments HTML n'existent pas
        if (this.gridSizeInput) {
            this.gridSize = parseInt(this.gridSizeInput.value);
        } else {
            this.gridSize = 4; // Valeur par défaut
        }
        
        this.selectedHexes = new Set();
        this.score = 0;
        this.grid = [];
        this.mode = 'game'; // Forcer le mode par défaut à GAME
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
    }
    
    initializeElements() {
        this.hexGridSvg = document.getElementById('hexGridSvg');
        if (!this.hexGridSvg) {
            throw new Error('hexGridSvg non trouvé dans le DOM. Vérifiez que <svg id="hexGridSvg"> existe dans votre HTML.');
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
        window.addEventListener('resize', () => this.generateGrid());
    }
    
    generateGrid() {
        // Cacher le message de victoire à chaque régénération
        const msgDiv = document.getElementById('victoryMsg');
        if (msgDiv) msgDiv.style.display = 'none';
        this.clearGrid();
        const svg = this.hexGridSvg;
        svg.innerHTML = '';
        // Synchroniser la largeur du SVG avec celle de son parent
        svg.style.width = '100%';
        svg.style.height = 'auto';
        // On attend le layout pour avoir la largeur réelle du SVG
        setTimeout(() => {
            const svgWidth = svg.clientWidth;
            const N = this.gridSize;
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
                        hex.setAttribute('fill', '#ff0000');
                        hex.setAttribute('stroke', '#b2bec3');
                        hex.setAttribute('stroke-width', '1');
                    } else {
                        hex.setAttribute('cursor', 'pointer');
                        hex.dataset.hexNumber = hexNumber;
                        hex.dataset.state = 0; // Toujours initialisé à GRIS
                        const zoneColor = hex.dataset.zoneId ? this.getZoneColor(hex.dataset.zoneId) : '#b2bec3';
                        hex.setAttribute('fill', zoneColor);
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
        }, 0);
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
        if (state === 0) {
            const zoneColor = hex.dataset.zoneId ? this.getZoneColor(hex.dataset.zoneId) : '#b2bec3';
            hex.setAttribute('fill', zoneColor);
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
                }
                // Ajout : en mode GAME, clic sur contrainte = highlight
                if (this.mode === 'game' && hex.dataset.type === 'constraint') {
                    hex.addEventListener('click', () => {
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
                    this.clearNeighborHighlight();
                });
            }
        });
    }
    
    // Méthode simplifiée pour ajouter les événements à une cellule
    addSimpleCellEvents(hex) {
        hex.addEventListener('click', () => {
            // Synchronisation des zones :
            const zoneId = hex.dataset.zoneId;
            if (zoneId) {
                // Récupérer toutes les cellules de la même zone
                const allZoneCells = Array.from(this.hexGridSvg.querySelectorAll('polygon[data-type="game"][data-zone-id="' + zoneId + '"]'));
                // Déterminer le nouvel état (cycle comme la cellule cliquée)
                let state = parseInt(hex.dataset.state);
                const newState = (state + 1) % 3;
                allZoneCells.forEach(cell => {
                    cell.dataset.state = newState;
                    if (newState === 0) {
                        const zoneColor = cell.dataset.zoneId ? this.getZoneColor(cell.dataset.zoneId) : '#b2bec3';
                        cell.setAttribute('fill', zoneColor);
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
                // Mettre à jour les contraintes une seule fois
                this.updateAllActualBlack();
                this.updateConstraintColors();
                if (this.mode === 'edit') {
                    this.updateYamlExport();
                }
            } else {
                this.cycleHexState(hex);
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
    
    // Affecte ou vérifie récursivement les coordonnées IJK à toute la grille
    affecterEtVerifierIJKRecursif(row, col, i, j, k) {
        const cell = this.findCellByCoords(row, col);
        if (!cell) return;
        // Si la cellule n'a pas encore de coordonnées, on les affecte
        if (cell.dataset.i === undefined || cell.dataset.j === undefined || cell.dataset.k === undefined) {
            cell.dataset.i = i;
            cell.dataset.j = j;
            cell.dataset.k = k;
        } else {
            // Sinon, on vérifie la cohérence
            const oldI = parseInt(cell.dataset.i);
            const oldJ = parseInt(cell.dataset.j);
            const oldK = parseInt(cell.dataset.k);
            if (oldI !== i || oldJ !== j || oldK !== k) {
                console.error(`Incohérence IJK pour cellule id=${cell.dataset.hexNumber} (row=${row},col=${col}) : existant=(${oldI},${oldJ},${oldK}), recalculé=(${i},${j},${k})`);
            }
            // Si déjà affecté et cohérent, on ne propage pas plus loin
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
                    hex.setAttribute('fill', '#ff0000');
                    hex.setAttribute('stroke', '#b2bec3');
                    hex.setAttribute('stroke-width', '1');
                } else {
                    hex.setAttribute('cursor', 'pointer');
                    hex.dataset.hexNumber = hexNumber;
                    hex.dataset.state = 0; // Toujours initialisé à GRIS
                    const zoneColor = hex.dataset.zoneId ? this.getZoneColor(hex.dataset.zoneId) : '#b2bec3';
                    hex.setAttribute('fill', zoneColor);
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
    }

    detectGridSizeFromTextualGrid(textual) {
        // Détecte la taille N à partir du nombre de lignes
        const lines = textual.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        return Math.floor((lines.length + 1) / 2);
    }

    initConstraintsFromConf(constraints) {
        const crownCells = this.listCrownCells();
        console.log('crownCells:', crownCells);
        const uselessIndices = crownCells
            .map((cell, index) => ({ cell, index }))
            //.filter(({ cell }) => cell.type === 'useless')
            .map(({ index }) => index)
            .sort((a, b) => a - b);

        let section = 0;
        let indices = [0, 0, 0];
        let allExpectedTmp = [[0],constraints.K, [0], constraints.I ,[0], constraints.J];
        let allExpected = allExpectedTmp.flat()
        console.log('allExpected:', allExpected);
        // Affectation réelle
        section = 0;
        indices = [0, 0, 0];
        crownCells.forEach((cell, idx) => {
            const svgCell = this.findCellByCoords(cell.row, cell.col);
            if (svgCell) {
                console.log(`cell found with idx=${idx}, (row,col)=(${cell.row},${cell.col}) and val=${allExpected[idx]}`);
                const val = allExpected[idx];
                svgCell.dataset.expected_black = (val !== undefined && val !== null) ? val : '';
            } else {
                console.log('cell not found:', cell);
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
            let val = 0;
            if (type) {
                const i = parseInt(constraint.dataset.i);
                const j = parseInt(constraint.dataset.j);
                const k = parseInt(constraint.dataset.k);
                gameCells.forEach(cell => {
                    if (parseInt(cell.dataset.state) === 1) {
                        if (type === 'I' && parseInt(cell.dataset.i) === i) val++;
                        if (type === 'J' && parseInt(cell.dataset.j) === j) val++;
                        if (type === 'K' && parseInt(cell.dataset.k) === k) val++;
                    }
                });
            }
            constraint.dataset.actual_black = val;
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
                }
            }
        });
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
                if (act < exp) {
                    cell.setAttribute('fill', '#fff'); // blanc
                    if (valueText) valueText.setAttribute('fill', '#222'); // texte noir
                    allOk = false;
                } else if (act === exp) {
                    cell.setAttribute('fill', '#27ae60'); // vert
                    if (valueText) valueText.setAttribute('fill', '#fff'); // texte blanc
                } else {
                    cell.setAttribute('fill', '#e74c3c'); // rouge
                    if (valueText) valueText.setAttribute('fill', '#fff'); // texte blanc
                    allOk = false;
                }
            } else {
                cell.setAttribute('fill', '#ff0000');
                if (valueText) valueText.setAttribute('fill', '#fff'); // texte blanc
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
            msgDiv.style.top = '20px';
            msgDiv.style.right = '20px';
            msgDiv.style.background = '#27ae60';
            msgDiv.style.color = 'white';
            msgDiv.style.padding = '16px 32px';
            msgDiv.style.fontSize = '2em';
            msgDiv.style.borderRadius = '12px';
            msgDiv.style.zIndex = 1000;
            msgDiv.style.display = 'none';
            document.body.appendChild(msgDiv);
        }
        if (allOk) {
            msgDiv.textContent = 'Gagné !';
            msgDiv.style.display = '';
        } else {
            msgDiv.style.display = 'none';
        }
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
}

// Initialiser le jeu quand la page est chargée
window.addEventListener('load', () => {
    const game = new HexGridGame();
    game.populateGridSelector();
    if (window.GRIDS_DEFINITION && window.GRIDS_DEFINITION.length > 0) {
        game.loadGridFromConf(window.GRIDS_DEFINITION[0]);
    } else {
        game.generateGrid();
    }
}); 