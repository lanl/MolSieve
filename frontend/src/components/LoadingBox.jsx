import React from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export default function LoadingBox({ children, sx }) {
    return (
        <Box sx={sx}>
            <CircularProgress color="primary" />
            {children}
        </Box>
    );
}

LoadingBox.defaultProps = {
    fillContainer: true,
    sx: {
        display: 'flex',
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
};
