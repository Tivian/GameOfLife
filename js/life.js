class Life {
    constructor(canvas) {
        this.settings = {
            speed: 10,
            size: 10,
            border: 1,
            showDead: false,
            bkgColor: '#fff',
            borderColor: '#ccc',
            rule: {
                born: '3',
                survive: '23'
            }
        };

        this.canvas = (canvas instanceof jQuery) ? canvas.get(0) : canvas;
        this.ctx = this.canvas.getContext('2d');
        this.cells = new Map();
        this._resize();

        this._running = false;
        this._shift = new Point(0, 0);
        this._generation = 0;

        let self = this;
        $(window).on('resize', () => {
            self.canvas.width = window.innerWidth;
            self.canvas.height = window.innerHeight;
            self.draw();
        });

        let lastCoord = new Point(0, 0);
        let dragging = false;
        let dragged = false;

        $('#coords').css('user-select', 'none');

        $(this.canvas)
            .on('mousemove', ev => {
                if (dragging) {
                    let coord = new Point(ev.pageX, ev.pageY);
                    if (coord.distance(lastCoord) > 1)
                        dragged = true;

                    this.shift = [
                        this.shift.x + coord.x - lastCoord.x, 
                        this.shift.y + coord.y - lastCoord.y
                    ];

                    lastCoord = coord;
                    this.draw();
                }

                self._displayCoords(ev);
            })
            .on('mousedown', ev => {
                lastCoord = new Point(ev.pageX, ev.pageY);

                if (ev.which == 1) {
                    dragging = true;
                } else if (ev.which == 2) {
                    self.center(ev);
                }
            })
            .on('mouseup', ev => {
                if (ev.which == 1)
                    dragging = false;
            })
            .on('click', ev => {
                if (!dragged) {
                    let point = self._toPoint(ev);
                    console.log(point.x, point.y);
                    self.modify(point.x, point.y);
                    self.draw();
                } else {
                    dragged = false;
                }
            })
            .on('contextmenu', ev => {
                ev.preventDefault();
            });

        this.center();
    }

    get population() {
        return this.cells.size;
    }

    get generation() {
        return this._generation;
    }

    get width() {
        return this.canvas.width;
    }

    get height() {
        return this.canvas.height;
    }

    get shift() {
        return this._shift;
    }

    set shift(value) {
        [this._shift.x, this._shift.y] = value;

        this._top = new Point(
            -Math.ceil(this._shift.x / this.settings.size),
            -Math.ceil(this._shift.y / this.settings.size)
        );

        this._bottom = new Point(
            -Math.ceil((this._shift.x - this.width) / this.settings.size),
            -Math.ceil((this._shift.y - this.height) / this.settings.size)
        );
    }

    get showDead() {
        return this.settings.showDead;
    }

    set showDead(value) {
        this.settings.showDead = value;
        this.draw();
    }

    _inside(point) {
        return point.x >= this._top.x
            && point.x <= this._bottom.x
            && point.y >= this._top.y
            && point.y <= this._bottom.y;
    }

    _resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    draw() {
        let height = this.canvas.height;
        let width = this.canvas.width;
        let size = this.settings.size;

        this.ctx.fillStyle = this.settings.bkgColor;
        this.ctx.fillRect(0, 0, width, height);

        for (let cell of this.cells.values()) {
            if (!this._inside(cell))
                continue;

            if (!this.settings.showDead && !cell.isAlive)
                continue;

            let color = `rgb(${Math.atan(100 / cell.age) / (Math.PI / 2) * 220}, 0, ${Math.atan(cell.age / 100) / (Math.PI / 2) * 220})`;
            this.ctx.fillStyle = cell.isAlive ? color : '#999';
            this.ctx.fillRect(this.shift.x + cell.x * size, this.shift.y + cell.y * size, size, size);
        }

        for (let y = (this.shift.y % size) - size; y < height; y += size) {
            for (let x = (this.shift.x % size) - size; x < width; x += size) {
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
                
                for (let neighbor of cell.neighbors) {
                    if (!neighbor.isAlive && neighbor.counter == 0)
                        this.remove(neighbor);
                }

                if (cell.counter == 0)
                    this.remove(cell);
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

    remove(cell) {
        cell.clear();
        this.cells.delete(cell.hash);
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
        for (let neighbor of cell.neighborhood)
            cell.addNeighbor(this.getOrAdd(neighbor));
    }

    async next() {
        let toModify = [];

        for (let cell of this.cells.values()) {
            if ((cell.isAlive && !this.settings.rule.survive.find(cell.counter))
            || (!cell.isAlive && this.settings.rule.born.find(cell.counter)))
                toModify.push(cell);

            cell.age++;
        }

        this._generation++;
        if (toModify.length > 0) {
            for (let cell of toModify)
                this.modify(cell);

            this.draw();
            return true;
        } else {
            return false;
        }
    }

    start() {
        let sleep = (ms) => {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        let self = this;
        this._running = true;
        (async _ => {
            console.log("START");

            while(self._running) {
                await sleep(self.settings.speed);
                if (!await self.next() || (self.cells.size == 0))
                    self.stop();
            }

            console.log("STOP");
        })();
    }
    
    stop() {
        this._running = false;
    }

    clear() {
        this.stop();

        for (let cell of this.cells.values())
            cell.clear();
        this.cells.clear();

        this.draw();
    }

    _toPoint(ev) {
        return new Point(
            Math.floor((ev.pageX - this.shift.x) / this.settings.size),
            Math.floor((ev.pageY - this.shift.y) / this.settings.size)
        );
    }

    _displayCoords(ev) {
        let point = this._toPoint(ev);
        let elem = $('#coords');
        let maxHeight = window.innerHeight - elem.outerHeight();
        let maxWidth = window.innerWidth - elem.outerWidth();

        if (!elem.is(":visible"))
            elem.show();

        elem.css({
            top:  ev.pageY > maxHeight - 35 ? maxHeight - 10 : ev.pageY + 20,
            left: ev.pageX > maxWidth  - 25 ? maxWidth  - 10 : ev.pageX + 10
        });

        $('#coord_x').text(point.x);
        $('#coord_y').text(point.y);
    }

    center(ev) {
        this.shift = [
            window.innerWidth  / 2 - this.settings.size / 2,
            window.innerHeight / 2 - this.settings.size / 2
        ];

        if (typeof ev !== 'undefined')
            this._displayCoords(ev);

        this.draw();
    }
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this._hash = this.x + '|' + this.y;
    }

    get hash() {
        return this._hash;
    }

    distance(other) {
        if (!(other instanceof Point))
            return undefined;
        
        return Math.floor(
            Math.pow(other.x - this.x, 2)
          + Math.pow(other.y - this.y, 2));
    }

    toString() {
        return `(${this.x}, ${this.y})`;
    }
}

class Cell {
    constructor(x, y, alive = false) {
        this._pos = (x instanceof Cell)
            ? x._pos : (x instanceof Point)
            ? x : new Point(x, y);
        this._age = 0;
        this._alive = alive;

        this._counter = 0;
        this._neighbors = new Map();
    }

    get x() {
        return this._pos.x;
    }

    get y() {
        return this._pos.y;
    }

    get isAlive() {
        return this._alive;
    }

    set isAlive(value) {
        this._alive = value;
        for (let neighbor of this.neighbors)
            neighbor._counter += value ? 1 : -1;
    }

    get neighbors() {
        return this._neighbors.values();
    }

    get counter() {
        return this._counter;
    }

    get age() {
        return this._age;
    }

    set age(value) {
        this._age = this.isAlive ? value : 0;
    }

    get hash() {
        return this._pos.hash;
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
        if (this._neighbors.size == 8)
            return;

        if (!this._neighbors.has(cell.hash)) {
            this._neighbors.set(cell.hash, cell);

            if (!cell.isAlive)
                cell.addNeighbor(this);
            else
                this._counter++;
        }
    }

    removeNeighbor(cell) {
        this._neighbors.delete(cell.hash);
    }

    clear() {
        for (let other of this.neighbors)
            other.removeNeighbor(this);
        this._neighbors.clear();
    }

    toString() {
        return (this.isAlive ? 'Alive' : 'Dead') + ' cell at ' + this._pos.toString();
    }
}

String.prototype.find = function(searchValue, fromIndex) {
    return this.indexOf(searchValue, fromIndex) != -1;
};