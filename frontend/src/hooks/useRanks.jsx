import { useEffect, useState } from 'react';

export default function useRanks(keys) {
    const [ranks, setRanks] = useState(keys);
    const [rankDict, setRankDict] = useState({});

    /**
     * Sets the position of a chart based upon a value.
     * The highest valued charts will be at the top, and the lowest will be at the bottom.
     *
     * @param {Number} val - Value
     * @param {Any} property - Key for the value
     */
    const updateRank = (val, key) => {
        setRankDict((rd) => ({ ...rd, [key]: val }));
    };

    useEffect(() => {
        // sort [key,value] pairs by value, then reduce to only keys and set in ranks array
        setRanks(
            Object.entries(rankDict)
                .sort((a, b) => a[1] < b[1])
                .map((d) => d[0])
        );
    }, [rankDict]);

    return { updateRank, ranks, rankDict };
}
