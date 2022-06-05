import { useEffect } from "react";

export default function (key, action, isHovered) {
    useEffect(() => {
        function onKeyup(e) {
            if (e.key === key) action(e);
        }
        if(isHovered) {
            window.addEventListener('keyup', onKeyup);
        } else {
            window.removeEventListener('keyup', onKeyup);
        }
        return () => window.removeEventListener('keyup', onKeyup);
    }, [isHovered]);
}
