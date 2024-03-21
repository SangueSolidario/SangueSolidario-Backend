const swaggerJSDoc = require("swagger-jsdoc");

const swaggerDefinition = {
    swagger: "2.0",
    info: {
        title: "SangueSolidario",
        version: "1.0.0",
        description: "Obtenha os dados da app SangueSolidario"
    }
};

const options = {
    swaggerDefinition,
    apis: ["./src/*.js"]     // Ficheiros onde encontrar funções anotadas com a definição acima
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;