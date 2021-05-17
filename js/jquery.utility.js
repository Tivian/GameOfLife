(function($) {
/**
 * Initializes custom range sliders.<br>
 * See index.html to see an example of appropriate HTML code.
 * @see {@link https://css-tricks.com/value-bubbles-for-range-inputs/|Source}
 */
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

/**
 * Makes deep copy of an object.
 * @param {*} obj - An object
 * @returns A new copied object.
 */
$.deepCopy = function(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Checks if the current device has touche capabilities.
 * @returns True if the current device has touche capabilities.
 */
$.isTouchDevice = function() {
    return !!('ontouchstart' in window || window.DocumentTouch && document instanceof DocumentTouch);
}

jQuery.fn.extend({
    /**
     * Changes position of the cursor inside a textbox.
     * @param {number} caretPos - The desired postion of the cursor
     * @memberof jQuery
     */
    setCaretPosition: function(caretPos) {
        if (this.createTextRange) {
            let range = this.createTextRange();
            range.move('character', caretPos);
            range.select();
        } else {
            if (this.selectionStart) {
                this.focus();
                this.setSelectionRange(caretPos, caretPos);
            } else {
                this.focus();
            }
        }
    },
    /**
     * Returns position of the cursor inside a textbox.
     * @returns {number} - The position of the cursor inside the textbox
     * @memberof jQuery
     */
    getCaretPosition: function() {
        let caretPos = 0;

        if (document.selection) {
            this.focus();
            let selection = document.selection.createRange();
            selection.moveStart('character', -this.value.length);
            caretPos = selection.text.length;
        } else if (this.selectionStart || this.selectionStart === '0') {
            caretPos = this.selectionDirection === 'backward'
                ? this.selectionStart : this.selectionEnd;
        }

        return caretPos;
    }
});
}(jQuery));