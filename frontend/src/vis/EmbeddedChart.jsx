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
    controls,
}) {
    const ref = createRef();
    const [isHovered, setIsHovered] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);

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
        d3.select(ref.current).selectAll('.chartSelection').remove();

        if (selections) {
            for (const s of selections) {
                const { id: sID, brushValues } = s;
                const { start, end } = brushValues;
                d3.select(ref.current)
                    .append('rect')
                    .attr('x', start)
                    .attr('y', 0)
                    .attr('height', height)
                    .attr('width', end - start)
                    .attr('fill', 'none')
                    .attr('stroke', 'gray')
                    .attr('stroke-width', 1)
                    .classed(sID, true)
                    .classed('chartSelection', true);
            }
        }

        return () => {
            d3.select(ref.current).selectAll('.chartSelection').remove();
        };
    }, [JSON.stringify(selections), width, height]);

    const borderStyle = selected ? 3 : 2;
    const h = height - margin.top;
    const w = width - margin.left;
    return (
        <Box
            id={id}
            width={w}
            height={h}
            sx={{ display: 'flex' }}
            className="embeddedChart"
            border={borderStyle}
            borderColor={color}
            onClick={onChartClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Box className="floatingToolBar" sx={{ visibility: isHovered ? 'visible' : 'hidden' }}>
                {brush !== undefined ? (
                    <IconButton
                        color="secondary"
                        size="small"
                        aria-label={selectionMode ? 'Clear Selection' : 'Start Selection'}
                        onClick={() => setSelectionMode(!selectionMode)}
                    >
                        {selectionMode ? <DeselectIcon /> : <HighlightAltIcon />}
                    </IconButton>
                ) : null}
                {controls}
            </Box>

            <svg ref={ref} width={w} height={h}>
                <foreignObject x={0} y={0} width={w} height={h}>
                    {children(w, h)}
                </foreignObject>
            </svg>
        </Box>
    );
}
EmbeddedChart.defaultProps = {
    margin: {
        top: 3,
        left: 3,
    },
    color: 'black',
    showBrush: true,
};
