class Life {
    constructor(canvas) {
        this._settings = {
            speed: 10,
            step: 1,
            scale: 1.0,
            size: 10,
            border: 1,
            locked: false,
            detect: true,
            type: 'infinite',
            limit: {
                from: new Point(),
                to: new Point()
            },
            origin: new Point(),
            top: new Point(),
            bottom: new Point(),
            colors: {
                background: '#fff',
                border: '#ccc',
                outside: '#bbb',
                hot: [ 0xdc, 0x14, 0x3c ],
                medium: [ 0x00, 0x00, 0xff ],
                cold: [ 0x00, 0x00, 0xcd ]
            },
            rule: {
                born: '3',
                survive: '23'
            }
        };
        this.defaults = $.deepCopy(this._settings);

        this.canvas = (canvas instanceof jQuery) ? canvas.get(0) : canvas;
        this.$canvas = $(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this._resize();

        this.cells = new Map();
        this._newGen = new Map();
        this._generation = 0;
        this._running = false;        

        let self = this;

        let mouseLast = new Point();
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
                        this._settings.origin.x + coord.x - mouseLast.x, 
                        this._settings.origin.y + coord.y - mouseLast.y
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
                if (!dragged && !this._settings.locked) {
                    let point = self.getPosition(ev);
                    console.log(`Create cell at ${point.toString()}`);
                    self.create(point.x, point.y);
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

    get top() {
        return this._settings.top;
    }

    get bottom() {
        return this._settings.bottom;
    }

    get origin() {
        return this._settings.origin;
    }

    set origin(value) {
        [this._settings.origin.x, this._settings.origin.y] = value instanceof Array
            ? value : [value.x, value.y];
        let size = this.cellSize;

        this._settings.top = new Point(
            -Math.ceil(this._settings.origin.x / size),
            Math.ceil(this._settings.origin.y / size)
        );

        this._settings.bottom = new Point(
            -Math.ceil((this._settings.origin.x - this.width) / size),
            Math.ceil((this._settings.origin.y - this.height) / size)
        );
    }

    get scale() {
        return this._settings.scale;
    }

    set scale(value) {
        if (value < 0.1)
            value = 0.1;
        else if (value > 100)
            value = 100;

        let oldValue = this._settings.scale;
        this._settings.scale = value;
        this.origin = [this._settings.origin.x, this._settings.origin.y];

        if (this.cellSize <= this.cellBorder)
            this._settings.scale = oldValue;
    }

    get cellSize() {
        return Math.ceil(this._settings.size * this._settings.scale);
    }

    get cellBorder() {
        return Math.ceil(this._settings.border * this._settings.scale);
    }

    get rule() {
        return this._settings.rule;
    }

    set rule(value) {
        if (typeof value !== 'undefined') {
            if (typeof value === 'object') {
                [this._settings.rule.born, this._settings.rule.survive] =
                    [value.born, value.survive];
            } else if (typeof value === 'string') {
                let result = value.match(/B?([0-8]+)\/S?([0-8]+)/);

                if (result != null) {
                    [this._settings.rule.born, this._settings.rule.survive] =
                        [result[1], result[2]];
                } else {
                    return;
                }
            } else {
                return;
            }

            const normalize = str => new Array(...(new Set(str.split('')))).sort().join('');
            this._settings.rule.born = normalize(this._settings.rule.born);
            this._settings.rule.survive = normalize(this._settings.rule.survive);
            this.$canvas.trigger('change.rule');
        }
    }

    get speed() {
        return this._settings.speed;
    }

    set speed(value) {
        if (value < 1)
            value = 1;
        this._settings.speed = value;
        this.$canvas.trigger('change.speed');
    }

    get step() {
        return this._settings.step;
    }

    set step(value) {
        if (value < 1)
            value = 1;
        this._settings.step = value;
        this.$canvas.trigger('change.step');
    }

    get locked() {
        return this._settings.locked;
    }

    set locked(value) {
        this._settings.locked = !!value;
        this.$canvas.trigger('change.lock');
    }

    get detectStillLife() {
        return this._settings.detect;
    }

    set detectStillLife(value) {
        this._settings.detect = !!value;
        this.$canvas.trigger('change.detect');
    }

    get type() {
        return this._settings.type;
    }

    set type(value) {
        const valid = new Set([ 'infinite', 'finite', 'wrapped' ]);
        if (!valid.has(value)) 
            return;

        this._settings.type = value;
        this.$canvas.trigger('change.type');
    }

    get limit() {
        let from = this._settings.limit.from;
        let to = this._settings.limit.to;

        return {
            to:     to,
            from:   from,
            width:  to.x - from.x,
            height: from.y - to.y
        };
    }

    set limit(value) {
        if (typeof value === 'object') {
            if (value.from !== undefined && value.to !== undefined) {
                [this._settings.limit.from, this._settings.limit.to] = [value.from, value.to];
            } else if (value.width !== undefined && value.height !== undefined) {
                let width  = Math.ceil(value.width  / 2);
                let height = Math.ceil(value.height / 2);
                this._settings.limit.from = new Point(-width, height);
                this._settings.limit.to   = new Point(width, -height);
            } else {
                return;
            }

            this.$canvas.trigger('change.limit');
        }
    }

    _resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    _inside(point) {
        return this._insideRect(point, this._settings.top, this._settings.bottom);
    }

    _insideRect(point, from, to) {
        return this._insideRectCoord(point.x, point.y, from, to);
    }

    _insideRectCoord(x, y, from, to) {
        return x >= from.x
            && x <= to.x
            && y <= from.y
            && y >= to.y;
    }

    _getHash(x, y) {
        return this._limitCoords(x, y, Cell.getHash);
    }

    _newCell(x, y) {
        return this._limitCoords(x, y, (x, y) => new Cell(x, y));
    }

    _limitCoords(x, y, callback) {
        let from = this._settings.limit.from;
        let to = this._settings.limit.to;

        switch (this._settings.type) {
            case 'infinite':
                return callback(x, y);
            case 'finite':
                if (this._insideRectCoord(x, y, from, to))
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
        return this._settings.rule.born.indexOf(count) != -1;
    }

    _death(count) {
        return this._settings.rule.survive.indexOf(count) == -1;
    }

    // Inspired by https://stackoverflow.com/a/1573154/11702094
    _convertColor(color) {
        if (typeof color !== 'string')
            return color;

        let elem = document.createElement('div');
        elem.style.color = color;
        document.body.appendChild(elem);
        let rgb = window.getComputedStyle(elem).color;
        document.body.removeChild(elem);
        return rgb.replace(/[^\d,]/g, '').split(',').map(x => parseInt(x));
    }

    // Inspired by https://gist.github.com/gskema/2f56dc2e087894ffc756c11e6de1b5ed
    _gradientRGB = [];
    _colorGradient(fadeFraction, rgbColor1, rgbColor2, rgbColor3) {
        let color1 = rgbColor1;
        let color2 = rgbColor2;
        let fade = fadeFraction;

        // Do we have 3 colors for the gradient? Need to adjust the params.
        if (rgbColor3) {
            fade = fade * 2;

            // Find which interval to use and adjust the fade percentage
            if (fade >= 1) {
                fade -= 1;
                color1 = rgbColor2;
                color2 = rgbColor3;
            }
        }

        for (let i = 0; i < 3; i++)
            this._gradientRGB[i] = Math.floor(color1[i] + ((color2[i] - color1[i]) * fade));

        return `rgb(${this._gradientRGB.join(',')})`;
    }

    _mod(a, n) {
        return ((a % n) + n) % n;
    }

    draw() {
        let height = this.canvas.height;
        let width = this.canvas.width;
        let size = this.cellSize;
        let border = this.cellBorder;
        let origin = this._settings.origin;
        let limit = this._settings.limit;
        let colors = this._settings.colors;

        this.ctx.fillStyle = colors.background;
        this.ctx.fillRect(0, 0, width, height);

        if (this._settings.type !== 'infinite') {
            this.ctx.fillStyle = colors.outside;
            this.ctx.fillRect(0, 0, width, origin.y - limit.from.y * size);
            this.ctx.fillRect(0, 0, origin.x + limit.from.x * size, height);
            this.ctx.fillRect(width, height, origin.x + (limit.to.x + 1) * size - width, -height);
            this.ctx.fillRect(width, height, -width, origin.y - (limit.to.y - 1) * size - height);
        }

        this.cells.forEach(cell => {
            if (!this._inside(cell))
                return;

            this.ctx.fillStyle = this._colorGradient(
                Math.atan(cell.age / 500) / (Math.PI / 2),
                colors.hot, colors.medium, colors.cold);
            this.ctx.fillRect(origin.x + cell.x * size, origin.y - cell.y * size, size, size);
        });

        this.ctx.fillStyle = colors.border;
        for (let x = (origin.x % size) - size; x < width; x += size)
            this.ctx.fillRect(x - 0.5, -0.5, border, height);

        for (let y = (origin.y % size) - size; y < height; y += size)
            this.ctx.fillRect(-0.5, y - 0.5, width, border);
    }

    create(x, y) {
        if (this._settings.type !== 'infinite'
          && (!this._insideRectCoord(x, y, this._settings.limit.from, this._settings.limit.to)))
            return;

        let cell = new Cell(x, y);

        if (this.cells.has(cell.hash))
            this.cells.delete(cell.hash);
        else
            this.cells.set(cell.hash, cell);
    }

    next() {
        let changed = false;
        this._newGen.clear();

        this._generation++;
        for (let cell of this.cells.values()) {
            cell.age++;

            let counter = 0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx == 0 && dy == 0)
                        continue;

                    let neighborHash = this._getHash(cell.x + dx, cell.y + dy);
                    if (neighborHash === undefined)
                        continue;

                    if (this.cells.has(neighborHash)) {
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

                                if (this.cells.has(otherHash))
                                    otherCounter++;
                            }
                        }

                        if (this._birth(otherCounter)) {
                            let neighbor = this._newCell(cell.x + dx, cell.y + dy);
                            this._newGen.set(neighbor.hash, neighbor); // create
                            changed = true;
                        }
                    }
                }
            }

            if (!this._death(counter))
                this._newGen.set(cell.hash, cell); // survive
            else
                changed = true;
        }

