class GlobalStates {
    map = new Map();

    addPropToStates = (propertyList) => {
        for (const prop of propertyList) {
            if (this.map.has(prop.id)) {
                const previous = this.map.get(prop.id);
                this.map.set(prop.id, Object.assign(previous, prop));
            } else {
                this.map.set(prop.id, prop);
            }
        }
    };

    removePropFromStates = (prop) => {
        for (const s of this.map.values()) {
            if (s[prop] !== undefined && s[prop] !== null) {
                delete s[prop];
                this.map.set(s.id, s);
            }
        }
    };

    calculateGlobalUniqueStates = (newUniqueStates, run) => {
        for (const s of newUniqueStates) {
            if (this.map.has(s.id)) {
                const previous = this.map.get(s.id);
                previous.seenIn = [...previous.seenIn, run];
                this.map.set(s.id, Object.assign(previous, s));
            } else {
                s.seenIn = [run];
                this.map.set(s.id, s);
            }
        }
    };

    get = (id) => {
        return this.map.get(id);
    };
}

const instance = new GlobalStates();

export default instance;
