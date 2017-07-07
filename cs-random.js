/* cs-random.js
 * https://mouseypounds.github.io/stardew-predictor/
 *
 * Simple and incomplete Javascript implementation of the C# pseudo random number generator
 * published at http://referencesource.microsoft.com/#mscorlib/system/random.cs
 */

/*jshint browser: true, jquery: true, esnext: true */

const INT_MIN = -2147483648,
		INT_MAX = 2147483647,
		MBIG = INT_MAX,
		MSEED = 161803398;

class CSRandom {
	constructor(Seed = Date.getTime()) {
		var ii, mj, mk, i, k, subtraction;
		Seed = parseInt(Seed); // Force an integer since there is no type checking
		
		this.inext = 0;
		this.inextp = 0;
		this.SeedArray = [];		
		
		subtraction = (Seed === INT_MIN) ? INT_MAX : Math.abs(Seed);
		mj = MSEED - subtraction;
		this.SeedArray[55] = mj;
		mk = 1;
		for (i = 1; i < 55; i++) {
			ii = (21 * i) % 55;
			this.SeedArray[ii] = mk;
			mk = mj - mk;
			if (mk < 0) {
				mk += MBIG;
			}
			mj = this.SeedArray[ii];
		}
		for (k = 1; k < 5; k++) {
			for (i = 1; i < 56; i++) {
				this.SeedArray[i] -= this.SeedArray[1 + (i + 30) % 55];
				if (this.SeedArray[i] < 0) {
					this.SeedArray[i] += MBIG;
				}
			}
		}
		this.inext = 0;
		this.inextp = 21;
		Seed = 1;
	}
	
	Sample() {
		return parseFloat(this.InternalSample() * (1.0 / MBIG));
	}
	
	InternalSample() {
		var retVal,
			locINext = this.inext,
			locINextp = this.inextp;
		
		if (++locINext >= 56) {
			locINext = 1;
		}
		if (++locINextp >= 56) {
			locINextp = 1;
		}
		retVal = this.SeedArray[locINext] - this.SeedArray[locINextp];
		if (retVal === MBIG) {
			retVal--;
		}
		if (retVal < 0) {
			retVal += MBIG;
		}
		this.SeedArray[locINext] = retVal;
		this.inext = locINext;
		this.inextp = locINextp;
		return parseInt(retVal);
	}
	
	GetSampleForLargeRange() {
		// This might require special large integer handling
		var result = this.InternalSample(),
			d;
			
		if (this.InternalSample() %2 === 0) {
			result = -result;
		}
		d = result;
		d += (INT_MAX - 1);
		d /= 2 * INT_MAX - 1;
		return d;
	}
	
	Next(a, b) {
		// Next() gives range of [0..INT_MAX)
		// Next(a) gives range of [0..a)
		// Next(a,b) gives range of [a..b)
		var min = 0,
			max = INT_MAX,
			range;

		if (typeof b !== 'undefined') {
			// 2 parameter version
			max = b;
			min = (typeof a !== 'undefined') ? a : 0;
			if (min > max) {
				throw "Argument out of range - min (" + min + ") should be smaller than max (" + max + ")";
			}
			range = max - min;
			if (range <= INT_MAX) {
				return parseInt(this.Sample() * range + min);
			} else {
				return parseInt(this.GetSampleForLargeRange() * range + min);
			}
		} else if (typeof a !== 'undefined') {
			// 1 parameter version
			max = a;
			if (max < 0) {
				throw "Argument out of range - max (" + max + ") must be positive";
			}
			return parseInt(this.Sample() * max);
		} else {
			return this.InternalSample();
		}
	}
		
	NextDouble() {
		return this.Sample();
	}
	
	// not implementing NextBytes since Stardew Valley doesn't use it
		
}
