/** Represents 2D point. */
class Point {
    /**
     * @param {number=} x - The X-axis coordinate
     * @param {number=} y - The Y-axis coordinate
     */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.hash = Point.getHash(x, y);
    }

    /**
     * Checks if this point is inside the rectangle.
     * @param {Point} from - The top left corner of the rectangle.
     * @param {Point} to - The bottom right corner of the rectangle.
     * @returns {boolean} Returns true if this point is inside the rectangle.
     */
    isInside(from, to) {
        return Point.isInside(this.x, this.y, from, to);
    }

    /**
     * Calculates distance between two points.
     * @param {Point} other - An other point.
     * @returns {number} The distance between this point and other point.
     */
    distance(other) {        
        return Point.distance(this, other);
    }

    /**
     * A string representation of this point.
     * @returns A string representation of this point.
     */
    toString() {
        return `(${this.x}, ${this.y})`;
    }

    /**
     * Checks if this point is inside the rectangle.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @param {(Point|object)} from - The top left corner of the rectangle.
     * @param {(Point|object)} to - The bottom right corner of the rectangle.
     * @returns {boolean} Returns true if this point is inside the rectangle.
     */
    static isInside(x, y, from, to) {
        return x >= from.x
            && x <= to.x
            && y <= from.y
            && y >= to.y;
    }

    /**
     * Calculates distance between two points.
     * @param {(Point|object)} a - A first point
     * @param {(Point|object)} b - A second point
     * @returns {number} The distance between two points.
     */
    static distance(a, b) {
        return Math.floor(
            Math.pow(b.x - a.x, 2)
          + Math.pow(b.y - a.y, 2));
    }

    /**
     * Returns hash for given coordinates.<br>
     * Useful for maps, as JS doesn't have a native way
     *   to change how two objects are distingushed.
     * @param {number} x - The X-axis coordinate
     * @param {number} y - The Y-axis coordinate
     * @returns {string} The hash for given coordinates.
     */
    static getHash(x, y) {
        return `${x}|${y}`;
    }
}
