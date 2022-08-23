import { useEffect, useState } from 'react';

export const useHover = (ref) => {
    const [isHovered, setIsHovered] = useState(false);

    // the issue is that you never "leave" the parent element with these events
    useEffect(() => {
        if (ref && ref.current) {
            ref.current.addEventListener('mouseover', function () {
                setIsHovered(true);
            });

            ref.current.addEventListener('mouseleave', function () {
                setIsHovered(false);
            });
        }
        return () => {};
    }, [ref]);

    return isHovered;
};
