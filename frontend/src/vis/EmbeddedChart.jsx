import { React, createRef, useState } from 'react';

import Box from '@mui/material/Box';

/* This component is intended to allow embedding svgs within svgs as React components */
// essentially the same as a ChartBox, just with a border
export default function EmbeddedChart({ children, height, width, margin }) {
    const ref = createRef();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Box
            ref={ref}
            sx={{ display: 'flex' }}
            border={1}
            width={width - margin.left}
            height={height - margin.top}
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
};
