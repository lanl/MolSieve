// functions that you can call on the trajectories dictionary
// no trajectories object because that would make it harder for react to diff

export function getAllImportantChunks(trajectories) {
    let iChunks = [];
    for (const t of Object.values(trajectories)) {
        iChunks = [...iChunks, ...t.chunkList.filter((c) => c.important && !c.hasParent)];
    }
    return iChunks;
}

export function getAllImportantStates(trajectories) {
    const iChunks = getAllImportantChunks(trajectories);
    let iStates = [];
    for (const c of Object.values(iChunks)) {
        iStates = [...iStates, ...c.states];
    }
    return iStates;
}
