class UI {
    static life;
    static $coords;
    static $toolbar;
    static saveModal;
    static infoToast;
    static gallery;
    static speedIncrement = 10;

    static init() {
        UI.life = window.life = new Life($('#game-of-life'));
        UI.$coords = $('#coords');
        UI.$toolbar = $('#toolbar');
        UI.saveModal = new bootstrap.Modal(document.getElementById('modal-save'));
        UI.infoToast = new bootstrap.Toast(document.getElementById('info-toast'));
        UI.gallery = new Gallery('modal-gallery', './static/patterns.zip');

        $.rangeSlider();
        if (!$.isTouchDevice())
            $('[data-bs-toggle="tooltip"]').tooltip();

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
                $('#in-board-size > input, #in-game-rule > input').prop('readonly', true);
                $('#in-board-type').prop('disabled', true);
            })
            .on('stop', _ => {
                $('#btn-play > i').attr('class', 'fas fa-play');
                $('#in-board-size > input, #in-game-rule > input').prop('readonly', false);
                $('#in-board-type').prop('disabled', false);
            })
            .on('change.rule', _ =>  UI.updateRule())
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
            .on('load.file', _ => {
                $('#gr-file-info').removeClass('d-none');
                UI.showToast('Loaded ' + UI.life.file, 'success');
            })
            .on('unload.file', _ =>
                $('#gr-file-info').addClass('d-none')
            )
            .on('life.new life.next life.wipe load.file', _ => {
                $('#out-gens').text(UI.life.generation);
                $('#out-populus').text(UI.life.size);
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

        $('#btn-play').click(_ => {
            if (UI.life.isRunning)
                UI.life.stop();
            else
                UI.life.start();
        });
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
                let $elem = $(ev.target);
                let val = $elem.val();
                val = parseInt(val.replace(/[^-+0-9]/g, ''));
                if (isNaN(val) || val < 1)
                    val = 1;
                if (val >= 10000)
                    val = 9999;
                $elem.val(val);

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
        $('#btn-lock').click(_ => {
            let state = $('#btn-lock > i').attr('class').indexOf('unlock') != -1;
            UI.life.locked = state;
            $('#btn-lock')
                .attr('data-bs-original-title', state ? 'Unlock' : 'Lock')
                .tooltip('show');
        });
        $('#btn-night').click(_ => {
            let $btn = $('#btn-night');
            let $symbol = $('#btn-night > i');
            let state = $symbol.attr('class').indexOf('far') != -1;

            $btn
                .attr('data-bs-original-title', state ? 'Dark mode' : 'Light mode')
                .tooltip('show');
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
            $('#btn-hide')
                .attr('data-bs-original-title', state ? 'Show' : 'Hide')
                .tooltip('show');
            $('#btn-hide > i').css({
                transform: state ? 'rotate(180deg)' : ''
            });
        });

        // setup of the settings dropdown
        $('.dropdown-menu').click(ev =>
            ev.stopPropagation());
        $('#toolbar')
            .on('show.bs.dropdown', ev => {
                if (ev.target.id == 'btn-settings') {
                    UI.updateRule();
                    let limit = UI.life.limit;
                    $('#in-board-width').val(limit.width);
                    $('#in-board-height').val(limit.height);
                    $('#in-game-step').val(UI.life.step);
                    $('#in-board-type').val(UI.life.type).trigger('change');
                } else if (ev.target.id == 'btn-info') {
                    let file = UI.life.file;
                    $('#dropdown-info .dropdown-divider').each((_, elem) => $(elem).show());

                    if (file.title.length > 0)
                        $('#info-title').text(file.title);
                    else
                        $('#gr-info-title').hide();

                    if (file.author.length > 0)
                        $('#info-author').text(file.author);
                    else
                        $('#gr-info-author').hide();

                        function addhttp(url) {
                        if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
                        url = "http://" + url;
                        }
                        return url;
                        }

                    let comments = file.comments.map(line => UI.convertIfLink(line));
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
        $('#in-game-rule-born, #in-game-rule-survive').on('input', ev => {
            let $elem = $(ev.target);
            let str = $elem.val();
            str = str.replace(/(.)(?=.*\1)|[^0-8]/g, '');
            str = str.split('').sort().join('');
            $elem.val(str);

            UI.life.rule = `B${$('#in-game-rule-born').val()}/S${$('#in-game-rule-survive').val()}`;
        });
        $('#in-board-type').change(ev => {
            let value = $(ev.target).val();
            $('#gr-board-size').toggle(value != 'infinite');

            UI.life.type = $('#in-board-type').val();
            UI.life.draw();
        });
        $('#in-board-width, #in-board-height').on('input', ev => {
            let $elem = $(ev.target);
            let str = $elem.val();
            str = str.replace(/[^-+\d]/g, '');
            $elem.val(str);

            UI.life.limit = {
                width: $('#in-board-width').val(),
                height: $('#in-board-height').val()
            };
            UI.life.draw();
        });
        $('#in-game-step').on('change input', ev =>
            UI.life.step = $(ev.target).val()
        );
        $('#in-coord-display').change(ev => {
            let value = $(ev.target).val();
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

        $('#btn-gallery-load').click(_ => {
            UI.life.stop();
            UI.gallery.file.getBlob().then(data => {
                data.name = UI.gallery.file.name;
                CellFile.read(data, file =>
                    UI.life.load(file, true));
            });
            UI.gallery.hide();
        });
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

    static updateRule() {
        let rule = UI.life.rule.match(/B(\d+)\/S(\d+)/i);
        $('#in-game-rule-born').val(rule[1]);
        $('#in-game-rule-survive').val(rule[2]);
    }

    static changeSpeed(delta) {
        let $elem = $('#in-speed');
        let val = parseInt($elem.val());
        if (val == 1 && delta == UI.speedIncrement)
            val = 0;

        $elem.val(val + delta);
        $elem.trigger('input');
    }

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
        let $body = $('#info-toast .toast-body');
        let $button = $('#info-toast .btn-close');

        let fx = (light.includes(color)) ? 'addClass' : 'removeClass';
        $toast[fx]('text-white');
        $button[fx]('btn-close-white');

        let className = $toast.attr('class');
        let toRemove = className.match(/(bg-\S+)/ig)
            .filter(x => !x.includes('gradient'));
        $toast.removeClass(toRemove);
        $toast.addClass(`bg-${color}`);

        $body.html(html);
        UI.infoToast.show();
    }

    static convertIfLink(text) {
        let url = text;
        try {
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
        } catch (error) {
            return text;
        }
    }
}
