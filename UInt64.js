// https://gist.github.com/georgir/add1fe7e8397e22854238dcd386d6dcd

// Input may exceed JS 53-bit int limits
// So we need a small UInt64 implementation
// Yeah I know it can be improved with some bitwise ops, whatever.
const UInt32Max = 2 ** 32;
class UInt64 {
    constructor (hi, lo, rem) {
    //debugger;
    if (lo !== undefined) {
        // Proper overflow/unsignedness of both 32bit components.
        if (+lo >= UInt32Max) {
            hi += Math.floor(lo / UInt32Max);
            lo = lo % UInt32Max;
        }
        if (+lo < 0) {
            hi -= Math.ceil(-lo / UInt32Max);
            lo = (UInt32Max + (lo % UInt32Max)) % UInt32Max;
        }
        if (+hi >= UInt32Max) {
            hi = hi % UInt32Max;
        }
        if (+hi < 0) {
            hi = (UInt32Max + (hi % UInt32Max)) % UInt32Max;
        }
        // Now add immutable properties.
        Object.defineProperties(this, {
            hi: {
                value: hi,
                enumerable: true,
            },
            lo: {
                value: lo,
                enumerable: true,
            },
            rem: {
                value: rem,
                enumerable: rem !== undefined,
            },
        });
        return this;
    }
    if (hi instanceof UInt64) {
        // This is immutable so no need to copy.
        return hi;
    }
    if (+hi < UInt32Max) {
        // Allow init with single number or short string too.
        return new UInt64(0, +hi);
    }
    // Init by long string
    const s = String(hi);
    const s1 = s.slice(0, -9);
    const s2 = s.slice(-9);
    return new UInt64(s1).mul(10, 9).add(+s2);
}
    add(x) {
        // Constructor overflow/unsignedness code will take care of all,
        // even negative numbers work fine.
        const other = new UInt64(x);
        return new UInt64(this.hi + other.hi, this.lo + other.lo);
    }
    sub(x) {
        // Constructor overflow/unsignedness code will take care of all,
        // even negative numbers work fine.
        const other = new UInt64(x);
        return new UInt64(this.hi - other.hi, this.lo - other.lo);
    }
    mul(k, n = 1) {
        // Multiply by k n times,
        // k needs to be max 20 bits so that
        // intermediate products fit in js 53bit limit.
        // We wont add checks to slow us tho.
        let hi = this.hi, lo = this.lo;
        while (n-- > 0) {
            lo *= k;
            hi *= k;
            if (lo > UInt32Max) {
                hi += Math.floor(lo / UInt32Max);
                lo = lo % UInt32Max;
            }
        }
        return new UInt64(hi, lo);
    }
    div(k, n = 1) {
        // Divide by k n times,
        // k needs to be max 20 bits so that
        // intermediate products fit in js 53bit limit.
        // We wont add checks to slow us tho.
        // Returns UInt64 object with a rem property
        // for the reminder of the last division.
        let hi = this.hi, lo = this.lo, rem;
        while (n-- > 0) {
            lo += (hi % k) * UInt32Max;
            hi = Math.floor(hi / k);
            rem = lo % k;
            lo = Math.floor(lo / k);
        }
        return new UInt64(hi, lo, rem);
    }
    toSource() {
        // For debugging.
        return `UInt64(${this.hi}, ${this.lo})`;
    }
    dump() {
        // Alias of toSource().
        return this.toSource();
    }
    toString() {
        // Could do it 6 digits at a time
        // as that's what fits in our 20-bit limit for k
        // but then we'd have to bother with 0-padding...
        let i = this, r = '';
        while (i.hi) {
            i = i.div(10);
            r = i.rem + r;
        }
        if (i.lo || !r) {
            r = i.lo + r;
        }
        return r;
    }
    valueOf() {
        // A 0-padded string so it can be compared with < >
        return this.toString().padStart(20, '0');
    }
    eq(x) {
        // But for == we can't avoid using a method.
        const other = new UInt64(x);
        return this.hi == other.hi && this.lo == other.lo;
    }
    lt(x) {
        // Even for < > it is faster if we avoid stringifying.
        const other = new UInt64(x);
        return this.hi < other.hi ||
            (this.hi == other.hi && this.lo < other.lo);
    }
    gt(x) {
        // Even for < > it is faster if we avoid stringifying.
        const other = new UInt64(x);
        return this.hi > other.hi ||
            (this.hi == other.hi && this.lo > other.lo);
    }
}
