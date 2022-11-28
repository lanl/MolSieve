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
    withBrush,
    onSelectionComplete,
}) {
    const ref = createRef();
    const [isHovered, setIsHovered] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);

    const finishBrush = ({ selection }) => {
        const [start, end] = selection;
        onSelectionComplete({ start: Math.round(start), end: Math.round(end) });
        setSelectionMode(!selectionMode);
    };

    useEffect(() => {
        if (ref.current) {
            const svg = d3.select(ref.current);
            if (selectionMode) {
                svg.append('g').classed('brush', true).call(d3.brushX().on('end', finishBrush));
            } else {
                svg.selectAll('.brush').remove();
            }
        }
    }, [selectionMode]);

    const borderStyle = selected ? 3 : 1;
    return (
        <svg ref={ref} width={width} height={height}>
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
                    {withBrush ? (
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

                    {children(width, height, isHovered)}
                </Box>
            </foreignObject>
        </svg>
    );
}
/*
 */
EmbeddedChart.defaultProps = {
    margin: {
        top: 2.5,
        left: 0,
    },
    color: 'black',
    withBrush: false,
};
