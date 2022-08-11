import { React, useEffect } from 'react';
import * as d3 from 'd3';

import Box from '@mui/material/Box';

import '../css/vis.css';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useResize } from '../hooks/useResize';
import {
    onChunkMouseOver,
    getLengthList,
    onStateMouseOver,
    tooltip,
    withinExtent,
} from '../api/myutils';
// import Timestep from '../api/timestep';

/* const margin = {
    top: 35, bottom: 20, left: 25, right: 25,
}; */
let zoom = null;
let scaleR = null;

// TODO think of better way to do this later
const CHUNK = 0;
const TIMESTEP = 1;

export default function CircularSequence({
    trajectories,
    sx,
    setStateHovered,
    stateHovered,
    visibleProp,
}) {
    const { width, height, divRef } = useResize();

    const renderDonut = (visible, name, count) => {
        const trajectory = trajectories[name];
        const { chunks } = trajectory.simplifiedSequence;

        // get list of currently visible chunk IDs
        const visibleIDs = visible
            .filter((d) => d.dataType === CHUNK)
            .sort((a, b) => a.timestep - b.timestep)
            .map((d) => d.id);

        const simMatrix = trajectory.calculateChunkSimilarities(visibleIDs);

        const arcs = d3
            .pie()
            .value((d) => d.size)
            .sort((a, b) => a.timestep - b.timestep)
            .padAngle(0.001)(visible);

        const chunkArcs = arcs.filter((d) => d.data.dataType === CHUNK);
        const timestepArcs = arcs.filter((d) => d.data.dataType === TIMESTEP);

        // ensures that circle is correctly rendered
        d3.select(`#${name}`).selectAll('.arcs').remove();
        d3.select(`#${name}`).selectAll('.ribbon').remove();

        const chunkNodes = d3
            .select(`#${name}`)
            .selectAll('.arcs')
            .data(chunkArcs, (d) => d.id);

        chunkNodes
            .enter()
            .append('path')
            .attr(
                'd',
                d3
                    .arc()
                    .innerRadius(scaleR(count))
                    .outerRadius(scaleR(count) - 5)
            )
            .attr('fill', (d) => trajectory.colorByCluster(d.data))
            .on('mouseover', function (_, d) {
                onChunkMouseOver(this, d.data, name);
                setStateHovered({
                    caller: this,
                    stateID: d.data.id,
                    name,
                    timestep: d.data.timestep,
                });
            })
            .on('mouseout', () => {
                setStateHovered(null);
            })
            /* .on('click', (_, d) => {
                const newList = visible.filter((b) => d.data.id !== b.id);
                const childArray = d.data.getChildren();

                const newItems = trajectory.getItems(childArray);
                for (const i of newItems) {
                    newList.push(i);
                }
                renderDonut(newList, name, count);
            }) */
            .classed('arcs', true)
            .classed('chunk', true)
            .classed('importantChunk', (d) => d.data.important)
            .classed('unimportantChunk', (d) => !d.data.important);

        const timestepNodes = d3
            .select(`#${name}`)
            .selectAll('.arcs')
            .data(timestepArcs, (d) => d.data.id);

        console.log(timestepArcs);
        timestepNodes
            .enter()
            .append('path')
            .attr(
                'd',
                d3
                    .arc()
                    .innerRadius(scaleR(count))
                    .outerRadius(scaleR(count) - 10)
            )
            .on('mouseover', function (_, d) {
                onStateMouseOver(this, d.data.id, trajectory, name);
                setStateHovered({
                    caller: this,
                    stateID: d.data.id,
                    name,
                    timestep: d.data.timestep,
                });
            })
            .on('mouseout', function () {
                setStateHovered(null);
            })
            .attr('fill', (d) => d.data.individualColor)
            .classed('arcs', true)
            .classed('clickable', true)
            .classed('state', true);

        const chords = [];
        for (let i = 0; i < chunkArcs.length; i++) {
            const d = chunkArcs[i];
            const row = simMatrix[i];
            const v = Math.max(...row);
            const j = row.indexOf(v);
            const dj = chunkArcs[j];

            if (v > 0) {
                const chord = {
                    source: {
                        startAngle: d.startAngle,
                        endAngle: d.endAngle, // startAngle + (sourceArea / 4) * d.hits,
                        id: d.data.id,
                    },
                    target: {
                        startAngle: dj.startAngle,
                        endAngle: dj.endAngle, // startAngle + (targetArea / 4) * d.hits,
                        id: dj.data.id,
                    },
                    value: v,
                };
                chords.push(chord);
            }
        }
        const ribbons = d3.select(`#${name}`).append('g').selectAll('.ribbon').data(chords);
        ribbons
            .enter()
            .append('path')
            .attr('d', d3.ribbon().radius(scaleR(count) - 5))
            .attr('opacity', (d) => d.value)
            .on('mouseover', function (_, d) {
                const c = chunks.get(d.source.id);
                setStateHovered({
                    caller: this,
                    stateid: d.source.id,
                    name,
                    timestep: c.timestep,
                });

                d3.selectAll('.arcs')
                    .filter((ad) => d.source.id === ad.data.id || d.target.id === ad.data.id)
                    .classed('highlightedState', true);
            })
            .on('mouseout', function () {
                d3.selectAll('.ribbon,.highlightedState').classed('highlightedState', false);
                setStateHovered(null);
            })
            .classed('ribbon', true)
            .attr('fill', 'red');
    };

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }

            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            const container = svg
                .append('g')
                .attr('id', 'container')
                .attr('transform', 'translate(0,0)');

            const trajectoriesGroup = container
                .append('g')
                .attr('transform', `translate(${width / 2}, ${height / 2})`);

            scaleR = d3
                .scaleRadial()
                .range([height / 3, height / 2]) // from center of chart to top
                .domain([0, Object.keys(trajectories).length]);

            let count = 0;
            const sortedTraj = getLengthList(trajectories);

            for (const st of sortedTraj) {
                const { name } = st;
                const trajectory = trajectories[name];
                trajectoriesGroup.append('g').attr('id', `${name}`); // group for this trajectory

                const { simplifiedSequence } = trajectory;
                const { chunks } = simplifiedSequence;
                // select all top level chunks from the chunk map
                const chunkList = Array.from(chunks.values()).filter(
                    (d) => d.parentID === undefined
                );

                // render the top level donut initially
                renderDonut(chunkList, name, count);

                count++;
            }

            zoom = d3.zoom().on('zoom', (e) => {
                container.attr('transform', e.transform);
            });

            svg.call(zoom);
        },
        [width, height, trajectories]
    );

    useEffect(() => {
        if (stateHovered) {
            d3.select(ref.current)
                .selectAll('.arcs')
                .filter((d) => d.data.id === stateHovered.stateID)
                .classed('highlightedState', true);

            const ribbons = d3
                .select(ref.current)
                .selectAll('.ribbon')
                .filter(
                    (d) =>
                        d.target.id === stateHovered.stateID || d.source.id === stateHovered.stateID
                )
                .classed('highlightedState', true)
                .attr('opacity', 1);

            /* tooltip(
                    this,
                    `${chunks.get(d.source.id).toString()} 
                     <br>
                     ${chunks.get(d.target.id).toString()} 
                     <br> <b>Similarity score:</b> ${d.value}`
                ); */

            d3.select(ref.current).selectAll('.ribbon:not(.highlightedState').attr('opacity', 0.1);
        } else {
            d3.select(ref.current)
                .selectAll('.ribbon')
                .attr('opacity', (d) => d.value);

            d3.select(ref.current)
                .selectAll('.highlightedState')
                .classed('highlightedState', false);
        }
    }, [stateHovered]);

    useEffect(() => {
        if (visibleProp) {
            let count = 0;
            for (const [name, vis] of Object.entries(visibleProp)) {
                let { sequence, chunkList, extent } = vis;
                chunkList = chunkList.filter((d) => withinExtent(d, extent));
                sequence = sequence.filter((d) => withinExtent(d, extent));

                renderDonut([...sequence, ...chunkList], name, count);
                count++;
            }
        }
    }, [visibleProp]);

    return (
        <Box ref={divRef} sx={sx}>
            <svg className="vis" id="circularSequence" ref={ref} viewBox={[0, 0, width, height]} />
        </Box>
    );
    // preserveAspectRatio="none"
}
