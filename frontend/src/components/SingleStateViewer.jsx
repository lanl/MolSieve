import { React, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import GlobalStates from '../api/globalStates';
import ImageViewer from './ImageViewer';

import { apiGenerateOvitoImage } from '../api/ajax';

export default function SingleStateViewer({ stateID, onHover }) {
    const [img, setImg] = useState(undefined);

    useEffect(() => {
        apiGenerateOvitoImage(stateID).then((data) => {
            GlobalStates.addPropToState(data);
            setImg(data.img);
        });
    }, [stateID]);

    return (
        <Box onMouseEnter={onHover}>
            <ImageViewer img={img} />
        </Box>
    );
}
