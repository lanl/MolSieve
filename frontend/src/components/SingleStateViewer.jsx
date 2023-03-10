import { React, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { useDispatch } from 'react-redux';
import ImageViewer from './ImageViewer';

import { apiGenerateOvitoImage } from '../api/ajax';
import { addPropToState } from '../api/states';

export default function SingleStateViewer({ stateID, visScript, onClick }) {
    const [img, setImg] = useState(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const dispatch = useDispatch();

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);
        apiGenerateOvitoImage(stateID, visScript, controller)
            .then((data) => {
                dispatch(addPropToState(data));
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
