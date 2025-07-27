export class JsonPathParser {
    constructor(jsonStr) {
        this.jsonStr = jsonStr;
        this.i = 0;
        this.stack = [];
    }

    getPathAtOffset(offset) {
        this.offset = offset;  // Store offset for use in parsing
        try { 
            this.parseValue(); 
        } catch (e) { 
            if (e.path) {
                return e.path; 
            }
            throw e; 
        }
        return [];
    }

    skipWhitespace() { 
        while (this.i < this.jsonStr.length && /\s/.test(this.jsonStr[this.i])) this.i++; 
    }

    parseValue() {
        this.skipWhitespace();
        const ch = this.jsonStr[this.i];
        if (ch === '{') return this.parseObject();
        if (ch === '[') return this.parseArray();
        if (ch === '"') return this.parseString();
        return this.parsePrimitive();
    }

    parseObject() {
        this.i++; this.skipWhitespace();
        while (this.i < this.jsonStr.length && this.jsonStr[this.i] !== '}') {
            const key = this.parseString(); this.skipWhitespace();
            if (this.jsonStr[this.i] === ':') this.i++;
            this.stack.push(key.value);
            this.parseValue();
            this.stack.pop();
            this.skipWhitespace();
            if (this.jsonStr[this.i] === ',') this.i++;
            this.skipWhitespace();
        }
        this.i++;
    }

    parseArray() {
        this.i++; this.skipWhitespace();
        let index = 0;
        while (this.i < this.jsonStr.length && this.jsonStr[this.i] !== ']') {
            this.stack.push(index);
            this.parseValue();
            this.stack.pop();
            index++;
            this.skipWhitespace();
            if (this.jsonStr[this.i] === ',') this.i++;
            this.skipWhitespace();
        }
        this.i++;
    }

    parseString() {
        const start = this.i;
        this.i++;
        while (this.i < this.jsonStr.length) {
            if (this.jsonStr[this.i] === '"' && this.jsonStr[this.i - 1] !== '\\') break;
            this.i++;
        }
        this.i++;
        const end = this.i;
        const value = this.jsonStr.slice(start + 1, end - 1);
        // Throw path when we're inside the string or at the end quote
        if (this.offset > start && this.offset <= end) {
            throw { path: [...this.stack] };
        }
        return { value, start, end };
    }

    parsePrimitive() {
        const start = this.i;
        while (this.i < this.jsonStr.length && /[^\s,\]\}]/.test(this.jsonStr[this.i])) this.i++;
        const end = this.i;
        if (this.offset >= start && this.offset <= end) throw { path: [...this.stack] };
    }
}
