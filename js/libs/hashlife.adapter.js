/** Adapter for Hashlife engine. */
class HashLifeAdapter {
    /**
     * Creates hashlife adapter using existing Life instance.
     * @param {Life} life - Already initialized Life object
     */
    constructor(life) {
        this.life = life;
        this.backup = {};
        this._ = new LifeUniverse();
    }

    /**
     * Enables hashlife adapter.
     */
    _enable() {
        Object.getOwnPropertyNames(HashLifeAdapter.prototype)
            .filter(x => x !== 'constructor' && !x.startsWith('_'))
            .forEach(fx => {
                this.backup[fx] = this.life[fx];
                this.life[fx] = this[fx];
            });

        this.backup.minScale = this.life.minScale;
        this.life.minScale = 1e-16;

        this.backup.step = this.life.step;
        this.life.step = this._.step;

        this._.generation = this.life.generation;
        if (this.life.cells.size)
            this._setCells(this.life.cells);

        this.events = {
            'change.rule': this._setRule.bind(this),
            'change.step': this._setStep.bind(this),
            'change.size': this._resize.bind(this)
        };
        Object.getOwnPropertyNames(this.events)
            .forEach(x => this.life.$canvas.on(x, this.events[x]));
        this._resize();
    }

    /**
     * Disables hashlife adapter.
     */
    _disable() {
        Object.getOwnPropertyNames(this.events)
            .forEach(x => this.life.$canvas.off(x, this.events[x]));

        this.life.cells = new Map(this.life.getCells().map(x => [x.hash, x]))
        Object.getOwnPropertyNames(this.backup)
            .forEach(fx => this.life[fx] = this.backup[fx]);
    }

    /**
     * Prepares rulestring for hashlife engine.
     * @private
     */
    _setRule() {
        let rule = this.life._settings.rule;
        this._.set_rules(...Object.getOwnPropertyNames(rule)
            .reverse()
            .map(x => rule[x].split('')
                .map(x => 1 << x)
                .reduce((acc, cur) => acc |= cur, 0)));
    }

    /**
     * Sets step size (in form of a 2^x power) for hashlife engine.
     * @private
     */
    _setStep() {
        this._.set_step(this.life._settings.step);
    }

    /**
     * Resizes internal image buffer used in {@link HashLifeAdapter#draw} function.
     * @private
     */
    _resize() {
        this.img = this.life.ctx.createImageData(this.life.width, this.life.height);
        this.data = new Int32Array(this.img.data.buffer);
    }

    /**
     * Traverses hashlife quadtree through every alive cell.
     * @param {object} node - The starting node.
     * @param {function} callback - The callback function, which will be
     *  called for every alive cell found.
     * @private
     */
    _traverse(node, callback) {
        const traverseNode = (node, size, left, top) => {
            if (node.population === 0)
                return;

            if(size <= 1) {
                if(node.population)
                    callback(left, top);
            } else if(node.level === 0) {
                if(node.population)
                    callback(left, top);
            } else {
                size /= 2;
    
                traverseNode(node.nw, size, left, top);
                traverseNode(node.ne, size, left + size, top);
                traverseNode(node.sw, size, left, top + size);
                traverseNode(node.se, size, left + size, top + size);
            }
        };

        var size = Math.pow(2, node.level - 1);
        traverseNode(node, 2 * size, -size, -size);
    }

    /**
     * Sets cells in hashlife engine.
     * @param {*} cells - Set/Map/Array of alive cells
     * @returns {Array} List of x-axis coordinates, y-axis coordinates and bounding box.
     * @private
     */
    _setCells(cells) {
        let [field_x, field_y] = this._convert(cells);
        let bounds = this._.get_bounds(field_x, field_y);

        this._.setup_field(field_x, field_y, bounds);
        this.life._generation = this._.generation;

        return [field_x, field_y, bounds];
    }

    /**
     * Seperates x and y coordinates of given collection of cells.
     * @param {*} cells - Set/Map/Array of alive cells
     * @param {boolean=} raw - If true then the function will only
     *  convert input into array without seperating the coordinates
     * @returns {Array} Array of x-axis coordinates and y-axis coordinates.
     * @private
     */
    _convert(cells, raw = false) {
        if (cells instanceof Set)
            cells = [...cells];
        else if (cells instanceof Map)
            cells = [...cells.values()];
        else if (cells instanceof Array && cells[0] instanceof Array)
            cells = cells.map(c => ({x: c[0], y: c[1]}));

        if (!cells.length && cells.x && cells.y)
            cells = [cells];

        if (raw)
            return cells;

        let x = [], y = cells.map(c => {
            x.push(c.x);
            return -c.y;
        });

        return [x, y];
    }

