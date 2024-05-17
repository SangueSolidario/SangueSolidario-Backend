const { app } = require('@azure/functions');
const { EmailClient } = require("@azure/communication-email");
const dotenv = require("dotenv").config();

const connectionString = process.env.EMAILCONN;
const client = new EmailClient(connectionString);

app.cosmosDB('cosmosTrigger', {
    connectionStringSetting: 'AzureWebJobsCosmosDBConnectionString',
    databaseName: "Sangue",
    collectionName: "campanhasContainer",
    createLeaseCollectionIfNotExists: true,
    handler: (documents, context) => {
        context.log(`Cosmos DB function processed ${documents.length} documents`);
        context.log(`${process.env.EMAILCONN}`)
    }
});
