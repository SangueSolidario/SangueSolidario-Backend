#!/bin/bash

# Flag (-github) para definir se quere-se conectar, pela primeira vez, ao Github Actions
github=false
createVars=false
genEmail=false

while [[ $# -gt 0 ]]; do
    key="$1"

    case $key in
        -github)
        github=true
        shift
        ;;
        -createVars)
        createVars=true
        shift
        ;;
        -genEmail)
        genEmail=true
        shift
        ;;
        *)
        shift
        ;;
    esac
done

resource_name="apibackend"
apim_name="sanguesolidario"
apim_id="apisanguesolidario"
location="uksouth"
email="tiagomartins1@ipcbcampus.pt"
organization="SangueSolidario"
webapp="webapp-sanguesolidario"

# Criar grupo de recursos
if ! az group show --name $resource_name &>/dev/null; then
    echo "A criar o grupo de recursos $resource_name"
    az group create --location $location --name $resource_name
fi

echo "Á espera que o grupo de recursos seja criado"
az group wait --exists --resource-group $resource_name

# Se der erro, o comando não retornará 0
if ! az apim show --name $apim_name --resource-group $resource_name &>/dev/null; then
    # Elimina APIM caso tenha sido soft-deleted no passado
    az apim deletedservice purge --location $location --service-name $apim_name

    echo "A criar o API Management $apim_name"
    az apim create --name $apim_name --resource-group $resource_name --location $location --publisher-email $email --publisher-name $organization
fi

echo "Á espera que o API Management seja criado"
az apim wait --exists --resource-group $resource_name --name $apim_name

servico_app="servicoweb-sanguesolidario"

# Se der erro, o comando não retornará 0
if ! az webapp show --name $servico_app --resource-group $resource_name &>/dev/null; then
    echo "A criar o App Service $servico_app"
    az appservice plan create --name $servico_app --resource-group $resource_name --sku B1 --is-linux
fi

# Se der erro, o comando não retornará 0
if ! az webapp show --name $webapp --resource-group $resource_name &>/dev/null; then
    echo "A criar o WebApp $webapp"
    az webapp create --name $webapp --resource-group $resource_name --plan $servico_app --runtime "NODE:20-lts"
fi

# Configurar Github Actions
if [ "$github" = true ]; then
    # Esperar 30 segundos pela webapp
    echo "A dormir por 30 segundos"
    sleep 30
    github_repo="ttiagojm/SangueSolidario-Backend"
    az webapp deployment github-actions add --repo $github_repo -g $resource_name -n $webapp -b main --login-with-github
else
    echo "Adicionar Github Actions ignorado"
fi

# Verificar se a webapp está ON
app_service_url="https://${webapp}.azurewebsites.net"
openapi_url="${app_service_url}/api/swagger.json"

# Esperar 30 segundos
echo "A dormir por 30 segundos"
sleep 30

# Atribuir AppService à API openAPI
api_name="sanguesolidarioapi"
az apim api import \
    --api-id $api_name \
    --resource-group $resource_name \
    --service-name $apim_name \
    --service-url $app_service_url \
    --path "/api" \
    --specification-format "OpenApi" \
    --specification-url "$openapi_url" \
    --display-name $api_name \
    --api-type "http" \
    --protocols "https" \
    --subscription-required false

cosmos_name="mycosmosbd1"
db_name="Sangue"

az cosmosdb create --name $cosmos_name --resource-group $resource_name --kind GlobalDocumentDB

az cosmosdb sql database create --account-name $cosmos_name --resource-group $resource_name --name $db_name

az cosmosdb sql container create --account-name $cosmos_name --database-name $db_name --resource-group $resource_name --name campanhasContainer --partition-key-path /Nome

az cosmosdb sql container create --account-name $cosmos_name --database-name $db_name --resource-group $resource_name --name doadoresContainer --partition-key-path /email -u '{"uniqueKeys": [{"paths": ["/email"]}]}'

az cosmosdb sql container create --account-name $cosmos_name --database-name $db_name --resource-group $resource_name --name familiaresContainer --partition-key-path /email_doador

