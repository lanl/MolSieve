import { React, createRef, useEffect } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';

/* This component is intended to allow embedding svgs within svgs as React components */
export default function EmbeddedChart({ children, height, width, margin }) {
    const ref = createRef();

    return (
        <Box
            ref={ref}
            component={Paper}
            border={1}
            width={width - margin.left}
            height={height - margin.top}
        >
            {children(width, height)}
        </Box>
    );
}

EmbeddedChart.defaultProps = {
    margin: {
        top: 5,
        bottom: 5,
        left: 5,
        right: 5,
    },
};
