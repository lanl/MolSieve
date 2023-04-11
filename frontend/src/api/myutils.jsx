// stolen from https://stackoverflow.com/questions/11120840/hash-string-into-rgb-color
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import * as d3 from 'd3';

import 'tippy.js/themes/translucent.css';

/**
 * Gets the number of states loaded in an array.
 *
 * @param {Array<State>} arr - State array
 * @returns {Number} arr - How many states are loaded.
 */
export const getNumberLoaded = (arr) => arr.filter((d) => d.loaded === true).length;

/**
 * Counts the number of times an element occurs in an array and returns the counts as a dictionary.
 *
 * @param {Array<Number>} arr - Array of numbers.
 * @returns {Object} Object of id to number of occurrences.
 */
export function occurrenceDict(arr) {
    /* eslint-disable-next-line */
    return arr.reduce((a, c) => ((a[c] = (a[c] || 0) + 1), a), {});
}

/**
 * Calculates the percentage that each element has occurred within the array specified.
 *
 * @param {Array<Number>} arr - Array of numbers.
 * @returns {Object} Object of id to occurrence probability.
 */
export function distributionDict(arr) {
    const oc = occurrenceDict(arr);
    for (const e of Object.keys(oc)) {
        const count = oc[e];
        oc[e] = count / arr.length;
    }
    return oc;
}

/**
 * Constructs a Tippy tooltip for the specified node.
 *
 * @param {Object} node - The DOM element to add a tooltip to.
 * @param {String} content - The content of the tooltip.
 * @param {Object} settings - Various Tippy settings.
 * @returns {Object} Tooltip instance.
 */
export function tooltip(node, content, settings) {
    const defaults = {
        allowHTML: true,
        arrow: true,
        theme: 'translucent',
        placement: 'auto',
    };

    const used = !settings ? defaults : settings;

    if (content) {
        used.content = content;
    }
    return tippy(node, used);
}

/**
 * As above, but does not return instance.
 *
 * @param {Object} node - DOM node to add tooltip to.
 * @param {String} content - Tooltip content.
 */
export function oneShotTooltip(node, content) {
    const settings = {
        allowHTML: true,
        arrow: true,
        theme: 'translucent',
        placement: 'auto',
    };

    if (content) {
        settings.content = content;
    }
    tippy(node, settings);
}

/**
 * Destroys a tooltip instance.
 *
 * @param {Object} node - DOMElement to destroy tooltip for.
 */
export const destroyToolTip = (node) => {
    /* eslint-disable-next-line */
    const instance = node._tippy;
    if (instance) {
        instance.destroy();
    }
};

/**
 * Shows tooltip for a node. Creates an instance if it doesn't exist yet.
 *
 * @param {Object} node - DOMElement to show tooltip for.
 * @param {String} content - Content of tooltip.
 */
export const showToolTip = (node, content) => {
    /* eslint-disable-next-line */
    let instance = node._tippy;
    if (!instance) {
        instance = tooltip(node, content);
    } else {
        instance.setContent(content);
    }
    instance.show();
};

// https://jsfiddle.net/Arg0n/zL0jgspz/2/
/**
 * Returns the intersection of the arrays provided.
 * TODO: could move everything below here to Math
 * @param {Array} args - The arrays to calculate an intersection for.
 * @returns {Array} The elements in common between all arrays.
 */
export function intersection(...args) {
    const result = [];
    const lists = args;
    for (let i = 0; i < lists.length; i++) {
        const currentList = lists[i];
        for (let y = 0; y < currentList.length; y++) {
            const currentValue = currentList[y];
            if (result.indexOf(currentValue) === -1) {
                if (
                    lists.filter(function (obj) {
                        return obj.indexOf(currentValue) === -1;
                    }).length === 0
                ) {
                    result.push(currentValue);
                }
            }
        }
    }
    return result;
}

/**
 * Returns the intersection of two Set objects.
 * TODO: make this a variable number of arguments
 *
 * @param {Set} setA - The first Set.
 * @param {Set} setB - The second Set.
 * @returns {Set} The Set of elements commmon to both set.
 */
export function setIntersection(setA, setB) {
    const inter = new Set();
    for (const elem of setB) {
        if (setA.has(elem)) {
            inter.add(elem);
        }
    }
    return inter;
}

/**
 * Returns the union of two sets.
 *
 * @param {Set} setA - The first Set.
 * @param {Set} setB - The second Set.
 * @returns {Set} A set containing the elements from both sets.
 */
export function setUnion(setA, setB) {
    const union = new Set(setA);
    for (const elem of setB) {
        union.add(elem);
    }
    return union;
}

/**
 * Given an array of values, normalizes the values between the specified range.
 *
 * @param {Array<Number>} d - The array of values to normalize.
 * @param {Array<Number>} r - The normalization range.
 * @returns {Array<Number>} The normalized values.
 */
export function normalize(d, r) {
    const max = d3.max(d);
    const min = d3.min(d);
    const a = r[0];
    const b = r[1];

    const norms = [];

    // https://stats.stackexchange.com/questions/178626/how-to-normalize-data-between-1-and-1
    for (const v of d) {
        norms.push((b - a) * ((v - min) / (max - min)) + a);
    }

    return norms;
}

/**
 * As above, but applied to the values of a dictionary.
 *
 * @param {Object<String, Number>} d - Dictionary to normalize.
 * @param {Array<Number>} r - Normalization range.
 * @returns {Object<String, Number>} Normalized dictionary.
 */
