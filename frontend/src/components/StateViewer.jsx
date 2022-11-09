import { React, useEffect, useState, useRef } from 'react';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import GlobalStates from '../api/globalStates';
import WebSocketManager from '../api/websocketmanager';
import ImageViewer from './ImageViewer';

export default function StateViewer({ selection }) {
    const [progress, setProgress] = useState(0.0);
    const [loaded, setLoaded] = useState({});
    const [sequenceIdx, setSequenceIdx] = useState(0);
    const [img, setImg] = useState(undefined);

    const ws = useRef(null);

    const render = (d) => {
        setLoaded((prevState) => ({ ...prevState, [d.id]: d.img }));
    };

    useEffect(() => {
        setImg(loaded[selection[sequenceIdx]]);
    }, [sequenceIdx, loaded, selection]);

    const runSocket = () => {
        ws.current = WebSocketManager.connect(
            'ws://localhost:8000/api/generate_ovito_images',
            'selections'
        );

        let i = 0;
        const total = [...new Set(selection)].length;

        ws.current.addEventListener('open', () => {
            ws.current.send(JSON.stringify(selection));
        });

        ws.current.addEventListener('message', (e) => {
            const d = JSON.parse(e.data);
            GlobalStates.addPropToState(d);
            render(d);
            i++;
            setProgress(i / total);
        });
    };

    useEffect(() => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        // check if we haven't already computed the img for the selection
        if (!GlobalStates.subsetHasProperty('img', selection)) {
            runSocket();
        } else {
            setProgress(1.0);
        }

        return () => {
            if (ws.current) {
                ws.current.close();
                ws.current = null;
            }
        };
    }, [selection]);

    return (
        <Box>
            {progress < 1.0 ? (
                <LinearProgress color="primary" variant="determinate" value={progress * 100} />
            ) : null}
            <ImageViewer img={img} />
            <Box>
                <IconButton
                    onClick={() => setSequenceIdx((prev) => prev - 1)}
                    disabled={sequenceIdx - 1 < 0}
                >
                    <ArrowBackIcon />
                </IconButton>
                <IconButton
                    onClick={() => setSequenceIdx((prev) => prev + 1)}
                    disabled={sequenceIdx + 1 > selection.length - 1}
                >
                    <ArrowForwardIcon />
                </IconButton>
            </Box>
        </Box>
    );
}
