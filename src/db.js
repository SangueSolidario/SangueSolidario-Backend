const rf = require("./utils");

class RequestDBDao{

    constructor(client, database, campanha, doador, familiar, notificao){
        this.client = client;
        this.databaseId = database;

        // ID's dos Containers 
        this.campanhaId = campanha;
        this.doadorId = doador;
        this.familiarId = familiar;
        this.notificaoId = notificao;
        
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

        for(const containerId of [this.campanhaId, this.familiarId, this.doadorId, this.notificaoId]){
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
}

module.exports = RequestDBDao;