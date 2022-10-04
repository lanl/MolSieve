import { React, createRef, useState } from 'react';

import Box from '@mui/material/Box';

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
}) {
    const ref = createRef();
    const [isHovered, setIsHovered] = useState(false);

    const borderStyle = selected ? 'dashed' : 'solid';
    return (
        <Box
            ref={ref}
            sx={{ display: 'flex', borderStyle }}
            border={1}
            borderColor={color}
            width={width - margin.left}
            height={height - margin.top}
            onClick={() => onChartClick()}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {children(width, height, isHovered)}
        </Box>
    );
}

EmbeddedChart.defaultProps = {
    margin: {
        top: 2.5,
        left: 0,
    },
    color: 'black',
};
