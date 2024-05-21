param(
    [Parameter(HelpMessage="Criar Github Actions")]
    [switch]$github = $False,

    [Parameter(HelpMessage="Criar variáveis de ambiente")]
    [switch]$createVars = $False,

    [Parameter(HelpMessage="Gerar email e serviço de comunicação")]
    [switch]$genEmail = $False
)

$resource_name="apibackend"
$apim_name="sanguesolidario"
$apim_id="apisanguesolidario"
$location="uksouth"
$email="tiagomartins1@ipcbcampus.pt"
$organization="SangueSolidario"
$webapp="webapp-sanguesolidario"

# Criar grupo de recursos
if ((az group exists --name $resource_name) -eq $false) {
    echo "A criar o grupo de recursos $resource_name"
    az group create --location $location --name $resource_name
}

echo "Á espera que o grupo de recursos seja criado"
az group wait --exists --resource-group $resource_name

# Se der erro o $LASTEXITCODE não será 0
az apim show --name $apim_name --resource-group $resource_name

# Criar API Management
if ($LASTEXITCODE -ne 0) {
    # Elimina APIM caso tenha sido soft-deleted no passado
    az apim deletedservice purge --location $location --service-name $apim_name

    echo "A criar o API Management $apim_name"
    az apim create --name $apim_name --resource-group $resource_name --location $location --publisher-email $email --publisher-name $organization
}

echo "Á espera que o API Management seja criado"
az apim wait --exists --resource-group $resource_name --name $apim_name

$servico_app="servicoweb-sanguesolidario"

# Se der erro o $LASTEXITCODE não será 0
az webapp show --name $servico_app --resource-group $resource_name

# Criar API Service
if ($LASTEXITCODE -ne 0) {
    echo "A criar o App Service $servico_app"
    az appservice plan create --name $servico_app --resource-group $resource_name --sku B1 --is-linux
}

# Se der erro o $LASTEXITCODE não será 0
az webapp show --name $webapp --resource-group $resource_name

# Criar WebApp
if ($LASTEXITCODE -ne 0) {
    echo "A criar o WebApp $webapp"
    az webapp create --name $webapp --resource-group $resource_name --plan $servico_app --runtime "NODE:20-lts"
}

# Configurar Github Actions
if ($github) {
    # Esperar 30 segundos pela webapp
    echo "A dormir por 30 segundos"
    Start-Sleep -Seconds 30
    $github_repo="ttiagojm/SangueSolidario-Backend"
    az webapp deployment github-actions add --repo $github_repo -g $resource_name -n $webapp -b main --login-with-github
} else {
    echo "Adicionar Github Actions ignorado"
}

# Verificar se a webapp está ON
$app_service_url="https://${webapp}.azurewebsites.net"
$openapi_url="${app_service_url}/api/swagger.json"

# Esperar 30 segundos
echo "A dormir por 30 segundos"
Start-Sleep -Seconds 30

