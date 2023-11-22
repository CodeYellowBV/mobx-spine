export class Relation {
    __toModel = null;

    constructor(toModel) {
        this.__toModel = toModel
    }

    get model() {
        return this.__toModel
    }
}
