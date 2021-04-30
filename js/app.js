class UI {
    static life;
    static $coords;
    static $toolbar;
    static speedIncrement = 10;

    static init() {
        UI.life = window.life = new Life($('#game-of-life'));
        UI.$coords = $('#coords');
        UI.$toolbar = $('#toolbar');

        $(window)
            .on('contextmenu', ev => ev.preventDefault());

        UI.$toolbar
            .on('mousemove', _ => UI.$coords.hide());
        $('[data-bs-toggle="tooltip"]').tooltip();
        $.rangeSlider();

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
            .on('mousemove center', ev => {
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

        $('#btn-load').click(_ => {
            $('<input type="file">')
                .prop('accept', '.rle,.cells,.lif,.life,.mcl,.plf,.l')
                .on('change', ev => 
                    UI.life.load(new LifeFile(ev.target.files[0]), true)
                )
                .click();
        });
        //$('#btn-save').click(_ => {});
        //$('#btn-gallery').click(_ => {});
        $('#btn-lock').click(_ => {
            let state = $('#btn-lock > i').attr('class').indexOf('unlock') != -1;
            UI.life.locked = state;
            $('#btn-lock')
                .attr('data-bs-original-title', state ? 'Unlock' : 'Lock')
                .tooltip('show');
        });
        $('#btn-info').click(_ => UI.life.test()); // TODO
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

        // dropdown menu setup
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
                }
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
                break;
            case 'dark':
                $('#toolbar .dropdown-menu').addClass('dropdown-menu-dark');
                UI.life.setColor('background', '#222');
                UI.life.setColor('border', '#444');
                UI.life.setColor('outside', '#555');
                UI.life.setColor('medium', '#1e90ff');
                UI.life.setColor('cold', '#00f');
                break;
        }

        UI.life.draw();
    }

    static displayCoords(ev, follow = true) {
        let point = UI.life.getPosition(ev);
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
        $('#in-game-rule-born').val(UI.life.rule.born);
        $('#in-game-rule-survive').val(UI.life.rule.survive);
    }

    static changeSpeed(delta) {
        let $elem = $('#in-speed');
        let val = parseInt($elem.val());
        if (val == 1 && delta == UI.speedIncrement)
            val = 0;

        $elem.val(val + delta);
        $elem.trigger('input');
    }
}
