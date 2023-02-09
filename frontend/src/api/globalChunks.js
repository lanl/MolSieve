// basically just a counter for the chunks class, can probably re-do this to be more abstract
class GlobalChunks {
    id;

    constructor() {
        this.id = 0;
    }

    generateID = () => {
        this.id -= 1;
        return this.id--;
    };
}

const instance = new GlobalChunks();

export default instance;
