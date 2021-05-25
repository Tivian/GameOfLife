/** Container for pattern gallery. */
class Gallery {
    /**
     * Creates pattern gallery container.
     * @param {string} modalId - An ID of modal in which gallery should be displayed
     * @param {string} filename - A filename of pattern gallery in .zip format
     */
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

        let $fileList = $('#gallery-file-list');
        let $gallerySet = $('#gallery-set');
        this.elem.addEventListener('show.bs.modal', _ => {
            if ($('#gallery-set * ').length)
                return;

            let opt = dir => `<option value="${dir}">${dir}</option>`;
            let keys = [...this.files.keys()];

            $gallerySet.html(keys.map(x => opt(x)).join('\n'));
            $gallerySet.trigger('change');
        });
        this.elem.addEventListener('shown.bs.modal', _ => {
            this.$canvas.show();
            this._resizePreview();
            $fileList.find('button:visible:first').trigger('click');
        });
        this.elem.addEventListener('hide.bs.modal', _ => {
            this.$canvas.hide();
        });
        window.addEventListener('resize', _ => {
            this.cache = {};
            this._resizePreview();
        });

        const btnFromFile = file =>
            `<button type='button' class='list-group-item list-group-item-action text-truncate'`
            + `value="${file.path}">${file.name}</button>`;

        const showFiles = files => {
            $fileList.html(files.map((x, i) => btnFromFile(x, i)).join('\n'));
            $fileList.find('button').on('click', ev => {
                this._currentBtn = ev.target;
                this._preview(ev);
            });
            $fileList.find('button:first').trigger('click');
        };

        const filterDuplicates = files => {
            return files.filter((file, i, arr) => {
                let match = file.name.toLowerCase().match(/^(.*)\.(.*)/i);
                return match
                && ((match[2] == 'rle')
                    || !arr.some(o => o != file && o.name.toLowerCase().includes(match[1])));
            });
        }

        const naturalSort = (arr, attr = 'name') => arr.sort((a, b) =>
            a[attr].localeCompare(b[attr], { sensitivity: 'base', numeric: true }));

        $gallerySet.on('change', _ =>
            showFiles(this.files.get($gallerySet.val()))
        );

        $fileList.on('keydown', ev => {
            let prevent = true;
            let getElem = elem => elem;

            let pageStep = Math.floor(
                $fileList.closest('.modal-body').height() /
                $fileList.find('button:first').outerHeight()) - 1;

            const pageFx = (elem, fx) => {
                let result = elem[fx]().eq(pageStep);
                if (!result.length)
                    result = elem[fx]().last();
                return result;
            };

            switch (ev.key) {
                case 'ArrowUp':
                    getElem = elem => elem.prev();
                    break;
                case 'ArrowDown':
                    getElem = elem => elem.next();
                    break;
                case 'PageUp':
                    getElem = elem => pageFx(elem, 'prevAll');
                    break;
                case 'PageDown':
                    getElem = elem => pageFx(elem, 'nextAll');
                    break;
                case 'Home':
                    getElem = elem => elem.prevAll().last();
                    break;
                case 'End':
                    getElem = elem => elem.nextAll().last();
                    break;
                default:
                    prevent = false;
                    break;
            }

            if (prevent) {
                ev.preventDefault();
                getElem($(this._currentBtn)).focus().click();
            }
        });

        let $galleryType = $('#in-gallery-type');
        let $fileName = $('#in-gallery-file-name');
        $galleryType.click(_ => {
            let type = $galleryType.find('i.fa-list').length != 0;
            let classes = ['fa-list', 'fa-search'];
            if (!type) {
                classes = classes.reverse();
                $gallerySet.trigger('change');
            } else {
                showFiles(naturalSort(filterDuplicates(this.find('', true))));
            }

            $galleryType.attr('data-bs-original-title', type ? 'List' : 'Search')
                .tooltip('show');
            $galleryType.find('i')
                .removeClass(classes[0])
                .addClass(classes[1]);

            $gallerySet.toggle(!type);
            $fileName.toggle(type);
        });