        this.cells.clear();
        this._newGen.forEach((val, key) => this.cells.set(key, val));
        return changed;
    }

    start() {
        if (this._running)
            return;

        this.$canvas.trigger('start');

        let self = this;
        this._running = true;
        (async _ => {
            console.log('START');

            while(self._running) {
                await Life.sleep(self._settings.speed);
                for (let i = 0; i < self._settings.step; i++) {
                    if (!self.next() && self._settings.detect) {
                        self.stop();
                        break;
                    }
                }

                self.draw();
            }

            console.log('STOP');
        })();
    }
    
    stop() {
        if (!this._running)
            return;

        this.$canvas.trigger('stop');
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
                cells.forEach(cell => this.cells.set(cell.hash, cell));
            } else if (cells[0] instanceof Array) {
                cells.forEach(cell => {
                    let obj = new Cell(cell[0], cell[1]);
                    this.cells.set(obj.hash, obj);
                });
            } else {
                cells.forEach(cell => {
                    let obj = new Cell(cell.x, cell.y);
                    this.cells.set(obj.hash, obj);
                });
            }
        } else if (cells instanceof Map) {
            cells.forEach((val, key) => this.cells.set(key, val));
        } else if (cells instanceof LifeFile) {
            console.log('file', cells);
        }

        this.draw();
    }

    center(ev) {
        this.origin = [
            this.$canvas.width()  / 2 - 0.5 * this.cellSize,
            this.$canvas.height() / 2 - 0.5 * this.cellSize
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

    setColor(name, color) {
        const gradient = new Set([ 'hot', 'medium', 'cold' ]);
        this._settings.colors[name] = gradient.has(name) ?
            this._convertColor(color) : color;
    }

    async test() {
        if (this.isRunning)
            return;

        this.clear();
        let speed = this.speed;
        this.speed = 0;

        this.create(-2, 1);
        this.create(-1, 1);
        this.create(-2, 0);
        this.create(-1, 0);
        
        this.create(0, -1);

        this.create(1, 0);
        this.create(2, 0);
        this.create(1, 1);
        this.create(2, 1);

        let start = performance.now();
        this.start();
        while (this.generation < 500)
            await Life.sleep(10);
        console.log(`Time: ${Math.round(performance.now() - start)}ms`);
        this.stop();
        this.speed = speed;

        /* RESULTS
         *  Firefox: 7700 / 2800(with profiler launched[WTF])
         *  Chrome:  2700
         *  Edge:    2700
         *  Opera:   2700
         */
    }

    static sleep = (ms) => 
        new Promise(resolve => setTimeout(resolve, ms));
}

class Point {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.hash = Point.getHash(x, y);
    }

    distance(other) {        
        return Math.floor(
            Math.pow(other.x - this.x, 2)
          + Math.pow(other.y - this.y, 2));
    }

    toString() {
        return `(${this.x}, ${this.y})`;
    }

    static getHash(x, y) {
        return `${x}|${y}`;
    }
}

class Cell {
    constructor(x, y) {
        this._pos = new Point(x, y);
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

    toString() {
        return `Cell at ${this._pos.toString()}`;
    }

    static getHash(x, y) {
        return Point.getHash(x, y);
    }
}
