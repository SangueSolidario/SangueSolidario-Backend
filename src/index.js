const { CosmosClient } = require("@azure/cosmos");
const { BlobServiceClient, StorageSharedKeyCredential} = require("@azure/storage-blob");
const express = require("express");
const { check, validationResult } = require('express-validator');
const swaggerUI = require("swagger-ui-express");
const multer = require("multer");
const swaggerSpec = require("./swagger");
const ReqDao = require("./db");
const rf = require("./utils");
const dotenv = require("dotenv").config();

// Configure Multer to store in-memory
const storage = multer.memoryStorage();
const upload = multer({storage: storage});

// Express APP
const app = express();
const port = process.env.PORT || 3000;

// Storage Account
const storage_name = process.env.BLOB
const storage_key = process.env.BLOB_KEY

const sharedKeyCredential = new StorageSharedKeyCredential(storage_name, storage_key);
const blobServiceClient = new BlobServiceClient(
  `https://${storage_name}.blob.core.windows.net`,
  sharedKeyCredential
);

// CosmosDB
const endpoint = process.env.HOST;
const key = process.env.COSMOSKEY;
const client = new CosmosClient({ endpoint, key });
const dao = new ReqDao(
    client, process.env.DB, 
    process.env.CAMPANHA, process.env.DOADOR,
    process.env.FAMILIAR
);

// Init RequestDBDao
dao.init();
app.use(express.json())


app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec));

// For APIM to obtain routes cretated by Swagger
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
*               multipart/form-data:
*                   schema:
*                       type: object
*                       properties:
*                           Nome:
*                               type: string
*                           DataInicio:
*                               type: string
*                           DataFim:
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
*                           Imagem:
*                               type: string
*                               format: binary
*       responses:
*           201:
*               description: Criado com Sucesso
*           400:
*               description: Não foi passado um body
*           500:
*               description: Erro no servidor
*/
app.post("/campanha", [
    upload.single("Imagem"),
    check("Nome", "Necessário passar um Nome").trim().notEmpty().escape(),
    check("Coordenadas").customSanitizer(val => JSON.parse(val.trim())), // Multer transformed object in String, undoing it
    check("Coordenadas.lon", "Necessário fornecer a longitude nas Coordenadas").trim().notEmpty(),
    check("Coordenadas.lat", "Necessário fornecer a latitude nas Coordenadas").trim().notEmpty()
], async (req, res) => {
    try{
        const errors = validationResult(req);

        if(req.file !== undefined){
            const containerClient = blobServiceClient.getContainerClient("images");
            const blockBlobClient = containerClient.getBlockBlobClient(req.file.originalname);
            await blockBlobClient.upload(req.file.buffer, req.file.size);

            req.body.Imagem = req.file.originalname;
        }
        

        if(!errors.isEmpty())
            return res.status(400).json({"mensagem": errors.array() });

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
app.delete("/campanha", [
    check("name", "Necessário passar um name").trim().notEmpty().escape(),
    check("id", "Necessário fornecer um id").trim().notEmpty().escape()
], async (req, res) => {
    try {
        const errors = validationResult(req);

        if(!errors.isEmpty()){
            return res.status(400).json({"mensagem": errors.array()});
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
app.post("/doador", [
    check("email", "Necessário passar um email válido").isEmail().normalizeEmail()
], async (req, res) => {

    try{
        const errors = validationResult(req);

        if(!errors.isEmpty())
            return res.status(400).json({"mensagem": errors.array()});

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
app.delete("/doador", [
    check("email", "Necessário passar um email válido").isEmail().normalizeEmail(),
    check("id", "Necessário passar um id").trim().notEmpty().escape(),
], async (req, res) => {
    try {
        const errors = validationResult(req);

        if(!errors.isEmpty()){
            return res.status(400).json({"mensagem": errors.array()});
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
app.post("/doador/campanha", [
    check("email", "Necessário passar um email válido").isEmail().normalizeEmail(),
    check("id", "Necessário fornecer um id").trim().notEmpty().escape()
], async (req, res) => {
    try {
        const errors = validationResult(req);

        if(!errors.isEmpty()){
            return res.status(400).json({"mensagem": errors.array()});
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
app.post("/familiares", [
    check("email", "Necessário passar um email válido").isEmail().normalizeEmail()
], async (req, res) => {
    try{
        
        // Validate if it's a valid email
        const errors = validationResult(req);

        if(!errors.isEmpty()){
            return res.status(400).json({"mensagem": errors.array()});
        }

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
app.post("/familiar", [
    check("email_doador", "Necessário passar um email válido").isEmail().normalizeEmail(),
    //check("id", "Necessário passar um id para o familiar").trim().notEmpty().escape(),
    check("NomeFamiliar", "Necessário passar um nome para o familiar").trim().notEmpty().escape(),
    check("TipoSanguineo", "Necessário passar um tipo sanguíneo").trim().notEmpty().escape(),
], async (req, res) => {
    try{
        
        const errors = validationResult(req);

        if(!errors.isEmpty()){
            return res.status(400).json({"mensagem": errors.array()});
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
app.delete("/familiar", [
    check("email_doador", "Necessário passar um email válido").isEmail().normalizeEmail(),
    check("id", "Necessário passar um id para o familiar").trim().notEmpty().escape()
], async (req, res) => {
    try {

        const errors = validationResult(req);

        if(!errors.isEmpty()){
            return res.status(400).json({"mensagem": errors.array()});
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