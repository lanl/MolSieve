import { React, createRef, useState } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';

/* This component is intended to allow embedding svgs within svgs as React components */
export default function EmbeddedChart({ children, height, width, margin }) {
    const ref = createRef();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Box
            ref={ref}
            component={Paper}
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
        bottom: 5,
        left: 5,
        right: 5,
    },
};
