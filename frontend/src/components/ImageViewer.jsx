import { React, useEffect, useRef } from 'react';

/**
 * A dynamic <img> component that takes base64 encoded strings and renders them to the page.
 */
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

    return <img ref={imgRef} alt="" style={{ width: 100, height: 100 }} />;
}
