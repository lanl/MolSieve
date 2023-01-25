import { structuralAnalysisProps, mpn65 } from './constants';
import { abbreviate } from './myutils';

const IGNORE_PROPS = ['img'];
const NO_ABBREVIATE = ['id', 'seenIn'];

export default class State {
    id;

    constructor(id) {
        this.id = id;
    }

    get color() {
        return this.individualColor;
    }

    get individualColor() {
        return mpn65[this.id % mpn65.length];
    }

    // -1 stateCluster is noise / unclustered
    get stateClusteringColor() {
        if (this.stateCluster === undefined) {
            throw new Error('State cluster is not defined!');
        }
        return this.stateCluster !== -1 ? mpn65[this.stateCluster % mpn65.length] : 'black';
    }

    get clusterIdentifier() {
        return this.id;
    }

    /* Adds up the counts from the structural analyses of the state */
    get structure() {
        const structure = { FCC: 0, OTHER: 0, HCP: 0, BCC: 0, ICO: 0 };

        for (const property of structuralAnalysisProps) {
            for (const st of Object.keys(structure)) {
                if (property in this && property.includes(st)) {
                    structure[st] += this[property];
                }
            }
        }

        return structure;
    }

    /* Returns the dominant structure within the state */
    get essentialStructure() {
        const { structure } = this;
        return Object.keys(structure).reduce(function (a, b) {
            return structure[a] > structure[b] ? a : b;
        });
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
}
