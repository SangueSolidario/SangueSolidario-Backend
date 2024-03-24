const rf = require("./utils");

class RequestDBDao{

    constructor(client, database, campanha, doador, familiar){
        this.client = client;
        this.databaseId = database;

        // ID's dos Containers 
        this.campanhaId = campanha;
        this.doadorId = doador;
        this.familiarId = familiar;
        
        // Objetos dos Containers e Base de dados
        this.database = null
        this.containers = {};
    }

    /**
     * Função que inicializa os objetos da DB e containers
     */
    async init(){
        const db = await this.client.databases.createIfNotExists({
            id: this.databaseId
        });
        this.database = db.database;
        console.log(`Base de Dados ${this.databaseId} carregada!\n`);

        for(const containerId of [this.campanhaId, this.doadorId, this.familiarId]){
            const container = await this.database.containers.createIfNotExists({id: containerId});
            this.containers[containerId] = container.container;
            console.log(`Container ${containerId} carregado!\n`);

            // Verificar se é necessário injetar dados
            const items = await this.containers[containerId].items.readAll().fetchAll();

            if(items.resources.length == 0){
                for(const data of rf.readJson(containerId))
                    await this.containers[containerId].items.create(data);

                console.log(`Dados iniciais adicionados em ${containerId}`);
            }
        }
    }

    /**
     * Função que obtém os dados de todas as campanhas
     */
    async getCampanhas(){
        try{
            const querySpec = {
                query: "SELECT * FROM c"
            };
            
            const data = await this.containers[this.campanhaId].items.query(querySpec).fetchAll();

            // Each Campanha should only keep some fields
            data.resources = data.resources.map(obj => {
                return rf.remFields(obj,  "_rid", "_self", "_etag", "_attachments", "_ts", "participantes");
            });

            return data.resources;
        } catch(err){
            throw err;
        }
    }

    /**
     * Função que obtém os dados de todos os familiares de um doador
     */
    async getFamiliares(email){
        try{
            const querySpec = {
                query: `SELECT * FROM c WHERE c.email_doador=@email`,
                parameters: [{
                    name: "@email",
                    value: email
                }]
            };
            
            const data = await this.containers[this.familiarId].items.query(querySpec).fetchAll();

            if(data.resources.length == 0){
                return {
                    status: 404,
                    data: {
                        "mensagem": "Não existe doador com esse email"
                    }
                };
            }
            
            // Each familiar should only keep some fields
            data.resources = data.resources.map(obj => {
                return rf.keepFields(obj, "email_doador", "NomeFamiliar", "Parentesco", "TipoSanguineo", "id");
            });

            return {
                status: 200,
                data: data.resources
            };
        } catch(err){
            throw err;
        }
    }

    /**
     * Função que cria ou atualiza Doador
     */
    async postDoador(data){
        try{
            const doador = await this.valueExists("email", this.doadorId, data.email);
            
            // Create
            if(doador.resources.length == 0){
                const new_doador = await this.containers[this.doadorId].items.create(data);
                return {
                    status: 201,
                    data: rf.keepFields(new_doador.resource, "email", "id")
                };
            }

            // Update, add new keys/values to the resources of doador in DB
            for (const [key, value] of Object.entries(data)) {
                doador.resources[0][key] = value;
            }
            
            const new_doador = await this.containers[this.doadorId]
                                .item(doador.resources[0].id)
                                .replace(doador.resources[0]);
            return {
                status: 200,
                data: rf.remFields(new_doador.resource, "_rid", "_self", "_etag", "_attachments", "_ts")
            };

        } catch(err){
            throw err;
        }
    }

    /**
     * Função que cria Campanha
     */
    async postCampanha(data){
        try{

            // Remove possible ID field
            data = rf.remFields(data, "id");

            const new_campanha = await this.containers[this.campanhaId].items.create(data);
            return {
                status: 201,
                data: rf.remFields(new_campanha.resource, "_rid", "_self", 
                                "_etag", "_attachments", "_ts", "participantes")
            };
        } catch(err){
            throw err;
        }
    }

    /**
     * Função que elimina Campanha
     */
    async deleteCampanha(paramKey, id){
        try {
            await this.containers[this.campanhaId].item(id, paramKey).delete();

            return {
                status: 200,
                data: {"mensagem": "Campanha eliminada com sucesso"}
            };

        } catch(err) {
            
            if(err.code == 404){
                return {
                    status: 404,
                    data: {"mensagem": "Campanha não encontrada"}
                };
            }

            throw err;
        }
    }

