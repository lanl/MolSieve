import Filter from './Filter';
import { getMinProperty, getMaxProperty } from './myutils';

import {
    filterMinOpacity,
    filterMaxOpacity,
    filterRangeOpacity,
    filterClusteringDifference,
    // filterFuzzyMembership,
    // filterTransitions,
    filterRelationship,
    // filterChunks,
} from './filters';

const RANGE_SLIDER = 'range';
const SLIDER = 'slider';
const TOGGLE = 'toggle';

export default class FilterBuilder {
    filter = new Filter();

    buildClusteringDifference() {
        this.filter.func = filterClusteringDifference;
        this.filter.checkBoxLabel = 'Show clustering difference';
        this.filter.id = 'clustering_difference';
        this.filter.type = TOGGLE;
        this.filter.group = 'g';
        this.filter.className = ['strongly_unstable', 'moderately_unstable', 'stable'];

        return this.getFilter();
    }

    /* buildHideChunks() {
        this.filter.func = filterChunks;
        this.filter.checkBoxLabel = 'Hide chunks';
        this.filter.id = 'chunks';
        this.filter.type = TOGGLE;
        this.filter.group = 'c';
        this.filter.className = ['chunks'];

        return this.getFilter();
    }

    buildTransitions() {
        this.filter.func = filterTransitions;
        this.filter.checkBoxLabel = 'Filter transitions from dominant state';
        this.filter.extents = [1, 100];
        this.filter.options = { val: 10, selectVal: 'per' };
        this.filter.id = 'transitions';
        this.filter.children = (actions) => (
            <select
                onChange={(e) => {
                    actions.setMode(e);
                    actions.propagateChange();
                }}
            >
                <option value="per">% of window</option>
                <option value="abs">timesteps</option>
            </select>
        );
        this.filter.type = SLIDER;
        this.filter.group = 'g';
        this.filter.enabledFor = ['sequence'];
        this.filter.className = ['transitions'];

        return this.getFilter();
    }

    buildFuzzyMemberships() {
        this.filter.func = filterFuzzyMembership;
        this.filter.checkBoxLabel = 'Filter fuzzy memberships';
        this.filter.id = 'fuzzy_membership';
        this.filter.type = TOGGLE;
        this.filter.group = 'g';
        this.filter.className = ['fuzzy_membership'];

        return this.getFilter();
    } */

    buildMinFilter(attribute, sequence) {
        this.filter.func = filterMinOpacity;
        this.filter.sliderLabel = 'At least';
        this.filter.type = SLIDER;
        this.filter.options = {
            val: getMinProperty(attribute, sequence),
            property: attribute,
        };

        this.buildStateFilterLabel(SLIDER, attribute, 'min');
    }

    buildMaxFilter(attribute, sequence) {
        this.filter.func = filterMaxOpacity;
        this.filter.sliderLabel = 'At most';
        this.filter.type = SLIDER;
        this.filter.options = {
            val: getMinProperty(attribute, sequence),
            property: attribute,
        };

        this.buildStateFilterLabel(SLIDER, attribute, 'max');
    }

    buildRangeFilter(attribute, sequence) {
        this.filter.func = filterRangeOpacity;
        this.filter.sliderLabel = 'Between';
        this.filter.type = RANGE_SLIDER;
        this.filter.options = {
            val: [getMinProperty(attribute, sequence), getMaxProperty(attribute, sequence)],
            property: attribute,
        };
        this.buildStateFilterLabel(RANGE_SLIDER, attribute, 'range');
    }

    buildStateFilterLabel(type, attribute, funcDescription) {
        this.filter.id = `${attribute}_${type}_${funcDescription}`;
        this.filter.checkBoxLabel = `Filter ${attribute}`;
    }

    buildRelationFilter(attribute, relationAttribute) {
        this.filter.func = filterRelationship;
        this.filter.type = TOGGLE;
        this.filter.val = false;

        this.filter.id = `${attribute}_${relationAttribute}`;
        this.filter.checkBoxLabel = `Find common ${relationAttribute} with ${attribute}`;
    }

    buildCustomFilter(type, attribute, sequence) {
        switch (type) {
            case 'MIN':
                this.buildMinFilter(attribute, sequence);
                break;
            case 'MAX':
                this.buildMaxFilter(attribute, sequence);
                break;
            case 'RANGE':
                this.buildRangeFilter(attribute, sequence);
                break;
            case 'RELATION':
                this.buildRelationFilter();
                break;
            default:
                break;
        }

        this.filter.extents = [
            getMinProperty(attribute, sequence),
            getMaxProperty(attribute, sequence),
        ];

        this.filter.className = [type];
        this.filter.group = 'g';

        return this.getFilter();
    }

    reset() {
        this.filter = new Filter();
    }

    getFilter() {
        const result = { ...this.filter };
        this.reset();
        return result;
    }
}
