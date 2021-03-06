/** Board for Game of Life. */
class Life {
    /**
     * Creates new board for Game of Life.
     * @param {(string|object)} canvas - An ID of the canvas element or jQuery object of canvas.
     * @param {object=} options - An options for the board setup.
     * @param {string} engine - The engine name which should be used for creating new generations.
     */
    constructor(canvas, options, engine) {
        this._settings = {
            speed: 10,
            step: 1,
            scale: 1.0,
            size: 10,
            border: 0.4,
            locked: false,
            detect: true,
            showBorder: true,
            type: 'infinite',
            limit: {
                from: new Point(),
                to: new Point()
            },
            origin: new Point(),
            top: new Point(),
            bottom: new Point(),
            showAge: true,
            allowInverse: false,
            colors: {
                background: '#eee',
                border: '#aaa',
                outside: '#999',
                basic: '#020202',
                rgb: {
                       hot: [ 0xdc, 0x14, 0x3c ],
                    medium: [ 0x00, 0x00, 0xff ],
                      cold: [ 0x00, 0x00, 0xcd ]
                },
                int: {}
            },
            rule: {
                born: '3',
                survive: '23'
            }
        };
        this.defaults = $.deepCopy(this._settings);
        this.cellSize = this._settings.size;
        this.cellBorder = this._settings.border;
        this.scaleThreshold = 0.5;
        this.zoomIntensity = 0.09;
        this.minScale = 0.01;
        this.maxScale = 100;

        if (typeof options === 'string')
            [engine, options] = [options, engine];

        const defaultOptions = {
            fullscreen: true,
            events: true
        };
        options = options || defaultOptions;
        if (options.fullscreen === undefined)
            options.fullscreen = defaultOptions.fullscreen;
        if (options.events === undefined)
            options.events = defaultOptions.events;
        this._options = $.deepCopy(options);

        Object.freeze(this._options);
        Object.freeze(this.defaults);

        this.canvas = (typeof canvas === 'string')
            ? document.getElementById(canvas)
            : ((canvas instanceof jQuery)
                ? canvas.get(0) : canvas);
        this.$canvas = $(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this._resize();

        Object.getOwnPropertyNames(this._settings.colors)
            .filter(x => typeof this._settings.colors[x] === 'string')
            .forEach(x => this.setColor(x, this._settings.colors[x]));

        this.cells = new Map();
        this._newGen = new Map();
        this._generation = 0;
        this._running = false;
        this._dirty = false;
        this._file = undefined;

        this.engines = {
               naive: '_setupNaive',
              worker: '_setupWorker',
            hashlife: '_setupHashlife'
        };
        Object.freeze(this.engines);
        this.engine = engine || 'hashlife';

        let mouseLast = new Point();
        let dragging = false;
        let dragged = false;

        this.center();
        if (!this._options.events)
            return;

        $(window)
            .on('resize', () => {
                this._resize();
                this.draw();
            })
            .on('mousemove', ev => {
                if (dragging) {
                    this.$canvas.css('cursor', 'grabbing');
                    let coord = new Point(ev.pageX, ev.pageY);
                    if (Point.distance(coord, mouseLast) > 1)
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
                    this.$canvas.css('cursor', '');
                    dragging = false;
                }
            });

        this.$canvas
            .on('mousedown', ev => {
                mouseLast = new Point(ev.pageX, ev.pageY);

                if (ev.which == 1)
                    dragging = true;
                else if (ev.which == 2)
                    this.center(ev);
            })
            .on('click', ev => {
                if (!dragged && !this._settings.locked) {
                    let point = this.getPosition(ev);
                    this.create(point.x, point.y);
                    this.draw();
                } else {
                    dragged = false;
                }
            })
            .on('wheel', ev => {
                let wheel = ev.originalEvent.deltaY < 0 ? 1 : -1;
                let zoom = Math.exp(wheel * this.zoomIntensity);
                let xoff = (ev.pageX - this.origin.x) / this.scale;
                let yoff = (ev.pageY - this.origin.y) / this.scale;
                this.scale *= zoom;
                this.origin = [
                    ev.pageX - xoff * this.scale,
                    ev.pageY - yoff * this.scale ];
                this.draw();
            });
    }

    /**
     * Chooses which engine should be used for creating
     *  future generation of the automaton.
     * Valid values are <code>naive</code> and <code>worker</code>.
     * @type {string}
     */
    get engine() {
        return this._engine;
    }

    set engine(value) {
        const valid = [ 'naive', 'worker', 'hashlife' ];
        if (!valid.includes(value))
            return;

        if (this._engine === 'hashlife')
            this._restoreLife();

        this._engine = value;
        this[this.engines[this._engine]]();
        this.$canvas.trigger('change.engine');
    }

    /**
     * True if automaton is currently running.
     * @type {boolean}
     */
    get isRunning() {
        return this._running;
    }

    /**
     * The number of alive cells.
     * @type {number}
     */
    get population() {
        return this.size();
    }

    /**
     * The number of calculated generations.
     * @type {number}
     */
    get generation() {
        return this._generation;
    }

    /**
     * The width of the canvas.
     * @type {number}
     */
    get width() {
        return this.canvas.width;
    }

    /**
     * The height of the canvas.
     * @type {number}
     */
    get height() {
        return this.canvas.height;
    }

    /**
     * The top left corner of the visible viewbox in game coordinates.
     * @type {Point}
     */
    get top() {
        return this._settings.top;
    }

    /**
     * The bottom right corner of the visible viewbox in game coordinates.
     * @type {Point}
     */
    get bottom() {
        return this._settings.bottom;
    }

    /**
     * The top left corner of the visible viewbox in pixels.
     * @type {Point}
     */
    get origin() {
        return this._settings.origin;
    }

    set origin(value) {
        [this._settings.origin.x, this._settings.origin.y] =
            value instanceof Array ? value : [value.x, value.y];
        this._setDrawLimits();
    }

    /**
     * The scale of the viewbox.
     * @type {number}
     */
    get scale() {
        return this._settings.scale;
    }

    set scale(value) {
        if (value < this.minScale)
            value = this.minScale;
        else if (value > this.maxScale)
            value = this.maxScale;

        this._settings.scale = value;
        this.cellSize = this._settings.size * this._settings.scale;
        this.cellBorder = this._settings.border * this._settings.scale;
    }

    /**
     * The rulestring of the automaton in B/S notation.<br>
     * Input accepts also S/B notation.
     * @type {string}
     */
    get rule() {
        return `B${this._settings.rule.born}/S${this._settings.rule.survive}`;
    }

    set rule(value) {
        if (!value)
            return;

        if (typeof value === 'object') {
            if (!value.born || !value.survive)
                return;

            [this._settings.rule.born, this._settings.rule.survive] =
                [value.born, value.survive];
        } else if (typeof value === 'string') {
            value = value.toUpperCase();

            if (/^([BS][0-8\/]*){1,2}$/gi.test(value)) {
                let result = `${value}/`.split('/', 2).sort();
                if (!result[0].startsWith('B'))
                    result = result.reverse();

                result = result.map(x => x.replace(/[^0-8]/g, ''));
                this._settings.rule.born = result[0];
                this._settings.rule.survive = result[1];
            } else {
                let result = value.match(/([0-8]+)?\/([0-8]+)?/i);
                if (result == null)
                    return;

                this._settings.rule.survive = result[1] || '';
                this._settings.rule.born = result[2] || '';
            }
        } else {
            return;
        }

        // sort the numbers inside the rule string
        const normalize = str => new Array(...(new Set(str.split('')))).sort().join('');
        this._settings.rule.born = normalize(this._settings.rule.born);
        this._settings.rule.survive = normalize(this._settings.rule.survive);
        if (!this._settings.allowInverse)
            this._settings.rule.born = this._settings.rule.born.replace('0', '');

        this.$canvas.trigger('change.rule');
    }

    /**
     * The number of miliseconds between each generation.
     * @type {number}
     */
    get speed() {
        return this._settings.speed;
    }

    set speed(value) {
        value = parseInt(value);
        if (value < 1)
            value = 1;
        this._settings.speed = value;
        this.$canvas.trigger('change.speed');
    }

    /**
     * The number of generation skipped between each draw.
     * @type {number}
     */
    get step() {
        return this._settings.step;
    }

    set step(value) {
        value = parseInt(value);
        let min = this.engine === 'hashlife' ? 0 : 1;
        if (value < min)
            value = min;
        this._settings.step = value;
        this.$canvas.trigger('change.step');
    }

    /**
     * Denotes if viewbox can be moved or any cells can be changed.
     * @type {boolean}
     */
    get locked() {
        return this._settings.locked;
    }

    set locked(value) {
        this._settings.locked = !!value;
        this.$canvas.trigger('change.lock');
    }

    /**
     * Denotes if automaton should stop when last generation
     *   consisted of only still lifes.
     * @type {boolean}
     */
    get detectStillLife() {
        return this._settings.detect;
    }

    set detectStillLife(value) {
        this._settings.detect = !!value;
        this.$canvas.trigger('change.detect');
    }

    /**
     * Denotes if [draw]{@link Life#draw} function should draw cell borders.
     * @type {boolean}
     */
    get showBorder() {
        return this._settings.showBorder;
    }

    set showBorder(value) {
        this._settings.showBorder = !!value;
        this.$canvas.trigger('change.border');
    }

    /**
     * Denotes if [draw]{@link Life#draw} function should color cells showing their age.
     * @type {boolean}
     */
    get showAge() {
        return this._settings.showAge;
    }

    set showAge(value) {
        this._settings.showAge = !!value;
        this.$canvas.trigger('change.color');
    }

    /**
     * Allows or disallows rules where birth occurs in cells with 0 neighbors.
     * @type {boolean}
     */
    get allowInverse() {
        return this._settings.allowInverse;
    }

    set allowInverse(value) {
        this._settings.allowInverse = !!value;
        this.rule = this.rule;
        this.$canvas.trigger('change.inverse');
    }

    /**
     * Chooses type of automaton board.<br>
     * Valid values are <code>infinite</code>, <code>finite</code> and <code>wrapped</code>.
     * @type {string}
     */
    get type() {
        return this._settings.type;
    }

    set type(value) {
        const valid = new Set([ 'infinite', 'finite', 'wrapped' ]);
        if (!valid.has(value)) 
            return;

        this._dirty = value !== 'infinite';
        this._settings.type = value;
        this.$canvas.trigger('change.type');
    }

    /**
     * Rectangle corresponding to set limits. <br>
     * Relevant only in <code>wrapped</code> and <code>finite</code> board types.
     * @type {object}
     */
    get limit() {
        let from = this._settings.limit.from;
        let to = this._settings.limit.to;

        return {
                to: to,
              from: from,
             width: to.x - from.x,
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
                this._settings.limit.from = new Point(-width,  height);
                this._settings.limit.to   = new Point( width, -height);
            } else {
                return;
            }

            this.$canvas.trigger('change.limit');
        }
    }

