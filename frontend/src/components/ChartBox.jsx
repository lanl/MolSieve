import React from 'react';
import Box from '@mui/material/Box';
import { useHover } from '../hooks/useHover';
import { useResize } from '../hooks/useResize';

export default function ChartBox({ children, sx }) {
    const { width, height, divRef } = useResize();
    const isHovered = useHover(divRef);

    return (
        <Box sx={sx} ref={divRef}>
            {children(width, height, isHovered)}
        </Box>
    );
}
