const { CosmosClient } = require("@azure/cosmos");
const express = require("express");
const swaggerUI = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const ReqDao = require("./db");
const rf = require("./utils");

// Express APP
const app = express();
const port = process.env.PORT || 3000;

// CosmosDB
const endpoint = process.env.HOST;
const key = process.env.AUTH_KEY;
const client = new CosmosClient({ endpoint, key });
const dao = new ReqDao(
    client, process.env.DB, 
    process.env.CAMPANHA, process.env.DOADOR
);

// Iniciar o RequestDBDao
dao.init();
app.use(express.json())
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
* /familiares:
*   post:
*       summary: Obtém todos os familiares de um doador
*       consumes:
*           - application/json
*       produces:
*           - application/json
*       requestBody:
*           required: true
*           content:
*               application/json:
*                   schema:
*                       type: object
*                       required:
*                           - email
*                       properties:
*                           email:
*                               type: string
*       responses:
*           200:
*               description: Sucesso
*           400:
*               description: Email inválido
*           404:
*               description: Não encontrou doador
*           500:
*               description: Erro no servidor
*/
app.post("/familiares", async (req, res) => {
    try{
        
        // Validate if it's a valid email
        if(!rf.isEmail(req.body.email))
            return res.status(400).json({"mensagem": "Email inválido"});

        const familiares = await dao.getFamiliares(req.body.email);

        if(familiares.length == 0)
            return res.status(404).json({"mensagem": "Não existe doador com esse ID"});
        return res.status(200).json(familiares[0]);

    } catch(error){
        console.log(error)
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

/**
* @openapi
* /familiares:
*   post:
*       summary: Obtém todos os familiares de um doador
*       consumes:
*           - application/json
*       produces:
*           - application/json
*       requestBody:
*           required: true
*           content:
*               application/json:
*                   schema:
*                       type: object
*                       required:
*                           - email
*                       properties:
*                           email:
*                               type: string
*       responses:
*           201:
*               description: Criado com Sucesso
*           204:
*               description: Atualizado com Sucesso
*           400:
*               description: Email inválido
*           404:
*               description: Não encontrou doador
*           500:
*               description: Erro no servidor
*/
app.post("/campanha", async (req, res) => {

    try{
        const data = await dao.postCampanha(req.body);
        console.log(data);
        return res.status(200).json({"mensagem": "Funca!"});
    } catch(err){
        console.log(error);
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

app.listen(port, () => {
    console.log(`App a executar na porta ${port}`);
});