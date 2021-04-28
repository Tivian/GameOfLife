class UI {
    static life;
    static $coords;
    static $toolbar;

    static init() {
        UI.life = window.life;
        UI.$coords = $('#coords');
        UI.$toolbar = $('#toolbar');

        let toolbarPos = {
            my: 'right top',
            at: 'right top',
            of: window
        };
        UI.$toolbar
            .on('mousemove', _ => UI.$coords.hide())
            .position(toolbarPos);
        $.tooltip('enable');

        $(window)
            .on('resize', _ => UI.$toolbar.position(toolbarPos))
            .on('contextmenu', ev => ev.preventDefault());

        let mouseLeft = false;
        UI.life.$canvas
            .on('start', _ =>
                $('#btn-play > i').attr('class', 'fas fa-pause')
            )
            .on('stop', _ =>
                $('#btn-play > i').attr('class', 'fas fa-play')
            )
            .on('mouseenter', _ => {
                if (mouseLeft) {
                    mouseLeft = false;
                    UI.$coords.show();
                }
            })
            .on('mouseleave', _ => {
                if (!mouseLeft) {
                    mouseLeft = true;
                    UI.$coords.hide();
                }
            })
            .on('mousemove center', ev => UI.displayCoords(ev));

        $('#btn-play').click(_ => {
            if (UI.life.isRunning)
                UI.life.stop();
            else
                UI.life.start();
        });
        $('#btn-clear').click(_ => UI.life.clear());
        $('#btn-load').click(_ => {
            $('<input type="file">')
                .prop('accept', '.rle,.lif,.life,.mcl,.plf,.l')
                .on('change', ev => 
                    // TODO
                    ev.target.files[0].text().then(txt => console.log(txt))
                )
                .click();
            //LifeFile.load();
        });
        //$('#btn-save').click(_ => {});
        //$('#btn-gallery').click(_ => {});
        //$('#btn-settings').click(_ => {});
        //$('#btn-info').click(_ => {});
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
            UI.theme(state ? 'dark' : 'light');
        });
        $('#btn-hide').click(_ => {
            let $toHide = $('#toolbar > div:nth-of-type(-n+2)');
            let state = $toHide.css('right') == '0px';
            
            $toHide.animate({
                right: state ? -$('#toolbar').width() : ''
            });
            $('#btn-hide')
                .attr('data-bs-original-title', state ? 'Show' : 'Hide')
                .tooltip('show');
            $('#btn-hide > i').css({
                transform: state ? 'rotate(180deg)' : ''
            });
        });
    }

    static theme(name) {
        console.log(name);
    }

    static displayCoords(ev) {
        if (ev.type != 'mousemove')
            console.log(ev);

        let point = UI.life.getPosition(ev);
        let maxHeight = UI.life.$canvas.height() - UI.$coords.outerHeight();
        let maxWidth = UI.life.$canvas.width() - UI.$coords.outerWidth();

        if (ev.target == UI.life.$canvas.get(0) && !UI.$coords.is(':visible'))
            UI.$coords.show();

        UI.$coords.css({
            top:  ev.pageY > maxHeight - 35 ? maxHeight - 10 : ev.pageY + 20,
            left: ev.pageX > maxWidth  - 25 ? maxWidth  - 10 : ev.pageX + 10
        });

        $('#coord-x').text(point.x);
        $('#coord-y').text(point.y);
    }
}
