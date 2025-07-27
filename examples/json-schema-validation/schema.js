export const PROPERTIES = [
    { 
        label: "root name",
        jsonPath: ["name"],
        schemaPath: "$.properties.name.pattern"
    },
    { 
        label: "address name",
        jsonPath: ["address", "name"],
        schemaPath: "$.properties.address.properties.name.pattern"
    }
];

export const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
        id: { type: "number" },
        name: {
            type: "string",
            pattern: "^(John|Doe|Musk|Alice|Bob|Charlie|Eve|Mallory|Oscar|Trent)( (John|Doe|Musk|Alice|Bob|Charlie|Eve|Mallory|Oscar|Trent))*$"
        },
        address: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    pattern: "^(Alpha|Beta|Gamma)( (Alpha|Beta|Gamma))*$"
                }
            }
        },
        active: { type: "boolean" }
    },
    required: ["id", "name"]
};
