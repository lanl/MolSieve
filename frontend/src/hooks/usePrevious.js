import { useEffect, useRef } from 'react';

/**
 * Remembers previous value of a state.
 *
 * @param {Object} value - Value to save.
 * @returns {Object} Stored value.
 */
export default function usePrevious(value) {
    const ref = useRef();
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}