export function normalizeDict(d, r) {
    const keys = Object.keys(d);
    const values = Object.values(d);
    const normValues = normalize(values, r);

    const normDict = {};
    keys.forEach((k, i) => {
        normDict[k] = normValues[i];
    });

    return normDict;
}

/**
 * Returns similarity between two chunks as a function of their state space intersection / union.
 *
 * @param {Chunk} a - Chunk a
 * @param {Chunk} b - Chunk b
 * @returns {Number} Percentage similarity.
 */
export function chunkSimilarity(a, b) {
    const aSet = a.statesSet;
    const bSet = b.statesSet;

    const inter = setIntersection(aSet, bSet);
    const union = setUnion(aSet, bSet);

    return inter.size / union.size;
}

/**
 * Compares two sets and returns them as a sorted object; {smallest, largest}
 * @param {Set<Any>} a - Set to compare
 * @param {Set<Any>} b - Set to compare
 * @returns {Set<Any>, Set<Any>} The two sorted sets
 */
export function compareSets(a, b) {
    if (a.size !== b.size) {
        const largest = a.size > b.size ? a : b;
        const smallest = a.size === largest.size ? b : a;
        return { smallest, largest };
    }
    return { a, b };
}

/**
 * Calculates the magnitude of a vector. Recall |v| = sqrt(v_1 ** 2 + v_2 ** 2 .. v_n ** n)
 *
 * @param {Array<Number>} a - The vector.
 * @returns {Number} The magnitude.
 */
export function magnitude(a) {
    if (a.length === 0) {
        return 0;
    }

    const sum = a.reduce((acc, e) => acc + e * e, 0);
    return Math.sqrt(sum);
}

/**
 * Calculates the dot product between two vectors.
 *
 * @param {Array<Number>} a - Vector A.
 * @param {Array<Number>} b - Vector B.
 * @throws {Error} - Raised if A and B are not the same length.
 * @returns {Number} The dot product of a and b.
 */
export function dot(a, b) {
    if (a.length !== b.length) {
        throw new Error('Arrays A & B must be the same length.');
    }

    let val = 0;
    for (let i = 0; i < a.length; i++) {
        val += a[i] * b[i];
    }
    return val;
}

/**
 * Calculates the cosine similarity between vectors A and B.
 *
 * @param {Array<Number>} a - Vector A.
 * @param {Array<Number>} b - Vector B.
 * @throws {Error} - Raised if A and B are not the same length.
 * @returns {Number} The cosine similarity between vectors A and B.
 */
export function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error('Arrays A & B must be the same length.');
    }

    if (a.length === 0 || b.length === 0) {
        return 0;
    }

    const dotp = dot(a, b);
    return dotp / magnitude(a) + magnitude(b);
}

/**
 * Calculates the state ratio similarity between two chunks.
 *
 * @param {Chunk} a - Chunk to compare
 * @param {Chunk} b - Chunk to compare
 * @returns {Number} - Similarity score
 */
export function stateRatioChunkSimilarity(a, b) {
    const aRatios = a.stateRatios;
    const bRatios = b.stateRatios;

    const { smallest, largest } = compareSets(aRatios, bRatios);

    // cosine similarity
    const smallVec = [];
    const largeVec = [];
    for (const [stateID, sVal] of smallest.entries()) {
        const lVal = largest.get(stateID);
        if (lVal) {
            largeVec.push(lVal);
        } else {
            largeVec.push(0);
        }
        smallVec.push(sVal);
    }

    return cosineSimilarity(smallVec, largeVec);
}

/**
 * Format function to print a floating value as a percentage.
 *
 * @param {Number} num - Value.
 * @returns {String} Value as percentage.
 */
export function percentToString(num) {
    return `${Math.trunc(num.toFixed(3) * 100)}%`;
}

/**
 * Forms a new string from all of the capital letters in the supplied string.
 *
 * @param {String} string - String to abbreviate
 * @returns {String} string - Abbreviated string
 */
export function abbreviate(string) {
    return string.replaceAll(/([a-z])/g, '').replaceAll(/__/g, '_');
}

/**
 * Builds a dictionary using an array's elements as keys.
 *
 * @param {Any} arr - array to use as keys
 * @param {Any} defaultValue - value for each key
 * @returns {Dict<Any,Any>} dictionary formed by using an array's elements as keys
 */
export function buildDictFromArray(arr, defaultValue) {
    const d = {};
    for (const e of arr) {
        d[e] = defaultValue;
    }
    return d;
}

/**
 * Gets the neighbors of an element in an array.
 *
 * @param {Array} arr - The array.
 * @param {Number} idx - The index of the element.
 * @returns {Array} The neighbors of the element.
 */
export function getNeighbors(arr, idx) {
    const neighbors = [undefined, undefined];

    if (idx !== 0) {
        neighbors[0] = arr[idx - 1];
    }

    if (idx !== arr.length - 1) {
        neighbors[1] = arr[idx + 1];
    }

    return neighbors;
}

/**
 * Sets all charts on the screen to have the unfocused class except for the selected chart.
 *
 * @param {String} c1 - ID of the chart.
 */
export function focusChart(c1) {
    const charts = document.querySelectorAll('.embeddedChart');
    for (const chart of charts) {
        if (chart.id !== `ec_${c1}`) {
            chart.classList.add('unfocused');
        }
    }
}

/**
 * Undo above operation.
 *
 */
export function unFocusCharts() {
    const charts = document.querySelectorAll('.embeddedChart.unfocused');
    for (const chart of charts) {
        chart.classList.remove('unfocused');
    }
}