        $fileName.on('input', ev => {
            let val = ev.target.value;

            $fileList.find('button').each(function() {
                let $this = $(this);
                $this.toggle($this.val().includes(val));
            });
            [...$('#gallery-file-list button:visible')]
                .sort((a, b) => b.textContent.startsWith(val) - a.textContent.startsWith(val))
                .forEach(x => $fileList[0].appendChild(x));
        });
        
        fetch(filename).then(file => {
            file.blob().then(data => {
                this.fs.importBlob(data).then(_ => {
                    naturalSort(this.fs.root.children);
                    for (let dir of this.fs.root.children) {
                        let files = [];
                        this._traverse(files, dir);

                        files = filterDuplicates(naturalSort(files));
                        this.files.set(dir.name.substr(dir.name.indexOf('_') + 1), files);
                    }

                    $(document).trigger('gallery.load');
                });
            });
        });

        this.previewLife = new Life(this.canvas, {fullscreen: false, events: false}, 'naive');
        this.previewLife.showAge = false;
        this.previewLife.setColor('background', 'white');
    }

    /**
     * Renders given blob onto the preview canvas.
     * @param {Blob} blob - A blob to render
     * @private
     */
    _renderBlob(blob) {
        let img = new Image();
        img.onload = _ => {
            this.ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(blob);
        };
        img.src = URL.createObjectURL(blob);
    }

    /**
     * Prepares pattern file according to given event.
     * @param {Event} ev - A mouse event fired by clicking on
     *   the button corresponding to the pattern file.
     * @private
     */
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

    /**
     * Traverses directory tree of the pattern archive
     *   and pushes every file into array parameter.
     * @param {Array} array - An array object used for entry collection
     * @param {object} node - A starting node in the directory tree
     * @private
     */
    _traverse(array, node) {
        for (let entry of node.children) {
            if (entry.directory)
                this._traverse(array, entry);
            else
                array.push({name: entry.name, path: entry.data.filename});
        }
    }

    /**
     * Resizes preview canvas according to parent dimensions.
     * @private
     */
    _resizePreview() {
        this.canvas.width = this.$canvas.parent().width();
        this.canvas.height = this.$canvas.closest('.modal-body').height();
        this._scalePreview();
    }

    /**
     * Scales and centers preview in a way that whole pattern will be visible.
     * @private
     */
    _scalePreview() {
        let bb = this.previewLife.getBoundingBox();
        let factor = ((bb.width / this.canvas.width) > (bb.height / this.canvas.height)) ? 'width' : 'height';
        this.previewLife.scale = this.canvas[factor] / ((bb[factor] * 1.1) * this.previewLife.defaults.size);
        this.previewLife.center(bb.left + bb.width / 2, bb.top - bb.height / 2, false);
    }

    /**
     * Shows gallery modal.
     */
    show() {
        this.modal.show();
    }

    /**
     * Hides gallery modal.
     */
    hide() {
        this.previewLife.clear();
        this.modal.hide();
    }

    /**
     * Finds set of files which matches given string.
     * @param {string} str - A string to match
     * @returns {Array.<object>} The file entries if any was found.
     */
    find(str, map = false) {
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
        return map ? found.map(x => ({
            name: x.name,
            path: x.data.filename
        })) : found;
    }

    /**
     * Loads given file
     * @param {(object|string)} file - A file to load or filename
     * @returns {Promise} A Promise which will be resolved
     *   when file finishes loading.
     */
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

    /**
     * Randomly finds pattern file which size lies inside given range.
     * @param {number=} minSize - Minimum size of the pattern file
     * @param {number=} maxSize - Maximum size of the pattern file
     * @returns {object} The randomly choosen pattern file.
     */
    random(minSize = 0, maxSize = Number.MAX_VALUE) {
        let selection = UI.gallery.fs.entries.filter(e =>
            !e.directory && e.data.compressedSize >= minSize && e.data.compressedSize <= maxSize);
        this.file = selection[Math.floor(Math.random() * selection.length)];
        return this.file;
    }
}