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
        this.ctx = this.canvas.getContext('2d');
        this.elem = $(this.canvas);
        this.cells = new Map();
        this._newGen = new Map();
        this._resize();

        this._running = false;
        this._origin = new Point(0, 0);
        this._generation = 0;

        let self = this;
        $(window).on('resize', () => {
            self._resize();
            self.draw();
        });

        let lastCoord = new Point(0, 0);
        let dragging = false;
        let dragged = false;

        $('#coords').css('user-select', 'none');

        $(this.canvas)
            .on('mousemove', ev => {
                if (dragging) {
                    $(self.canvas).css('cursor', 'grab');
                    let coord = new Point(ev.pageX, ev.pageY);
                    if (coord.distance(lastCoord) > 1)
                        dragged = true;

                    this.origin = [
                        this.origin.x + coord.x - lastCoord.x, 
                        this.origin.y + coord.y - lastCoord.y
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
                if (ev.which == 1) {
                    $(self.canvas).css('cursor', '');
                    dragging = false;
                }
            })
            .on('click', ev => {
                if (!dragged) {
                    let point = self._toPoint(ev);
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
                self.draw();
                self._displayCoords(ev);

                console.log(change, ev.pageX, ev.pageY);
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
        let sleep = (ms) => 
            new Promise(resolve => setTimeout(resolve, ms));

        let self = this;
        this._running = true;
        (async _ => {
            console.log("START");

            while(self._running) {
                await sleep(self.settings.speed);
                if (!await self.next())
                    self.stop();
                else
                    self.draw();
            }

            console.log("STOP");
        })();
    }
    
    stop() {
        this._running = false;
    }

    clear() {
        this.stop();
        this._generation = 0;
        this.cells.clear();
        this.draw();
    }

    _toPoint(ev) {
        let size = this.cellSize;
        return new Point(
            Math.floor((ev.pageX - this.origin.x) / size),
            -Math.floor((ev.pageY - this.origin.y) / size)
        );
    }

    _displayCoords(ev) {
        let point = this._toPoint(ev);
        let elem = $('#coords');
        let maxHeight = this.elem.height() - elem.outerHeight();
        let maxWidth = this.elem.width() - elem.outerWidth();

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
        this.origin = [
            this.elem.width()  / 2,
            this.elem.height() / 2
        ];

        if (typeof ev !== 'undefined')
            this._displayCoords(ev);

        this.draw();
    }

    async test() {
        let sleep = (ms) => 
            new Promise(resolve => setTimeout(resolve, ms));

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
            await sleep(10);
        console.log(`Time: ${performance.now() - start}ms`);
    }
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