    /**
     * Currently loaded pattern file.
     * @type {CellFile}
     * @fires Life#unload.file - If the value was undefined.
     */
    get file() {
        return this._file;
    }

    set file(value) {
        this._file = value;
        if (!value)
            this.$canvas.trigger('unload.file');
    }

    /**
     * Initialize naive engine.
     * @private
     */
    _setupNaive() {
        this.next = this.next_naive;
        this.start = this.start_naive;
    }

    /**
     * Initialize web worker engine.
     * @param {number=} cores - A number of threads
     * @private
     */
    _setupWorker(cores = 4) {
        if (!window.Worker)
            return;

        if (cores > navigator.hardwareConcurrency / 2)
            cores = navigator.hardwareConcurrency / 2;

        this.next = this.next_worker;
        this.start = this.start_worker;

        this.cores = cores;
        this.workers = [];

        for (let i = 0; i < this.cores; i++)
            this.workers.push(new Worker('./js/life.worker.js'));

        let result = 0;
        let done = 0;
        let step = 0;
        this.workers.forEach((w, i) => {
            w.postMessage({ action: 'new', nth: i, cores: this.cores });
            w.postMessage({ action: 'setup', settings: this._settings });
            w.onmessage = async ev => {
                if (ev.data.action === 'done') {
                    if (done == 0)
                        this._newGen.clear();

                    ev.data.result[0].forEach((val, key) => this._newGen.set(key, val));
                    result = (result << 1) | ev.data.result[1];
                    if (++done == this.cores) {
                        done = 0;

                        if (result == 0 && this._settings.detect) {
                            this.stop();
                        } else {
                            if (this.cells.size != 0) {
                                this._generation++;
                                [this.cells, this._newGen] = [this._newGen, this.cells];
                            }

                            if (++step >= this.step) {
                                this.$canvas.trigger('life.next');
                                this.draw();
                                step = 0;
                            }

                            if (this._running) {
                                if (step == 0)
                                    await Life.sleep(this.speed);
                                this.next();
                            }
                        }

                        result = 0;
                    }
                }
            };
        });
    }

