import { React } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';

import DisabledByDefaultIcon from '@mui/icons-material/DisabledByDefault';

/* eslint-disable react/jsx-props-no-spreading */
/**
 * Box with button which removes it.
 * TODO: disabled does not do anything
 * @param {Object} toolbar - Array of JSX elements to put alongside the deletion button.
 * @param {Function} deleteFunc - Function to call when the button is pressed.
 */
function RemovableBox({
    children,
    disabled = false,
    sx = {},
    toolbar = [],
    deleteFunc = () => {},
    ...props
}) {
    return (
        <Box component={Paper} sx={{ sx }} disabled={disabled} {...props}>
            <Box display="flex" direction="row">
                <Tooltip title="Remove selection" arrow>
                    <IconButton color="secondary" onClick={deleteFunc}>
                        <DisabledByDefaultIcon />
                    </IconButton>
                </Tooltip>
                {toolbar}
            </Box>
            <Divider />
            {children}
        </Box>
    );
}

export default RemovableBox;
