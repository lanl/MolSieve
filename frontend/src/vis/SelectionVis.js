import {
 React, useEffect, useState, useRef,
} from 'react';
import Box from '@mui/material/Box';
import * as d3 from 'd3';
import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';

// import tippy from "tippy.js";
// import "tippy.js/dist/tippy.css";

const margin = {
 top: 20, bottom: 20, left: 40, right: 25,
};

function SelectionVis({ data, loadingCallback }) {
    const divRef = useRef();
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

    const resize = () => {
        const newWidth = divRef.current.parentElement.clientWidth;
        setWidth(newWidth);

        const newHeight = divRef.current.parentElement.clientHeight;
        setHeight(newHeight);
    };

    useEffect(() => {
        resize();
    }, [data]);

    useEffect(() => {
        window.addEventListener('resize', resize());
    }, []);

    const ref = useTrajectoryChartRender((svg) => {
        if (height === undefined || width === undefined) {
            return;
        }

        if (!svg.empty()) {
            svg.selectAll('*').remove();
        }

        const extents = Object.values(data.extents);

        const { sequence } = data;
        const { run } = data;
        const { colors } = data;
        const { currentClustering } = data;        

        const scaleX = d3
            .scaleLinear()
            .range([margin.left, width - margin.right])
            .domain([0, sequence.length]);

        svg.selectAll('rect')
            .data(sequence)
            .enter()
            .append('rect')
            .attr('x', (_, i) => scaleX(i))
            .attr('y', height * 0.2 + 5)
            .attr('width', 5)
            .attr('height', 10)
            .attr('fill', (d) => {
                return colors[currentClustering[d]];
            });

        svg.selectAll('rect')
            .filter((_, i) => {
                for (const extent of extents) {
                    if (
                        i >= extent.begin
                        && i <= extent.end
                    ) {
                        return true;
                    }
                }
                return false;
            })
            .attr('height', 20)
            .attr('y', height * 0.2);

        let title = `${run} `;

        for (const extent of extents) {
            title += `${extent.begin} - ${extent.end} `;
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
    });

    return (
      <Box ref={divRef}>
        {width && height && (
        <svg ref={ref} viewBox={[0, 0, width, height]} />
            )}
      </Box>
    );
}

export default SelectionVis;