    /**
     * Prepares the automaton state for the Hashlife engine.<br>
     * Safes methods, which are going to be replaced by the adapter.
     * @private
     */
    _setupHashlife() {
        if (!this.hashlife)
            this.hashlife = new HashLifeAdapter(this);

        this.hashlife._enable();
        this.draw();
    }

    /**
     * Restores the automaton to the state before the engine change.
     * @private
     */
    _restoreLife() {
        this.hashlife._disable();
        this.draw();
    }

    /**
     * Resizes the canvas for the automaton.
     * @fires Life#change.size
     * @private
     */
    _resize() {
        if (this._options.fullscreen) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }

        this._setDrawLimits();
        this.$canvas.trigger('change.size');
    }

    /**
     * Sets top left and bottom right corners of the viewbox.
     * @private
     */
    _setDrawLimits() {
        let size = this.cellSize;
        let origin = this._settings.origin;

        this._settings.top = new Point(
            -Math.ceil(origin.x / size),
             Math.ceil(origin.y / size)
        );

        this._settings.bottom = new Point(
            -Math.ceil((origin.x - this.width)  / size),
             Math.ceil((origin.y - this.height) / size)
        );
    }

    /**
     * Checks if point is inside viewbox.
     * @param {(Point|object)} point - A point to check.
     * @returns {boolean} True if point is inside.
     * @private
     */
    _inside(point) {
        return Point.isInside(point.x, point.y, this._settings.top, this._settings.bottom);
    }

    /**
     * Checks if point is inside board limits.<br>
     * Relevant only for <code>wrapped</code> and <code>finite</code> board types.
     * @param {(Point|object)} point - A point to check.
     * @returns {boolean} True if point is inside.
     * @private
     */
    _insideLimit(point) {
        return Point.isInside(point.x, point.y, this._settings.limit.from, this._settings.limit.to);
    }

    /**
     * Checks if coordinates are inside board limits.<br>
     * Relevant only for <code>wrapped</code> and <code>finite</code> board types.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @returns {boolean} True if coordinates are inside.
     * @private
     */
    _insideLimitCoord(x, y) {
        return Point.isInside(x, y, this._settings.limit.from, this._settings.limit.to);
    }

    /**
     * Returns hash for given coordinates.<br>
     * Used for hashing in the map.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @param {object} settings - The settings of the automaton
     * @returns {string} The hash for given coordinates.
     * @private
     */
    static _getHash(x, y, settings) {
        return Life._limitCoords(x, y, Point.getHash, settings);
    }

    /**
     * Returns new object representing single alive cell.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @param {object} settings - The settings of the automaton
     * @returns {object} The alive cell
     * @private
     */
    static _newCell(x, y, settings) {
        return Life._limitCoords(x, y, (x, y) =>
            ({ x: x, y: y, age: 0, hash: Point.getHash(x, y) }), settings);
    }

    /**
     * Converts given coordinates according to set board type.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @param {coordsCallback} callback - A function which is called with translated coordinates
     * @returns {(object|undefined)} The alive cell or <code>undefined</code> if cell
     *   at given coordinates shouldn't exist with current board type.
     * @private
     */
    _limitCoords(x, y, callback) {
        return Life._limitCoords(x, y, callback, this.settings);
    }

    /**
     * Callback which uses translated coordinates.
     * @callback Life~coordsCallback
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @private
     */

    /**
     * Converts given coordinates according to set board type.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @param {coordsCallback} callback - A function which is called with translated coordinates
     * @param {object} settings - The settings of the automaton
     * @returns {(object|undefined)} The alive cell or <code>undefined</code> if cell
     *   at given coordinates shouldn't exist with current board type.
     * @private
     */
    static _limitCoords(x, y, callback, settings) {
        let from = settings ? settings.limit.from : 0;
        let to = settings ? settings.limit.to : 0;

        switch (settings ? settings.type : '') {
            case 'infinite':
                return callback(x, y);
            case 'finite':
                if (Point.isInside(x, y, from, to))
                    return callback(x, y);
                break;
            case 'wrapped':
                return callback(
                    Life._mod(x - from.x, (to.x - from.x + 1)) + from.x,
                    Life._mod(y - from.y, (to.y - from.y - 1)) + from.y
                );
        }

        return settings === undefined ? callback(x, y) : undefined;
    }

    /**
     * Checks if with given number of neighbors cell should be born.
     * @param {number} count - A number of neighbors
     * @param {object} settings - The settings of the automaton
     * @returns {boolean} True if cell should be born
     * @private
     */
    static _birth(count, settings) {
        return settings.rule.born.indexOf(count) != -1;
    }

    /**
     * Checks if with given number of neighbors cell should be killed.
     * @param {number} count - A number of neighbors
     * @param {object} settings - The settings of the automaton
     * @returns {boolean} True if cell should be killed
     * @private
     */
    static _death(count, settings) {
        return settings.rule.survive.indexOf(count) == -1;
    }

    /**
     * Converts given color to for of RGB array.
     * @param {*} color - A color to convert. Needs to be in a format recognized by CSS.
     * @returns {number[]} - An RGB array
     * Inspired by {@link https://stackoverflow.com/a/1573154/11702094}.
     * @private
     */
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

    /** 
     * Variable to prevent array creation at every
     *   call to [_colorGradient]{@link Life#_colorGradient}.
     * @private
     */
    _gradientRGB = [];

    /**
     * Calculates gradient value.
     * @param {number} fadeFraction - A value in range [0; 1].
     *   Value 0 meaning left side of the gradient and value 1 meaning right side.
     * @param {Array.<number>} rgbColor1 - An RGB array for color on the left side
     * @param {Array.<number>} rgbColor2 - An RGB array for color in the middle
     * @param {Array.<number>=} rgbColor3 - An RGB array for color on the right side
     * @param {boolean=} raw - If true then the function will return color as a RGB array.
     * @returns {string|Array} The RGB string/array with calculated gradient value.
     * Inspired by {@link https://gist.github.com/gskema/2f56dc2e087894ffc756c11e6de1b5ed}.
     * @private
     */
    _colorGradient(fadeFraction, rgbColor1, rgbColor2, rgbColor3, raw = false) {
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

        return raw ? this._gradientRGB : `rgb(${this._gradientRGB.join(',')})`;
    }

    /**
     * Calculates proper modulo for negative numbers.
     * @param {number} a - A first number
     * @param {number} n - A second number
     * @returns {number} - The result of a mod n
     * @private
     */
    static _mod(a, n) {
        return ((a % n) + n) % n;
    }

    /**
     * Cleans dirty board.<br>
     * Game board becomes dirty when board type was changed after
     *   creating alive cells outside the limits of the board.
     * @private
     */
    _clean() {
        this._dirty = false;
        for (let entry of this.cells) {
            if (!this._insideLimit(entry[1]))
                this.cells.delete(entry[0]);
        }
    }

    /**
     * Draws current state of the automaton within visible viewbox.
     */
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

            this.ctx.fillStyle = (!this._settings.showAge)
                ? this._settings.colors.basic
                : this._colorGradient(Math.atan(cell.age / 500) / (Math.PI / 2),
                    colors.rgb.hot, colors.rgb.medium, colors.rgb.cold);
            this.ctx.fillRect(origin.x + cell.x * size, origin.y - cell.y * size, size, size);
        });

        // borders are 0.5px shifted because of anti-aliasing
        if (this.scale >= this.scaleThreshold) {
            this.ctx.fillStyle = colors.border;
            for (let x = (origin.x % size) - size; x < width; x += size)
                this.ctx.fillRect(x - 0.5, -0.5, border, height);

            for (let y = (origin.y % size) - size; y < height; y += size)
                this.ctx.fillRect(-0.5, y - 0.5, width, border);
        }
    }

    /**
     * Creates alive cell at given coordinates.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @fires Life#life.new
     */
    create(x, y) {
        if (this._settings.type !== 'infinite' && !this._insideLimitCoord(x, y))
            return;

        let cell = Life._newCell(x, y, this._settings);

        if (this.cells.has(cell.hash))
            this.cells.delete(cell.hash);
        else
            this.cells.set(cell.hash, cell);

        this.$canvas.trigger('life.new');
    }

    /**
     * Starts the naive engine for the automaton.
     * @fires Life#start
     */
    start_naive() {
        if (this._running)
            return;

        this._running = true;
        this.$canvas.trigger('start');

        (async _ => {
            while(this._running) {
                await Life.sleep(this._settings.speed);
                for (let i = 0; i < this._settings.step; i++) {
                    if (!this.next() && this._settings.detect) {
                        this.stop();
                        break;
                    }
                }

                this.draw();
            }
        })();
    }

    /**
     * Calculates next generation in naive way.
     * @returns {boolean} True if any cell changed state.
     * @fires Life#life.next
     */
    next_naive() {
        if (this.population == 0)
            return;

        if (this._dirty)
            this._clean();

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

                    let neighborHash = Life._getHash(cell.x + dx,
                        cell.y + dy, this._settings);
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

                                let otherHash = Life._getHash(cell.x + dx + cx,
                                    cell.y + dy + cy, this._settings);
                                if (otherHash === undefined)
                                    continue;

                                if (this.cells.has(otherHash))
                                    otherCounter++;
                            }
                        }

                        if (Life._birth(otherCounter, this._settings)) {
                            let neighbor = Life._newCell(cell.x + dx, cell.y + dy, this._settings);
                            this._newGen.set(neighbor.hash, neighbor); // create
                            changed = true;
                        }
                    }
                }
            }

            if (!Life._death(counter, this._settings))
                this._newGen.set(cell.hash, cell); // survive
            else
                changed = true;
        }

        [this.cells, this._newGen] = [this._newGen, this.cells];
        this.$canvas.trigger('life.next');
        return changed;
    }

    /**
     * Starts automaton using Web Worker.
     * @fires Life#start
     */
    start_worker() {
        if (this._running)
            return;

        this._running = true;
        this.$canvas.trigger('start');

        this.workers.forEach(w =>
            w.postMessage({ action: 'setup', settings: this._settings }));
        this.next();
    }

    /**
     * Calculates next generation.<br>
     * In current version doesn't behave the same as [next_naive]{@link Life#next_naive}.
     * @fires Life#life.next
     */
    next_worker() {
        this.workers.forEach(w =>
            w.postMessage({ action: 'next', cells: this.cells }));
    }
    
    /**
     * Stops the automaton.
     * @fires Life#stop
     */
    stop() {
        if (!this._running)
            return;

        this._running = false;
        this.$canvas.trigger('stop');
    }

    /**
     * Clears the automaton and centers the viewbox.
     * @fires Life#life.wipe
     */
    clear() {
        this.stop();
        this._generation = 0;
        this.file = undefined;
        this.cells.clear();
        this.center();

        this.$canvas.trigger('life.wipe');
    }

    /**
     * Populate randomly the game board.
     * @param {number} width - The width of randomized area
     * @param {number} height - The height of randomized area
     * @param {number} threshold - Controls how many cells gonna be alive,
     *   should be in [0; 1] range
     */
    randomize(width, height, threshold = 0.5) {
        if (this.isRunning)
            throw 'The automaton is running!';

        let soup = [];
        let shift = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (Math.random() < threshold)
                    soup.push([x - shift.x, y - shift.y]);
            }
        }

        this.load(soup, true);
    }

    /**
     * Loads cells from file or collection of cells.
     * @param {*} cells - The [CellFile]{@link CellFile} or Map/Set/Array of cells
     * @param {boolean=} override - If true then board will be cleared
     * @param {boolean=} force - Relevant only for MCell files.
     *   If true then game type won't be checked.
     */
    load(cells, override = false, force = false) {
        if (typeof cells === 'undefined')
            return;

        if (this.isRunning)
            throw 'The automaton is running!';

        if (override && !(cells instanceof CellFile))
            this.cells.clear();

        if (cells instanceof Set)
            cells = [...cells];

        if (cells instanceof CellFile) {
            this.file = cells;
            this.reload(override, force);
        } else {
            if (cells instanceof Array) {
                if (cells[0] instanceof Array) {
                    cells.forEach(cell => {
                        let obj = Life._newCell(cell[0], cell[1], this._settings);
                        this.cells.set(obj.hash, obj);
                    });
                } else {
                    cells.forEach(cell => {
                        let obj = Life._newCell(cell.x, cell.y, this._settings);
                        this.cells.set(obj.hash, obj);
                    });
                }
            } else if (cells instanceof Map) {
                cells.forEach((val, key) => this.cells.set(key, val));
            }

            this.draw();
        }
    }

    /**
     * Reloads last loaded file.<br>
     * Works only after any file has been loaded.
     * @param {boolean=} override - If true then game board will be cleared
     * @param {boolean=} force - If true then MCell game type will be ignored
     * @param {boolean=} center - If true then loaded pattern will
     *   be centered on (0, 0) point
     */
    reload(override = true, force = false, center = true) {
        if (this.isRunning)
            throw 'The automaton is running!';

        if (!this.file || !(this.file instanceof CellFile))
            throw 'Invalid pattern file';

        if (override) {
            let file = this.file;
            this.clear();
            this.file = file;
        }

        this.file.cells.forEach(point => {
            let cell = Life._newCell(point.x, point.y, this._settings);
            this.cells.set(cell.hash, cell);
        });

        if (!force && this.file.type && this.file.type !== 'Life')
            throw `Unsupported mode "${this.file.type}"`;

        if (typeof this.file.rule === 'string')
            this.rule = this.file.rule;

        if (this.file instanceof MCellFile) {
            if (this.file.board) {
                this.limit = this.file.board;
                this.type = this.file.wrapped ? 'finite' : 'wrapped';
            }

            if (this.file.speed)
                this.speed = this.file.speed;
        }

        if (center && ![...this.cells.values()].some(x => this._inside(x)))
            this.center(this.nearest(0, 0));

        this.draw();
        this.$canvas.trigger('load.file');
    }

    /**
     * Removes from the game board only given cells.
     * @param {*} cells - An Array/Set/Map of cells or single cell to be removed
     * @fires Life#life.wipe
     */
    remove(cells) {
        if (cells instanceof Set)
            cells = [...cells];
        else if (cells instanceof Map)
            cells = [...cells.values()];

        if (!cells.length && cells.x && cells.y)
            cells = [cells];

        if (!cells[0].x && !cells[0].y)
            throw 'Unknown format';

        for (let cell of cells) {
            this.cells.delete(Point.getHash(cell.x, cell.y));
        }

        this.draw();
        this.$canvas.trigger('life.wipe');
    }

    /**
     * Calculates bounding box for currenly alive cells.
     * @returns {object} The bounding box of current game board.
     *  Contains information about width, height, top left
     *  and bottom right corners of the current pattern.
     */
    getBoundingBox() {
        return Life.getBoundingBox(this.cells);
    }

    /**
     * Centers viewbox using given mouse event.<br>
     * When no event is given then this function sets center point
     *   in the center of the canvas.
     * @param {MouseEvent=} ev - A mouse event used to calculate proper origin point
     * @param {number=} x - The X-axis coordinate of new center point
     * @param {number=} y - The Y-axis coordinate of new center point
     * @param {boolean=} rescale - If true then restores scale to default value
     * @fires mousemove
     */
    center(ev, x = 0, y = 0, rescale = true) {
        if (typeof ev === 'object' && 'x' in ev && 'y' in ev)
            [ev, x, y, rescale] = [undefined, ev.x, ev.y, x];
        if (typeof ev === 'number' && typeof x === 'number')
            [ev, x, y, rescale] = [undefined, ev, x, y];

        if (rescale)
            this.scale = this.defaults.scale;

        this.origin = [
            this.$canvas.width()  / 2 - x * this.cellSize,
            this.$canvas.height() / 2 + y * this.cellSize
        ];

        let event = new jQuery.Event('mousemove');
        if (typeof ev !== 'undefined')
            [event.targer, event.pageX, event.pageY] = [ev.target, ev.pageX, ev.pageY];
        this.$canvas.trigger(event);
        this.draw();
    }

    /**
     * Finds nearest alive cell to given coordinates.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @returns {object} The alive cell which is nearest to the given coordinates
     */
    nearest(x = 0, y = 0) {
        let zero = new Point(x, y);
        let result = [...this.cells.values()].reduce((acc, cur) => {
            let dist = Point.distance(cur, zero);
            return {
                cell: acc.dist > dist ? cur : acc.cell,
                dist: Math.min(acc.dist, dist)
            };
        }, { cell: undefined, dist: Number.MAX_VALUE });

        return result.cell;
    }

    /**
     * Converts given mouse event into cell coordinates.
     * @param {MouseEvent} ev - A mouse event
     * @returns {Point} The coordinates of cell corresponding to the mouse position
     */
    getPosition(ev) {
        let size = this.cellSize;
        return new Point(
             Math.floor((ev.pageX - this.origin.x) / size),
            -Math.floor((ev.pageY - this.origin.y) / size)
        );
    }

    /**
     * Returns array of alive cells.
     * @returns {Array} The array of alive cells
     */
    getCells() {
        return [...this.cells.values()];
    }

    /**
     * Sets given color to given value.
     * @param {string} name - A color to set
     * @param {*} color - A color value in format recognized by CSS.
     * @fires Life#change.color
     */
    setColor(name, color) {
        let rgb = this._convertColor(color);
        if (this._settings.colors[name]
        && typeof this._settings.colors[name] === 'string')
            this._settings.colors[name] = color;

        this._settings.colors.rgb[name] = rgb;
        this._settings.colors.int[name] =
            rgb[0] | rgb[1] << 8 | rgb[2] << 16 | 0xFF << 24;
        this.$canvas.trigger('change.color');
    }

    /**
     * Converts game canvas into blob.
     * @param {*} callback - A callback which will be called
     *   after conversion is done
     * @param {number=} quality - The quality of the snapshot, must be between 0 and 1
     * @param {string=} type - The MIME type of the snapshot
     */
    toBlob(callback, quality = 0.92, type = 'image/jpeg') {
        this.draw();
        return this.canvas.toBlob(callback, type, quality);
    }

    /**
     * Returns number of alive cells.
     * @returns {number} The number of alive cells.
     */
    size() {
        return this.cells.size;
    }

    /**
     * Calculates bounding box of given set of cells.
     * @param {*} cells - An Array/Set/Map of alive cells
     * @returns {object} The bounding box
     */
    static getBoundingBox(cells) {
        if (!cells)
            return undefined;

        if (cells instanceof Map)
            cells = cells.values();

        cells = [...cells];
        if (cells.length == 0) {
            return {
                  top: 0, bottom: 0,
                 left: 0,  right: 0,
                width: 0, height: 0
            };
        }

        return cells.reduce((acc, cur) => {
            let obj = {
                   top: Math.max(acc.top, cur.y),
                bottom: Math.min(acc.bottom, cur.y),
                  left: Math.min(acc.left, cur.x),
                 right: Math.max(acc.right, cur.x)
            };
            obj.width  = obj.right - obj.left   + 1;
            obj.height = obj.top   - obj.bottom + 1;
            return obj;
        }, {
               top: -Number.MAX_VALUE,
            bottom:  Number.MAX_VALUE,
              left:  Number.MAX_VALUE,
             right: -Number.MAX_VALUE
        });
    }

    /**
     * Helper function used in delaying next generation.
     * @param {number} ms - A number of miliseconds to wait
     * @returns {Promise} The Promise to await
     */
    static sleep = (ms) => 
        new Promise(resolve => setTimeout(resolve, ms));
}
