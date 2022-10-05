import { React, useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import QQPlot from '../vis/QQPlot';
import GlobalStates from '../api/globalStates';
import ChartBox from '../components/ChartBox';
import LoadingBox from '../components/LoadingBox';

export default function ChunkComparisonView({ chunk1, chunk2, property }) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [dist1, setDist1] = useState(null);
    const [dist2, setDist2] = useState(null);

    useEffect(() => {
        GlobalStates.ensureSubsetHasProperty(property, chunk1.sequence).then(() => {
            GlobalStates.ensureSubsetHasProperty(property, chunk2.sequence).then(() => {
                const c1s = chunk1.sequence.map((id) => GlobalStates.get(id));
                const c2s = chunk2.sequence.map((id) => GlobalStates.get(id));

                const c1v = c1s.map((d) => d[property]);
                const c2v = c2s.map((d) => d[property]);

                setDist1(c1v);
                setDist2(c2v);
                setIsLoaded(true);
            });
        });
    }, [chunk1, chunk2, property]);
    return isLoaded ? (
        <Paper>
            <Typography>
                {chunk1.id} vs {chunk2.id}
            </Typography>
            <ChartBox>
                {(width, height) => (
                    <QQPlot dist1={dist1} dist2={dist2} width={width} height={height} />
                )}
            </ChartBox>
        </Paper>
    ) : (
        <LoadingBox />
    );
}
