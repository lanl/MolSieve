import { React, useState, useEffect, memo } from 'react';

import * as d3 from 'd3';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { distributionDict } from '../api/myutils';

function AggregateScatterplot({
    xAttributeList,
    yAttributeList,
    width,
    height,
    colorFunc = () => 'black',
    margin = { top: 0, bottom: 3, left: 0, right: 0 },
    onElementClick = () => {},
}) {
    const [data, setData] = useState(null);

    useEffect(() => {
        const chunkSize = yAttributeList.length / 10;
        const chunks = [];

        for (let i = 0; i < yAttributeList.length; i += chunkSize) {
            const chunk = yAttributeList.slice(i, i + chunkSize);
            const dist = distributionDict(chunk);

            const uniqueStates = [...new Set(chunk)];
            const threshold = 1 / uniqueStates.length;

            const majority = [];
            for (const e of Object.keys(dist)) {
                if (dist[e] > threshold) {
                    majority.push(parseInt(e, 10));
                }
            }
            chunks.push(majority.sort());
        }

        setData(chunks);
    }, [JSON.stringify(xAttributeList), JSON.stringify(yAttributeList)]);

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
        [JSON.stringify(data), width, height, colorFunc]
    );
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
