import { mpn65 } from './constants';
import { abbreviate } from './myutils';

const IGNORE_PROPS = ['img', 'loaded', 'color'];
const NO_ABBREVIATE = ['id', 'seenIn'];

export default class State {
    id;

    constructor(id) {
        this.id = id;
        this.color = mpn65[this.id % mpn65.length];
    }

    // -1 stateCluster is noise / unclustered
    get stateClusteringColor() {
        return this.stateCluster !== -1 ? mpn65[this.stateCluster % mpn65.length] : 'black';
    }

    /**
     * Returns all of the state's properties as an html string.
     *
     * @returns {[TODO:type]} [TODO:description]
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
