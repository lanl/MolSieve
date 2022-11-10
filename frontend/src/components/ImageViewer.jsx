import { React, useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export default function ImageViewer({ img }) {
    const imgRef = useRef(null);
    const [imgUnavailable, setImgUnavailable] = useState(true);
    useEffect(() => {
        if (img !== undefined) {
            const imageData = `data:image/png;base64,${img}`;
            imgRef.current.setAttribute('src', imageData);
            setImgUnavailable(false);
        } else {
            imgRef.current.setAttribute('src', '');
            setImgUnavailable(true);
        }
    }, [img]);

    return <img ref={imgRef} alt="" style={{ width: 200, height: 200, objectFit: 'cover' }} />;
}
