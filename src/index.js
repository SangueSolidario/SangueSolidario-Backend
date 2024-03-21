const { CosmosClient } = require("@azure/cosmos");
const express = require("express");
const swaggerUI = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const ReqDao = require("./db");

// Express APP
const app = express();
const port = process.env.PORT || 3000;

// CosmosDB
const endpoint = process.env.HOST;
const key = process.env.AUTH_KEY;
const client = new CosmosClient({ endpoint, key });
const dao = new ReqDao(
    client, process.env.DB, 
    process.env.CAMPANHA, process.env.DOADOR, 
    process.env.FAMILIAR, process.env.NOTIFY,
);

// Iniciar o RequestDBDao
dao.init();

console.log(swaggerSpec)
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec));

// Para o APIM poder obter as rotas criadas pelo Swagger
app.get("/api/swagger.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
});

/**
* @openapi
* /campanhas:
*   get:
*       summary: Obtém todas as campanhas disponíveis
*       responses:
*           200:
*               description: Sucesso
*           500:
*               description: Erro no servidor
*/
app.get("/campanhas", async (req, res) => {
    try{
        return res.status(200).json(await dao.getCampanhas());
    } catch(error){
        console.log(error)
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

/**
* @openapi
* /familiares/{id}:
*   get:
*       summary: Obtém todos os familiares de um doador
*       parameters:
*           - in: path
*             name: id
*             required: true
*             schema:
*               type: int
*             description: ID do doador
*       responses:
*           200:
*               description: Sucesso
*           404:
*               description: Não encontrou doador
*           500:
*               description: Erro no servidor
*/
app.get("/familiares/:id", async (req, res) => {
    try{
        const familiares = await dao.getFamiliares(req.params.id);

        if(familiares.length == 0)
            return res.status(404).json({"mensagem": "Não existe doador com esse ID"});
        return res.status(200).json();

    } catch(error){
        console.log(error)
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

app.listen(port, () => {
    console.log(`App a executar na porta ${port}`);
});