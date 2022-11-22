import { React, useEffect, useState, useRef } from 'react';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import GlobalStates from '../api/globalStates';
import WebSocketManager from '../api/websocketmanager';
import ImageViewer from './ImageViewer';

export default function StateViewer({ stateIDs, sx, activeState, setActiveState }) {
    const [progress, setProgress] = useState(0.0);
    const [loaded, setLoaded] = useState({});
    const [img, setImg] = useState(undefined);

    const ws = useRef(null);

    const render = (d) => {
        setLoaded((prevState) => ({ ...prevState, [d.id]: d.img }));
    };

    useEffect(() => {
        setImg(loaded[stateIDs[activeState.idx]]);
    }, [activeState.idx, loaded, stateIDs]);

    const runSocket = () => {
        ws.current = WebSocketManager.connect(
            'ws://localhost:8000/api/generate_ovito_images',
            'selections'
        );

        let i = 0;
        const total = [...new Set(stateIDs)].length;

        ws.current.addEventListener('open', () => {
            ws.current.send(JSON.stringify([...new Set(stateIDs)]));
        });

        ws.current.addEventListener('message', (e) => {
            const d = JSON.parse(e.data);
            GlobalStates.addPropToState(d);
            render(d);
            i++;
            setProgress(i / total);
            if (i === total) {
                ws.current.close();
                ws.current = null;
            }
        });
    };

    useEffect(() => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        // check if we haven't already computed the img for the selection
        if (!GlobalStates.subsetHasProperty('img', stateIDs)) {
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
    }, [JSON.stringify(stateIDs)]);

    useEffect(() => {
        if (progress === 1.0 && (!img || Object.keys(loaded).length === 0)) {
            const states = stateIDs.map((id) => GlobalStates.get(id));
            const imgDict = {};
            for (const state of states) {
                imgDict[state.id] = state.img;
            }
            setLoaded(imgDict);
        }
    }, [progress]);

    return (
        <Box sx={sx}>
            {progress < 1.0 ? (
                <LinearProgress color="primary" variant="determinate" value={progress * 100} />
            ) : null}
            <ImageViewer img={img} />
            <Box sx={{ display: 'flex' }}>
                <IconButton
                    sx={{ flexGrow: 1 }}
                    onClick={() =>
                        setActiveState((prev) => {
                            const newIdx = prev.idx - 1;
                            const newID = stateIDs[newIdx];
                            return { id: newID, idx: newIdx };
                        })
                    }
                    disabled={activeState.idx - 1 < 0}
                >
                    <ArrowBackIcon />
                </IconButton>
                <IconButton
                    sx={{ flexGrow: 1 }}
                    onClick={() =>
                        setActiveState((prev) => {
                            const newIdx = prev.idx + 1;
                            const newID = stateIDs[newIdx];
                            return { id: newID, idx: newIdx };
                        })
                    }
                    disabled={activeState.idx + 1 > stateIDs.length - 1}
                >
                    <ArrowForwardIcon />
                </IconButton>
            </Box>
        </Box>
    );
}
