import { React, useEffect, useRef } from 'react';

export default function ImageViewer({ img }) {
    const imgRef = useRef(null);
    useEffect(() => {
        if (img !== undefined) {
            const imageData = `data:image/png;base64,${img}`;
            imgRef.current.setAttribute('src', imageData);
        } else {
            imgRef.current.setAttribute('src', '');
        }
    }, [img]);

    return <img ref={imgRef} alt="" style={{ width: 100, height: 200, objectFit: 'cover' }} />;
}
