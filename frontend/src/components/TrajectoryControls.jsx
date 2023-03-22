import { React, useState } from 'react';
import { useSelector } from 'react-redux';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import '../css/App.css';

export default function TrajectoryControls({ name, simplifySet, recalculateClustering, sx }) {
    const initThreshold = useSelector((state) => state.trajectories.values[name].chunkingThreshold);
    const initClustering = useSelector(
        (state) => state.trajectories.values[name].currentClustering
    );
    const [chunkingThreshold, setChunkingThreshold] = useState(initThreshold);
    const [currentClustering, setCurrentClustering] = useState(initClustering);

    return (
        <Box sx={sx} className="hideUntilHoverTrigger">
            <Typography>{name.toUpperCase()}</Typography>
            <Box sx={{ m: 2 }} />
            <Box gap={2} className="hideUntilHover">
                <Typography>PCCA clusters</Typography>
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
            <Box sx={{ m: 2 }} />
            <Box className="hideUntilHover">
                <Typography>Simplification Threshold</Typography>
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
        </Box>
    );
}
