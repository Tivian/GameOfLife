class UI {
    static life;
    static $coords;
    static $toolbar;
    static saveModal;
    static infoToast;
    static gallery;
    static fps = {};
    static speedIncrement = 10;

    static init() {
        UI.life = window.life = new Life($('#game-of-life'));
        UI.$coords = $('#coords');
        UI.$toolbar = $('#toolbar');
        UI.saveModal = new bootstrap.Modal(document.getElementById('modal-save'));
        UI.infoToast = new bootstrap.Toast(document.getElementById('info-toast'), {autohide: false});
        UI.gallery = new Gallery('modal-gallery', './static/patterns.zip');

        $.rangeSlider();
        if (!$.isTouchDevice())
            $('[data-bs-toggle="tooltip"]').tooltip();
        else
            UI.touchInit();

        $(window).on('contextmenu', ev => {
            if ($(ev.target).closest('#dropdown-info').length == 0)
                ev.preventDefault();
        });

        UI.$toolbar
            .on('mousemove', _ => UI.$coords.hide());

        let coordsFollow = true;
        let coordsEnabled = true;
        let mouseLeft = false;
        UI.life.$canvas
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
                $('#in-game-rule').val(UI.life.rule)
            )
            .on('change.speed', _ =>
                $('#in-speed').val(UI.life.speed)
            )
            .on('change.lock', _ =>
                $('#btn-lock > i').attr('class', `fas fa-${UI.life.locked ? '' : 'un'}lock`)
            )
            .on('change.detect', _ =>
                $('#sw-dead').attr('checked', UI.life.detectStillLife)
            )
            .on('change.type', _ =>
                $('#in-board-type').val(UI.life.type)
            )
            .on('change.step', _ => 
                $('#in-game-step').val(UI.life.step)
            )
            .on('change.engine', _ =>
                $('#in-engine').val(UI.life.engine)
            )
            .on('load.file', _ => {
                $('#gr-file-info').removeClass('d-none');
                UI.showToast('Loaded ' + UI.life.file, 'success');
            })
            .on('unload.file', _ =>
                $('#gr-file-info').addClass('d-none')
            )
            .on('life.new life.next life.wipe load.file', _ => {
                $('#out-gens').text(UI.life.generation);
                $('#out-populus').text(UI.life.population);
            })
            .on('life.next', _ => {
                if (!UI.fps.timestamp) {
                    UI.fps.timestamp = performance.now();
                } else {
                    let diff = !UI.fps.lastGen ? 1 : (UI.life.generation - UI.fps.lastGen);
                    let value = diff * 1000 / (performance.now() - UI.fps.timestamp);
                    UI.fps.lastGen = UI.life.generation;
                    UI.fps.speed = (!UI.fps.speed) ? value : (UI.fps.speed + value) / 2;
                    UI.fps.max = !UI.fps.max ? UI.fps.speed : UI.fps.speed > UI.fps.max ? UI.fps.speed : UI.fps.max;
                    UI.fps.min = !UI.fps.min ? UI.fps.speed : (UI.fps.speed < UI.fps.min || UI.fps.min < 1) ? UI.fps.speed : UI.fps.min;
                    UI.fps.timestamp = performance.now();
                    $('#out-fps').text(`${Math.floor(UI.fps.min)} | ${Math.floor(UI.fps.speed)} | ${Math.floor(UI.fps.max)}`);
                }
            })
            .on('life.wipe', _ => {
                UI.speed = UI.max = UI.min = undefined;
                $('#out-fps').text('0 | 0 | 0');
            })
            .on('mouseenter', ev => {
                if (coordsEnabled && mouseLeft) {
                    mouseLeft = false;
                    UI.displayCoords(ev, coordsFollow);
                }
            })
            .on('mouseleave', _ => {
                if (coordsEnabled && !mouseLeft) {
                    mouseLeft = true;
                    UI.$coords.hide();
                }
            })
            .on('mousemove wheel center', ev => {
                if (coordsEnabled)
                    UI.displayCoords(ev, coordsFollow);
            });

        $('#btn-play').click(_ => UI.play());
        $('#btn-next').click(_ => {
            if (!UI.life.isRunning) {
                UI.life.next();
                UI.life.draw();
            }
        });
        $('#btn-clear').click(_ => UI.life.clear());

        $('#btn-slower').click(_ => this.changeSpeed(UI.speedIncrement));
        $('#btn-faster').click(_ => this.changeSpeed(-UI.speedIncrement));
        $('#in-speed')
            .on('input', ev => {
                let val = parseInt(ev.target.value.replace(/[^-+0-9]/g, ''));
                if (isNaN(val) || val < 1)
                    val = 1;
                if (val >= 10000)
                    val = 9999;
                ev.target.value = val;

                UI.life.speed = val;
            })
            .on('keydown', ev =>
                this.changeSpeed((ev.which == 38) ? 1 : (ev.which == 40) ? -1 : 0))
            .val(UI.life.speed);

        $('#btn-reload').click(_ => {
            try {
                UI.life.reload();
                UI.showToast('Reloaded ' + UI.life.file, 'primary');
            } catch (error) {
                UI.showToast(error, 'danger');
            }
        });
        $('#btn-load').click(_ => {
            UI.life.stop();
            CellFile.open(file => UI.life.load(file, true));
        });
        $('#btn-save').click(_ => {
            if (UI.life.cells.size == 0)
                return;

            if (UI.life.file !== undefined) {
                $('#in-file-title').val(UI.life.file.title);
                $('#in-file-author').val(UI.life.file.author);
                let $comments = $('#in-file-comments');
                if (UI.life.file.comments)
                    $comments.val(UI.life.file.comments.join('\n'));
                if (UI.life.file.name) {
                    let fname = UI.life.file.name.match(/^(.*)\./);
                    if (fname)
                        $('#in-file-name').val(fname[1]);
                }
            }

            UI.saveModal.show();
        });
        $('#btn-download').click(_ => {
            let fname = $('#in-file-name').val().trim();
            let format = $('#in-file-format').val().trim();
            if (!fname)
                return;

            let file = CellFile.get(format, fname, UI.life.cells);
            if (!file)
                return;

            file.rule = UI.life.rule;
            file.title = $('#in-file-title').val();
            file.author = $('#in-file-author').val();
            file.comments = $('#in-file-comments').val().split('\n');

            let link = document.createElement('a');
            let href = URL.createObjectURL(file.toBlob());
            link.setAttribute('href', href);
            link.setAttribute('download', file.name);
            link.click();
            URL.revokeObjectURL(href);
            UI.saveModal.hide();
        });
        $('#btn-gallery').click(_ => {
            UI.life.stop();
            UI.gallery.show();
        });
        $('#btn-random').click(_ => {
            UI.load(UI.gallery.random(0, 1000))
        });
        $('#btn-lock').click(_ => {
            let state = $('#btn-lock > i').attr('class').indexOf('unlock') != -1;
            UI.life.locked = state;
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
            UI.theme(!state ? 'dark' : 'light');
        });

        $('#btn-hide').click(_ => {
            let $toHide = $(`#toolbar > div:nth-of-type(-n+${$('#toolbar > div').length - 1})`);
            let state = $toHide.css('right') == '0px';
            
            $toHide.animate({
                right: state ? -1.2 * UI.$toolbar.width() : ''
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
            UI.load();
            UI.gallery.hide();
        });

        // setup of the settings dropdown
        $('.dropdown-menu').click(ev =>
            ev.stopPropagation());
        $('#toolbar')
            .on('show.bs.dropdown', ev => {
                if (ev.target.id == 'btn-settings') {
                    let limit = UI.life.limit;
                    $('#in-board-width').val(limit.width);
                    $('#in-board-height').val(limit.height);
                    $('#in-game-step').val(UI.life.step);
                    $('#in-game-rule').val(UI.life.rule);
                    $('#in-board-type').val(UI.life.type).trigger('change');
                } else if (ev.target.id == 'btn-info') {
                    let file = UI.life.file;
                    $('#dropdown-info .dropdown-divider').each((_, elem) => $(elem).show());

                    if (file.title.length > 0)
                        $('#info-title').text(file.title);
                    else if (UI.gallery.file)
                        $('#info-title').text(UI.gallery.file.name.match(/(.*)\./)[1]);
                    else
                        $('#gr-info-title').hide();

                    if (file.author.length > 0)
                        $('#info-author').text(file.author);
                    else
                        $('#gr-info-author').hide();

                    let comments = file.comments
                        .map(line => UI.convertIfLink(line)).filter(x => x);
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
            UI.life.rule = !match ? 'B/S' : match[0];
            ev.target.value = UI.life.rule;
        });
        $('#in-board-type').change(ev => {
            let value = ev.target.value;
            $('#gr-board-size').toggle(value != 'infinite');

            UI.life.type = $('#in-board-type').val();
            UI.life.draw();
        });
        $('#in-board-width, #in-board-height').on('input', ev => {
            ev.target.value = parseInt(ev.target.value) || 0;

            UI.life.limit = {
                width: $('#in-board-width').val(),
                height: $('#in-board-height').val()
            };
            UI.life.draw();
        });
        $('#in-game-step').on('change input', ev =>
            UI.life.step = ev.target.value
        );
        $('#in-coord-display').change(ev => {
            let value = ev.target.value;
            coordsFollow = value != 'corner';
            coordsEnabled = value != 'off';

            if (value == 'corner') {
                UI.$coords.css({
                    top: 'auto',
                    right: 'auto',
                    bottom: '0.3vh',
                    left: '0.3vh'
                });
            } else {
                UI.$coords.attr('style', '');
            }
        });
        $('#sw-dead').change(ev =>
            UI.life.detectStillLife = ev.target.checked
        );
        $('#sw-colors').change(ev => {
            UI.life.colorCells = ev.target.checked;
            UI.life.draw();
        });
        $('#sw-fps').change(ev =>
            $('#out-fps').parent().css('display', ev.target.checked ? 'flex' : 'none')
        )
        $('#in-engine').change(ev =>
            UI.life.engine = ev.target.value
        );

        $(document).on('gallery.load', _ => UI.demo());
        $(document).on('keydown', ev => {
            if (ev.target !== document.body)
                return;

            if (ev.which >= 97 && ev.which <= 105) // numpad 1-9
                UI.numpad(ev.which - 97);
            else if (ev.which == 32) // SPACE
                UI.play();
        });
    }

    static play() {
        if (UI.life.isRunning)
            UI.life.stop();
        else
            UI.life.start();
    }

    static numpad(key) {
        let bb = UI.life.getBoundingBox();
        let center = [bb.left + bb.width / 2, bb.top - bb.height / 2];
        let pos = [
            [bb.left, bb.bottom], [center[0], bb.bottom], [bb.right, bb.bottom],
            [bb.left, center[1]],         center,         [bb.right, center[1]],
            [bb.left,    bb.top], [center[0],    bb.top], [bb.right,    bb.top]
        ];
        UI.life.center(...pos[key]);
        UI.$coords.hide();
    }

    static touchInit() {
        document.addEventListener('touchstart', UI.touchHandler);
        document.addEventListener('touchmove', UI.touchHandler);
        document.addEventListener('touchend', UI.touchHandler);
        document.addEventListener('touchcancel', UI.touchHandler);

        UI.$coords.remove();
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
        UI.load(UI.gallery.random(200, 500));
    }

    static load(file) {
        UI.gallery.load(file)
            .then(data => UI.life.load(data, true))
            .catch(error => UI.showToast(error, 'danger'));
    }

    static theme(name) {
        switch (name) {
            case 'light':
                $('#toolbar .dropdown-menu').removeClass('dropdown-menu-dark');
                UI.life.setColor('background', UI.life.defaults.colors.background);
                UI.life.setColor('border', UI.life.defaults.colors.border);
                UI.life.setColor('outside', UI.life.defaults.colors.outside);
                UI.life.setColor('medium', UI.life.defaults.colors.medium);
                UI.life.setColor('cold', UI.life.defaults.colors.cold);
                UI.life.setColor('basic', UI.life.defaults.colors.basic);
                break;
            case 'dark':
                $('#toolbar .dropdown-menu').addClass('dropdown-menu-dark');
                UI.life.setColor('background', '#222');
                UI.life.setColor('border', '#444');
                UI.life.setColor('outside', '#555');
                UI.life.setColor('medium', '#1e90ff');
                UI.life.setColor('cold', '#00f');
                UI.life.setColor('basic', '#fefefe');
                break;
        }

        UI.life.draw();
    }

    static displayCoords(ev, follow = true) {
        let point = UI.life.getPosition(ev);
        if (isNaN(point.x) || isNaN(point.y))
            return;

        let maxHeight = UI.life.height - UI.$coords.outerHeight();
        let maxWidth = UI.life.width - UI.$coords.outerWidth();

        if (ev.target == UI.life.canvas && !UI.$coords.is(':visible'))
            UI.$coords.show();

        if (follow) {
            UI.$coords.css({
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
        if (val == 1 && delta == UI.speedIncrement)
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
        UI.infoToast.show();
        if (UI.toastTimeout)
            clearTimeout(UI.toastTimeout);
        UI.toastTimeout = setTimeout(_ => UI.infoToast.hide(), 5000);
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
