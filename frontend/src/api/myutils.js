// stolen from https://stackoverflow.com/questions/11120840/hash-string-into-rgb-color
//import * as d3 from 'd3';
import React from 'react';

export function djb2(str){
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
	    hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
    }
    return hash;
}

export function hashStringToColor(str) {
    if (str === "") {
	return "white"
    }
    var hash = djb2(str);
    var r = (hash & 0xFF0000) >> 16;
    var g = (hash & 0x00FF00) >> 8;
    var b = hash & 0x0000FF;
    return "#" + ("0" + r.toString(16)).substr(-2) + ("0" + g.toString(16)).substr(-2) + ("0" + b.toString(16)).substr(-2);
}

// https://stackoverflow.com/questions/59065687/how-to-get-most-frequent-occurring-element-in-an-array
export function mostOccurringElement(arr) {
    var counts = arr.reduce((a, c) => {
	a[c] = (a[c] || 0) + 1;
	return a;
    }, {});
       
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}


// https://stackoverflow.com/questions/3426404/create-a-hexadecimal-colour-based-on-a-string-with-javascript
export function intToRGB(i) {    
    let colors = ["#00FF00","#0000FF","#FF0000","#01FFFE","#FFA6FE","#FFDB66","#006401","#010067","#95003A","#007DB5","#FF00F6","#FFEEE8","#774D00","#90FB92","#0076FF","#D5FF00","#FF937E","#6A826C","#FF029D","#FE8900","#7A4782","#7E2DD2","#85A900","#FF0056","#A42400","#00AE7E","#683D3B","#BDC6FF","#263400","#BDD393","#00B917","#9E008E","#001544","#C28C9F","#FF74A3","#01D0FF","#004754","#E56FFE","#788231","#0E4CA1","#91D0CB","#BE9970","#968AE8","#BB8800","#43002C","#DEFF74","#00FFC6","#FFE502","#620E00","#008F9C","#98FF52","#7544B1","#B500FF","#00FF78","#FF6E41","#005F39","#6B6882","#5FAD4E","#A75740","#A5FFD2","#FFB167","#009BFF","#E85EBE","#000000"];
    return colors[i];
}

// https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates
export function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

// https://jsfiddle.net/Arg0n/zL0jgspz/2/
export function intersection() {
    var result = [];
    var lists;
  
    if(arguments.length === 1) {
  	lists = arguments[0];
    } else {
  	lists = arguments;
    }
  
    for(var i = 0; i < lists.length; i++) {
  	var currentList = lists[i];
  	for(var y = 0; y < currentList.length; y++) {
    	    var currentValue = currentList[y];
	    if(result.indexOf(currentValue) === -1) {
		if(lists.filter(function(obj) { return obj.indexOf(currentValue) == -1 }).length == 0) {
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
 * TODO: perhaps refactor to simply unique states would be faster
 */
export function getMinProperty(property, sequence) {
    var min = Number.MAX_VALUE;        
    for(var d of sequence) {            
	if(d[property] < min) {
	    min = d[property];
	}
    }
    return min;
}

/** Gets the maximum value of the given property within the sequence.
 * @param {string} property - the property you're interested in 
 * @param {Array<Object>} sequence - the array of states to search through 
 * @return {number} max value of property
 * TODO: perhaps refactor to simply unique states would be faster
 */
export function getMaxProperty(property, sequence) {
    var max = Number.MIN_VALUE;
    for(var d of sequence) {
	if(d[property] > max) {
	    max = d[property];
	}
    }
    return max;
}

