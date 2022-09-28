import { useRef, useState, useLayoutEffect } from 'react';

export const useResize = () => {
    const divRef = useRef(null);
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

    const resize = () => {
        if (!divRef || !divRef.current) {
            return;
        }

        const newWidth = divRef.current.clientWidth;
        const newHeight = divRef.current.offsetHeight;
        setWidth(newWidth);
        setHeight(newHeight);
    };

    useLayoutEffect(() => {
        resize();
    }, [divRef]);

    useLayoutEffect(() => {
        window.addEventListener('resize', resize);
    }, []);

    return { width, height, divRef };
};
