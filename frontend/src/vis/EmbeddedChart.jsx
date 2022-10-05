import { React, createRef, useState } from 'react';

import Box from '@mui/material/Box';
import '../css/App.css';
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
}) {
    const ref = createRef();
    const [isHovered, setIsHovered] = useState(false);

    const borderStyle = selected ? 3 : 1;
    return (
        <Box
            ref={ref}
            sx={{ display: 'flex' }}
            className="embeddedChart"
            border={borderStyle}
            borderColor={color}
            width={width - margin.left}
            height={height - margin.top}
            onClick={() => onChartClick()}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            id={id}
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
