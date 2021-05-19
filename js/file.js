/**
 * Container for pattern files.
 * @see {@link http://www.mirekw.com/ca/ca_files_formats.html|File formats description}
 */
class CellFile {
    /** List of supported file formats. */
    static supported = '.rle,.cells,.lif,.life,.mcl,.l';
    /** If true then during file loading there will be
     * some information displayed on the console. */
    static debug = false;
    /** If true then any error in file format syntax
     * will result in an exception. */
    static strict = false;
    /** The description of the type of the pattern file. */
    description = 'Generic cellular automata file';

    /**
     * Creates container for a pattern file.
     * @param {string} name - The name of the file.
     * @param {*=} cells - The collection of alive cells,
     *  useful when saving to file.
     */
    constructor(name, cells) {
        this.name = name;
        this.width = 0;
        this.height = 0;
        this.rule = '23/3';

        if (cells && typeof cells[Symbol.iterator] === 'function')
            this.cells = new Set([...cells.values()]);
        else
            this.cells = new Set();

        this.title = '';
        this.author = '';
        this.comments = [];
    }

    /**
     * Returns blob of the pattern file.
     * @returns {Blob} The blob of the pattern file.
     */
    toBlob() {
        return new Blob([this.save()], { type: 'text/plain' });
    }

    /**
     * Returns the information about the file.
     * @returns {string} The information about the file.
     */
    toString() {
        let str = [this.description];

        if (this.title)
            str.push(`"${this.title}"`);
        else if (this.name)
            str.push(`"${this.name}"`);

        if (this.author)
            str.push(`by ${this.author}`);

        if (str.length == 1 && this.cells.size != 0)
            str.push(`of ${this.cells.size} cells`);

        return str.join(' ');
    }

    /**
     * Creates {@link CellFile} from given collection of cells.
     * @param {string} format - The file format.<br>
     *  Supports only RLE and Life formats.
     * @param {string} name - The name of the file.
     * @param {*=} cells - The collection of alive cells.
     * @returns {CellFile} - A new CellFile or undefined if
     *  invalid format name is provided
     */
    static get(format, name, cells) {
        switch (format) {
            case 'rle':
                return new RLEFile(name, cells);
            case 'life':
                return new LifeFile(name, cells);
            default:
                return undefined;
        }
    }

    /**
     * Opens a file explorer pop-up for selecting a file to load.
     * @param {function} callback - The callback which will be called
     *  when file is finished loading.
     */
    static open(callback) {
        let input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', CellFile.supported);
        input.addEventListener('change', ev => CellFile.read(ev.target.files[0], callback));
        input.click();
    }

