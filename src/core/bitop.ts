class Bitop {
    private buffer: Buffer;
    private buflen: number;
    private bufpos: number;
    private bufoff: number;
    public iserro: boolean;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
        this.buflen = buffer.length;
        this.bufpos = 0;
        this.bufoff = 0;
        this.iserro = false;
    }

    read(n: number): number {
        let v = 0;
        let d = 0;
        while (n) {
            if (n < 0 || this.bufpos >= this.buflen) {
                this.iserro = true;
                return 0;
            }

            this.iserro = false;
            d = this.bufoff + n > 8 ? 8 - this.bufoff : n;

            v = v * Math.pow(2, d);
            v += (
                this.buffer[this.bufpos] >> (
                    8 - this.bufoff - d
                )
            ) & (
                0xff >> (
                    8 - d
                )
            );

            this.bufoff += d;
            n -= d;

            if (this.bufoff == 8) {
                this.bufpos++;
                this.bufoff = 0;
            }
        }
        return v;
    }

    look(n: number): number {
        let p = this.bufpos;
        let o = this.bufoff;
        let v = this.read(n);
        this.bufpos = p;
        this.bufoff = o;
        return v;
    }

    read_golomb(): number {
        let n: number;
        for (n = 0; this.read(1) == 0 && !this.iserro; n++) {
            ;
        }
        return Math.pow(2, n) + this.read(n) - 1;
    }
}

export default Bitop;
