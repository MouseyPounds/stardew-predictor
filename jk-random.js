/* jk-random.js
 * https://mouseypounds.github.io/stardew-predictor/
 *
 * Simple and incomplete Javascript implementation of the Jkiss pseudo random number generator
 * from github.com/mono/mono/commit/8d3c6d44f8
 */

/*jshint browser: true, jquery: true */

// These would be constants in ES2015
var INT_MIN = -2147483648,
  INT_MAX = 2147483647;

function JKRandom(Seed) {
  "use strict";

  // Alternative to default argument
  if (typeof(Seed) === 'undefined') {
    Seed = Date.now();
  }
  /// Seed = Math.imul(1, parseInt(Seed) >>> 0); // Force a 32-bit integer since there is no type checking

  this.x = parseInt(Seed) >>> 0;
  this.y = 987654321;
  this.z = 43219876;
  this.c = 6543217;
  console.log("<<");
}

JKRandom.prototype.Sample = function() {
  "use strict";
  var a = this.InternalSample() >>> 6;
  var b = this.InternalSample() >>> 5;

  return (a * 134217728.0 + b) / 9007199254740992.0;
};

JKRandom.prototype.InternalSample = function() {
  "use strict";
  var t;

  this.x = parseInt((314527869n * BigInt(this.x) + 1234567n) % 0x100000000n);
  this.y = (this.y ^ this.y << 5) >>> 0;
  this.y = parseInt(BigInt(this.y) ^ BigInt(this.y) >> 7n);
  this.y = (this.y ^ this.y << 22) >>> 0;

  t = BigInt(4294584393) * BigInt(this.z) + BigInt(this.c);

  this.c = parseInt(t >> 32n) >>> 0;
  this.z = parseInt(t & 0xFFFFFFFFn) >>> 0;

  return (this.x + this.y + this.z) >>> 0;
};

/// JKRandom.prototype.GetSampleForLargeRange = function() {
///   "use strict";
///   // This might require special large integer handling
///   var result = this.InternalSample(), d;
/// 
///   if (this.InternalSample() % 2 === 0) {
///     result = -result;
///   }
///   d = result;
///   d += (INT_MAX - 1);
///   d /= 2 * INT_MAX - 1;
///   return d;
/// };

JKRandom.prototype.Next = function(a, b) {
  "use strict";
  var min = 0,
    max = INT_MAX,
    range;

  if (typeof b !== 'undefined') {
  // Next(a,b) gives range of [a..b)
    max = b;
    min = (typeof a !== 'undefined') ? a : 0;
    if (min > max) {
      throw "Argument out of range - min (" + min + ") should be smaller than max (" + max + ")";
    }
    range = max - min;
    return (range <= 1) ? min : this.InternalSample() % range + min;
  } else if (typeof a !== 'undefined') {
  // Next(a) gives range of [0..a)
    max = a;
    if (max < 0) {
      throw "Argument out of range - max (" + max + ") must be positive";
    }
    return (max == 0) ? 0 : this.InternalSample() % max;
  } else {
  // Next() gives range of [0..INT_MAX)
    var rndm = this.InternalSample();
    while (rndm == INT_MIN)  { rndm = this.InternalSample(); }
    var mask = rndm >> 31;
    return (rndm ^ mask) + (mask & 1) >>> 0;
  }
};

JKRandom.prototype.NextDouble = function() {
  "use strict";

  return this.Sample();
};
