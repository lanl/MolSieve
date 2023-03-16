class Trajectory {
    current_clustering;

    colors = [];

    raw;

    LAMMPSBootstrapScript;

    chunks = new Map();

    chunkingThreshold;

    extents;

    /** Sets the metadata for the run in the this object
     * data - metadata for the run retrieved from get_metadata
     */
    set_metadata(data) {
        this.raw = data.raw;
        this.LAMMPSBootstrapScript = data.LAMMPSBootstrapScript;
    }

    add_colors(colorArray) {
        for (const c of colorArray) {
            this.colors.push(c);
        }
    }

    simplifySet(simplifiedSet) {
        this.chunks.clear();
        for (const chunk of simplifiedSet) {
            this.chunks.set(chunk.id, chunk);
        }
        // set extents here
        this.extents = [0, this.length];
    }

    /**
     * Get chunk map as array.
     *
     * @returns {Map(Int, Chunk)} List of chunks within trajectory.
     */
    get chunkList() {
        return Array.from(this.chunks.values()).map((c) => c);
    }

    get importantChunkList() {
        return this.chunkList.filter((c) => c.important);
    }

    // could be more flexible if chunkList gets passed in
    isTimestepsWithinChunks(timesteps) {
        const start = Math.min(...timesteps);
        const end = Math.max(...timesteps);

        return this.importantChunkList.some((c) => c.timestep <= start && c.last >= end);
    }

    /**
     * Gets the length of the trajectory from the last timestep of the last chunk.
     *
     * @returns {Number} Length of the trajectory.
     */
    get length() {
        const { chunkList } = this;
        const lastArray = chunkList.map((c) => c.last);
        return Math.max(...lastArray);
    }

    /**
     * Gets all of the currently rendered chunks for a trajectory.
     *
     * @param {Trajectory} trajectory - The trajectory to retrieve the chunks from.
     * @returns {Array<Chunk>} Array of visible chunks.
     */
    getVisibleChunks() {
        const { chunkList, extents } = this;
        const [start, end] = extents;
        // this is all of the chunks we need for data
        const topChunkList = chunkList.filter((d) => {
            return !(start > d.last || end < d.timestep);
        });

        // the important chunks we will render
        const iChunks = topChunkList.filter((d) => d.important);
        // the unimportant chunks we will render
        const uChunks = topChunkList.filter((d) => !d.important);

        return { iChunks, uChunks, topChunkList };
    }
}

export default Trajectory;
