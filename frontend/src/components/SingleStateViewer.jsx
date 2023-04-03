import { React, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { getStateColoringMethod } from '../api/states';

import ImageViewer from './ImageViewer';

import { apiGenerateOvitoImage } from '../api/ajax';
// import { useDispatch } from 'react-redux';
// import { addPropToState } from '../api/states';

export default function SingleStateViewer({ stateID, visScript, onClick }) {
    const [img, setImg] = useState(undefined);
    const [isLoading, setIsLoading] = useState(false);
    // const dispatch = useDispatch();
    const colorFunc = useSelector((state) => getStateColoringMethod(state));

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);
        apiGenerateOvitoImage(stateID, visScript, controller)
            .then((data) => {
                // dispatch(addPropToState(data)); do we need to save this?
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
            <Box height="5px" width="100%" sx={{ backgroundColor: colorFunc(stateID) }} />
        </Box>
    );
}