# Atribuir AppService à API openAPI
$api_name="sanguesolidarioapi"
az apim api import `
    --api-id $api_name `
    --resource-group $resource_name `
    --service-name $apim_name `
    --service-url $app_service_url `
    --path "/api" `
    --specification-format "OpenApi" `
    --specification-url "$openapi_url" `
    --display-name $api_name `
    --api-type "http" `
    --protocols "https" `
    --subscription-required false

$cosmos_name="mycosmosbd1"
$db_name="Sangue"

az cosmosdb create --name $cosmos_name --resource-group $resource_name --kind GlobalDocumentDB

az cosmosdb sql database create --account-name $cosmos_name --resource-group $resource_name --name $db_name

az cosmosdb sql container create --account-name $cosmos_name --database-name $db_name --resource-group $resource_name --name campanhasContainer --partition-key-path /Nome

az cosmosdb sql container create --account-name $cosmos_name --database-name $db_name --resource-group $resource_name --name doadoresContainer --partition-key-path /email -u '{""uniqueKeys"": [{""paths"": [""/email""]}]}'

az cosmosdb sql container create --account-name $cosmos_name --database-name $db_name --resource-group $resource_name --name familiaresContainer --partition-key-path /email_doador

# Obter a chave primária
$primaryKey = az cosmosdb keys list --name $cosmos_name --resource-group $resource_name --type keys --output json --query primaryMasterKey -o tsv

# Obter .env e trocar o valor da KEY pela nova KEY criada
$content = Get-Content ".env"
$new_content = $content -replace 'COSMOSKEY=.*', "COSMOSKEY=$primaryKey"
$new_content = $new_content -replace 'DB=.*', "DB=$db_name"
$new_content | Set-Content ".env"

# Criar Blob Storage Account
$blobStorageAccount = "myblobstorage20210941"
az storage account create --name $blobStorageAccount --location $location --resource-group $resource_name --sku Standard_LRS --kind StorageV2 --access-tier hot --allow-blob-public-access true

$blobStorageAccountKey = az storage account keys list -g $resource_name -n $blobStorageAccount --query "[0].value" -o tsv

az storage container create --name images --account-name $blobStorageAccount --account-key $blobStorageAccountKey

az webapp config appsettings set --name $webapp --resource-group $resource_name `
  --settings `
    "AzureStorageConfig__AccountName=$blobStorageAccount" `
    "AzureStorageConfig__ImageContainer=images" `
    "AzureStorageConfig__AccountKey=$blobStorageAccountKey"

# Reiniciar webapp para garantir que as variáveis ficam definidas
az webapp restart --name $webapp --resource-group $resource_name

# Atualizar valores .env com novas informações dos recursos do Azure
$content = Get-Content ".env"
$new_content = $content -replace 'COSMOSKEY=.*', "COSMOSKEY=$primaryKey"
$new_content = $new_content -replace 'DB=.*', "DB=$db_name"
$new_content = $new_content -replace 'BLOB_KEY=.*', "BLOB_KEY=$blobStorageAccountKey"
$new_content = $new_content -replace 'BLOB=.*', "BLOB=$blobStorageAccount"
$new_content | Set-Content ".env"

# Set KEY=VALUE do .env nas variáveis de ambiente da webapp
if ($createVars) {
    echo "A criar variáveis de ambiente"
    Get-Content ".env" | ForEach-Object {
        $pair = $_ -split "="
        $settingName = $pair[0].Trim()
        $settingValue = $pair[1].Trim()
        az webapp config appsettings set --name $webapp --resource-group $resource_name --settings "$settingName=$settingValue"
    }
}

# Criar Communication Service e Email Service se $genEmail for true
$commService="comm20210941"
$emailService="emailService20210941"

if ($genEmail) {
    # Criar serviço de comunicação
    az communication create --data-location unitedstates --name $commService -g $resource_name --location global

    # Criar serviço de email
    az communication email create -n $emailService -g $resource_name --location global --data-location unitedstates

    # Criar domínio de email Azure
    az communication email domain create --domain-name AzureManagedDomain --email-service-name $emailService -g $resource_name --location global --domain-management AzureManaged

    # É necessário ir ao portal e conectar o domínio ao serviço de comunicação
    Read-Host -Prompt "Ir ao Portal Azure -> Communication Service -> Connect your email domains -> Connect Domain -> Selecionar todos os serviços criados... Pressione ENTER para continuar"

    # Obter string de conexão para o serviço de comunicação
    $commServiceConn = az communication list-key --name $commService --resource-group $resource_name --query "primaryConnectionString" -o tsv

    $content = Get-Content ".env"
    $new_content = $content -replace 'EMAILCONN=.*', "EMAILCONN=$commServiceConn"
    $new_content | Set-Content ".env"
}

# Criar Function App
$functionAppName="detectNewCampanhas"
az functionapp create -g $resource_name --consumption-plan-location $location --runtime node --functions-version 4 --name $functionAppName --storage-account $blobStorageAccount

# Passar a string de conexão para o CosmosDB
$cosmosConnStr = az cosmosdb keys list --name mycosmosbd1 --resource-group apibackend --type connection-strings --output json --query "connectionStrings[0].connectionString" -o tsv
$domainEmail = az communication email domain list --email-service-name $emailService -g $resource_name --query '[0].fromSenderDomain' -o tsv

az functionapp config appsettings set --name $functionAppName -g $resource_name `
 --settings `
 "COSMOS_HOST=https://$cosmos_name.documents.azure.com:443/" `
 "COSMOS_KEY=$primaryKey" `
 "EMAIL_CONN=$(az communication list-key --name $commService --resource-group $resource_name --query 'primaryConnectionString' -o tsv)" `
 "SENDER_EMAIL=DoNotReply@$domainEmail"`
 "BLOB=$blobStorageAccount" `
 "BLOB_KEY=$blobStorageAccountKey" `
 "${cosmos_name}_DOCUMENTDB=$cosmosConnStr" `
 "DB_ID=$db_name" `
 "DOADORES_ID=doadoresContainer"

# Publish Function APP Trigger
cd src/email/
func azure functionapp publish $functionAppName