    _drawArgs = {};

    /**
     * Fills given square in the internal image buffer.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @param {number} size - The size of the square
     * @private
     */
    _fillSquare(x, y, size) {
        x += 0.5;
        y += 0.5;
        let minx = x;
        let miny = y;
        let maxx = x + size;
        let maxy = y + size;
        let width = this._drawArgs.width;
        let height = this._drawArgs.height;
        let color = this._drawArgs.color;

        minx = (minx < 0) ? 0 : (minx > width)  ? width  : minx | 0;
        miny = (miny < 0) ? 0 : (miny > height) ? height : miny | 0;
        maxx = (maxx < 0) ? 0 : (maxx > width)  ? width  : maxx | 0;
        maxy = (maxy < 0) ? 0 : (maxy > height) ? height : maxy | 0;

        for (let y = miny; y < maxy; y++)
            for (let x = minx, i = y * width; x < maxx; x++)
                this.data[i + x] = color;
    }

    /**
     * Draws recursivly nodes starting with given node onto the internal image buffer.
     * @param {object} node - The starting node
     * @param {number} size - The size of the node
     * @param {number} left - The X-axis position of the node
     * @param {number} top - The Y-axis position of the node
     * @private
     */
    _drawNode(node, size, left, top) {
        if (node.population === 0)
            return;

        let height = this._drawArgs.height;
        let width = this._drawArgs.width;
        let origin = this._drawArgs.origin;
        let cellSize = this._drawArgs.cellSize;

        if (left + size + origin.x < 0 || top + size + origin.y < 0
         || left + origin.x >= width   || top + origin.y >= height)
            return;

        if(size <= 1) {
            if(node.population)
                this._fillSquare(left + origin.x, top + origin.y, 1);
        } else if(node.level === 0) {
            if(node.population)
                this._fillSquare(left + origin.x, top + origin.y, cellSize);
        } else {
            size /= 2;

            this._drawNode(node.nw, size, left, top);
            this._drawNode(node.ne, size, left + size, top);
            this._drawNode(node.sw, size, left, top + size);
            this._drawNode(node.se, size, left + size, top + size);
        }
    }

    /**
     * Draws given node and it's children onto the internal image buffer.
     * @param {object} node - The starting node
     * @private
     */
    _draw(node) {
        this.data.fill(this.life._settings.colors.int.background);
        let size = Math.pow(2, node.level - 1) * this.life.cellSize;
        this._drawNode(node, 2 * size, -size, -size);
        this.life.ctx.putImageData(this.img, 0, 0);
    }

    /**
     * Updates the canvas with current state of the automaton.
     * @this Life
     */
    draw() {
        let height = this.canvas.height;
        let width = this.canvas.width;
        let size = this.cellSize;
        let border = this.cellBorder;
        let origin = this._settings.origin;
        let colors = this._settings.colors;

        this.hashlife._drawArgs.height = height;
        this.hashlife._drawArgs.width = width;
        this.hashlife._drawArgs.cellSize = size;
        this.hashlife._drawArgs.origin = origin;
        this.hashlife._drawArgs.color = colors.int.basic;

        this.hashlife._draw(this.hashlife._.root);

        if (this.scale >= this.scaleThreshold) {
            this.ctx.fillStyle = colors.border;
            for (let x = (origin.x % size) - size; x < width; x += size)
                this.ctx.fillRect(x - 0.5, -0.5, border, height);

            for (let y = (origin.y % size) - size; y < height; y += size)
                this.ctx.fillRect(-0.5, y - 0.5, width, border);
        }
    }

    /**
     * Creates new cell at given coordinates or removes it if the cell exists.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @fires Life#life.new
     * @this Life
     */
    create(x, y) {
        this.hashlife._.set_bit(x, -y, !this.hashlife._.get_bit(x, -y));
        this.$canvas.trigger('life.new');
    }

