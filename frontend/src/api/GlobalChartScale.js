import * as d3 from 'd3';

class GlobalChartScale {
    min = Number.MIN_VALUE;

    max = Number.MAX_VALUE;

    s = d3.scaleLinear().domain([this.min, this.max]).range([30, 5]);

    attribute = null;

    update = (vals, newAttribute) => {
        const newMin = d3.min(vals);
        const newMax = d3.max(vals);

        if (newAttribute !== this.attribute || newMin < this.min || this.max < newMax) {
            this.min = newMin;
            this.max = newMax;
            this.updateScale();
        }
    };

    updateScale = () => {
        this.s = d3.scaleLinear().domain([this.min, this.max]).range([65, 5]);
    };

    get scale() {
        return this.s;
    }
}

const instance = new GlobalChartScale();

export default instance;
