/*
 * © 2025. Triad National Security, LLC. All rights reserved.
 * This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
 */
import { abbreviate } from './myutils';

const IGNORE_PROPS = ['img', 'loaded', 'color']; // don't show these properties in UI
const NO_ABBREVIATE = ['id', 'seenIn']; // don't abbreviate these properties in UI

/**
 * Thin abstraction over a state ID, just used to make it easier to render properties.
 */
export default class State {
    id;

    constructor(id) {
        this.id = id;
    }

    /**
     * Returns all of the state's properties as an html string.
     *
     * @returns {String} The state's properties as an HTML string.
     */
    toString() {
        let propertyString = '';
        let propCount = 0;
        const perLine = 3;

        for (const property of Object.keys(this)) {
            const value = this[property];
            if (!IGNORE_PROPS.includes(property) && value !== undefined) {
                const abbreviated = !NO_ABBREVIATE.includes(property)
                    ? abbreviate(property)
                    : property.charAt(0).toUpperCase() + property.slice(1);
                propertyString += `<b>${abbreviated}</b>: ${value} `;

                propCount++;
                if (propCount % perLine === 0) {
                    propertyString += '<br>';
                }
            }
        }
        return propertyString;
    }

    // Equivalent of Object.entries, but without undefined properties and nicely abbreviated
    get properties() {
        return Object.entries(this)
            .filter(([, value]) => value !== undefined)
            .filter(([property]) => !IGNORE_PROPS.includes(property))
            .map(([property, value]) => {
                const abbreviated = !NO_ABBREVIATE.includes(property)
                    ? abbreviate(property)
                    : property.charAt(0).toUpperCase() + property.slice(1);
                return [abbreviated, value];
            });
    }
}
