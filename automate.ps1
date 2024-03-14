$do_github=$args[0]
$resource_name="apibackend"
$apim_name="apimbackend"
$apim_id="apisanguesolidario"
$location="uksouth"
$email="tiagomartins1@ipcbcampus.pt"
$organization="SangueSolidario"

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

    echo "A criar o API Manegement $apim_name"
    az apim create --name $apim_name --resource-group $resource_name --location $location --publisher-email $email --publisher-name $organization
}

echo "Á espera que o API Manegement seja criado"
az apim wait --exists --resource-group $resource_name --name $apim_name


$servico_app="servicoweb-sanguesolidario"

# Se der erro o $LASTEXITCODE não será 0
az webapp show --name $servico_app --resource-group $resource_name

# Criar API Service
if($LASTEXITCODE -ne 0){
    echo "A criar o App Service $servico_app"
    az appservice plan create --name $servico_app --resource-group $resource_name --sku B1 --is-linux
}

$webapp="webapp-sanguesolidario"

# Se der erro o $LASTEXITCODE não será 0
az webapp show --name $webapp --resource-group $resource_name

# Criar WebApp
if($LASTEXITCODE -ne 0){
    echo "A criar o WebApp $webapp"
    az webapp create --name $webapp --resource-group $resource_name --plan $servico_app --runtime "NODE:20-lts"
}

# Configurar Github Actions
if($do_github){
    $github_repo="ttiagojm/SangueSolidarioBack"
    az webapp deployment github-actions add --repo $github_repo -g $resource_name -n $webapp -b main --login-with-github
} else{
    echo "Adicionar Github Actions ignorado"
}

# Atribuir AppService à API openAPI
$api_name="sanguesolidarioapi"
$app_service_url="https://${webapp}.azurewebsites.net"
$openapi_url="${app_service_url}/api"
az apim api import --api-id $api_name -g $resource_name --display-name $api_name --path "/api" -n $apim_name --specification-format Swagger --specification-url $openapi_url