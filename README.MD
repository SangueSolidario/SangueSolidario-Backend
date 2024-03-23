# SangueSolidario
Repositório que contém toda a lógica do webapp "SangueSolidario".

# Deploy
* Todo o processo de deploy foi automatizado utilizando o script Powershell `automate.ps1`.

* Se é for a primeira vez a fazer o deploy ou caso tenha eliminado o grupo de recursos anterior é importante passar a flag `-github` quando for executar o script.

* Para executar o script fazendo bypass da política de execução do Windows, pode utilizar: `powershell -ExecutionPolicy Bypass -File automate.ps1 -github -createVars`

# URLs
Após a execução dos script, estes URLs estarão disponíveis:
* [Swagger](https://webapp-sanguesolidario.azurewebsites.net/api-docs/ ) - UI do Swagger com todas as rotas, tendo sido gerado apenas para fins de automatização da importação da API para o API Management do Azure
* [URL da API](https://sanguesolidario.azure-api.net/api/) - URL a ser utilizado para as requisições da API