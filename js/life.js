class Life {
    constructor(canvas) {
        this.settings = {
            speed: 10,
            scale: 1.0,
            size: 10,
            border: 1,
            bkgColor: '#fff',
            borderColor: '#ccc',
            rule: {
                born: '3',
                survive: '23'
            }
        };

        this.canvas = (canvas instanceof jQuery) ? canvas.get(0) : canvas;
        this.$canvas = $(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.cells = new Map();
        this._newGen = new Map();
        this._resize();

        this._running = false;
        this._origin = new Point(0, 0);
        this._generation = 0;

        let self = this;

        let mouseLast = new Point(0, 0);
        let dragging = false;
        let dragged = false;

        $(window)
            .on('resize', () => {
                self._resize();
                self.draw();
            })
            .on('mousemove', ev => {
                if (dragging) {
                    $(self.canvas).css('cursor', 'grabbing');
                    let coord = new Point(ev.pageX, ev.pageY);
                    if (coord.distance(mouseLast) > 1)
                        dragged = true;

                    this.origin = [
                        this.origin.x + coord.x - mouseLast.x, 
                        this.origin.y + coord.y - mouseLast.y
                    ];

                    mouseLast = coord;
                    this.draw();
                }
            })
            .on('mouseup', ev => {
                if (ev.which == 1) {
                    self.$canvas.css('cursor', '');
                    dragging = false;
                }
            });

        this.$canvas
            .on('mousedown', ev => {
                mouseLast = new Point(ev.pageX, ev.pageY);

                if (ev.which == 1) {
                    dragging = true;
                } else if (ev.which == 2) {
                    self.center(ev);
                }
            })
            .on('click', ev => {
                if (!dragged) {
                    let point = self.getPosition(ev);
                    console.log(point.x, point.y);
                    self.create(point);
                    self.draw();
                } else {
                    dragged = false;
                }
            })
            .on('wheel', ev => {
                let delta = ev.originalEvent.deltaY < 0 ? 1 : -1;
                let weight = self.cellSize / 75;
                let change = weight * delta;
                self.scale += change;

                // TODO: change origin point for more natural zooming
                /*self.origin = [
                ];*/

                self.draw();
                console.log(change, ev.pageX, ev.pageY);
            });

        this.center();
    }

    get isRunning() {
        return this._running;
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

    get origin() {
        return this._origin;
    }

    set origin(value) {
        [this._origin.x, this._origin.y] = value instanceof Array
            ? value : [value.x, value.y];
        let size = this.cellSize;

        this._top = new Point(
            -Math.ceil(this._origin.x / size),
            Math.ceil(this._origin.y / size)
        );

        this._bottom = new Point(
            -Math.ceil((this._origin.x - this.width) / size),
            Math.ceil((this._origin.y - this.height) / size)
        );
    }

    get scale() {
        return this.settings.scale;
    }

    set scale(value) {
        if (value < 0.1)
            value = 0.1;
        else if (value > 100)
            value = 100;

        let oldValue = this.settings.scale;
        this.settings.scale = value;
        this.origin = [this.origin.x, this.origin.y];

        if (this.cellSize <= this.cellBorder)
            this.settings.scale = oldValue;
    }

    get cellSize() {
        return Math.ceil(this.settings.size * this.settings.scale);
    }

    get cellBorder() {
        return Math.ceil(this.settings.border * this.settings.scale);
    }

    _inside(point) {
        return point.x >= this._top.x
            && point.x <= this._bottom.x
            && point.y <= this._top.y
            && point.y >= this._bottom.y;
    }

    _resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    draw() {
        let height = this.canvas.height;
        let width = this.canvas.width;
        let size = this.cellSize;
        let border = this.cellBorder;

        this.ctx.fillStyle = this.settings.bkgColor;
        this.ctx.fillRect(0, 0, width, height);

        for (let cell of this.cells.values()) {
            if (!this._inside(cell))
                continue;

            let color = `rgb(${Math.atan(100 / cell.age) / (Math.PI / 2) * 220}, 0, ${Math.atan(cell.age / 100) / (Math.PI / 2) * 220})`;
            this.ctx.fillStyle = color;
            this.ctx.fillRect(this.origin.x + cell.x * size, this.origin.y - cell.y * size, size, size);
        }

        this.ctx.fillStyle = this.settings.borderColor;
        for (let x = (this.origin.x % size) - size; x < width; x += size)
            this.ctx.fillRect(x, 0, border, height);

        for (let y = (this.origin.y % size) - size; y < height; y += size)
            this.ctx.fillRect(0, y, width, border);
    }

    create(x, y) {
        let cell = new Cell(x, y);

        if (this.cells.has(cell.hash))
            this.cells.delete(cell.hash);
        else
            this.cells.set(cell.hash, cell);
    }

    async next() {
        let changed = false;
        this._newGen.clear();

        this._generation++;
        for (let cell of this.cells.values()) {
            cell.age++;

            let counter = 0;
            for (let neighbor of cell.neighborhood) {
                if (this.cells.has(neighbor.hash)) {
                    counter++;
                } else {
                    let other_counter = 0;
                    for (let other of neighbor.neighborhood) {
                        if (this.cells.has(other.hash))
                            other_counter++;
                    }

                    if (this.settings.rule.born.indexOf(other_counter) != -1) {
                        this._newGen.set(neighbor.hash, neighbor); // create
                        changed = true;
                    }
                }
            }

            if (this.settings.rule.survive.indexOf(counter) != -1)
                this._newGen.set(cell.hash, cell); // survive
            else
                changed = true;
        }

        this.cells = new Map(this._newGen);
        return changed;
    }

    start() {
        this.canvas.dispatchEvent(new Event('start'));

        let self = this;
        this._running = true;
        (async _ => {
            console.log('START');

            while(self._running) {
                await Life.sleep(self.settings.speed);
                if (!await self.next())
                    self.stop();
                else
                    self.draw();
            }

            console.log('STOP');
        })();
    }
    
    stop() {
        this.canvas.dispatchEvent(new Event('stop'));
        this._running = false;
    }

    clear() {
        this.stop();
        this._generation = 0;
        this.cells.clear();
        this.draw();
    }

    load(cells, override = false) {
        if (typeof cells === 'undefined')
            return;

        if (override)
            this.cells.clear();

        if (cells instanceof Array) {
            if (cells[0] instanceof Cell) {
                for (let cell of cells)
                    this.cells.set(cell.hash, cell);
            } else if (cells[0] instanceof Array) {
                for (let cell of cells) {
                    let obj = new Cell(cell[0], cell[1]);
                    this.cells.set(obj.hash, obj);
                }
            } else {
                for (let cell of cells) {
                    let obj = new Cell(cell.x, cell.y);
                    this.cells.set(obj.hash, obj);
                }
            }
        } else if (cells instanceof Map) {
            for (let entry of cells)
                this.cells.set(entry[0], entry[1]);
        }

        this.draw();
    }

    center(ev) {
        this.origin = [
            this.$canvas.width()  / 2,
            this.$canvas.height() / 2
        ];
        
        let event = new jQuery.Event('mousemove');
        if (typeof ev !== 'undefined')
            [event.targer, event.pageX, event.pageY] = [ev.target, ev.pageX, ev.pageY];
        this.$canvas.trigger(event);
        this.draw();
    }

    getPosition(ev) {
        let size = this.cellSize;
        return new Point(
            Math.floor((ev.pageX - this.origin.x) / size),
            -Math.floor((ev.pageY - this.origin.y) / size)
        );
    }

    async test() {
        this.clear();

        this.create(0, 0);
        this.create(1, 0);
        this.create(0, 1);
        this.create(1, 1);
        
        this.create(2, -1);

        this.create(3, 0);
        this.create(4, 0);
        this.create(3, 1);
        this.create(4, 1);

        let start = performance.now();
        this.start();
        while (this.generation < 500)
            await Life.sleep(10);
        console.log(`Time: ${performance.now() - start}ms`);
    }

    static sleep = (ms) => 
        new Promise(resolve => setTimeout(resolve, ms));
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hash = `${x}|${y}`;
    }

    distance(other) {        
        return Math.floor(
            Math.pow(other.x - this.x, 2)
          + Math.pow(other.y - this.y, 2));
    }

    toString() {
        return `(${this.x}, ${this.y})`;
    }
}

class Cell {
    constructor(x, y) {
        this._pos = (x instanceof Cell)
            ? x._pos : (x instanceof Point)
            ? x : new Point(x, y);
        this.age = 0;
    }

    get x() {
        return this._pos.x;
    }

    get y() {
        return this._pos.y;
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

                        yield new Cell(self.x + x, self.y + y);
                    }
                }
            }
        };
    }

    toString() {
        return `Cell at ${this._pos.toString()}`;
    }
}
