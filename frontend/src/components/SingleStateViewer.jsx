import { React, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import GlobalStates from '../api/globalStates';
import ImageViewer from './ImageViewer';

import { apiGenerateOvitoImage } from '../api/ajax';

export default function SingleStateViewer({ stateID, onHover }) {
    const [img, setImg] = useState(undefined);

    useEffect(() => {
        const controller = new AbortController();

        const state = GlobalStates.get(stateID);
        if (!state.img) {
            apiGenerateOvitoImage(stateID, controller)
                .then((data) => {
                    GlobalStates.addPropToState(data);
                    setImg(data.img);
                })
                .catch(() => {});
        } else {
            setImg(state.img);
        }

        return () => controller.abort();
    }, [stateID]);

    return (
        <Box onMouseEnter={onHover}>
            <ImageViewer img={img} />
        </Box>
    );
}
