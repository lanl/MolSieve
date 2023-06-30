import React from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * Neatly organized Box containing a loading indicator.
 *
 */
export default function LoadingBox({ children, sx, color }) {
    return (
        <Box sx={sx}>
            <CircularProgress color={color} />
            {children}
        </Box>
    );
}

LoadingBox.defaultProps = {
    sx: {
        display: 'flex',
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    color: 'primary',
};
