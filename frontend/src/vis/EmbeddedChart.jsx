import { React, createRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import '../css/App.css';

import IconButton from '@mui/material/IconButton';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import DeselectIcon from '@mui/icons-material/Deselect';
import * as d3 from 'd3';

/* This component is intended to allow embedding svgs within svgs as React components */
// essentially the same as a ChartBox, just with a border
export default function EmbeddedChart({
    children,
    height,
    width,
    margin,
    color,
    onChartClick,
    selected,
    id,
    brush,
    selections,
}) {
    const ref = createRef();
    const [isHovered, setIsHovered] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);

    // setSelectionMode(!selectionMode);
    useEffect(() => {
        if (ref.current && brush !== undefined) {
            const svg = d3.select(ref.current);
            if (selectionMode) {
                svg.append('g').classed('brush', true).call(brush);
            } else {
                svg.selectAll('.brush').remove();
            }
        }
    }, [selectionMode]);

    useEffect(() => {
        d3.select(ref.current).selectAll('.selection').remove();

        if (selections) {
            for (const s of selections) {
                const { active, originalExtent } = s;
                const { start: ogStart, end: ogEnd } = originalExtent;

                d3.select(ref.current)
                    .append('rect')
                    .attr('x', ogStart)
                    .attr('y', 0)
                    .attr('height', height)
                    .attr('width', ogEnd - ogStart)
                    .attr('fill', 'none')
                    .attr('stroke', () => (active ? 'blue' : 'red'))
                    .attr('stroke-width', 2)
                    .classed('selection', true);
            }
        }

        return () => {
            d3.select(ref.current).selectAll('.selection').remove();
        };
    }, [JSON.stringify(selections)]);

    // not the most elegant solution, but it works
    const borderStyle = selected ? 3 : 1;
    return (
        <foreignObject key={id} x={0} y={margin.top} width={width} height={height}>
            <Box
                id={id}
                width={width}
                height={height}
                sx={{ display: 'flex' }}
                className="embeddedChart"
                border={borderStyle}
                borderColor={color}
                onClick={() => onChartClick()}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {brush !== undefined ? (
                    <Box
                        className="floatingToolBar"
                        sx={{ visibility: isHovered ? 'visible' : 'hidden' }}
                    >
                        <IconButton
                            color="secondary"
                            size="small"
                            aria-label={selectionMode ? 'Clear Selection' : 'Start Selection'}
                            onClick={() => setSelectionMode(!selectionMode)}
                        >
                            {selectionMode ? <DeselectIcon /> : <HighlightAltIcon />}
                        </IconButton>
                    </Box>
                ) : null}
                <svg ref={ref} width={width} height={height}>
                    <foreignObject x={0} y={margin.top} width={width} height={height}>
                        {children(width, height, isHovered)}
                    </foreignObject>
                </svg>
            </Box>
        </foreignObject>
    );
}
EmbeddedChart.defaultProps = {
    margin: {
        top: 2.5,
        left: 0,
    },
    color: 'black',
    showBrush: true,
};
