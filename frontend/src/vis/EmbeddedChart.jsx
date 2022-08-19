import * as d3 from 'd3';
import GlobalStates from '../api/globalStates';

const margin = {
    top: 10,
    bottom: 20,
    left: 25,
    right: 25,
};

const border = {
    top: 5,
    bottom: 15,
    left: 5,
    right: 10,
};

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

export default function EmbeddedChart(svg, chunkID, trajectory) {
    const width = parseFloat(svg.attr('width'));
    const height = parseFloat(svg.attr('height'));

    const { chunks } = trajectory;

    const chunk = chunks.get(chunkID);
    const stateIDs = trajectory.getChunkStatesNotUnique(chunk);
    const timestepObjects = stateIDs.map((id) => GlobalStates.get(id));

    const scaleX = d3
        .scaleLinear()
        .range([margin.left, width - margin.right])
        .domain([0, stateIDs.length]);

    const scaleY = d3
        .scaleLinear()
        .range([margin.top, height - margin.bottom])
        .domain(d3.extent(stateIDs));

    svg.selectAll('*').remove();

    const rectG = svg.append('g').attr('transform', 'translate(0,0)');

    svg.append('rect')
        .attr('fill', 'none')
        .attr('stroke', 'gray')
        .attr('x', border.left)
        .attr('y', border.top)
        .attr('width', width - border.right)
        .attr('height', height - border.bottom);

    rectG
        .selectAll('rect')
        .data(timestepObjects)
        .enter()
        .append('rect')
        .attr('x', (_, i) => scaleX(i))
        .attr('y', (d) => scaleY(d.id))
        .attr('fill', (d) => scheme[d.id % scheme.length])
        .attr('width', 5)
        .attr('height', 5);
}
