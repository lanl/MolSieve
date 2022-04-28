import { useEffect } from "react";

export default function (key, action) {
    useEffect(() => {
        function onKeydown(e) {
            if (!e.repeat) {
                if (e.key === key) action(e);
            }
        }
        window.addEventListener('keydown', onKeydown);
        return () => window.removeEventListener('keydown', onKeydown);
    }, []);
}
