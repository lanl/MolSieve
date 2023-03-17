import { React, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import Toolbar from '@mui/material/Toolbar';

import Drawer from '@mui/material/Drawer';

import IconButton from '@mui/material/IconButton';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Container from '@mui/material/Container';
import TrajectoryControls from './TrajectoryControls';

import ChartBox from './ChartBox';
// import FilterComponent from './FilterComponent';
import Timeline from '../vis/Timeline';

import { selectTrajectories } from '../api/trajectories';

function ControlDrawer({
    trajectoryNames,
    recalculateClustering,
    setZoom,
    simplifySet,
    drawerOpen,
    toggleDrawer,
    sx,
}) {
    const [runs, setRuns] = useState({});
    const trajectories = useSelector((state) => selectTrajectories(state));

    const updateRun = (name, property, value) => {
        const run = runs[name];
        run[property] = value;
        setRuns({ ...runs, [name]: run });
    };

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
                <ChartBox>
                    {(width) => {
                        // 50px per trajectory
                        const h = trajectoryNames.length * 50;
                        return trajectoryNames.map((name) => (
                            <Timeline
                                key={name}
                                width={width}
                                setZoom={setZoom}
                                height={h}
                                trajectoryName={name}
                            />
                        ));
                    }}
                </ChartBox>
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
