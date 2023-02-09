import { useState, useCallback } from 'react';

/* eslint-disable */
export const useContextMenu = () => {
    const [contextMenu, setContextMenu] = useState(null);

    const toggleMenu = useCallback(
        (event) => {
            event.preventDefault();
            setContextMenu(
                contextMenu === null
                    ? {
                          mouseX: event.clientX - 2,
                          mouseY: event.clientY - 4,
                      }
                    : null
            );
        },
        [contextMenu]
    );

    return { contextMenu, toggleMenu };
};
