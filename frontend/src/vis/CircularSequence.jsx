import { React, useEffect, useState } from 'react';
import * as d3 from 'd3';

import Box from '@mui/material/Box';

import '../css/vis.css';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useResize } from '../hooks/useResize';
import usePrevious from '../hooks/usePrevious';
import { getLengthList, onStateMouseOver, tooltip, withinExtent } from '../api/myutils';
// import GlobalChunks from '../api/globalChunks';

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
    const [ribbonsHovered, setRibbonsHovered] = useState([]);
    const [instance, setInstance] = useState([]);
    const prevInstance = usePrevious(instance);

    // globalChunks is an object that contains a list of currently rendered chunks along with their trajectory name

    /*    const renderSimilarities = (globalChunks, trajs) => {
        // get chunk from corresponding trajectory?
        const names = Object.keys(trajs);
        const visibleIDs = globalChunks.map((d) => d.id);
        if (names.length > 1) {
            for (let i = 0; i < names.length; i++) {
                for (let j = i + 1; j < names.length; j++) {
                    const simMatrix = GlobalChunks.calculateChunkSimilarities(visibleIDs);
                    console.log(simMatrix);
                }
            }
        }
        console.log(globalChunks);
    }; */

    const renderDonut = (visible, name, count) => {
        const trajectory = trajectories[name];

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
        d3.select(`#circle_${name}`).selectAll('.arcs').remove();
        d3.select(`#circle_${name}`).selectAll('.ribbon').remove();

        const chunkNodes = d3
            .select(`#circle_${name}`)
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
            .attr('data-tippy-content', (d) => d.data.toString())
            .classed('arcs', true)
            .classed('chunk', true)
            .classed(name, true)
            .classed('important', (d) => d.data.important)
            .classed('unimportant', (d) => !d.data.important);

        const timestepNodes = d3
            .select(`#circle_${name}`)
            .selectAll('.arcs')
            .data(timestepArcs, (d) => d.data.id);

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
            .classed(name, true)
            .classed('clickable', true)
            .classed('timestep', true);

        const chords = [];
        let arcIndex = 0;
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
                    id: arcIndex++,
                };
                chords.push(chord);
            }
        }
        const ribbons = d3.select(`#circle_${name}`).selectAll('.ribbon').data(chords);
        ribbons
            .enter()
            .append('path')
            .attr('d', d3.ribbon().radius(scaleR(count) - 5))
            .attr('opacity', (d) => d.value)
            .on('mouseover', function (_, d) {
                setRibbonsHovered([d]);
            })
            .on('mouseout', function () {
                setRibbonsHovered([]);
            })
            .attr('data-tippy-content', (d) => `<b>Similarity score:</b> ${d.value.toFixed(2)}`)
            .classed('ribbon', true)
            .attr('fill', 'red');

        return chunkArcs;
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

            // full list of chunks, this will render the similarities between intra-cluster chunks
            let globalChunks = [];
            for (const st of sortedTraj) {
                const { name } = st;
                const trajectory = trajectories[name];
                trajectoriesGroup.append('g').attr('id', `circle_${name}`); // group for this trajectory
                const { chunks } = trajectory;
                const chunkList = Array.from(chunks.values()).filter(
                    (d) => d.parentID === undefined
                );

                renderDonut(chunkList, name, count);
                globalChunks = [{ name, data: chunkList }, ...globalChunks];
                count++;
            }

            // start here
            // renderSimilarities(globalChunks, trajectories);

            zoom = d3.zoom().on('zoom', (e) => {
                container.attr('transform', e.transform);
            });

            svg.call(zoom);
        },
        [width, height, trajectories]
    );

    useEffect(() => {
        if (stateHovered) {
            const arcs = d3
                .select(ref.current)
                .selectAll(`.arcs`)
                .filter((d) => d.data.id === stateHovered.stateID)
                .classed('highlightedState', true);

            setInstance(tooltip([...arcs]));
            const ribbons = d3
                .select(ref.current)
                .selectAll('.ribbon')
                .filter(
                    (d) =>
                        d.target.id === stateHovered.stateID || d.source.id === stateHovered.stateID
                )
                .data();

            if (ribbons.length > 0) {
                setRibbonsHovered(ribbons);
            }
        } else {
            setRibbonsHovered([]);
            d3.select(ref.current)
                .selectAll('.highlightedState')
                .classed('highlightedState', false);
        }
    }, [stateHovered]);

    useEffect(() => {
        if (ribbonsHovered.length > 0) {
            const sourceList = ribbonsHovered.map((d) => d.source.id);
            const targetList = ribbonsHovered.map((d) => d.target.id);
            const ribbonIDs = ribbonsHovered.map((d) => d.id);
            const arcs = d3
                .selectAll('.arcs')
                .filter((ad) => sourceList.includes(ad.data.id) || targetList.includes(ad.data.id))
                .classed('highlightedState', true);

            const nodes = d3
                .selectAll('.ribbon')
                .filter((d) => ribbonIDs.includes(d.id))
                .classed('highlightedState', true)
                .attr('opacity', 1)
                .nodes();

            setInstance((previous) => [...previous, ...tooltip([...arcs, ...nodes])]);
            d3.select(ref.current).selectAll('.ribbon:not(.highlightedState').attr('opacity', 0.1);
        } else {
            setInstance(null);
            d3.select(ref.current)
                .selectAll('.ribbon')
                .attr('opacity', (d) => d.value);

            d3.select(ref.current)
                .selectAll('.arc,.highlightedState')
                .classed('highlightedState', false);
        }
    }, [ribbonsHovered]);

    useEffect(() => {
        if (instance == null) {
            if (prevInstance) prevInstance.forEach((i) => i.hide());
        } else {
            instance.forEach((i) => i.show());
        }
    }, [instance]);

    useEffect(() => {
        if (visibleProp) {
            let count = 0;
            for (const [name, vis] of Object.entries(visibleProp)) {
                let { sequence, chunkList } = vis;
                const { extent } = vis;
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
