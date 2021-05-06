class Gallery {
    constructor(modalId, filename) {
        this.elem = document.getElementById(modalId);
        this.modal = new bootstrap.Modal(this.elem);
        this.$canvas = $('#gallery-preview');
        this.canvas = this.$canvas.get(0);
        this.ctx = this.canvas.getContext('2d');
        this.fs = new zip.fs.FS();
        this.file = undefined;
        this.files = new Map();
        this.cache = {};
        this.limitCache = 100;
        this.prevQuality = 0.92;

        let $gallerySet = $('#gallery-set');
        this.elem.addEventListener('show.bs.modal', _ => {
            let opt = dir => `<option value="${dir}">${dir}</option>`;
            let keys = [...this.files.keys()];

            $gallerySet.html(keys.map(x => opt(x)).join('\n'));
            $gallerySet.trigger('change');
        });
        this.elem.addEventListener('shown.bs.modal', _ => {
            this.$canvas.show();
            this._resizePreview();
            $('#gallery-file-list button:first').trigger('click');
        });
        this.elem.addEventListener('hide.bs.modal', _ => {
            this.$canvas.hide();
            $('#gallery-file-list button').off('click');
        });
        window.addEventListener('resize', _ => {
            this.cache = {};
            this._resizePreview();
        });

        $gallerySet.on('change', _ => {
            let btn = file => 
                `<button type='button' class='list-group-item list-group-item-action text-truncate'`
                + `value="${file.path}">${file.name}</button>`;

            let dir = $gallerySet.val();
            $('#gallery-file-list').html(this.files.get(dir).map((x, i) => btn(x, i)).join('\n'));
            $('#gallery-file-list button').on('click', ev => this._preview(ev));
            $('#gallery-file-list button:first').trigger('click');
        });
        
        fetch(filename).then(file => {
            file.blob().then(data => {
                this.fs.importBlob(data).then(_ => {
                    let naturalSort = arr => arr.sort((a, b) =>
                        a.name.localeCompare(b.name, { sensitivity: 'base', numeric: true }));

                    naturalSort(this.fs.root.children);
                    for (let dir of this.fs.root.children) {
                        let files = [];
                        this._traverse(files, dir);
                        naturalSort(files);
                        files = files.filter(f => {
                            let match = f.name.toLowerCase().match(/^(.*)\.(.*)/i);
                            return !match ? false : (match[2] == 'rle')
                                ? true : !files.some(o => o != f && o.name.toLowerCase().includes(match[1]));
                        });

                        this.files.set(dir.name.substr(dir.name.indexOf('_') + 1), files);
                    }

                    $(document).trigger('gallery.load');
                });
            });
        });

        this.previewLife = new Life(this.canvas, {fullscreen: false, events: false});
        this.previewLife.colorCells = false;
        this.previewLife.setColor('background', 'white');
    }

    _renderBlob(blob) {
        let img = new Image();
        img.onload = _ => {
            this.ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(blob);
        };
        img.src = URL.createObjectURL(blob);
    }

    _preview(ev) {
        if (this.$canvas.is(':hidden'))
            return;

        let name = ev.target.value;
        this.file = this.fs.find(name);
        if (Object.keys(this.cache).length > this.limitCache)
            this.cache = {};

        if (this.cache[name]) {
            this._renderBlob(this.cache[name]);
            return;
        }

        this.file.getBlob('text/plain').then(data => {
            CellFile.read(data, file => {
                this.previewLife.load(file, true);
                this._scalePreview();
                this.previewLife.toBlob(blob => this.cache[name] = blob, this.prevQuality);
            });
        });
    }

    _traverse(array, node) {
        for (let entry of node.children) {
            if (entry.directory)
                this._traverse(array, entry);
            else
                array.push({name: entry.name, path: entry.data.filename});
        }
    }

    _resizePreview() {
        this.canvas.width = this.$canvas.parent().width();
        this.canvas.height = this.$canvas.closest('.modal-body').height();
        this._scalePreview();
    }

    _scalePreview() {
        let bb = this.previewLife.getBoundingBox();
        let factor = ((bb.width / this.canvas.width) > (bb.height / this.canvas.height)) ? 'width' : 'height';
        this.previewLife.scale = this.canvas[factor] / ((bb[factor] * 1.1) * this.previewLife.defaults.size);
        this.previewLife.center(bb.left + bb.width / 2, bb.top - bb.height / 2, false);
    }

    show() {
        this.modal.show();
    }

    hide() {
        this.previewLife.clear();
        this.modal.hide();
    }

    find(str) {
        let found = [];
        let traverse = (node) => {
            for (let entry of node.children) {
                if (entry.directory)
                    traverse(entry);
                else if (entry.data.filename.includes(str))
                    found.push(entry);
            }
        }

        traverse(this.fs.root);
        return found;
    }

    load(file) {
        if (!file && this.file)
            file = this.file;
        else if (typeof file === 'string')
            file = this.find(file)[0];

        this.file = file;
        return new Promise(resolve => {
            file.getBlob().then(data => {
                data.name = file.name;
                CellFile.read(data, resolve);
            });
        });
    }

    random(minSize, maxSize) {
        minSize = minSize || 0;
        maxSize = maxSize || Number.MAX_VALUE;
        let selection = UI.gallery.fs.entries.filter(e =>
            !e.directory && e.data.compressedSize >= minSize && e.data.compressedSize <= maxSize);
        this.file = selection[Math.floor(Math.random() * selection.length)];
        return this.file;
    }
}