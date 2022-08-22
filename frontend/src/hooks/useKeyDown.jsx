import { useEffect } from 'react';

export default function (key, action, isHovered) {
    useEffect(() => {
        function onKeydown(e) {
            if (!e.repeat) {
                if (e.key === key) action();
            }
        }
        if (isHovered) {
            window.addEventListener('keydown', onKeydown);
        } else {
            window.removeEventListener('keydown', onKeydown);
        }
        return () => window.removeEventListener('keydown', onKeydown);
    }, [isHovered]);
}
