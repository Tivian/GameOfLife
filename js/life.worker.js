class LifeWorker {
    constructor(nth, cores) {
        [this.nth, this.cores] = [nth, cores];
        this.newGen = new Map();
    }

    _getHash(x, y) {
        return this._limitCoords(x, y, Point.getHash);
    }

    _newCell(x, y) {
        return this._limitCoords(x, y, (x, y) => ({ x: x, y: y, age: 0, hash: Point.getHash(x, y) }));
    }

    _limitCoords(x, y, callback) {
        let from = this.settings.limit.from;
        let to = this.settings.limit.to;

        switch (this.settings.type) {
            case 'infinite':
                return callback(x, y);
            case 'finite':
                if (Point.isInside(x, y, from, to))
                    return callback(x, y);
                break;
            case 'wrapped':
                return callback(
                    this._mod(x - from.x, (to.x - from.x + 1)) + from.x,
                    this._mod(y - from.y, (to.y - from.y - 1)) + from.y
                );
        }

        return undefined;
    }

    _birth(count) {
        return this.settings.rule.born.indexOf(count) != -1;
    }

    _death(count) {
        return this.settings.rule.survive.indexOf(count) == -1;
    }

    _mod(a, n) {
        return ((a % n) + n) % n;
    }

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

                    let neighborHash = this._getHash(cell.x + dx, cell.y + dy);
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

                                let otherHash = this._getHash(cell.x + dx + cx, cell.y + dy + cy);
                                if (otherHash === undefined)
                                    continue;

                                if (cells.has(otherHash))
                                    otherCounter++;
                            }
                        }

                        if (this._birth(otherCounter)) {
                            let neighbor = this._newCell(cell.x + dx, cell.y + dy);
                            this.newGen.set(neighbor.hash, neighbor); // create
                            changed = true;
                        }
                    }
                }
            }

            if (!this._death(counter))
                this.newGen.set(cell.hash, cell); // survive
            else
                changed = true;
        }

        return [ this.newGen, changed ];
    }

    setup(settings) {
        this.settings = settings;
    }
}

let life = new LifeWorker();
importScripts('./point.js');

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