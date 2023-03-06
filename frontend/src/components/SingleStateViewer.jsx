import { React, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import GlobalStates from '../api/globalStates';
import ImageViewer from './ImageViewer';

import { apiGenerateOvitoImage } from '../api/ajax';

export default function SingleStateViewer({ stateID, visScript, onClick }) {
    const [img, setImg] = useState(undefined);
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);
        apiGenerateOvitoImage(stateID, visScript, controller)
            .then((data) => {
                GlobalStates.addPropToState(data);
                setImg(data.img);
                setIsLoading(false);
            })
            .catch(() => {});
        return () => controller.abort();
    }, [stateID, visScript]);

    return (
        <Box onClick={onClick}>
            {isLoading && <LinearProgress variant="indeterminate" />}
            <ImageViewer img={img} />
        </Box>
    );
}
