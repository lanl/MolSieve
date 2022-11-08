import * as d3 from 'd3';

export default class ColorManager {
    colors = [...d3.schemeTableau10, ...d3.schemeAccent];

    nextColor = 0;

    request_colors(num) {
        const request = [];
        if (num <= 0) {
            return request;
        }

        for (let i = 0; i < num; i++) {
            request.push(this.colors[(this.nextColor + i) % this.colors.length]);
        }
        this.nextColor += num + 1;
        return request;
    }
}
