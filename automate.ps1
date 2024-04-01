# Flag (-github) para definir se quere-se conectar, pele primeir vez, ao Github Actions
param(
    [Parameter(HelpMessage="Criar Github Actions")]
    [switch]$github = $False,

    [Parameter(HelpMessage="Criar variáveis de ambiente")]
    [switch]$createVars = $False
)
$resource_name="apibackend"
$apim_name="sanguesolidario"
$apim_id="apisanguesolidario"
$location="uksouth"
$email="tiagomartins1@ipcbcampus.pt"
$organization="SangueSolidario"
$webapp="webapp-sanguesolidario"

# Criar grupo de recursos
if( (az group exists --name $resource_name) -eq $false){
    echo "A criar o grupo de recursos $resource_name"
    az group create --location $location --name $resource_name
}

echo "Á espera que o grupo de recursos seja criado"
az group wait --exists --resource-group $resource_name

# Se der erro o $LASTEXITCODE não será 0
az apim show --name $apim_name --resource-group $resource_name

# Criar API Management
if($LASTEXITCODE -ne 0){
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
if($LASTEXITCODE -ne 0){
    echo "A criar o App Service $servico_app"
    az appservice plan create --name $servico_app --resource-group $resource_name --sku B1 --is-linux
}

# Se der erro o $LASTEXITCODE não será 0
az webapp show --name $webapp --resource-group $resource_name

# Criar WebApp
if($LASTEXITCODE -ne 0){
    echo "A criar o WebApp $webapp"
    az webapp create --name $webapp --resource-group $resource_name --plan $servico_app --runtime "NODE:20-lts"
}

# Configurar Github Actions
if($github){
    # Esperar 30 segundos pela webapp
    echo "A dormir por 30 segundos"
    Start-Sleep -Milliseconds 30000
    $github_repo="SangueSolidario/SangueSolidario-Backend"
    az webapp deployment github-actions add --repo $github_repo -g $resource_name -n $webapp -b main --login-with-github
} else{
    echo "Adicionar Github Actions ignorado"
}

# Verificar se a webapp está ON
$app_service_url="https://${webapp}.azurewebsites.net"
$openapi_url="${app_service_url}/api/swagger.json"

# Esperar 30 segundos
echo "A dormir por 30 segundos"
Start-Sleep -Milliseconds 30000

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
$new_content = $content -replace 'KEY=.*', "KEY=$primaryKey"
$new_content = $new_content -replace 'DB=.*', "DB=$db_name"
$new_content | Set-Content ".env"

# Set KEY=VALUE do .env nas variáveis de ambiente da webapp
if($createVars){
    echo "A criar variáveis de ambiente"
    Get-Content .env | ForEach-Object {
        $pair = $_ -split "="
        $settingName = $pair[0].Trim()
        $settingValue = $pair[1].Trim()
        az webapp config appsettings set --name $webapp --resource-group $resource_name --settings "$settingName=$settingValue"
    }
}
# Reinicar webapp para garantir que as variáveis ficam definidas
az webapp restart --name $webapp --resource-group $resource_name