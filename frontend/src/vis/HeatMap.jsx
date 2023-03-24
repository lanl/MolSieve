import { React, useMemo, memo } from 'react';
import * as d3 from 'd3';

import Skeleton from '@mui/material/Skeleton';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

function HeatMap({
    width,
    height,
    xList,
    yList,
    data,
    margin = { top: 0, bottom: 0, left: 0, right: 0 },
    onElementClick = () => {},
    onElementMouseOver = () => {},
    onElementMouseOut = () => {},
    colorRange = ['white', '#69b3a2'],
}) {
    const scaleX = useMemo(
        () =>
            d3
                .scaleBand([margin.left, width - margin.right])
                .domain(xList)
                .padding(0.01),
        [xList.length, width]
    );

    const scaleY = useMemo(
        () =>
            d3
                .scaleBand([height - margin.bottom, margin.top])
                .domain(yList)
                .padding(0.01),
        [yList.length, height]
    );

    const ref = useTrajectoryChartRender(
        (svg) => {
            svg.selectAll('*').remove();
            if (!xList || !yList || !data) {
                return;
            }

            // dict is id : id : value; extract all values
            const values = Object.keys(data)
                .map((id) => Object.values(data[id]))
                .flat();

            const colorScale = d3.scaleLinear().range(colorRange).domain(d3.extent(values));

            // pairs
            const pairs = xList
                .map((id) =>
                    yList.map((id2) => ({
                        id,
                        id2,
                        value: data[id][id2],
                    }))
                )
                .flat();

            svg.selectAll()
                .data(pairs)
                .enter()
                .append('rect')
                .attr('x', (d) => scaleX(d.id))
                .attr('y', (d) => scaleY(d.id2))
                .attr('width', scaleX.bandwidth())
                .attr('height', scaleY.bandwidth())
                .attr('fill', (d) => colorScale(d.value))
                .classed('clickable', true)
                .on('click', function (_, d) {
                    onElementClick(this, d);
                })
                .on('mouseover', function (_, d) {
                    onElementMouseOver(this, d);
                })
                .on('mouseout', function (_, d) {
                    onElementMouseOut(this, d);
                });
        },
        [JSON.stringify(data), width, height]
    );

    return !data ? (
        <Skeleton variant="rounded" width={width} height={height} />
    ) : (
        <svg
            ref={ref}
            className="vis"
            viewBox={[0, 0, width, height]}
            width={width}
            height={height}
        />
    );
}

export default memo(HeatMap);
