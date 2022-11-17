import { useEffect, useState } from 'react';

export default function useRanks(keys) {
    const [ranks, setRanks] = useState(keys);
    const [rankDict, setRankDict] = useState({});

    useEffect(() => {
        // sort [key,value] pairs by value, then reduce to only keys and set in ranks array
        setRanks(
            Object.entries(rankDict)
                .sort((a, b) => a[1] < b[1])
                .map((d) => d[0])
        );
    }, [rankDict]);

    return { setRankDict, ranks, rankDict };
}
