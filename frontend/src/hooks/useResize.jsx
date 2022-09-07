import { useRef, useState, useLayoutEffect } from 'react';

export const useResize = (modAmount, modifierCount) => {
    const divRef = useRef(null);
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

    const resize = () => {
        if (!divRef || !divRef.current) {
            return;
        }

        const newWidth = divRef.current.offsetWidth;
        const newHeight = divRef.current.offsetHeight;
        if (newWidth < window.innerWidth && newHeight < window.innerHeight) {
            setWidth(newWidth);

            if (modAmount !== undefined && modifierCount !== undefined) {
                setHeight(newHeight + modAmount * modifierCount);
            } else {
                setHeight(newHeight);
            }
        }
    };

    useLayoutEffect(() => {
        resize();
    }, [divRef]);

    useLayoutEffect(() => {
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    return { width, height, divRef };
};
