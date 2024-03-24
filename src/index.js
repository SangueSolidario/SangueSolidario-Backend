const { CosmosClient } = require("@azure/cosmos");
const express = require("express");
const cors = require("cors");
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
    process.env.CAMPANHA, process.env.DOADOR,
    process.env.FAMILIAR
);

// Iniciar o RequestDBDao
dao.init();
app.use(express.json())
app.use(cors());
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
* /campanha:
*   post:
*       summary: Cria uma Campanha
*       requestBody:
*           required: true
*           content:
*               application/json:
*                   schema:
*                       type: object
*                       properties:
*                           Nome:
*                               type: string
*                           DataInicio:
*                               type: string
*                           DataFim:
*                               type: string
*                           Imagem:
*                               type: string
*                           Descricao:
*                               type: string
*                           TiposSanguineoNecessario:
*                               type: array
*                               items:
*                                   type: string
*                           Coordenadas:
*                               type: object
*                               properties:
*                                   lon:
*                                       type: string
*                                   lat:
*                                       type: string
*                           Status:
*                               type: string
*                           Cidade:
*                               type: string
*       responses:
*           201:
*               description: Criado com Sucesso
*           400:
*               description: Não foi passado um body
*           500:
*               description: Erro no servidor
*/
app.post("/campanha", async (req, res) => {
    try{
        
        if(req.body === undefined)
            return res.status(400).json({"mensagem": "Body vazio"});

        const {status, data } = await dao.postCampanha(req.body);
        
        return res.status(status).json(data);

    } catch(err){
        console.log(err);
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

/**
* @openapi
* /campanha:
*   delete:
*       summary: Elimina uma Campanha
*       requestBody:
*           required: true
*           content:
*               application/json:
*                   schema:
*                       type: object
*                       required:
*                           - id
*                           - name
*                       properties:
*                           id:
*                               type: string
*                           name:
*                               type: string
*       responses:
*           200:
*               description: Sucesso
*           400:
*               description: ID de doador ou nome da campanha inválidos
*           404:
*               description: Campanha não encontrada
*           500:
*               description: Erro no servidor
*/
app.delete("/campanha", async (req, res) => {
    try {

        if(req.body.name == undefined || req.body.id == undefined){
            return res.status(400).json({"mensagem": "É necessário passar ID de doador e nome da campanha"});
        }

        const {status, data } = await dao.deleteCampanha(req.body.name, req.body.id);
        return res.status(status).json(data);
    } catch(err) {
        console.log(err);
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

/**
* @openapi
* /doador:
*   post:
*       summary: Cria/Atualiza um Doador
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
*                           Nome:
*                               type: string
*                           TipoSanguineo:
*                               type: string
*                           DataNascimento:
*                               type: string
*                           Feedback:
*                               type: array
*                               items:
*                                   type: string
*       responses:
*           201:
*               description: Criado com Sucesso
*           200:
*               description: Atualizado com Sucesso
*           400:
*               description: Email inválido
*           500:
*               description: Erro no servidor
*/
app.post("/doador", async (req, res) => {

    try{
        
        if(req.body.email === undefined || !rf.isEmail(req.body.email))
            return res.status(400).json({"mensagem": "Email inválido"});

        const {status, data } = await dao.postDoador(req.body);
        
        return res.status(status).json(data);

    } catch(err){
        console.log(err);
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

/**
* @openapi
* /doador:
*   delete:
*       summary: Elimina um Doador
*       requestBody:
*           required: true
*           content:
*               application/json:
*                   schema:
*                       type: object
*                       required:
*                           - id
*                           - email
*                       properties:
*                           id:
*                               type: string
*                           email:
*                               type: string
*       responses:
*           200:
*               description: Sucesso
*           400:
*               description: Não passou Email válido ou ID de Doador
*           404:
*               description: Doador não encontrado
*           500:
*               description: Erro no servidor
*/
app.delete("/doador", async (req, res) => {
    try {

        if(req.body.email == undefined || !rf.isEmail(req.body.email || req.body.id == undefined)){
            return res.status(400).json({"mensagem": "É necessário passar ID de doador e email válido"});
        }

        const {status, data } = await dao.deleteDoador(req.body.email, req.body.id);
        return res.status(status).json(data);

    } catch(err) {
        console.log(err);
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

/**
* @openapi
* /doador/campanha:
*   post:
*       summary: Adiciona Doador a Campanha
*       requestBody:
*           required: true
*           content:
*               application/json:
*                   schema:
*                       type: object
*                       required:
*                           - email
*                           - id
*                       properties:
*                           email:
*                               type: string
*                           id:
*                               type: string
*                               description: ID da Campanha
*       responses:
*           200:
*               description: Adicionado Doador à Campanha com sucesso
*           400:
*               description: O Doador já está a participar da campanha
*           404:
*               description: Não existe Doador ou Campanha
*           500:
*               description: Erro no servidor
*/
app.post("/doador/campanha", async (req, res) => {
    try {
        if(req.body.id == undefined || req.body.email == undefined || !rf.isEmail(req.body.email)){
            return res.status(400).json({
                "mensagem": "É necessário fornecer id da campanha e email válido"
            });
        }

        const {status, data } = await dao.postDoadorCampanha(req.body.email, req.body.id);

        return res.status(status).json(data);

    } catch(err) {
        console.log(err);
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});


/**
* @openapi
* /familiares:
*   post:
*       summary: Obtém todos os familiares de um doador
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
        if(req.body.email === undefined || !rf.isEmail(req.body.email))
            return res.status(400).json({"mensagem": "Email inválido"});

        const {status, data}= await dao.getFamiliares(req.body.email);

        return res.status(status).json(data);

    } catch(error){
        console.log(error)
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

/**
* @openapi
* /familiar:
*   post:
*       summary: Adicionar/Atualizar Familiar
*       requestBody:
*           required: true
*           content:
*               application/json:
*                   schema:
*                       type: object
*                       required:
*                           - email_doador
*                       properties:
*                           email_doador:
*                               type: string
*                           NomeFamiliar:
*                               type: string
*                           TipoSanguineo:
*                               type: string
*                           Parentesco:
*                               type: string
*                           id:
*                               type: string
*                               description: ID do Familiar, necessário para Updates
*       responses:
*           200:
*               description: Sucesso
*           400:
*               description: Email inválido
*           404:
*               description: Não encontrou doador ou familiar
*           500:
*               description: Erro no servidor
*/
app.post("/familiar", async (req, res) => {
    try{
        
        if(req.body.email_doador === undefined || !rf.isEmail(req.body.email_doador)){
            return res.status(400).json({"mensagem": "É necessário passar um email de doador válido"});
        }
        
        const {status, data} = await dao.postFamiliar(req.body);

        return res.status(status).json(data);

    } catch(error){
        console.log(error)
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

/**
* @openapi
* /familiar:
*   delete:
*       summary: Elimina um Familiar
*       requestBody:
*           required: true
*           content:
*               application/json:
*                   schema:
*                       type: object
*                       required:
*                           - id
*                           - email_doador
*                       properties:
*                           id:
*                               type: string
*                           email_doador:
*                               type: string
*       responses:
*           200:
*               description: Sucesso
*           400:
*               description: Não passou Email Doador válido ou ID de Familiar
*           404:
*               description: Familiar não encontrado
*           500:
*               description: Erro no servidor
*/
app.delete("/familiar", async (req, res) => {
    try {

        if(req.body.email_doador == undefined || !rf.isEmail(req.body.email_doador || req.body.id == undefined)){
            return res.status(400).json({"mensagem": "É necessário passar ID de Familiar e email_doador válido"});
        }

        const {status, data } = await dao.deleteFamiliar(req.body.email_doador, req.body.id);
        return res.status(status).json(data);

    } catch(err) {
        console.log(err);
        return res.status(500).json({"mensagem": "Erro no servidor!"});
    }
});

app.listen(port, () => {
    console.log(`App a executar na porta ${port}`);
});