(function($) {
/* Source: https://css-tricks.com/value-bubbles-for-range-inputs/ */
$.rangeSlider = function() {
    let slider = $('.range-slider');
    let range = $('.range-slider__range');
    let value = $('.range-slider__value');
    
    slider.each(function() {
        value.each(function() {
            let value = $(this).prev().attr('value');
            $(this).html(value);
        });
        
        range.on('input', function() {
            $(this).next(value).html(this.value);
        });
    });
};

$.deepCopy = function(obj) {
    return JSON.parse(JSON.stringify(obj));
}

$.isTouchDevice = function() {
    return !!('ontouchstart' in window || window.DocumentTouch && document instanceof DocumentTouch);
}
}(jQuery));