import { React, useState } from 'react';
import Box from '@mui/material/Box';
import { useResize } from '../hooks/useResize';

export default function ChartBox({ children, sx }) {
    const { width, height, divRef } = useResize();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Box
            sx={sx}
            ref={divRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {children(width, height, isHovered)}
        </Box>
    );
}
