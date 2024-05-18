const { CosmosClient } = require('@azure/cosmos');
const { EmailClient } = require('@azure/communication-email');
const { BlobServiceClient, StorageSharedKeyCredential} = require("@azure/storage-blob");

const endpoint = process.env.COSMOS_HOST;
const key = process.env.COSMOS_KEY
const email_conn = process.env.EMAIL_CONN;
const sender_email = process.env.SENDER_EMAIL;
const storage_name = process.env.BLOB
const storage_key = process.env.BLOB_KEY

const cosmosClient = new CosmosClient({ endpoint, key});

const sharedKeyCredential = new StorageSharedKeyCredential(storage_name, storage_key);
const blobServiceClient = new BlobServiceClient(
  `https://${storage_name}.blob.core.windows.net`,
  sharedKeyCredential
);

const emailClient = new EmailClient(email_conn);
const containerClient = blobServiceClient.getContainerClient("images");

async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      readableStream.on("data", (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on("error", reject);
    });
}

module.exports = async function (context, documents) {
    if (!!documents && documents.length > 0) {
        for(const document of documents){
             context.log('Document Id: ', document.id);
            try {
                const database = cosmosClient.database(process.env.DB_ID);
                const container = database.container(process.env.DOADORES_ID);
                const { resources: doadores } = await container.items.readAll().fetchAll();

                const recipients = {
                    to: []
                };

                for (const doador of doadores) {
                    recipients.to.push({
                        address: doador.email,
                        displayName: doador.Nome,
                    });    
                }
                
                const blobClient = containerClient.getBlobClient(document.Imagem);
                const downloadBlockBlobResponse = await blobClient.download();
                const downloaded = (
                    await streamToBuffer(downloadBlockBlobResponse.readableStreamBody)
                ).toString("base64");

                const message = {
                    senderAddress: sender_email,
                    content: {
                        subject: "Nova Campanha: Sangue Solidário",
                        plainText: `Olá caro(a) doador(a)! Uma nova campanha denominada de '${document.Nome}' foi adicionada!`,
                    },
                    recipients: recipients,
                    attachments: [{
                        name: document.Imagem,
                        contentType: "image/jpeg",
                        contentInBase64: downloaded.toString("base64"),
                        },
                    ],
                };

                const poller = await emailClient.beginSend(message);
                await poller.pollUntilDone();

            } catch (err) {
                context.log.error(`Error: ${err.message}`);
            }
        }
       
    }
}