    /**
     * Função que adiciona Doador a Campanha
     */
    async postDoadorCampanha(email, idCampanha){

        try {
            
            // Verify if campanha exists
            const campanha = await this.valueExists("id", this.campanhaId, idCampanha);

            if(campanha.resources.length == 0){
                return{
                    status: 404,
                    data: {"mensagem": "A campanha não existe"}
                };
            }

            // Verify if email exists
            const doador = await this.valueExists("email", this.doadorId, email);

            if(doador.resources.length == 0){
                return{
                    status: 404,
                    data: {"mensagem": "O doador não existe"}
                };
            }

            // Verify if array exists and email already there
            if(campanha.resources[0]["participantes"] == undefined){
                campanha.resources[0]["participantes"] = [email];
            
            } else if(!campanha.resources[0]["participantes"].includes(email)){
                campanha.resources[0]["participantes"].push(email);
            } else{
                return {
                    status: 400,
                    data: {"mensagem": "O Doador já está a participar desta campanha"}
                };
            }
            
            const campanha_up = await this.containers[this.campanhaId]
                                .item(campanha.resources[0].id)
                                .replace(campanha.resources[0]);

            return {
                status: 200,
                data: rf.remFields(campanha_up.resource, "_rid", "_self", 
                "_etag", "_attachments", "_ts", "participantes")
            };

        } catch(err) {
            throw err;
        }
    }

    /**
     * Função que elimina Doador 
     */
    async deleteDoador(paramKey, id){
        try {
            await this.containers[this.doadorId].item(id, paramKey).delete();

            return {
                status: 200,
                data: {"mensagem": "Doador eliminado com sucesso"}
            };

        } catch(err) {
            
            if(err.code == 404){
                return {
                    status: 404,
                    data: {"mensagem": "Doador não encontrado"}
                };
            }

            throw err;
        }
    }

    /**
     * Função que adiciona Familiar
     */
    async postFamiliar(data){

        try{
            // Validate if Doador exists
            const doador = await this.valueExists("email", this.doadorId, data.email_doador);

            if(doador.resources.length == 0){
                return {
                    status: 404,
                    data: {"mensagem": "O Doador não existe"}
                };
            }

            // Create if not passed an id of Familiar
            if(data.id == undefined){
                const new_familiar = await this.containers[this.familiarId].items.create(data);
                return {
                    status: 201,
                    data: rf.keepFields(new_familiar.resource, "NomeFamiliar", "id", 
                                        "Parentesco", "email_doador", "TipoSanguineo")
                };
            }

            const familiar = await this.valueExists("id", this.familiarId, data.id);

            if(familiar.resources.length == 0){
                return {
                    status: 404,
                    data: {"mensagem": "O Familiar não existe"}
                };
            }

            // Update, add new keys/values to the resources of Familiar in DB
            for (const [key, value] of Object.entries(data)) {
                familiar.resources[0][key] = value;
            }
            
            const new_familiar = await this.containers[this.familiarId]
                                .item(familiar.resources[0].id)
                                .replace(familiar.resources[0]);
            return {
                status: 200,
                data: rf.remFields(new_familiar.resource, "_rid", "_self", "_etag", "_attachments", "_ts")
            };

        } catch(err){
            throw err;
        }
    }

    /**
     * Função que eliminar um Familiar
     */
    async deleteFamiliar(paramKey, id){
        try {
            await this.containers[this.familiarId].item(id, paramKey).delete();

            return {
                status: 200,
                data: {"mensagem": "Familiar eliminado com sucesso"}
            };

        } catch(err) {
            
            if(err.code == 404){
                return {
                    status: 404,
                    data: {"mensagem": "Familiar não encontrado"}
                };
            }

            throw err;
        }
    }

    /**
     * Auxiliar function to verify if field value is present in DB 
     */
    async valueExists(field, containerId, value){
        try{
            const querySpec = {
                query: `SELECT * FROM c WHERE c.${field}=@${field}`,
                parameters: [{
                    name: `@${field}`,
                    value: value
                }]
            };
            const data = await this.containers[containerId].items.query(querySpec).fetchAll();
            return data;

        } catch(err){
            throw err;
        }
    }
}

module.exports = RequestDBDao;