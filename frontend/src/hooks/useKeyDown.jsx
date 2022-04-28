import { useEffect } from "react";

export default function (key, action, opts) {
    useEffect(() => {
        function onKeydown(e) {
            if (!e.repeat) {
                if (e.key === key) action(opts);
            }
        }
        window.addEventListener('keydown', onKeydown);
        return () => window.removeEventListener('keydown', onKeydown);
    }, []);
}
