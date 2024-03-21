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

app.get("/campanhas", (req, res) => {
    try{
        
        return res.status(200).json({
            "ID": "1",
            "Nome": "Campanha 1",
            "DataInicio": "2017-01-01",
            "DataFim": "2017-01-31",
            "Imagem": "Url para Blob Storage",
            "Descricao": "Campanha 1",
            "TiposSanguineoNecessario": ["A+", "B+"],
            "Local": "Local 1",
            "Status": "Ativa"
        });
    } catch(error){
        return res.status(500).json({"mensagem": error});
    }
});

app.listen(port, () => {
    console.log(`App a executar na porta ${port}`);
});