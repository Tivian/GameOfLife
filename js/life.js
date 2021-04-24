class Life {
    constructor(canvas) {
        this.canvas = canvas instanceof jQuery ? canvas.get(0) : canvas;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx = this.canvas.getContext('2d');

        this.running = false;
        this.speed = 60;

        this.settings = {
            size: 10,
            border: 1,
            bkgColor: '#fff',
            borderColor: '#ccc',
            rule: {
                born: "3",
                survive: "23"
            }
        };

        this.cells = new Map();

        let self = this;
        $(window).on('resize', () => {
            self.canvas.width = window.innerWidth;
            self.canvas.height = window.innerHeight;
            self.draw();
        });

        $(this.canvas)
            .on('mousemove', ev => {
                //console.log(Math.floor(ev.pageX / self.settings.size), Math.floor(ev.pageY / self.settings.size));
                $('#coords').css({top: ev.pageY + 15, left: ev.pageX + 10});
                $('#coord_x').text(Math.floor(ev.pageX / self.settings.size));
                $('#coord_y').text(Math.floor(ev.pageY / self.settings.size));
            })
            .on('click', ev => {
                console.log(Math.floor(ev.pageX / self.settings.size), Math.floor(ev.pageY / self.settings.size));
                self.modify(Math.floor(ev.pageX / self.settings.size), Math.floor(ev.pageY / self.settings.size));
                self.draw();
            });

        this.draw();
    }

    async draw() {
        let height = this.canvas.height;
        let width = this.canvas.width;
        let size = this.settings.size;

        this.ctx.fillStyle = this.settings.bkgColor;
        this.ctx.fillRect(0, 0, width, height);

        for (let cell of this.cells.values()) {
            //if (!cell.alive)
                //continue;

            this.ctx.fillStyle = cell.isAlive ? '#000' : '#999';
            this.ctx.fillRect(cell.x * size, cell.y * size, size, size);
        }

        for (let y = 0; y < height; y += size) {
            for (let x = 0; x < width; x += size) {
                this.ctx.fillStyle = this.settings.borderColor;
                this.ctx.fillRect(x - this.settings.border / 2, y, this.settings.border, size);
            }

            this.ctx.fillStyle = this.settings.borderColor;
            this.ctx.fillRect(0, y, this.canvas.width, this.settings.border);
        }
    }

    modify(x, y) {
        let cell = new Cell(x, y, true);

        if (this.cells.has(cell.hash)) {
            cell = this.cells.get(cell.hash);
            if (cell.isAlive) {
                // kill
                cell.isAlive = false;

                for (let neighbor of cell.neighbors.values()) {
                    if (!neighbor.isAlive && neighbor.counter == 0) {
                        neighbor.neighbors.clear();
                        this.cells.delete(neighbor.hash);
                    }
                }

                if (cell.counter == 0) {
                    cell.neighbors.clear();
                    this.cells.delete(cell.hash);
                }
            } else {
                // bring to life
                cell.isAlive = true;
                this.createNeighborhood(cell);
            }
        } else {
            // create
            this.cells.set(cell.hash, cell);
            this.createNeighborhood(cell);
        }
    }

    getOrAdd(x, y) {
        let cell = new Cell(x, y, false);
        if (this.cells.has(cell.hash)) {
            return this.cells.get(cell.hash);
        } else {
            this.cells.set(cell.hash, cell);
            return cell;
        }
    }

    createNeighborhood(cell) {
        let neighborhood = new Map();

        for (let neighbor of cell.neighborhood) {
            let new_cell = this.getOrAdd(neighbor);
            neighborhood.set(new_cell.hash, new_cell);
        }

        for (let neighbor of neighborhood.values()) {
            cell.addNeighbor(neighbor);

            for (let other of neighbor.neighborhood) {
                if (neighborhood.has(other.hash))
                    neighbor.addNeighbor(neighborhood.get(other.hash));
            }
        }
    }

    async next() {
        let toModify = new Set();

        for (let cell of this.cells.values()) {
            if ((cell.isAlive && !this.settings.rule.survive.find(cell.counter))
            || (!cell.isAlive && this.settings.rule.born.find(cell.counter)))
                toModify.add(cell);
        }

        for (let cell of toModify) {
            this.modify(cell);
        }

        this.draw();
    }

    start() {
        let sleep = function(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        let self = this;
        this.running = true;
        (async function() {
            console.log(self);
            while(self.running) {
                await sleep(self.speed);
                self.next();
            }
        })();
    }
    
    stop() {
        this.running = false;
    }

    clear() {
        for (let cell of this.cells.values())
            cell.neighbors.clear();
        this.cells.clear();
    }
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    get hash() {
        /*const prime = 31;
        let hash = 7;
        hash = prime * hash + this.x;
        hash = prime * hash + this.y;
        return hash;*/
        return this.x + '|' + this.y;
    }

    toString() {
        return `(${this.x}, ${this.y})`;
    }
}

class Cell {
    constructor(x, y, alive = false) {
        this.pos = (x instanceof Cell) ? x.pos : (x instanceof Point) ? x : new Point(x, y);
        this.age = 0;

        this.counter = 0;
        this.neighbors = new Map();

        this.isAlive = alive;
        this.hash = this.pos.hash;

        Object.freeze(this.pos);
    }

    get x() {
        return this.pos.x;
    }

    get y() {
        return this.pos.y;
    }

    get isAlive() {
        return this.alive;
    }

    set isAlive(value) {
        this.alive = value;
        for (let neighbor of this.neighbors.values())
            neighbor.counter += value ? 1 : -1;
    }

    get neighborhood() {
        let self = this;
        return { 
            *[Symbol.iterator]() {
                for (let x = -1; x <= 1; x++) {
                    for (let y = -1; y <= 1; y++) {
                        if (x == 0 && y == 0)
                            continue;

                        yield new Point(self.x + x, self.y + y);
                    }
                }
            }
        };
    }

    addNeighbor(cell) {
        if (!this.neighbors.has(cell.hash)) {
            this.neighbors.set(cell.hash, cell);

            if (!cell.isAlive)
                cell.addNeighbor(this);
            else
                this.counter++;
        }
    }

    removeNeighbor(cell) {
        this.neighbors.delete(cell.hash);
    }

    toString() {
        return (this.isAlive ? 'Alive' : 'Dead') + ' cell at ' + this.pos.toString();
    }
}

String.prototype.find = function(searchValue, fromIndex) {
    return this.indexOf(searchValue, fromIndex) != -1;
};