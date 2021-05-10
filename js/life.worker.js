/** Web Worker simplified version of [Life]{@link Life} class. */
class LifeWorker {
    /**
     * Creates new Life class for Web Worker.
     * @param {number} nth - A number of this thread
     * @param {number} cores - A number of all threads
     */
    constructor(nth, cores) {
        [this.nth, this.cores] = [nth, cores];
        this.newGen = new Map();
    }

    /**
     * Calculates next generation of autmaton.
     * @param {Map} cells - A Map of alive cells
     * @returns {boolean} True if any cell changed state.
     */
    next(cells) {
        let changed = false;
        this.newGen.clear();

        let index = 0;
        let min = Math.floor((this.nth / this.cores) * cells.size);
        let max = Math.floor(((this.nth + 1) / this.cores) * cells.size);

        for (let cell of cells.values()) {
            index++;
            if (index < min)
                continue;
            else if (index > max)
                break;

            cell.age++;

            let counter = 0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx == 0 && dy == 0)
                        continue;

                    let neighborHash = Life._getHash(cell.x + dx, cell.y + dy, this.settings);
                    if (neighborHash === undefined)
                        continue;

                    if (cells.has(neighborHash)) {
                        counter++;
                    } else {
                        let otherCounter = 0;
                        for (let cx = -1; cx <= 1; cx++) {
                            for (let cy = -1; cy <= 1; cy++) {
                                if (cx == 0 && cy == 0)
                                    continue;

                                let otherHash = Life._getHash(cell.x + dx + cx,
                                    cell.y + dy + cy, this.settings);
                                if (otherHash === undefined)
                                    continue;

                                if (cells.has(otherHash))
                                    otherCounter++;
                            }
                        }

                        if (Life._birth(otherCounter, this.settings)) {
                            let neighbor = Life._newCell(cell.x + dx, cell.y + dy, this.settings);
                            this.newGen.set(neighbor.hash, neighbor); // create
                            changed = true;
                        }
                    }
                }
            }

            if (!Life._death(counter, this.settings))
                this.newGen.set(cell.hash, cell); // survive
            else
                changed = true;
        }

        return [ this.newGen, changed ];
    }

    /**
     * Sets the automaton settings.
     * @param {object} settings - The automaton settings
     */
    setup(settings) {
        this.settings = settings;
    }
}

let life = new LifeWorker();
importScripts('life.js', 'point.js');

onmessage = function(ev) {
    switch (ev.data.action) {
        case 'new':
            life = new LifeWorker(ev.data.nth, ev.data.cores);
            break;
        case 'setup':
            life.setup(ev.data.settings);
            break;
        case 'next':
            postMessage({ action: 'done', result: life.next(ev.data.cells) });
            break;
    }
};