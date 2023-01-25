// stolen from https://stackoverflow.com/questions/11120840/hash-string-into-rgb-color
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import * as d3 from 'd3';

import 'tippy.js/themes/translucent.css';

export function djb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
    }
    return hash;
}

export function hashStringToColor(str) {
    if (str === '') {
        return 'white';
    }
    const hash = djb2(str);
    const r = (hash & 0xff0000) >> 16;
    const g = (hash & 0x00ff00) >> 8;
    const b = hash & 0x0000ff;
    return `#${`0${r.toString(16)}`.substr(-2)}${`0${g.toString(16)}`.substr(-2)}${`0${b.toString(
        16
    )}`.substr(-2)}`;
}

export function occurrenceDict(arr) {
    return arr.reduce((a, c) => {
        const d = { ...a };
        d[c] = (d[c] || 0) + 1;
        return d;
    }, {});
}

// https://stackoverflow.com/questions/59065687/how-to-get-most-frequent-occurring-element-in-an-array
export function mostOccurringElement(arr) {
    const counts = occurrenceDict(arr);
    return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
}

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

export function onEntityMouseOver(node, d, text) {
    // https://atomiks.github.io/tippyjs/v6/addons/#singleton
    // can improve performance further
    let content = d !== null ? `${d.toString()}` : '';
    if (text) {
        content += text;
    }
    // faster if creating many instances
    oneShotTooltip(node, content);
}

// mpn65 color palette
export function intToRGB(i) {
    const colors = [
        'ff0029',
        '377eb8',
        '66a61e',
        '984ea3',
        '00d2d5',
        'ff7f00',
        'af8d00',
        '7f80cd',
        'b3e900',
        'c42e60',
        'a65628',
        'f781bf',
        '8dd3c7',
        'bebada',
        'fb8072',
        '80b1d3',
        'fdb462',
        'fccde5',
        'bc80bd',
        'ffed6f',
        'c4eaff',
        'cf8c00',
        '1b9e77',
        'd95f02',
        'e7298a',
        'e6ab02',
        'a6761d',
        '0097ff',
        '00d067',
        '000000',
        '252525',
        '525252',
        '737373',
        '969696',
        'bdbdbd',
        'f43600',
        '4ba93b',
        '5779bb',
        '927acc',
        '97ee3f',
        'bf3947',
        '9f5b00',
        'f48758',
        '8caed6',
        'f2b94f',
        'eff26e',
        'e43872',
        'd9b100',
        '9d7a00',
        '698cff',
        'd9d9d9',
        '00d27e',
        'd06800',
        '009f82',
        'c49200',
        'cbe8ff',
        'fecddf',
        'c27eb6',
        '8cd2ce',
        'c4b8d9',
        'f883b0',
        'a49100',
        'f48800',
        '27d0df',
        'a04a9b',
    ];
    return `#${colors[i]}`;
}

// https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates
export function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

// https://jsfiddle.net/Arg0n/zL0jgspz/2/
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

/** Gets the minimum value of the given property within the sequence.
 * @param {string} property - the property you're interested in
 * @param {Array<Object>} sequence - the array of states to search through
 * @return {number} min value of property
 */
export function getMinProperty(property, sequence) {
    let min = Number.MAX_VALUE;
    for (const d of sequence) {
        if (d[property] < min) {
            min = d[property];
        }
    }
    return min;
}

/** Quick utility function to check if an extent is a path or only a group of states. */
export function isPath(extent) {
    if (extent.begin !== undefined && extent.end !== undefined) {
        return true;
    }
    return false;
}

/** Gets the maximum value of the given property within the sequence.
 * @param {string} property - the property you're interested in
 * @param {Array<Object>} sequence - the array of states to search through
 * @return {number} max value of property
 */
export function getMaxProperty(property, sequence) {
    let max = Number.MIN_VALUE;
    for (const d of sequence) {
        if (d[property] > max) {
            max = d[property];
        }
    }
    return max;
}
/* Returns a list of sorted trajectories, sorted by sequence length */
export function getLengthList(trajectories) {
    const lengthList = [];
    let i = 0;
    for (const [name, trajectory] of Object.entries(trajectories)) {
        lengthList[i] = { name, length: trajectory.length() };
        i++;
    }
    return lengthList.sort((a, b) => (a.length > b.length ? 1 : -1));
}

export function range(start, end) {
    return [...Array(end - start + 1)].map((_, i) => i + start);
}

/* Returns an array of a chunk's children */
export function getChildren(chunk) {
    if (chunk.childSize) {
        return chunk.children;
    }
    // use this to splice into sequence array?
    return [chunk.timestep, chunk.last];
}

/**
 * Returns the difference between two sets as a set; i.e
 * only the items that are present in A alone without B.
 *
 * @param {Set<Any>} setA - Set A to differentiate.
 * @param {Set<Any>} setB - Set B to differentiate.
 * @returns {Set<Any>} Difference of both sets
 */
export function setDifference(setA, setB) {
    const diff = new Set();
    for (const elem of setA) {
        if (!setB.has(elem)) {
            diff.add(elem);
        }
    }
    return diff;
}

export function setIntersection(setA, setB) {
    const inter = new Set();
    for (const elem of setB) {
        if (setA.has(elem)) {
            inter.add(elem);
        }
    }
    return inter;
}

export function withinExtent(d, extent) {
    const start = extent[0];
    const end = extent[1];
    return (
        (d.timestep >= start && d.last <= end) ||
        (d.last >= start && d.last <= end) ||
        (d.timestep >= start && d.timestep <= end)
    );
}

export function setUnion(setA, setB) {
    const union = new Set(setA);
    for (const elem of setB) {
        union.add(elem);
    }
    return union;
}

/* Determines what kind of scale to use for the given array.
 * If isOrdinal is true, returns ordinal scale. */

export function getScale(data, isOrdinal) {
    // if array is a range i.e only has two values
    if (data.length === 2) {
        return d3.scaleSequential().domain(data);
    }

    if (isOrdinal) {
        return d3.scalePoint().domain(data);
    }

    // if array is continuous
    const extent = d3.extent(data);
    if (extent[1] - extent[0] > 10000) {
        return d3.scaleLog().domain(extent);
    }

    return d3.scaleLinear().domain(extent);
}

/* Given a css class name, return all element ids that have that class */
export function getClassIds(className) {
    const elements = document.getElementsByClassName(className);
    const ids = [];

    for (const el of elements) {
        ids.push(el.getAttribute('id'));
    }

    return ids;
}

export function ensureArray(obj) {
    return obj instanceof Set ? [...obj] : obj;
}

/**
 * [TODO:description]
 *
 * @param {[TODO:type]} d - [TODO:description]
 * @param {[TODO:type]} r - [TODO:description]
 * @returns {[TODO:type]} [TODO:description]
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
 * [TODO:description]
 *
 * @param {[TODO:type]} d - [TODO:description]
 * @param {[TODO:type]} r - [TODO:description]
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
 * @returns {Number} Percent similarity
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
export function magnitude(a) {
    if (a.length === 0) {
        return 0;
    }

    const sum = a.reduce((acc, e) => acc + e * e, 0);
    return Math.sqrt(sum);
}

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

    console.log(aRatios, bRatios);

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

export function percentToString(num) {
    return `${num.toFixed(3) * 100}%`;
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

export function getNeighbors(arr, idx) {
    const neighbors = [undefined, undefined];

    if (idx !== arr.length - 1) {
        neighbors[0] = arr[idx - 1];
    }

    if (idx !== 0) {
        neighbors[1] = arr[idx + 1];
    }

    return neighbors;
}
