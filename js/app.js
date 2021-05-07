class UI {
    static life;
    static $coords;
    static $toolbar;
    static saveModal;
    static infoToast;
    static gallery;
    static fps = {};
    static speedIncrement = 10;

    static clipboard = [];
    static selectState = 'none';
    static selectStart = undefined;
    static selectEnd = undefined;

    static init() {
        this.life = window.life = new Life($('#game-of-life'));
        this.$coords = $('#coords');
        this.$toolbar = $('#toolbar');
        this.saveModal = new bootstrap.Modal(document.getElementById('modal-save'));
        this.infoToast = new bootstrap.Toast(document.getElementById('info-toast'), {autohide: false});
        this.gallery = new Gallery('modal-gallery', './static/patterns.zip');

        $.rangeSlider();
        if (!$.isTouchDevice())
            $('[data-bs-toggle="tooltip"]').tooltip();
        else
            this.touchInit();

        $(window).on('contextmenu', ev => {
            if ($(ev.target).closest('#dropdown-info').length == 0)
                ev.preventDefault();
        });

        this.$toolbar
            .on('mousemove', _ => this.$coords.hide());

        let coordsFollow = true;
        let coordsEnabled = true;
        let mouseLeft = false;
        this.life.$canvas
            .on('start', _ => {
                $('#btn-play > i').attr('class', 'fas fa-pause');
                $('#in-board-size > input, #in-game-rule').prop('readonly', true);
                $('#in-board-type').prop('disabled', true);
                $('#in-engine').prop('disabled', true);
            })
            .on('stop', _ => {
                $('#btn-play > i').attr('class', 'fas fa-play');
                $('#in-board-size > input, #in-game-rule').prop('readonly', false);
                $('#in-board-type').prop('disabled', false);
                $('#in-engine').prop('disabled', false);
            })
            .on('change.rule', _ =>
                $('#in-game-rule').val(this.life.rule)
            )
            .on('change.speed', _ =>
                $('#in-speed').val(this.life.speed)
            )
            .on('change.lock', _ =>
                $('#btn-lock > i').attr('class', `fas fa-${this.life.locked ? '' : 'un'}lock`)
            )
            .on('change.detect', _ =>
                $('#sw-dead').attr('checked', this.life.detectStillLife)
            )
            .on('change.type', _ =>
                $('#in-board-type').val(this.life.type)
            )
            .on('change.step', _ => 
                $('#in-game-step').val(this.life.step)
            )
            .on('change.engine', _ =>
                $('#in-engine').val(this.life.engine)
            )
            .on('load.file', _ => {
                $('#gr-file-info').removeClass('d-none');
                this.showToast('Loaded ' + this.life.file, 'success');
            })
            .on('unload.file', _ =>
                $('#gr-file-info').addClass('d-none')
            )
            .on('life.new life.next life.wipe load.file', _ => {
                $('#out-gens').text(this.life.generation);
                $('#out-populus').text(this.life.population);
            })
            .on('life.next', _ => {
                if (!this.fps.timestamp) {
                    this.fps.timestamp = performance.now();
                } else {
                    let diff = !this.fps.lastGen ? 1 : (this.life.generation - this.fps.lastGen);
                    let value = diff * 1000 / (performance.now() - this.fps.timestamp);
                    this.fps.lastGen = this.life.generation;
                    this.fps.speed = (!this.fps.speed) ? value : (this.fps.speed + value) / 2;
                    this.fps.max = !this.fps.max ? this.fps.speed : this.fps.speed > this.fps.max ? this.fps.speed : this.fps.max;
                    this.fps.min = !this.fps.min ? this.fps.speed : (this.fps.speed < this.fps.min || this.fps.min < 1) ? this.fps.speed : this.fps.min;
                    this.fps.timestamp = performance.now();
                    $('#out-fps').text(`${Math.floor(this.fps.min)} | ${Math.floor(this.fps.speed)} | ${Math.floor(this.fps.max)}`);
                }
            })
            .on('life.wipe', _ => {
                this.speed = this.max = this.min = undefined;
                $('#out-fps').text('0 | 0 | 0');
            })
            .on('mouseenter', ev => {
                if (coordsEnabled && mouseLeft) {
                    mouseLeft = false;
                    this.displayCoords(ev, coordsFollow);
                }
            })
            .on('mouseleave', _ => {
                if (coordsEnabled && !mouseLeft) {
                    mouseLeft = true;
                    this.$coords.hide();
                }
            })
            .on('mousemove wheel center', ev => {
                if (coordsEnabled)
                    this.displayCoords(ev, coordsFollow);
            });

        $('#btn-play').click(_ => this.play());
        $('#btn-next').click(_ => {
            if (!this.life.isRunning) {
                this.life.next();
                this.life.draw();
            }
        });
        $('#btn-clear').click(_ => this.life.clear());

        $('#btn-slower').click(_ => this.changeSpeed(this.speedIncrement));
        $('#btn-faster').click(_ => this.changeSpeed(-this.speedIncrement));
        $('#in-speed')
            .on('input', ev => {
                let val = parseInt(ev.target.value.replace(/[^-+0-9]/g, ''));
                if (isNaN(val) || val < 1)
                    val = 1;
                if (val >= 10000)
                    val = 9999;
                ev.target.value = val;

                this.life.speed = val;
            })
            .on('keydown', ev =>
                this.changeSpeed((ev.which == 38) ? 1 : (ev.which == 40) ? -1 : 0))
            .val(this.life.speed);

        let selectBox = document.createElement('div');
        let $selectBox = $(selectBox);
        selectBox.id = 'select-box';

        const dragDelta = 5;
        let downPoint = undefined;
        let dragging = false;

        let selectFx = ev => {
            let origin = this.life.origin;
            let size = this.life.cellSize;
            let cellPos = this.life.getPosition(ev);

            let translate = (point) => {
                return !point ? undefined : {
                    x: point.x * size + origin.x,
                    y: -point.y * size + origin.y
                };
            }
            let currPoint = translate(cellPos);
            let startPoint = translate(this.selectStart);
            let endPoint = translate(this.selectEnd);

            if (ev.type == 'mousedown') {
                downPoint = new Point(ev.pageX, ev.pageY);
            } else if (downPoint && ev.type == 'mousemove') {
                let movePoint = new Point(ev.pageX, ev.pageY);
                dragging = (movePoint.distance(downPoint) > dragDelta);
            } else if (ev.type == 'mouseup') {
                downPoint = undefined;

                if (dragging) {
                    dragging = false;
                    return;
                }
            }

            if (this.selectState == 'selected' && ev.type == 'mouseup') {
                if (dragging)
                    return;

                this.clipboard = [];
                this.selectState = 'none';
                this.selectStart = undefined;
                this.selectEnd = undefined;
                console.log('WIPE');
            }

            if (this.selectState == 'none' && ev.type == 'mouseup') {
                this.selectState = 'anchor';
                this.selectStart = { x: cellPos.x, y: cellPos.y };

                $selectBox.css({
                    left: currPoint.x,
                    top: currPoint.y,
                    width: size,
                    height: size
                });
            } else if (this.selectState == 'anchor') {
                // FIXME: Is there more elegant way to do this?
                if (cellPos.x >= this.selectStart.x && cellPos.y <= this.selectStart.y) { // bottom right quadrant
                    $selectBox.css({
                        left: startPoint.x,
                        top: startPoint.y,
                        width: currPoint.x - startPoint.x + size,
                        height: currPoint.y - startPoint.y + size
                    });
                } else {
                    if (cellPos.x < this.selectStart.x && cellPos.y > this.selectStart.y) { // top left quadrant
                        $selectBox.css({
                            left: currPoint.x,
                            top: currPoint.y,
                            width: startPoint.x - currPoint.x + size,
                            height: startPoint.y - currPoint.y + size
                        });
                    } else if (cellPos.x < this.selectStart.x) { // bottom left quadrant
                        $selectBox.css({
                            left: currPoint.x,
                            top: startPoint.y,
                            width: startPoint.x - currPoint.x + size,
                            height: currPoint.y - startPoint.y + size
                        });
                    } else { // top right quadrant
                        $selectBox.css({
                            left: startPoint.x,
                            top: currPoint.y,
                            width: currPoint.x - startPoint.x + size,
                            height: startPoint.y - currPoint.y + size
                        });
                    }
                }

                if (this.selectState != 'selected' && ev.type == 'mouseup') {
                    this.selectState = 'selected';
                    this.selectEnd = { x: cellPos.x, y: cellPos.y };

                    // Shift coordinates so that selectStart is top left corner
                    //  and selectEnd is bottom right corner of the selected area.
                    let height = Math.abs(this.selectStart.y - cellPos.y);
                    if (cellPos.x < this.selectStart.x && cellPos.y > this.selectStart.y) {
                        [this.selectStart, this.selectEnd] = [this.selectEnd, this.selectStart];
                    } else if (cellPos.x < this.selectStart.x) {
                        this.selectStart.y -= height;
                        this.selectEnd.y += height;
                        [this.selectStart, this.selectEnd] = [this.selectEnd, this.selectStart];
                    } else if (cellPos.y > this.selectStart.y) {
                        this.selectStart.y += height;
                        this.selectEnd.y -= height;
                    }

                    this.copy();
                }
            } else if (this.selectState == 'selected' || this.selectState == 'pasting') {
                $selectBox.css({
                    left: startPoint.x,
                    top: startPoint.y,
                    width: endPoint.x - startPoint.x + size,
                    height: endPoint.y - startPoint.y + size
                });
            }
        };

        $('#btn-select').change(ev => {
            if (this.life.isRunning) {
                this.showToast('The automaton is running!', 'danger');
                ev.target.checked = false;
                return;
            }

            $('#btn-select + label')
                .prop('class', (ev.target.checked) ? 'btn btn-success' : 'btn btn-secondary');
            this.life.locked = ev.target.checked;

            if (ev.target.checked) {
                document.body.appendChild(selectBox);
                this.life.$canvas.on('mousedown mousemove mouseup wheel', selectFx);
            } else {
                if (this.selectState != 'none') {
                    document.body.removeChild(selectBox);
                    this.life.$canvas.off('mousedown mousemove mouseup wheel', selectFx);
                }

                $selectBox.removeAttr('style');
                this.selectState = 'none';
                this.selectStart = undefined;
                this.selectEnd = undefined;
            }
        });
        $('#btn-cut').click(_ => this.cut());
        $('#btn-paste').click(_ => this.paste());

        $('#btn-reload').click(_ => {
            try {
                this.life.reload();
                this.showToast('Reloaded ' + this.life.file, 'primary');
            } catch (error) {
                this.showToast(error, 'danger');
            }
        });
        $('#btn-load').click(_ => {
            this.life.stop();
            CellFile.open(file => this.life.load(file, true));
        });
        $('#btn-save').click(_ => {
            if (this.life.cells.size == 0)
                return;

            if (this.life.file !== undefined) {
                $('#in-file-title').val(this.life.file.title);
                $('#in-file-author').val(this.life.file.author);
                let $comments = $('#in-file-comments');
                if (this.life.file.comments)
                    $comments.val(this.life.file.comments.join('\n'));
                if (this.life.file.name) {
                    let fname = this.life.file.name.match(/^(.*)\./);
                    if (fname)
                        $('#in-file-name').val(fname[1]);
                }
            }

            this.saveModal.show();
        });
        $('#btn-download').click(_ => {
            let fname = $('#in-file-name').val().trim();
            let format = $('#in-file-format').val().trim();
            if (!fname)
                return;

            let file = CellFile.get(format, fname, this.life.cells);
            if (!file)
                return;

            file.rule = this.life.rule;
            file.title = $('#in-file-title').val();
            file.author = $('#in-file-author').val();
            file.comments = $('#in-file-comments').val().split('\n');

            let link = document.createElement('a');
            let href = URL.createObjectURL(file.toBlob());
            link.setAttribute('href', href);
            link.setAttribute('download', file.name);
            link.click();
            URL.revokeObjectURL(href);
            this.saveModal.hide();
        });
        $('#btn-gallery').click(_ => {
            this.life.stop();
            this.gallery.show();
        });
        $('#btn-random')
            .click(_ => this.load(this.gallery.random()))
            .on('mousedown', ev => {
                if (ev.which == 3) {
                    this.life.randomize(
                        Math.ceil(Math.random() * 100),
                        Math.ceil(Math.random() * 100),
                        Math.random() + 0.1);
                }
            });
        $('#btn-lock').click(_ => {
            let state = $('#btn-lock > i').attr('class').indexOf('unlock') != -1;
            this.life.locked = state;
            if (!$.isTouchDevice()) {
                $('#btn-lock')
                    .attr('data-bs-original-title', state ? 'Unlock' : 'Lock')
                    .tooltip('show');
            }
        });
        $('#btn-night').click(_ => {
            let $btn = $('#btn-night');
            let $symbol = $('#btn-night > i');
            let state = $symbol.attr('class').indexOf('far') != -1;

            if (!$.isTouchDevice()) {
                $btn
                    .attr('data-bs-original-title', state ? 'Dark mode' : 'Light mode')
                    .tooltip('show');
            }
            $symbol
                .removeClass(state ? 'far' : 'fas')
                .addClass(state ? 'fas' : 'far');
            this.theme(!state ? 'dark' : 'light');
        });

        $('#btn-hide').click(_ => {
            let $toHide = $(`#toolbar > div:nth-of-type(-n+${$('#toolbar > div').length - 1})`);
            let state = $toHide.css('right') == '0px';
            
            $toHide.animate({
                right: state ? -1.2 * this.$toolbar.width() : ''
            });
            if (!$.isTouchDevice()) {
                $('#btn-hide')
                    .attr('data-bs-original-title', state ? 'Show' : 'Hide')
                    .tooltip('show');
            }
            $('#btn-hide > i').css({
                transform: state ? 'rotate(180deg)' : ''
            });
        });

        $('#btn-gallery-load').click(_ => {
            this.load();
            this.gallery.hide();
        });

        // setup of the settings dropdown
        $('.dropdown-menu').click(ev =>
            ev.stopPropagation());
        $('#toolbar')
            .on('show.bs.dropdown', ev => {
                if (ev.target.id == 'btn-settings') {
                    let limit = this.life.limit;
                    $('#in-board-width').val(limit.width);
                    $('#in-board-height').val(limit.height);
                    $('#in-game-step').val(this.life.step);
                    $('#in-game-rule').val(this.life.rule);
                    $('#in-board-type').val(this.life.type).trigger('change');
                } else if (ev.target.id == 'btn-info') {
                    let file = this.life.file;
                    $('#dropdown-info .dropdown-divider').each((_, elem) => $(elem).show());

                    if (file.title.length > 0)
                        $('#info-title').text(file.title);
                    else if (this.gallery.file)
                        $('#info-title').text(this.gallery.file.name.match(/(.*)\./)[1]);
                    else
                        $('#gr-info-title').hide();

                    if (file.author.length > 0)
                        $('#info-author').text(file.author);
                    else
                        $('#gr-info-author').hide();

                    let comments = file.comments
                        .map(line => this.convertIfLink(line)).filter(x => x);
                    if (comments.length > 0)
                        $('#info-comments').html(comments.join('<br>'));
                    else
                        $('#gr-info-comments').hide();
                }
            })
            .on('shown.bs.dropdown', ev => {
                if (ev.target.id == 'btn-info')
                    $('#dropdown-info .dropdown-divider:visible:last').hide();
            });
        $('#in-game-rule').on('input', ev => {
            let match = ev.target.value.match(/(B?[0-8]*\/S?[0-8]*)|(S[0-8]*\/B[0-8]*)/g);
            this.life.rule = !match ? 'B/S' : match[0];
            ev.target.value = this.life.rule;
        });
        $('#in-board-type').change(ev => {
            let value = ev.target.value;
            $('#gr-board-size').toggle(value != 'infinite');

            this.life.type = $('#in-board-type').val();
            this.life.draw();
        });
        $('#in-board-width, #in-board-height').on('input', ev => {
            ev.target.value = parseInt(ev.target.value) || 0;

            this.life.limit = {
                width: $('#in-board-width').val(),
                height: $('#in-board-height').val()
            };
            this.life.draw();
        });
        $('#in-game-step').on('change input', ev =>
            this.life.step = ev.target.value
        );
        $('#in-coord-display').change(ev => {
            let value = ev.target.value;
            coordsFollow = value != 'corner';
            coordsEnabled = value != 'off';

            if (value == 'corner') {
                this.$coords.css({
                    top: 'auto',
                    right: 'auto',
                    bottom: '0.3vh',
                    left: '0.3vh'
                });
            } else {
                this.$coords.attr('style', '');
            }
        });
        $('#sw-dead').change(ev =>
            this.life.detectStillLife = ev.target.checked
        );
        $('#sw-colors').change(ev => {
            this.life.colorCells = ev.target.checked;
            this.life.draw();
        });
        $('#sw-fps').change(ev =>
            $('#out-fps').parent().css('display', ev.target.checked ? 'flex' : 'none')
        )
        $('#in-engine').change(ev =>
            this.life.engine = ev.target.value
        );

        $(document).on('gallery.load', _ => this.demo());
        $(document).on('keydown', ev => {
            if (ev.target !== document.body)
                return;

            if (ev.which >= 97 && ev.which <= 105) { // numpad 1-9
                this.numpad(ev.which - 97);
            } else if (ev.which == 32) { // SPACE
                this.play();
            } else if (ev.which == 82) { // R
                this.rotate();
            } else if (ev.which == 46) { // Delete
                this.cut();
                this.clipboard = [];
            }

            if (ev.ctrlKey) {
                if (ev.which == 67) { // C
                    this.copy(true);
                } else if (ev.which == 88) { // X
                    this.cut();
                } else if (ev.which == 86) { // V
                    this.paste();
                }
            }
        });
    }

    static copy(closeAfter = false, showToast = true) {
        if (this.selectState != 'selected')
            return;

        this.clipboard = this.life.getCells().map(c => ({ x: c.x, y: c.y }))
            .filter(c => Point.isInside(c.x, c.y, this.selectStart, this.selectEnd));

        if (showToast)
            this.showToast(`Copied ${this.clipboard.length} cells.`, 'success');

        if (closeAfter)
            this.turnOffSelect();
    }

    static cut() {
        if (this.selectState == 'selected') {
            try {
                this.copy(false, false);
                this.life.remove(this.clipboard);
            } catch (error) {
                this.showToast(error, 'danger');
            }
        }
    }

    static paste() {
        if (this.life.isRunning) {
            this.showToast('The automaton is running!', 'danger');
            return;
        }

        if (this.clipboard && this.clipboard.length > 0) {
            let pasteFx = (ev) => {
                let pos = this.life.getPosition(ev);
                let bb = Life.getBoundingBox(this.clipboard);
                let points = this.clipboard.map(c =>
                    ({ x: c.x - (bb.left - pos.x), y: c.y - (bb.top - pos.y) }));
                this.life.load(points);
                this.life.$canvas
                    .off('click', pasteFx)
                    .css({ cursor: '' });
                if (this.selectState == 'pasting')
                    this.selectState = 'selected';
                this.life.locked = this.selectState != 'none';
            };

            if (this.selectState != 'none')
                this.selectState = 'pasting';
            this.life.locked = true;
            this.life.$canvas
                .css({ cursor: 'cell' })
                .on('click', pasteFx);
        }
    }

    static rotate() {
        if (this.selectState != 'selected')
            return;

        let rotetePoint = (point, center, angle) => {
            let sin = Math.sin(angle);
            let cos = Math.cos(angle);

            point.x -= center.x;
            point.y -= center.y;

            let xNew = point.x * cos - point.y * sin;
            let yNew = point.x * sin - point.y * cos;

            point.x = Math.round(xNew + center.x);
            point.y = Math.round(yNew + center.y);
            return point;
        };

        this.copy(false, false);

        const angle = -Math.PI / 2;
        let bb = Life.getBoundingBox(this.clipboard);
        let pivot = {
            x: Math.floor(bb.left + bb.width / 2),
            y: Math.ceil(bb.top - bb.height / 2)
        };
        let points = this.clipboard.map(p =>
            rotetePoint($.deepCopy(p), pivot, angle));
        this.cut();
        this.life.load(points);

        let tr = rotetePoint($.deepCopy(this.selectStart), pivot, angle);
        let bl = rotetePoint($.deepCopy(this.selectEnd), pivot, angle);
        this.selectEnd = { x: tr.x, y: bl.y };
        this.selectStart = { x: bl.x, y: tr.y };
        this.life.$canvas.trigger('mousemove');
    }

    static turnOffSelect() {
        $('#btn-select')
            .prop('checked', false)
            .trigger('change');
    }

    static play() {
        if (this.life.isRunning) {
            this.life.stop();
        } else {
            this.turnOffSelect();
            this.life.start();
        }
    }

    static numpad(key) {
        let bb = this.life.getBoundingBox();
        let center = [bb.left + bb.width / 2, bb.top - bb.height / 2];
        let pos = [
            [bb.left, bb.bottom], [center[0], bb.bottom], [bb.right, bb.bottom],
            [bb.left, center[1]],         center,         [bb.right, center[1]],
            [bb.left,    bb.top], [center[0],    bb.top], [bb.right,    bb.top]
        ];
        this.life.center(...pos[key]);
        this.$coords.hide();
    }

    static touchInit() {
        document.addEventListener('touchstart', this.touchHandler);
        document.addEventListener('touchmove', this.touchHandler);
        document.addEventListener('touchend', this.touchHandler);
        document.addEventListener('touchcancel', this.touchHandler);

        this.$coords.remove();
    }

    static touchHandler(ev) {
        let touches = ev.changedTouches,
            first = touches[0],
            type = '';

        switch (ev.type) {
            case 'touchstart': type = 'mousedown'; break;
            case 'touchmove':  type = 'mousemove'; break;
            case 'touchend':   type = 'mouseup';   break;
            default:           return;
        }

        let simulatedEvent = document.createEvent("MouseEvent");
        simulatedEvent.initMouseEvent(type, true, true, window, 1,
            first.screenX, first.screenY,
            first.clientX, first.clientY, false,
            false, false, false, 0/*LMB*/, null);

        first.target.dispatchEvent(simulatedEvent);
    }

    static demo() {
        this.load(this.gallery.random(200, 500));
    }

    static load(file) {
        this.gallery.load(file)
            .then(data => this.life.load(data, true))
            .catch(error => this.showToast(error, 'danger'));
    }

    static theme(name) {
        switch (name) {
            case 'light':
                $('#toolbar .dropdown-menu').removeClass('dropdown-menu-dark');
                this.life.setColor('background', this.life.defaults.colors.background);
                this.life.setColor('border', this.life.defaults.colors.border);
                this.life.setColor('outside', this.life.defaults.colors.outside);
                this.life.setColor('medium', this.life.defaults.colors.medium);
                this.life.setColor('cold', this.life.defaults.colors.cold);
                this.life.setColor('basic', this.life.defaults.colors.basic);
                break;
            case 'dark':
                $('#toolbar .dropdown-menu').addClass('dropdown-menu-dark');
                this.life.setColor('background', '#222');
                this.life.setColor('border', '#444');
                this.life.setColor('outside', '#555');
                this.life.setColor('medium', '#1e90ff');
                this.life.setColor('cold', '#00f');
                this.life.setColor('basic', '#fefefe');
                break;
        }

        this.life.draw();
    }

    static displayCoords(ev, follow = true) {
        let point = this.life.getPosition(ev);
        if (isNaN(point.x) || isNaN(point.y))
            return;

        let maxHeight = this.life.height - this.$coords.outerHeight();
        let maxWidth = this.life.width - this.$coords.outerWidth();

        if (ev.target == this.life.canvas && !this.$coords.is(':visible'))
            this.$coords.show();

        if (follow) {
            this.$coords.css({
                top:  ev.pageY > maxHeight - 35 ? maxHeight - 10 : ev.pageY + 20,
                left: ev.pageX > maxWidth  - 25 ? maxWidth  - 10 : ev.pageX + 10
            });
        }

        $('#coord-x').text(point.x);
        $('#coord-y').text(point.y);
    }

    static changeSpeed(delta) {
        let $elem = $('#in-speed');
        let val = parseInt($elem.val());
        if (val == 1 && delta == this.speedIncrement)
            val = 0;

        $elem.val(val + delta);
        $elem.trigger('input');
    }

    static toastTimeout = undefined;
    static showToast(html, color = 'secondary') {
        const light = [
            'primary', 'secondary', 'success',
            'danger', 'dark'
        ];
        const dark = [
            'info', 'warning', 'light'
        ];

        if (color && !light.includes(color) && !dark.includes(color))
            throw 'Unknown toast color!';

        let $toast = $('#info-toast');
        let $toastBody = $('#info-toast .toast-body');
        let $button = $('#info-toast .btn-close');

        let fx = (light.includes(color)) ? 'addClass' : 'removeClass';
        $toast[fx]('text-white');
        $button[fx]('btn-close-white');

        let className = $toast.attr('class');
        let toRemove = className.match(/(bg-\S+)/ig)
            .filter(x => !x.includes('gradient'));
        $toast.removeClass(toRemove);
        $toast.addClass(`bg-${color}`);

        $toastBody.html(html);
        this.infoToast.show();
        if (this.toastTimeout)
            clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(_ => this.infoToast.hide(), 5000);
    }

    static convertIfLink(text) {
        let url = text;

        if (/(.cell|.rle)/gi.test(url)) {
            return '';
        } else if (/^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/gi.test(url)) {
            if (url && !/^https?:\/\//i.test(url))
                url = 'http://' + url;

            url = new URL(url);
            let name = url.href;
            if (url.hostname.includes('conwaylife')) {
                if (url.pathname.includes('wiki'))
                    name = 'LifeWiki entry';
                else if (url.pathname.includes('forum'))
                    name = 'ConwayLife forum';
            }

            return `<a href='${url}' target='_blank'>${name}</a>`;
        } else {
            return text;
        }
    }
}
