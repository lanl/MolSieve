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
}) {
    const ref = createRef();
    const [isHovered, setIsHovered] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);

    // setSelectionMode(!selectionMode);
    useEffect(() => {
        if (ref.current && brush !== undefined) {
            const svg = d3.select(ref.current);
            if (selectionMode) {
                // is there a way to tell that the brush finished?
                // need to call setSelection(!selectionMode) once they're done
                svg.append('g').classed('brush', true).call(brush);
            } else {
                svg.selectAll('.brush').remove();
            }
        }
    }, [selectionMode]);

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
                zIndex={999999}
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
