(function($) {
$.tooltip = function(operation) {
    operation = operation || '';

    switch (operation) {
        case 'enable':
            $('[data-toggle="tooltip"]').tooltip();
            break;
    }
};
}(jQuery));