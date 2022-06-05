import {useRef, useState, useEffect} from 'react';

export const useResize = () => {
    const divRef = useRef(null);
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

    const resize = () => {
        if(!divRef || !divRef.current) {
            return;
        }

        const newWidth = divRef.current.offsetWidth;
        setWidth(newWidth);

        const newHeight = divRef.current.offsetHeight;
        setHeight(newHeight);
    };

    useEffect(() => {
        resize();
    }, [divRef]);

    useEffect(() => {
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    return {width, height, divRef};
}