# Get Cosmos Primary Key
primaryKey=$(az cosmosdb keys list --name $cosmos_name --resource-group $resource_name --type keys --output json --query primaryMasterKey -o tsv)

blobStorageAccount="myblobstorage20210941"

az storage account create --name $blobStorageAccount --location $location --resource-group $resource_name \
    --sku Standard_LRS --kind StorageV2 --access-tier hot --allow-blob-public-access true

blobStorageAccountKey=$(az storage account keys list -g $resource_name -n $blobStorageAccount \
    --query "[0].value" --output tsv)


az storage container create --name images --account-name $blobStorageAccount --account-key $blobStorageAccountKey

az webapp config appsettings set --name $webapp --resource-group $resource_name \
  --settings AzureStorageConfig__AccountName=$blobStorageAccount \
    AzureStorageConfig__ImageContainer=images \
    AzureStorageConfig__AccountKey=$blobStorageAccountKey

# Reboot webapp 
az webapp restart --name $webapp --resource-group $resource_name

# Update .env values with new information from Azure Resources
content=$(< ".env")
new_content=$(echo "$content" | sed -E "s|COSMOSKEY=.*|COSMOSKEY=$primaryKey|")
new_content=$(echo "$new_content" | sed -E "s|DB=.*|DB=$db_name|")
new_content=$(echo "$new_content" | sed -E "s|BLOB_KEY=.*|BLOB_KEY=$blobStorageAccountKey|")
new_content=$(echo "$new_content" | sed -E "s|BLOB=.*|BLOB=$blobStorageAccount|")
echo "$new_content" > ".env"

# Set KEY=VALUE do .env in environment variables of WebApp
if [ "$createVars" = true ]; then
    echo "A criar variáveis de ambiente"
    while IFS='=' read -r settingName settingValue; do
        az webapp config appsettings set --name $webapp --resource-group $resource_name --settings "$settingName=$settingValue"
    done < .env
fi

commService="comm20210941"
emailService="emailService20210941"

if [ "$genEmail" = true ]; then
    # Create communication service
    az communication create --data-location unitedstates --name $commService -g $resource_name --location global

    # Create email service
    az communication email create -n $emailService -g $resource_name --location global --data-location unitedstates

    # Create Azure Domain Email
    az communication email domain create --domain-name AzureManagedDomain --email-service-name $emailService \
    -g $resource_name --location global --domain-management AzureManaged

    # It's needed to go to portal an connect the Domain with the Communication Service
    read -p "Go to Azure Portal -> Communication Service -> Connect your email domains -> Connect Domain -> Selec all services created before... ENTER to continue"

    # Get Connection String to Communication Service
    commServiceConn=$(az communication list-key --name $commService --resource-group $resource_name --query "primaryConnectionString" -o tsv)

    content=$(< ".env")
    new_content=$(echo "$content" | sed -E "s|EMAILCONN=.*|EMAILCONN=$commServiceConn|")
    echo "$new_content" > ".env"
fi


# Create Function APP
functionAppName="detectNewCampanhas"
az functionapp create -g $resource_name --consumption-plan-location $location --runtime node --functions-version 4 --name $functionAppName --storage-account $blobStorageAccount

# Pass connection string to CosmosDB
cosmosConnStr=$(az cosmosdb keys list --name mycosmosbd1 --resource-group apibackend --type connection-strings --output json --query "connectionStrings[0].connectionString" -o tsv)

az functionapp config appsettings set --name $functionAppName -g $resource_name \
 --settings COSMOS_HOST=https://$cosmos_name.documents.azure.com:443/ \
 COSMOS_KEY=$primaryKey EMAIL_CONN=$(az communication list-key --name $commService --resource-group $resource_name --query "primaryConnectionString" -o tsv) \
 SENDER_EMAIL=$(az communication email domain list --email-service-name $emailService -g $resource_name --query "[0].fromSenderDomain" -o tsv) \
 BLOB=$blobStorageAccount BLOB_KEY=$blobStorageAccountKey "${cosmos_name}_DOCUMENTDB"=$cosmosConnStr

# Publish Function APP Trigger
cd src/email/
func azure functionapp publish $functionAppName