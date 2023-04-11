import { React, memo, useMemo, useEffect } from 'react';

import * as d3 from 'd3';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { distributionDict } from '../api/myutils';

/**
 * State Space Chart; divides the sequence inside a Chunk into even segments
 * and calculates the most frequently occurring states within each segment.
 * States are then rendered as rectangles colored according to ID.
 * Segments with many states are likely to be unstable, while
 * segments with few states are likely to be stable.
 *
 * TODO: Rename to State Space Chart.
 * @param {Array<Number>} xAttributeList - The x values of the sequence.
 * @param {Array<Number>} yAttributeList - The y values of the sequence.
 * @param {Function} colorFunc - Function to color states with.
 * @param {Function} onElementClick - Function called when elements are clicked.
 */
function AggregateScatterplot({
    xAttributeList,
    yAttributeList,
    width,
    height,
    colorFunc = () => 'black',
    margin = { top: 0, bottom: 4, left: 0, right: 0 },
    onElementClick = () => {},
}) {
    const data = useMemo(() => {
        const chunkSize = yAttributeList.length / 10;
        const chunks = [];

        for (let i = 0; i < yAttributeList.length; i += chunkSize) {
            // divide chunk into pieces
            const chunk = yAttributeList.slice(i, i + chunkSize);
            // get distributions of states within each chunk
            const dist = distributionDict(chunk);

            // get the expected distribution value (1 / # of unique states)
            const uniqueStates = [...new Set(chunk)];
            const threshold = 1 / uniqueStates.length;

            // compare actual vs expected distribution
            const majority = [];
            for (const [e, v] of Object.entries(dist)) {
                if (v > threshold) {
                    majority.push(e);
                }
            }
            chunks.push(majority.sort());
        }

        return chunks;
    }, [xAttributeList.length, yAttributeList.length]);

    const ref = useTrajectoryChartRender(
        (svg) => {
            if (!svg.empty()) {
                svg.selectAll('*').remove();
            }

            if (!data) {
                return;
            }

            const scaleX = d3
                .scaleLinear()
                .domain([0, data.length - 1])
                .range([margin.left, width - margin.right]);

            for (let i = 0; i < data.length; i++) {
                const g = svg.append('g');
                const chunk = data[i];

                const uniqueStates = [...new Set(chunk)];

                const scaleY = d3
                    .scaleBand()
                    .domain(uniqueStates)
                    .range([height - margin.bottom, margin.top]);

                g.selectAll('rect')
                    .data(chunk)
                    .enter()
                    .append('rect')
                    .attr('x', scaleX(i))
                    .attr('y', (d) => scaleY(d))
                    .attr('width', scaleX(i + 1) - scaleX(i))
                    .attr('height', scaleY.bandwidth())
                    .attr('fill', (d) => colorFunc(d))
                    .on('click', function (_, d) {
                        onElementClick(this, d);
                    })
                    .classed('state', true)
                    .classed('fullOpacity', true)
                    .classed('clickable', true);
            }
        },
        [xAttributeList.length, yAttributeList.length, width, height]
    );

    useEffect(() => {
        if (ref.current) {
            d3.select(ref.current)
                .selectAll('rect')
                .attr('fill', (d) => colorFunc(d));
        }
    }, [ref, colorFunc]);

    return (
        <svg
            ref={ref}
            className="vis"
            viewBox={[0, 0, width, height]}
            width={width}
            height={height}
        />
    );
}

export default memo(AggregateScatterplot);
