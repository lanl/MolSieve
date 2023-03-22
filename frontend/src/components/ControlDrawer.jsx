import { React } from 'react';

import Toolbar from '@mui/material/Toolbar';

import Drawer from '@mui/material/Drawer';

import IconButton from '@mui/material/IconButton';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Container from '@mui/material/Container';
import TrajectoryControls from './TrajectoryControls';

// import FilterComponent from './FilterComponent';

function ControlDrawer({
    trajectoryNames,
    recalculateClustering,
    simplifySet,
    drawerOpen,
    toggleDrawer,
    sx,
}) {
    // we want persistent because it doesn't draw a backdrop & its state is saved between opening and closing it
    return (
        <Drawer
            anchor="right"
            variant="persistent"
            open={drawerOpen}
            onClose={() => toggleDrawer()}
            sx={sx}
        >
            <Toolbar
                variant="dense"
                sx={{ fontColor: '#394043', boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
            >
                <IconButton onClick={() => toggleDrawer()}>
                    <ChevronRightIcon />
                </IconButton>
            </Toolbar>
            <Container maxWidth="xs">
                {trajectoryNames.map((name) => (
                    <TrajectoryControls
                        name={name}
                        simplifySet={simplifySet}
                        recalculateClustering={recalculateClustering}
                    />
                ))}
            </Container>
        </Drawer>
    );
}

export default ControlDrawer;
