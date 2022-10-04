import React from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export default function LoadingBox({ children, fillContainer }) {
    const flexGrow = fillContainer ? 1 : 0;
    return (
        <Box
            sx={{
                display: 'flex',
                flexGrow,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <CircularProgress color="primary" />
            {children}
        </Box>
    );
}

LoadingBox.defaultProps = {
    fillContainer: true,
};
