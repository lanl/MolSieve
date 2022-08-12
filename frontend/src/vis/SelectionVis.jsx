import { React, memo, useEffect } from 'react';
import Box from '@mui/material/Box';
import * as d3 from 'd3';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useResize } from '../hooks/useResize';
import { onStateMouseOver } from '../api/myutils';
import GlobalStates from '../api/globalStates';
import '../css/vis.css';

const margin = {
    top: 20,
    bottom: 20,
    left: 40,
    right: 25,
};

let scaleX = null;
let scaleY = null;

function SelectionVis({
    trajectories,
    extents,
    loadingCallback,
    style,
    titleProp,
    sequenceExtent,
    maxStates,
    setStateClicked,
    setStateHovered,
}) {
    const { width, height, divRef } = useResize(10, maxStates);

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (height === undefined || width === undefined) {
                return;
            }

            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            let stateExtents = [];
            const trajToDraw = new Set();
            const statesSeen = new Set();
            for (const ex of extents) {
                for (const e of ex.states) {
                    statesSeen.add(e.id);
                }
            }

            if (statesSeen.size > 0) {
                for (const id of statesSeen) {
                    const state = GlobalStates.get(id);
                    for (const seen of state.seenIn) {
                        const traj = trajectories[seen];
                        const timesteps = traj.idToTimestep.get(id);
                        trajToDraw.add(seen);
                        // show first, and if it exists, last occurrence of timestep
                        timesteps.sort(function (a, b) {
                            return a - b;
                        });

                        const newEx = {
                            name: `${seen}`,
                            begin: timesteps[0],
                            end: timesteps.slice(-1),
                            id,
                        };
                        stateExtents = [...stateExtents, newEx];
                    }
                }
            }

            const trajToDrawArr = Array.from(trajToDraw);

            const groupedExtents = d3.group(extents, (d) => d.name);
            const maxLength = d3.max(Object.values(trajectories), (t) => t.sequence.length);

            scaleX = d3
                .scaleLinear()
                .range([margin.left, width - margin.right])
                .domain([0, maxLength]);

            scaleY = d3
                .scaleOrdinal()
                .range([margin.top + 10, height - margin.bottom])
                .domain(trajToDrawArr);

            // stores the rectangle that gets drawn when the view moves
            svg.append('g').attr('id', 'extentGroup');

            const trajWidth = 10 * maxStates;

            const extentScale = d3
                .scaleLinear()
                .range([2, trajWidth])
                .domain([0, stateExtents.length]);

            const g = svg.append('g');
            const s = svg.append('g');
            const ig = svg.append('g');

            ig.selectAll('rect')
                .data(trajToDrawArr)
                .enter()
                .append('rect')
                .attr('x', scaleX(0))
                .attr('y', (d) => scaleY(d))
                .attr('width', (d) => scaleX(trajectories[d].sequence.length) - scaleX(0))
                .attr('height', trajWidth)
                .attr('fill', 'none')
                .attr('stroke', 'lightgray');

            const colors = d3.schemeDark2;

            const ensureMinLength = function (d) {
                if (scaleX(d.end) - scaleX(d.begin) < 10) {
                    return scaleX(d.end) + 10;
                }
                return scaleX(d.end);
            };

            g.selectAll('line')
                .data(stateExtents)
                .enter()
                .append('line')
                .attr('x1', (d) => scaleX(d.begin))
                .attr('x2', (d) => ensureMinLength(d))
                .attr('y1', (d, i) => scaleY(d.name) + extentScale(i))
                .attr('y2', function (d, i) {
                    return scaleY(d.name) + extentScale(i);
                })
                .attr('stroke-linecap', 'round')
                .attr('stroke-width', 3)
                .attr('stroke', function (d) {
                    return colors[d.id % colors.length];
                })
                .on('mouseover', function (_, d) {
                    const state = GlobalStates.get(d.id);
                    const traj = trajectories[state.seenIn[0]];
                    const timesteps = traj.idToTimestep.get(d.id);
                    if (timesteps.length === 1) {
                        setStateHovered({
                            caller: this,
                            stateID: d.id,
                            name: d.name,
                            timestep: timesteps[0],
                        });
                    } else {
                        setStateHovered({
                            caller: this,
                            stateID: d.id,
                            name: d.name,
                            timesteps,
                        });
                    }

                    onStateMouseOver(this, state, trajectories[d.name], d.name);
                })
                .on('click', function (_, d) {
                    setStateClicked(GlobalStates.get(d.id));
                })
                .classed('clickable', true);

            for (const extentArray of groupedExtents.values()) {
                // only render sequence selections
                s.selectAll('line')
                    .data(extentArray)
                    .enter()
                    .append('line')
                    .attr('x1', (d) => scaleX(d.begin))
                    .attr('x2', (d) => ensureMinLength(d))
                    .attr('y1', (d) => scaleY(d.name) - 10)
                    .attr('y2', (d) => scaleY(d.name) - 10)
                    .attr('stroke', 'black');
            }
            let title = null;

            if (titleProp === null || titleProp === undefined) {
                title = `${name} `;
                for (const extent of extents) {
                    title += `${extent.begin} - ${extent.end} `;
                }
            } else {
                title = titleProp;
            }

            svg.append('text')
                .attr('x', width / 2)
                .attr('y', margin.top)
                .attr('text-anchor', 'middle')
                .style('font-size', '12px')
                .text(title);

            if (loadingCallback !== undefined) {
                loadingCallback();
            }
        },
        [width, height, trajectories]
    );

    useEffect(() => {
        if (sequenceExtent && scaleX && scaleY) {
            const g = d3.select(ref.current).select('#extentGroup');
            g.selectAll('rect').remove();
            g.append('rect')
                .attr('x', scaleX(sequenceExtent[0]))
                .attr('y', 0)
                .attr('width', scaleX(sequenceExtent[1]) - scaleX(sequenceExtent[0]))
                .attr('height', height)
                .attr('fill', 'none')
                .attr('stroke', 'gray');
        }
    }, [sequenceExtent]);

    return (
        <Box ref={divRef} sx={style.sx}>
            {width && height && (
                <svg ref={ref} preserveAspectRatio="none" viewBox={[0, 0, width, height]} />
            )}
        </Box>
    );
}
// no need to re-render
export default memo(SelectionVis);