    /**
     * Starts the hashlife engine for the automaton.
     * @fires Life#start
     * @this Life
     */
    start() {
        if (this._running)
            return;

        this._generation = 0;
        this._running = true;
        this.$canvas.trigger('start');

        (async _ => {
            let changed = true;
            while(this._running && (changed || !this._settings.detect)) {
                await Life.sleep(this._settings.speed);
                changed = this.next();
                this.draw();
            }
            this.stop();
        })();
    }

    /**
     * Calculates next generation.
     * @returns {boolean} True if detected still life
     * @fires Life#life.next
     * @this Life
     */
    next() {
        this.hashlife._.next_generation(true);
        this._generation = this.hashlife._.generation;
        this.$canvas.trigger('life.next');
        return this.hashlife._.root.population != 0;
    }

    /**
     * Clears the automaton and centers the viewbox.
     * @fires Life#life.wipe
     * @this Life
     */
    clear() {
        this.stop();
        this.hashlife._.clear_pattern();
        this.file = undefined;
        this.center();

        this._generation = this.hashlife._.generation;
        this.$canvas.trigger('life.wipe');
    }

    /**
     * Loads cells from file or collection of cells.
     * @param {*} cells - The [CellFile]{@link CellFile} or Map/Set/Array of cells
     * @param {boolean=} override - If true then board will be cleared
     * @param {boolean=} force - Relevant only for MCell files.
     *   If true then game type won't be checked.
     * @this Life
     */
    load(cells, override = false, force = false) {
        if (typeof cells === 'undefined')
            return;

        if (this.isRunning)
            throw 'The automaton is running!';

        if (override)
            this.clear();

        if (cells instanceof CellFile) {
            this.file = cells;
            this.reload(override, force);
        } else {
            this.hashlife._convert(cells, true)
                .forEach(c => this.hashlife._.set_bit(c.x, -c.y, true));
        }

        this.draw();
    }

    /**
     * Reloads last loaded file.<br>
     * Works only after any file has been loaded.
     * @param {boolean=} override - If true then game board will be cleared
     * @param {boolean=} force - If true then MCell game type will be ignored
     * @param {boolean=} center - If true then loaded pattern will
     *   be centered on (0, 0) point
     * @this Life
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

        if (!force && this.file.type && this.file.type !== 'Life')
            throw `Unsupported mode "${this.file.type}"`;

        if (typeof this.file.rule === 'string')
            this.rule = this.file.rule;

        let [field_x, field_y, bounds] = this.hashlife._setCells(this.file.cells);
        if (center)
            this.hashlife._.make_center(field_x, field_y, bounds);

        this.draw();
        this.$canvas.trigger('load.file');
    }

    /**
     * Removes from the game board only given cells.
     * @param {*} cells - An Array/Set/Map of cells or single cell to be removed
     * @fires Life#life.wipe
     * @this Life
     */
    remove(cells) {
        cells = this.hashlife._convert(cells);
        let length = cells[0].length;

        for (let i = 0; i < length; i++)
            this.hashlife._.set_bit(cells[0][i], cells[1][i], false);

        this.draw();
        this.$canvas.trigger('life.wipe');
    }

    /**
     * Calculates bounding box for currenly alive cells.
     * @returns {object} The bounding box of current game board.<br>
     *  Contains information about width, height, top left
     *  and bottom right corners of the current pattern.
     * @this Life
     */
    getBoundingBox() {
        let obj = this.hashlife._.get_root_bounds();
        obj.top *= -1;
        obj.bottom *= -1;
        obj.width = obj.right - obj.left + 1;
        obj.height = obj.top - obj.bottom + 1;
        return obj;
    }

    /**
     * Returns array of alive cells.
     * @param {boolean=} raw - If true then doesn't convert the cells
     *  to the same format as [Life]{@link Life#getCells}.
     * @returns {Array} The array of alive cells
     * @this Life
     */
    getCells(raw = false) {
        let cells = [];
        this.hashlife._traverse(this.hashlife._.root, (x, y) => cells.push([x, y]));
        return raw ? cells : cells.map(c => Life._newCell(c[0], -c[1]));
    }

    /**
     * Returns number of alive cells.
     * @returns {number} The number of alive cells.
     * @this Life
     */
    size() {
        return this.hashlife._.root.population;
    }
}
