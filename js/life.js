class Life {
    constructor(canvas) {
        this.canvas = canvas instanceof jQuery ? canvas.get(0) : canvas;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx = this.canvas.getContext('2d');

        this.settings = {
            size: 10,
            border: 1
        };

        let self = this;
        $(window).on('resize', function() {
            self.canvas.width = window.innerWidth;
            self.canvas.height = window.innerHeight;
            self.draw();
        });

        this.draw();
    }

    async draw() {
        let height = this.canvas.height;
        let width = this.canvas.width;
        let size = this.settings.size;

        for (let y = 0; y < height; y += size) {
            for (let x = 0; x < width; x += size) {
                let red = Math.floor(Math.random() * 256);
                let green = Math.floor(Math.random() * 256);
                let blue = Math.floor(Math.random() * 256);

                this.ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
                //this.ctx.fillStyle = 'white';
                this.ctx.fillRect(x, y, size, size);

                this.ctx.fillStyle = 'black';
                this.ctx.fillRect(x - this.settings.border / 2, y, this.settings.border, size);
            }

            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(0, y, this.canvas.width, this.settings.border);
        }
    }
}