// stolen from https://stackoverflow.com/questions/11120840/hash-string-into-rgb-color
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

export function djb2(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
        hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
    }
    return hash;
}

export function hashStringToColor(str) {
    if (str === "") {
        return "white";
    }
    var hash = djb2(str);
    var r = (hash & 0xff0000) >> 16;
    var g = (hash & 0x00ff00) >> 8;
    var b = hash & 0x0000ff;
    return (
        "#" +
        ("0" + r.toString(16)).substr(-2) +
        ("0" + g.toString(16)).substr(-2) +
        ("0" + b.toString(16)).substr(-2)
    );
}

// https://stackoverflow.com/questions/59065687/how-to-get-most-frequent-occurring-element-in-an-array
export function mostOccurringElement(arr) {
    var counts = arr.reduce((a, c) => {
        a[c] = (a[c] || 0) + 1;
        return a;
    }, {});

    return Object.keys(counts).reduce((a, b) =>
        counts[a] > counts[b] ? a : b
    );
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

export function onStateMouseOver(node, d, trajectory, name) {    

    let content = "";
    
    if(name !== undefined) {
        content += `<b>Run</b>: ${name}<br>`;
    }
        
    if(trajectory !== undefined) {
        const propertyString = extractPropertyString(trajectory.properties, d);
        const fuzzyMemberships = trajectory.fuzzy_memberships[trajectory.current_clustering][d.id];
        content += `<b>Fuzzy memberships</b>: ${fuzzyMemberships}
        <br>${propertyString}`;
    }

    
    tippy(node, {
        allowHTML: true,
        content: content,
        arrow: true,
        maxWidth: 'none',
    });    
}

export function onChunkMouseOver(node, d, name) {
    let content = "";
    
    if(name !== undefined) {
        content += `<b>Run</b>: ${name}<br>`;
    }

    content += `<br><b>Timesteps</b> ${d.timestep} - ${d.last}`
    
    tippy(node, {
        allowHTML: true,
        content: content,
        arrow: true,
        maxWidth: 'none',
    });
}

// mpn65 color palette
export function intToRGB(i) {
    let colors = ['ff0029', '377eb8', '66a61e', '984ea3', '00d2d5', 'ff7f00', 'af8d00',
    '7f80cd', 'b3e900', 'c42e60', 'a65628', 'f781bf', '8dd3c7', 'bebada',
    'fb8072', '80b1d3', 'fdb462', 'fccde5', 'bc80bd', 'ffed6f', 'c4eaff',
    'cf8c00', '1b9e77', 'd95f02', 'e7298a', 'e6ab02', 'a6761d', '0097ff',
    '00d067', '000000', '252525', '525252', '737373', '969696', 'bdbdbd',
    'f43600', '4ba93b', '5779bb', '927acc', '97ee3f', 'bf3947', '9f5b00',
    'f48758', '8caed6', 'f2b94f', 'eff26e', 'e43872', 'd9b100', '9d7a00',
    '698cff', 'd9d9d9', '00d27e', 'd06800', '009f82', 'c49200', 'cbe8ff',
    'fecddf', 'c27eb6', '8cd2ce', 'c4b8d9', 'f883b0', 'a49100', 'f48800',
    '27d0df', 'a04a9b']
    return '#' + colors[i];
}

// https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates
export function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

// https://jsfiddle.net/Arg0n/zL0jgspz/2/
export function intersection() {
    var result = [];
    var lists;

    if (arguments.length === 1) {
        lists = arguments[0];
    } else {
        lists = arguments;
    }

    for (var i = 0; i < lists.length; i++) {
        var currentList = lists[i];
        for (var y = 0; y < currentList.length; y++) {
            var currentValue = currentList[y];
            if (result.indexOf(currentValue) === -1) {
                if (
                    lists.filter(function (obj) {
                        return obj.indexOf(currentValue) == -1;
                    }).length == 0
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
    var min = Number.MAX_VALUE;
    for (var d of sequence) {
        if (d[property] < min) {
            min = d[property];
        }
    }
    return min;
}

/** Gets the maximum value of the given property within the sequence.
 * @param {string} property - the property you're interested in
 * @param {Array<Object>} sequence - the array of states to search through
 * @return {number} max value of property 
 */
export function getMaxProperty(property, sequence) {
    var max = Number.MIN_VALUE;
    for (var d of sequence) {
        if (d[property] > max) {
            max = d[property];
        }
    }
    return max;
}

import React from 'react';
import Box from '@mui/material/Box';

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
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

