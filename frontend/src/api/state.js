import { structuralAnalysisProps } from './constants';

const scheme = [
    '#1b9e77',
    '#d95f02',
    '#7570b3',
    '#e7298a',
    '#66a61e',
    '#e6ab02',
    '#a6761d',
    '#666666',
];

export default class State {
    id;

    constructor(id) {
        this.id = id;
    }

    get individualColor() {
        return scheme[this.id % scheme.length];
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
}
