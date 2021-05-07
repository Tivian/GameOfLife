class Point {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.hash = Point.getHash(x, y);
    }

    isInside(from, to) {
        return Point.isInside(this.x, this.y, from, to);
    }

    distance(other) {        
        return Point.distance(this, other);
    }

    toString() {
        return `(${this.x}, ${this.y})`;
    }

    static isInside(x, y, from, to) {
        return x >= from.x
            && x <= to.x
            && y <= from.y
            && y >= to.y;
    }

    static distance(a, b) {
        return Math.floor(
            Math.pow(b.x - a.x, 2)
          + Math.pow(b.y - a.y, 2));
    }

    static getHash(x, y) {
        return `${x}|${y}`;
    }
}
