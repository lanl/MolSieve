import { useRef, useState, useEffect } from 'react';
/* eslint-disable */
/**
 * Hook to resize a component based on the size of the screen.
 *
 * @returns {Object} The width, height and reference to a component on the screen.
 */
export const useResize = () => {
    const divRef = useRef(null);
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

    const resize = () => {
        const newWidth = divRef.current.clientWidth;
        const newHeight = divRef.current.offsetHeight;
        setWidth(newWidth);
        setHeight(newHeight);
    };

    useEffect(() => {
        if (!divRef || !divRef.current) {
            return;
        }
        const resizeObserver = new ResizeObserver(() => resize());
        resizeObserver.observe(divRef.current);
        return () => resizeObserver.disconnect();
    }, []);


    useEffect(() => {
        window.addEventListener('resize', resize);
        () => window.removeEventListener('resize');
    }, []);

    return { width, height, divRef };
};
