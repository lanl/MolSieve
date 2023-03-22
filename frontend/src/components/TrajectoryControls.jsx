import { React, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import Slider from '@mui/material/Slider';
import '../css/App.css';
import IconButton from '@mui/material/IconButton';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import TuneIcon from '@mui/icons-material/Tune';
import { setZoom } from '../api/trajectories';

export default function TrajectoryControls({ name, simplifySet, recalculateClustering, sx }) {
    const initThreshold = useSelector((state) => state.trajectories.values[name].chunkingThreshold);
    const initClustering = useSelector(
        (state) => state.trajectories.values[name].currentClustering
    );
    const [chunkingThreshold, setChunkingThreshold] = useState(initThreshold);
    const [currentClustering, setCurrentClustering] = useState(initClustering);

    const [anchor, setAnchor] = useState(null);
    const open = Boolean(anchor);
    const dispatch = useDispatch();

    return (
        <Box sx={sx}>
            <Typography>{name.toUpperCase()}</Typography>
            <Tooltip title="Reset timeline to full length">
                <IconButton onClick={() => dispatch(setZoom({ name }))}>
                    <ZoomOutIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title="Configure trajectory parameters">
                <IconButton edge="start">
                    <TuneIcon onClick={(e) => setAnchor(e.currentTarget)} />
                </IconButton>
            </Tooltip>
            <Menu anchorEl={anchor} open={open} onClose={() => setAnchor(null)}>
                <MenuItem dense divider>
                    <Box gap={2} width="100%">
                        <Typography variant="body2" align="center">
                            PCCA clusters
                        </Typography>
                        <Slider
                            step={1}
                            min={2}
                            max={20}
                            onChangeCommitted={(_, v) => {
                                recalculateClustering(name, v).catch(() =>
                                    setCurrentClustering(initClustering)
                                );
                            }}
                            valueLabelDisplay="auto"
                            onChange={(e) => {
                                setCurrentClustering(e.target.value);
                            }}
                            value={currentClustering}
                            marks={[
                                { value: 2, label: '2' },
                                { value: 20, label: '20' },
                            ]}
                        />
                    </Box>
                </MenuItem>
                <MenuItem dense>
                    <Box gap={2} width="100%">
                        <Typography variant="body2" align="center">
                            Simplification threshold
                        </Typography>
                        <Slider
                            step={0.01}
                            min={0}
                            max={1}
                            onChangeCommitted={(_, v) => {
                                simplifySet(name, v);
                            }}
                            valueLabelDisplay="auto"
                            onChange={(e) => {
                                setChunkingThreshold(e.target.value);
                            }}
                            value={chunkingThreshold}
                            marks={[
                                { value: 0, label: '0%' },
                                { value: 1, label: '100%' },
                            ]}
                        />
                    </Box>
                </MenuItem>
            </Menu>
        </Box>
    );
}