    /**
     * Reads a pattern file to load.
     * @param {*} handle - The file handle of the file to load.
     * @param {function} callback - The callback which will be called
     *  when file is finished loading.
     * @param {function} onerror - The callback used to handle any errors which
     *  could occur while loading the file.
     */
    static read(handle, callback, onerror) {
        if (!handle)
            return;

        if (!onerror)
            onerror = reason => console.log(reason);

        if (handle instanceof Response)
            handle.name = handle.url.replace(/^.+\//g, '');

        if (this.debug)
            console.log(`Loading file "${handle.name}"...`);

        handle.text().then(data => {
            data = data.replace(/[^\S\n\r]+/gm, ' ').replace(/^[ ]|[\r]|[ ]$/gm, '');
            window.tst = data;

            if (data.length == 0) {
                throw `Empty file: "${handle.name}"`;
            } else {
                let file = undefined;

                if (/^((x|y|rule[s]?)[^\n]*){2,3}$|^[\db$]{2,}$/gmi.test(data)) {
                    file = RLEFile._read(handle.name, data);
                } else if (/^(#Life 1\.|#P\s+|!)|^[.*o]+$|^[-+ \d]+$/gm.test(data)) {
                    file = LifeFile._read(handle.name, data);
                } else if (/^#MC(ell|Life)/gm.test(data)) {
                    file = MCellFile._read(handle.name, data);
                }

                if (!file)
                    throw `Unknown file format: "${handle.name}"`;
                else
                    callback(file);
            }
        }).catch(onerror);
    }
}

/**
 * Container for pattern files in RLE format.
 * @see {@link http://www.mirekw.com/ca/ca_files_formats.html#RLE|File format sytax}
 */
class RLEFile extends CellFile {
    /** The description of the type of the pattern file. */
    description = 'RLE file';

    /**
     * Creates container for RLE pattern file.
     * @param {string} name - The name of the file
     * @param {*=} cells - The collection of alive cells
     */
    constructor(name, cells) {
        super(name, cells);
        if (cells && !/^.*\.(rle)/g.test(name))
            this.name += '.rle';
    }

    /**
     * Converts contained list of alive cells into RLE formatted string.
     * @returns {string} The string of the RLE formatted content.
     */
    save() {
        let lines = [];
        if (!this.cells || this.cells.size == 0)
            return '';

        if (this.title)
            lines.push(`#N ${this.title.substring(0, 70)}`);
        if (this.author)
            lines.push(`#O ${this.author.substring(0, 70)}`);
        if (this.comments) {
            for (let comment of this.comments) {
                let iter = comment.matchAll(/.{0,67}(\s+|$)/gmi);
                for (let line of iter) {
                    line = line[0].trim();
                    if (line.length != 0)
                        lines.push(`#C ${line}`);
                }
            }
        }

        let boundingBox = Life.getBoundingBox(this.cells);
        [this.width, this.height] = [boundingBox.width, boundingBox.height];
        lines.push(`x = ${this.width || 0}, y = ${this.height || 0}, rule = ${this.rule || 'B23/S3'}`);

        let arr = new Array(...this.cells);
        arr.sort((a, b) => (b.y * this.width - b.x) - (a.y * this.width - a.x));

        let lastX = boundingBox.left;
        let lastY = boundingBox.top;
        let count = 0;
        let out = '';
        let first = true;

        function add(value, symbol) {
            if (value != 0)
                out += `${value == 1 ? '' : value}${symbol}`;
        }

        for (let cell of arr) {
            if (lastY != cell.y || first) {
                if (out.length > 0) {
                    add(count, 'o');
                    add(lastY - cell.y, '$');
                }

                add(cell.x - boundingBox.left, 'b', 2);
                count = 1;
                first = false;
            } else {
                if (cell.x - lastX == 1) {
                    count++;
                } else {
                    add(count, 'o', 2);
                    add(cell.x - lastX - 1, 'b', 1);
                    count = 1;
                }
            }

            [lastX, lastY] = [cell.x, cell.y];
        }

        add(count, 'o', 3);
        out += '!';

        let iter = out.matchAll(/.{0,69}(?:[bo$!]|$)/gi);
        for (let line of iter) {
            if (line.length != 0)
                lines.push(line);
        }

        return lines.join('\r\n');
    }

    /**
     * Converts text content of the pattern file into the RLEFile container.
     * @param {string} name - The name of the file
     * @param {string} raw - The text content of the file
     * @returns {RLEFile} - The RLEFile instance.
     * @private
     */
    static _read(name, raw) {
        let lines = raw.split('\n');
        let file = new RLEFile(name);
        let x = 0, y = 0;
        let startX = 0;
        let orphan = '';
        let finished = false;

        if (this.debug)
            console.log('Detected RLE file.');

        lines.forEach((line, index) => {
            if (/^#\s?N/gi.test(line)) { // title
                let title = line.match(/^#\s?N\s?(.+)/i);
                if (title)
                    file.title = title[1];
            } else if (/^#\s?O/gi.test(line)) { // author
                let author = line.match(/^#\s?O\s?(.+)/i);
                if (author)
                    file.author = author[1];
            } else if (/^#\s?C/gi.test(line)) { // comment
                let comment = line.match(/^#\s?C\s*(.+)?/i);
                if (comment && comment[1])
                    file.comments.push(comment[1]);
            } else if (/^((x|y|rule[s]?)\s?=.*){2,3}/gi.test(line)) { // game rules
                let rules = line.match(
                    /^x\s?=\s?([-+]?\d+).+y\s?=\s?([-+]?\d+)(.+rule[s]?\s?=\s?([BS]?[0-8]*\/[BS]?[0-8]*))?/i);
                if (rules) {
                    file.width = parseInt(rules[1]);
                    file.height = parseInt(rules[2]);
                    if (rules[3])
                        file.rule = rules[4];

                    [x, y] = [-Math.floor(file.width / 2), -Math.floor(file.height / 2)];
                    startX = x;
                }
            } else if (/^[\db$!|a-z]+$/gi.test(line)) { // cells
                if (finished)
                    return;

                line = orphan + line.toLowerCase();
                let matches = line.matchAll(/(\d+)?\s*([a-z$])|(\d+|!)/gi);

                for (let match of matches) {
                    // match[1] - number of cells
                    // match[2] - token type
                    // match[3] - only if orphan at the end of the line or terminating '!'
                    let value = (!match[1]) ? 1 : parseInt(match[1]);

                    switch (match[2]) {
                        //case 'o':
                        default: // alive cell
                            for (let i = 0; i < value; i++, x++)
                                file.cells.add(new Point(x, -y));
                            break;
                        case 'b': // dead cell
                            x += value;
                            break;
                        case '$': // end of a line of the pattern
                            y += value;
                            x = startX;
                            break;
                        case undefined:
                            if (match[3] == '!')
                                finished = true;

                            orphan = match[3];
                            break;
                    }
                }
            } else if (line.length != 0 && !/^[#]/g.test(line)) {
                if (finished)
                    file.comments.push(line);
                else if (this.strict)
                    throw `Unknown line [${index + 1}]: "${line}"`;
            }
        });

        return file.cells.size != 0 ? file : undefined;
    }
}

/**
 * Container for pattern files in Life1.0x format.
 * @see {@link http://www.mirekw.com/ca/ca_files_formats.html#Life%201.05|File format syntax}
 */
class LifeFile extends CellFile {
    /** The description of the type of the pattern file. */
    description = 'Life file';

    /**
     * Creates container for Life1.0x pattern file.
     * @param {string} name - The name of the file
     * @param {*=} cells - The collection of alive cells
     */
    constructor(name, cells) {
        super(name, cells);
        if (cells && !/^.*\.(lif)/g.test(name))
            this.name += '.lif';
    }

    /**
     * @todo For now saving patterns in Life1.0x format isn't implemented.
     */
    save() {
        throw 'Unsupported file format for saving structures.';
    }

    /**
     * Converts text content of the pattern file into the Life1.0x container.
     * @param {string} name - The name of the file
     * @param {string} raw - The text content of the file
     * @returns {LifeFile} - The LifeFile instance.
     * @private
     */
    // some dbLife (*.l) files may fail because of unknown file format
    static _read(name, raw) {
        let lines = raw.split('\n');
        let file = new LifeFile(name);
        let x = 0, y = 0;
        let startX = 0;
        let cells = new Set();
        let style = '';

        if (this.debug)
            console.log('Detected Life file.');

        lines.forEach((line, index) => {
            // life files tends to have two different line styles
            if (/^[!#]/i.test(line))
                style = line[0];

            if (/^#\s?Life/gi.test(line)) { // file signature
                ; // ignore this line
            } else if (/^!\s?Name\s?:/gi.test(line)) { // title
                let title = line.match(/^!\s?Name\s?:\s?(.+)/i);
                if (title)
                    file.title = title[1];
            } else if (/^!\s?Author\s?:/gi.test(line)) { // author
                let author = line.match(/^!\s?Author\s?:\s?(.+)/i);
                if (author)
                    file.author = author[1];
            } else if (/^#[RN]/gi.test(line)) { // game rule
                let rule = line.match(/^#[RN]\s?([0-8]*\/[0-8]*)?/i);
                if (rule && rule[1])
                    file.rule = rule[1];
            } else if (/^#P/gi.test(line)) { // origin
                let origin = line.match(/^#P\s?([-+]?\d+)\s?([-+]?\d+)/i);
                if (origin) {
                    [x, y] = [parseInt(origin[1]), parseInt(origin[2])];
                    startX = x;
                }
            } else if (/^#S/gi.test(line)) { // speed
                let speed = line.match(/^#S\s?(\d+)/i);
                if (speed)
                    file.speed = parseInt(speed[1]);
            } else if (/^[!#]\s?[CD]?/gi.test(line)) { // comment
                let comment = line.match(/^[!#]\s?[CD]?\s*(.+)?/i);
                if (comment && comment[1])
                    file.comments.push(comment[1]);
            } else if (/^[.*o]+$/gi.test(line)) { // cells
                let matches = line.matchAll(/([.*o])+?/gi);

                for (let match of matches) {
                    if (match[1] != '.')
                        cells.add(new Point(x, y));
                    x++;
                }

                x = startX;
                y++;
            } else if (/^[-+\d ]+$/gi.test(line)) { // single cell with coordinates
                let cell = line.match(/^([-+\d]+)\s?([-+\d]+)$/i);
                if (cell)
                    cells.add(new Point(parseInt(cell[1]), parseInt(cell[2])));
            } else if (line.length == 0 && style == '!') { // special case
                y++;
            } else if (line.length != 0 && style == '!') { // unknown line from dbLife
                ;
            } else if (this.strict && line.length != 0 && !/^[!#]/g.test(line)) {
                throw `Unknown line #${index + 1}: "${line}"`;
            }
        });

        // find bounding box
        let boundingBox = Life.getBoundingBox(cells);
        [file.width, file.height] = [boundingBox.width, boundingBox.height];

        // center the pattern
        [x, y] = [
            Math.floor(file.width / 2) + boundingBox.left - 1,
            Math.floor(file.height / 2) + boundingBox.bottom - 1
        ];
        cells.forEach(p => file.cells.add(new Point(p.x - x, -(p.y - y))));

        return file.cells.size != 0 ? file : undefined;
    }
}

/**
 * Container for pattern files in MCell format.
 * @see {@link http://www.mirekw.com/ca/ca_files_formats.html#MCell|File format syntax}
 */
class MCellFile extends CellFile {
    /** The description of the type of the pattern file. */
    description = 'MCell file';

    /**
     * Creates container for RLE pattern file.
     * @param {string} name - The name of the file
     * @param {*=} cells - The collection of alive cells
     */
    constructor(name, cells) {
        super(name, cells);
        if (cells && !/^.*\.(mcl)/g.test(name))
            this.name += '.mcl';

        this.type = 'Life';
    }

    /**
     * @todo For now saving patterns in MCell format isn't implemented.
     */
    save() {
        throw 'Unsupported file format for saving structures.';
    }

    /**
     * Converts text content of the pattern file into the MCell container.
     * @param {string} name - The name of the file
     * @param {string} raw - The text content of the file
     * @returns {MCellFile} - The MCellFile instance.
     * @private
     */
    static _read(name, raw) {
        let lines = raw.split('\n');
        let file = new MCellFile(name);
        let x = 0, y = 0;
        let cells = new Set();

        if (this.debug)
            console.log('Detected MCell file.');
        
        lines.forEach((line, index) => {
            if (/^#MCell/gi.test(line)) { // file signature
                ; // ignore this line
            } else if (/^#GAME/gi.test(line)) { // type of the cellular automata
                let type = line.match(/^#GAME\s?(.+)$/i);
                if (type)
                    file.type = type[1];
            } else if (/^#RULE/gi.test(line)) { // rules of the automata
                let rule = line.match(/^#RULE\s?(.+)$/i);
                if (rule)
                    file.rule = rule[1];
            } else if (/^#SPEED/gi.test(line)) { // set speed
                let speed = line.match(/^#SPEED\s?(\d+)$/i);
                if (speed)
                    file.speed = parseInt(speed[1]);
            } else if (/^#BOARD/gi.test(line)) { // set the board size
                let board = line.match(/^#BOARD\s?(\d+)x(\d+)$/i);
                if (board) {
                    file.board = {
                        width: parseInt(board[1]),
                        height: parseInt(board[2])
                    };
                }
            } else if (/^#CCOLORS/gi.test(line)) { // number of colors
                let colors = line.match(/^#CCOLORS\s?(\d+)$/i);
                if (colors)
                    file.colors = parseInt(colors[1]);
            } else if (/^#COLORING/gi.test(line)) { // coloring method
                let coloring = line.match(/^#COLORING\s?(\d+)$/i);
                if (coloring)
                    file.coloring = parseInt(coloring[1]);
            } else if (/^#WRAP/gi.test(line)) { // is board wrapped
                let wrap = line.match(/^#WRAP\s?(\d)$/i);
                if (wrap)
                    file.wrapped = !!parseInt(wrap[1]);
            } else if (/^#PALETTE/gi.test(line)) { // set the palette
                let palette = line.match(/^#PALETTE\s?(.+)$/i);
                if (palette)
                    file.palette = palette[1];
            } else if (/^#D\s?.*$/gi.test(line)) { // comment
                let comment = line.match(/^#D\s*(.+)?$/i);
                if (comment && comment[1])
                    file.comments.push(comment[1]);
            } else if (/^#L\s?[.$\w]+$/gi.test(line)) { // cells in RLE format
                let matches = line.substring(2).matchAll(/(\d+)?\s?([.$A-Za-z])\s?/gi);

                for (let match of matches) {
                    let value = (!match[1]) ? 1 : parseInt(match[1]);

                    switch (match[2]) {
                        default: // alive cell
                            for (let i = 0; i < value; i++, x++)
                                cells.add(new Point(x, -y));
                            break;
                        case '.': // dead cell
                            x += value;
                            break;
                        case '$': // end of the line
                            y += value;
                            x = 0;
                            break;
                    }
                }
            } else if (this.strict && line.length != 0) {
                throw `Unknown line [${index + 1}]: "${line}"`;
            }
        });

        [file.width, file.height] = [x, y];
        [x, y] = [Math.floor(file.width / 2), Math.floor(file.height / 2)];
        cells.forEach(p => file.cells.add(new Point(p.x - x, p.y - y)));

        return file.cells.size != 0 ? file : undefined;
    }
}
