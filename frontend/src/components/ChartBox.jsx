import { React } from 'react';
import Box from '@mui/material/Box';
import { useResize } from '../hooks/useResize';

export default function ChartBox({ children, sx }) {
    const { width, height, divRef } = useResize();

    return (
        <Box sx={sx} ref={divRef}>
            {children(width, height)}
        </Box>
    );
}
