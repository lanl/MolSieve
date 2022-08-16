// stolen from https://stackoverflow.com/questions/11120840/hash-string-into-rgb-color
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

import React from 'react';
import Box from '@mui/material/Box';
import GlobalStates from './globalStates';
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

// https://stackoverflow.com/questions/59065687/how-to-get-most-frequent-occurring-element-in-an-array
export function mostOccurringElement(arr) {
    const counts = arr.reduce((a, c) => {
        a[c] = (a[c] || 0) + 1;
        return a;
    }, {});

    return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
}

export function extractPropertyString(props, d) {
    let propertyString = '';
    let propCount = 0;
    const perLine = 3;

    for (const property of props) {
        const currentProp = d[property];
        const capitalized = property.charAt(0).toUpperCase() + property.slice(1);

        propertyString += `<b>${capitalized}</b>: ${currentProp} `;

        propCount++;
        if (propCount % perLine === 0) {
            propertyString += '<br>';
        }
    }
    return propertyString;
}

export function tooltip(node, content) {
    const settings = {
        allowHTML: true,
        arrow: true,
        theme: 'translucent',
        placement: 'auto',
    };

    if (content) {
        settings.content = content;
        return tippy(node, settings);
    }
    return tippy(node, settings);
}

export function onStateMouseOver(node, id, trajectory) {
    // https://atomiks.github.io/tippyjs/v6/addons/#singleton
    // can improve performance further
    let content = '';

    const d = GlobalStates.get(id);

    if (trajectory !== undefined) {
        const fuzzyMemberships = trajectory.fuzzy_memberships[trajectory.current_clustering][d.id];
        content += `<b>Fuzzy memberships</b>: ${fuzzyMemberships}<br/>`;
    }

    const propertyString = extractPropertyString(Object.keys(d), d);
    content += `${propertyString}`;
    const i = tooltip(node, content);
    i.show();
}

export function onChunkMouseOver(node, d) {
    let content = '';

    content += d.toString();

    tooltip(node, content);
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
export function intersection() {
    const result = [];
    let lists;

    if (arguments.length === 1) {
        lists = arguments[0];
    } else {
        lists = arguments;
    }

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

export function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
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
