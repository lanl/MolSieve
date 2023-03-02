import { React, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import GlobalStates from '../api/globalStates';
import ImageViewer from './ImageViewer';

import { apiGenerateOvitoImage } from '../api/ajax';

export default function SingleStateViewer({ stateID, visScript, onClick }) {
    const [img, setImg] = useState(undefined);

    useEffect(() => {
        const controller = new AbortController();

        apiGenerateOvitoImage(stateID, visScript, controller)
            .then((data) => {
                GlobalStates.addPropToState(data);
                setImg(data.img);
            })
            .catch(() => {});
        return () => controller.abort();
    }, [stateID, visScript]);

    return (
        <Box onClick={onClick}>
            <ImageViewer img={img} />
        </Box>
    );
}
