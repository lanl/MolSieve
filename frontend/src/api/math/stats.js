import * as d3 from 'd3';

/**
 * Calculates the simple moving average of the given dataset.
 * @param {Array<Number>} values - The values to calculate the average for.
 * @param {Number} n - The length of the moving average period.
 * @returns {Array<Number>} An array of moving averages.
 */
export function simpleMovingAverage(values, n) {
    const means = [];
    const length = values.length + 1;

    let i = n - 1;
    while (++i < length) {
        const ws = values.slice(i - n, i);
        const sum = ws.reduce((prev, curr) => prev + curr, 0);
        means.push(sum / n);
    }

    // get the remaining averages with variable window size
    if (means.length < values.length) {
        for (let j = means.length; j < values.length; ++j) {
            const ws = values.slice(j, values.length);
            const sum = d3.sum(ws);
            means.push(sum / ws.length);
        }
    }

    return means;
}

/**
 * Calculates the exponential moving average (EMA) for an array of values.
 *
 * @param {Array<Number>} values - An array of numerical values.
 * @param {Number} n - Time period
 * @returns {Array<Number>} Array of moving averages.
 */
export function exponentialMovingAverage(values, n) {
    const k = 2 / (n + 1);
    const d = [];
    d.push(values[0]);
    for (let i = 1; i < values.length; i++) {
        d.push(values[i] * k + d[i - 1] * (1 - k));
    }

    return d;
}

/**
 * Calculates the box plot statistics for the given dataset.
 *
 * @param {Array<Number>} data - The array of numbers to calculate the statistics for.
 * @returns {Object} Contains q1, median, q3, iqr and min / max thresholds.
 */
export function boxPlotStats(data) {
    if (!data) {
        return undefined;
    }
    const sorted = d3.sort(data);

    const q1 = d3.quantile(sorted, 0.25);
    const median = d3.median(sorted);
    const q3 = d3.quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const minThreshold = d3.min(sorted); // q1 - 1.5 * iqr;
    const maxThreshold = d3.max(sorted); // q1 + 1.5 * iqr;

    return { q1, median, q3, iqr, minThreshold, maxThreshold };
}

/**
 * Calculates stderr (denominator in zTest) for an array of values.
 *
 * @param {Array<Number>} data - The values to calculate stderr for.
 * @returns {Number} The stderr.
 */
function stderr(data) {
    return d3.deviation(data) ** 2 / data.length;
}

/**
 * Returns z-score as result of two sample z-test between two distributions.
 *
 * @param {Array<Number>} s1 - First sample
 * @param {Array<Number>} s2 - Second sample
 * @returns {Number} z-score
 */
export function zTest(s1, s2) {
    const x1 = d3.mean(s1);
    const x2 = d3.mean(s2);

    const stderr1 = stderr(s1);
    const stderr2 = stderr(s2);

    return (x1 - x2) / Math.sqrt(stderr1 + stderr2);
}

/**
 * Calculates the differences between each successive point in a sequence.
 *
 * @param {Array<Number>} arr - values to differentiate
 * @returns {Array<Number>} differentiated values
 */
export function differentiate(arr) {
    const diff = [];
    for (let i = 0; i < arr.length - 1; i++) {
        diff.push(arr[i + 1] - arr[i]);
    }
    return diff;
}

// https://github.com/royhzq/betajs/blob/master/beta.js
function lnBetaFunc(a, b) {
    // Log Beta Function
    // ln(Beta(x,y))
    let acc = 0.0;

    for (let i = 0; i < a - 2; i++) {
        acc += Math.log(a - 1 - i);
    }
    for (let i = 0; i < b - 2; i++) {
        acc += Math.log(b - 1 - i);
    }
    for (let i = 0; i < a + b - 2; i++) {
        acc -= Math.log(a + b - 1 - i);
    }
    return acc;
}

function lnBetaPDF(x, a, b) {
    // Log of the Beta Probability Density Function
    return (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lnBetaFunc(a, b);
}

export function betaPDF(x, a, b) {
    // Beta probability density function impementation
    // using logarithms, no factorials involved.
    // Overcomes the problem with large integers
    return Math.exp(lnBetaPDF(x, a, b));
}
