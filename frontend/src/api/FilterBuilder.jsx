import React from 'react';
import { getMinProperty, getMaxProperty } from "./myutils";

import {
    filter_min_opacity,
    filter_max_opacity,
    filter_range_opacity,
    filter_clustering_difference,
    filter_fuzzy_membership,
    filter_transitions,
    filter_relationship,
    filter_chunks,
} from "./filters";


const RANGE_SLIDER = "range";
const SLIDER = "slider";
const TOGGLE = "toggle";

class Filter {
    enabled = false;
    func;
}

class FilterBuilder {
    filter = new Filter();

    buildClusteringDifference() {
        this.filter.func = filter_clustering_difference;
        this.filter.checkBoxLabel = "Show clustering difference";
        this.filter.id = `clustering_difference`;
        this.filter.type = TOGGLE;
        this.filter.group = 'g';
        this.filter.className = ["strongly_unstable", "moderately_unstable", "stable"];

        return this.getFilter();
    }

    buildHideChunks() {
        this.filter.func = filter_chunks;
        this.filter.checkBoxLabel = "Hide chunks";
        this.filter.id = 'chunks';
        this.filter.type = TOGGLE;
        this.filter.group = 'c';
        this.filter.className = ['chunks']

        return this.getFilter();
    }

    buildTransitions() {       

        this.filter.func = filter_transitions;
        this.filter.checkBoxLabel = "Filter transitions from dominant state";
        this.filter.extents = [1, 100];
        this.filter.options = { val: 10, selectVal: "per" };
        this.filter.id = `transitions`;
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
        this.filter.restrict = ['sequence'];
        this.filter.className = ['transitions'];

        return this.getFilter();
    }

    buildFuzzyMemberships() {        
        this.filter.func = filter_fuzzy_membership;
        this.filter.checkBoxLabel = "Filter fuzzy memberships";
        this.filter.id = `fuzzy_membership`;
        this.filter.type = TOGGLE;
        this.filter.group = 'g';
        this.filter.className = ['fuzzy_membership'];  

        return this.getFilter();
    }

    buildMinFilter(attribute, sequence) {
        this.filter.func = filter_min_opacity;
        this.filter.sliderLabel = "At least";
        this.filter.type = SLIDER;
        this.filter.options = {
            val: getMinProperty(attribute, sequence),
            property: attribute,
        };

        this.buildStateFilterLabel(SLIDER, attribute);
    }

    buildMaxFilter(attribute, sequence) {
        this.filter.func = filter_max_opacity;
        this.filter.sliderLabel = "At most";
        this.filter.type = SLIDER;
        this.filter.options = {
            val: getMinProperty(attribute,sequence),
            property: attribute
        };
        
        this.buildStateFilterLabel(SLIDER, attribute);
    }

    buildRangeFilter(attribute, sequence) {
        this.filter.func = filter_range_opacity;
        this.filter.sliderLabel = "Between";
        this.filter.type = RANGE_SLIDER;
        this.filter.options = {
            val: [getMinProperty(attribute, sequence),
                  getMaxProperty(attribute, sequence)],
            property: attribute
        };
        this.buildStateFilterLabel(RANGE_SLIDER, attribute);
    }

    buildStateFilterLabel(type, attribute) {
        this.filter.id = `${attribute}_${type}`;
        this.filter.checkBoxLabel = `Filter ${attribute}`;
    }

    buildRelationFilter(attribute, relation_attribute) {
        this.filter.func = filter_relationship;
        this.filter.type = TOGGLE;
        this.filter.val = false;

        this.filter.id = `${attribute}_${relation_attribute}`
        this.filter.checkBoxLabel = `Find common ${relation_attribute} with ${attribute}`

    }

    buildCustomFilter(type, attribute, sequence) {
        switch(type) {
        case "MIN":
            this.buildMinFilter(attribute, sequence);
            break;
        case "MAX":
            this.buildMaxFilter(attribute, sequence);
            break;
        case "RANGE":
            this.buildRangeFilter(attribute, sequence);
            break;
        case "RELATION":
            this.buildRelationFilter();
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
        const result = {...this.filter};
        this.reset();
        return result;
    }
}

export default FilterBuilder;
